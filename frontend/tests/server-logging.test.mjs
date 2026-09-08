import assert from "node:assert/strict";
import test from "node:test";
import {
  createSafeServerErrorLog,
  emitSafeServerError,
} from "../src/lib/server/safe-server-error.ts";

test("safe server error logs omit sensitive and application data", () => {
  const sensitiveValues = [
    "password-value",
    "password-hash-value",
    "token-value",
    "authorization-value",
    "cookie-value",
    "cpf-value",
    "clinical-content-value",
    "storage-key-value",
    "original-name-value",
  ];
  const error = {
    name: "AxiosError",
    code: "ECONNRESET",
    message: sensitiveValues.join(" "),
    password: sensitiveValues[0],
    passwordHash: sensitiveValues[1],
    token: sensitiveValues[2],
    authorization: sensitiveValues[3],
    cookie: sensitiveValues[4],
    cpf: sensitiveValues[5],
    content: sensitiveValues[6],
    storageKey: sensitiveValues[7],
    originalName: sensitiveValues[8],
    request: { headers: { authorization: sensitiveValues[3] } },
    response: { body: sensitiveValues[6] },
    cause: {
      code: "UND_ERR_CONNECT_TIMEOUT",
      token: sensitiveValues[2],
    },
  };

  const entry = createSafeServerErrorLog("bff.backend_request_failed", error);

  assert.deepEqual(entry, {
    event: "bff.backend_request_failed",
    errorName: "AxiosError",
    errorCode: "ECONNRESET",
    causeCode: "UND_ERR_CONNECT_TIMEOUT",
  });

  const serializedEntry = JSON.stringify(entry);

  for (const sensitiveValue of sensitiveValues) {
    assert.equal(serializedEntry.includes(sensitiveValue), false);
  }
});

test("ordinary errors expose only their technical name", () => {
  const entry = createSafeServerErrorLog(
    "bff.session_validation_failed",
    new TypeError("response included private data"),
  );

  assert.deepEqual(entry, {
    event: "bff.session_validation_failed",
    errorName: "TypeError",
  });
});

test("unknown strings and non-technical codes do not become log details", () => {
  assert.deepEqual(
    createSafeServerErrorLog("bff.unknown_failure", "token-value"),
    { event: "bff.unknown_failure" },
  );
  assert.deepEqual(
    createSafeServerErrorLog("bff.invalid_code", {
      code: "token-value",
      cause: { code: "cookie-value" },
    }),
    { event: "bff.invalid_code" },
  );
});

test("safe server error emission does not throw", () => {
  const entries = [];

  assert.doesNotThrow(() => {
    emitSafeServerError("bff.write_failure", new Error("private"), (entry) => {
      entries.push(entry);
    });
  });
  assert.deepEqual(entries, [
    {
      event: "bff.write_failure",
      errorName: "Error",
    },
  ]);

  assert.doesNotThrow(() => {
    emitSafeServerError("bff.logger_failure", new Error("private"), () => {
      throw new Error("logger unavailable");
    });
  });

  const inaccessibleError = new Proxy(
    {},
    {
      get() {
        throw new Error("property access denied");
      },
    },
  );

  assert.doesNotThrow(() => {
    emitSafeServerError("bff.inaccessible_error", inaccessibleError, () => {});
  });
});
