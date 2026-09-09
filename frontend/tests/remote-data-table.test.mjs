import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteDataTableUrl,
  parseRemoteDataTableResponse,
} from "../src/lib/client/remote-data-table.ts";

test("remote tables build their own relative BFF query with numeric pagination", () => {
  assert.equal(
    buildRemoteDataTableUrl(
      "/api/clinics/clinic-id/members",
      {
        search: "Ana Silva",
        roleId: "11111111-1111-4111-8111-111111111111",
        isActive: true,
        ignored: undefined,
      },
      2,
      20,
    ),
    "/api/clinics/clinic-id/members?page=2&perPage=20&isActive=true&roleId=11111111-1111-4111-8111-111111111111&search=Ana+Silva",
  );

  assert.throws(
    () => buildRemoteDataTableUrl("https://backend.test/members", {}, 1, 20),
    /relative BFF route/,
  );
});

test("remote tables consume numeric Lucid metadata without depending on paginator URLs", () => {
  const parsed = parseRemoteDataTableResponse({
    data: [{ id: "member-id" }],
    meta: {
      total: 21,
      perPage: 20,
      currentPage: 2,
      lastPage: 2,
      nextPageUrl: "https://backend.invalid/private-url",
      previousPageUrl: "https://backend.invalid/private-url",
    },
  });

  assert.deepEqual(parsed, {
    data: [{ id: "member-id" }],
    meta: {
      total: 21,
      perPage: 20,
      currentPage: 2,
      lastPage: 2,
      nextPageUrl: "https://backend.invalid/private-url",
      previousPageUrl: "https://backend.invalid/private-url",
    },
  });

  assert.equal(
    parseRemoteDataTableResponse({
      data: [],
      meta: { total: 0, currentPage: 1, lastPage: 1 },
    }),
    null,
  );
});
