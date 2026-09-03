import assert from "node:assert/strict";
import test from "node:test";
import { isAxiosError, isCancel } from "axios";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "../src/lib/client/browser-api.ts";

// Supply the browser's relative URL resolution without starting a server.
class BrowserRequest extends Request {
  constructor(input, init) {
    super(
      typeof input === "string" ? new URL(input, "https://clinic.test") : input,
      init,
    );
  }
}

function environment(fetch) {
  return { Request: BrowserRequest, Response, fetch };
}

test("JSON requests retain the same-origin BFF URL, method, body and headers", async () => {
  const payload = JSON.stringify({
    email: "fixture@example.test",
    password: "synthetic",
  });
  const response = await browserApi.request({
    url: "/api/auth/login",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    data: payload,
    env: environment(async (request) => {
      assert.equal(request.url, "https://clinic.test/api/auth/login");
      assert.equal(request.method, "POST");
      assert.equal(request.credentials, "same-origin");
      assert.equal(request.headers.get("Content-Type"), "application/json");
      assert.equal(request.headers.get("Accept"), "application/json");
      assert.equal(request.headers.has("Authorization"), false);
      assert.equal(request.headers.has("X-XSRF-TOKEN"), false);
      assert.equal(request.headers.has("User-Agent"), false);
      assert.equal(await request.text(), payload);
      return Response.json({ user: { id: "fixture" } }, { status: 201 });
    }),
  });
  assert.equal(isSuccessfulResponse(response), true);
  assert.deepEqual(await readBrowserJson(response), {
    user: { id: "fixture" },
  });
  assert.equal(browserApi.defaults.withXSRFToken, false);
  assert.equal(browserApi.defaults.timeout, 0);
});

test("GET preserves the existing query string and no-store cache option", async () => {
  const url = "/api/clinics/fixture/patients?page=2&search=Ana+Silva%2B";
  await browserApi.request({
    url,
    method: "GET",
    fetchOptions: { cache: "no-store" },
    env: environment(async (request) => {
      assert.equal(request.url, `https://clinic.test${url}`);
      assert.equal(request.method, "GET");
      assert.equal(request.cache, "no-store");
      assert.equal(request.body, null);
      return Response.json({ data: [] });
    }),
  });
});

test("non-BFF URLs are rejected before any network request", async () => {
  const env = environment(() => assert.fail("Unexpected network request"));
  for (const url of [
    "https://backend.test/api/users",
    "//backend.test/api/users",
    "/login",
    "/api/../outside",
    "/api/\\outside",
  ]) {
    await assert.rejects(browserApi.get(url, { env }), /relative \/api\//);
  }
  await assert.rejects(
    browserApi.get("/api/users", { baseURL: "https://backend.test", env }),
    /relative \/api\//,
  );
});

test("HTTP error statuses and bodies remain available to the UI, unlike network failures", async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 500]) {
    const body = {
      message: `Original message ${status}`,
      errors: [{ field: "name" }],
    };
    const response = await browserApi.get("/api/clinics", {
      env: environment(async () => Response.json(body, { status })),
    });
    assert.equal(response.status, status);
    assert.equal(isSuccessfulResponse(response), false);
    assert.deepEqual(await readBrowserJson(response), body);
  }
  await assert.rejects(
    browserApi.get("/api/clinics", {
      env: environment(async () => {
        throw new TypeError("Failed to fetch");
      }),
    }),
    (error) =>
      isAxiosError(error) && error.code === "ERR_NETWORK" && !error.response,
  );
});

test("empty or malformed JSON still requires the caller's existing fallback", async () => {
  for (const [body, status] of [
    [null, 204],
    ["not JSON", 200],
  ]) {
    const response = await browserApi.delete("/api/auth/logout", {
      env: environment(async () => new Response(body, { status })),
    });
    assert.equal(isSuccessfulResponse(response), true);
    await assert.rejects(readBrowserJson(response), SyntaxError);
    assert.equal(await readBrowserJson(response).catch(() => null), null);
  }
});

test("FormData keeps file fields and bytes with a runtime-generated multipart boundary", async () => {
  const data = new FormData();
  data.append(
    "files[]",
    new File(["synthetic PDF"], "anexo.pdf", { type: "application/pdf" }),
  );
  await browserApi.post(
    "/api/clinics/fixture/patients/fixture/medical-record/entries/fixture/attachments",
    data,
    {
      env: environment(async (request) => {
        assert.match(
          request.headers.get("Content-Type"),
          /^multipart\/form-data; boundary=.+/,
        );
        const received = await request.formData();
        assert.deepEqual([...received.keys()], ["files[]"]);
        const file = received.get("files[]");
        assert.equal(file.name, "anexo.pdf");
        assert.equal(file.type, "application/pdf");
        assert.equal(await file.text(), "synthetic PDF");
        return Response.json({ data: [] }, { status: 201 });
      }),
    },
  );
  assert.equal(browserApi.defaults.headers["Content-Type"], false);
});

test("downloads preserve binary bytes and filename headers; JSON errors also decode from blobs", async () => {
  const bytes = new Uint8Array([0, 255, 128, 13, 10]);
  const disposition = "attachment; filename*=UTF-8''exame%20cl%C3%ADnico.pdf";
  const response = await browserApi.post(
    "/api/attachments/fixture/download",
    JSON.stringify({ purposeCode: 1 }),
    {
      headers: { "Content-Type": "application/json" },
      responseType: "blob",
      env: environment(
        async () =>
          new Response(bytes, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": disposition,
            },
          }),
      ),
    },
  );
  assert.ok(response.data instanceof Blob);
  assert.equal(response.data.type, "application/pdf");
  assert.deepEqual(new Uint8Array(await response.data.arrayBuffer()), bytes);
  assert.equal(response.headers.get("content-disposition"), disposition);
  const error = await browserApi.post(
    "/api/attachments/fixture/download",
    null,
    {
      responseType: "blob",
      env: environment(async () =>
        Response.json({ message: "Acesso negado" }, { status: 403 }),
      ),
    },
  );
  assert.equal(error.status, 403);
  assert.deepEqual(await readBrowserJson(error), { message: "Acesso negado" });
});

test("native signal cancellation stays distinguishable from HTTP and network errors", async () => {
  const controller = new AbortController();
  await assert.rejects(
    browserApi.get("/api/clinics", {
      signal: controller.signal,
      env: environment(async (request) => {
        assert.equal(request.signal.aborted, false);
        controller.abort();
        assert.equal(request.signal.aborted, true);
        request.signal.throwIfAborted();
      }),
    }),
    (error) => isCancel(error) && error.code === "ERR_CANCELED",
  );
});
