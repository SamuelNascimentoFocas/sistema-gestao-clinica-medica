import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseGlobalClinicCreatePayload,
  parseGlobalClinicResponse,
  parseGlobalClinicsQuery,
  parseGlobalClinicsResponse,
  parseGlobalClinicUpdatePayload,
  parseGlobalStatusPayload,
  parseGlobalUserInvitationPayload,
  parseGlobalUserResponse,
  parseGlobalUsersQuery,
  parseGlobalUsersResponse,
  parseGlobalUserStatusResponse,
  parseGlobalUserUpdatePayload,
} from "../src/lib/admin/global-admin-contract.ts";

const clinicId = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const onboardingUser = {
  id: userId,
  fullName: "Ana Silva",
  email: "ana@example.com",
  isGlobalAdmin: false,
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
  passwordConfigured: false,
  invitationStatus: "sent",
  invitationSentAt: "2026-09-10T00:00:00.000Z",
  invitationExpiresAt: "2026-09-11T00:00:00.000Z",
};

const clinic = {
  id: clinicId,
  name: "Clínica Central",
  cnpj: null,
  phone: null,
  addressStreet: null,
  addressNumber: null,
  addressComplement: null,
  addressNeighborhood: null,
  addressCity: null,
  addressState: null,
  addressPostalCode: null,
  isActive: true,
  timezone: "America/Sao_Paulo",
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

const meta = { total: 1, perPage: 20, currentPage: 1, lastPage: 1 };

test("global list queries preserve supported pagination and filters only", () => {
  const users = parseGlobalUsersQuery(
    new URLSearchParams({
      page: "2",
      perPage: "40",
      search: " Ana ",
      isActive: "false",
      isGlobalAdmin: "true",
    }),
  );
  assert.equal(users.ok, true);
  assert.equal(
    users.ok ? users.value.toString() : "",
    "page=2&perPage=40&search=Ana&isActive=false&isGlobalAdmin=true",
  );

  const clinics = parseGlobalClinicsQuery(
    new URLSearchParams({ page: "3", perPage: "10", isActive: "false" }),
  );
  assert.equal(clinics.ok, true);
  assert.equal(
    clinics.ok ? clinics.value.toString() : "",
    "page=3&perPage=10&isActive=false",
  );
  assert.equal(parseGlobalUsersQuery(new URLSearchParams("page=0")).ok, false);
  assert.equal(
    parseGlobalUsersQuery(new URLSearchParams("page=1&page=2")).ok,
    false,
  );
  assert.equal(
    parseGlobalClinicsQuery(new URLSearchParams("unknown=value")).ok,
    false,
  );
});

test("global invitation accepts only clinicId and roleId memberships without privilege inputs", () => {
  assert.deepEqual(
    parseGlobalUserInvitationPayload({
      fullName: "  Ana Silva  ",
      email: " ana@example.com ",
      memberships: [{ clinicId, roleId }],
    }),
    {
      ok: true,
      value: {
        fullName: "Ana Silva",
        email: "ana@example.com",
        memberships: [{ clinicId, roleId }],
      },
    },
  );

  for (const forbidden of [
    { password: "administrative-secret" },
    { passwordConfirmation: "administrative-secret" },
    { passwordHash: "hash" },
    { isGlobalAdmin: true },
    { roleCode: "clinic_admin" },
    { roleName: "Administrador" },
  ]) {
    assert.equal(
      parseGlobalUserInvitationPayload({
        fullName: "Ana Silva",
        email: "ana@example.com",
        ...forbidden,
      }).ok,
      false,
    );
  }

  assert.equal(
    parseGlobalUserInvitationPayload({
      fullName: "Ana Silva",
      email: "ana@example.com",
      memberships: [{ clinicId, roleId, roleCode: "clinic_admin" }],
    }).ok,
    false,
  );
});

test("global user update and status use narrow independent contracts", () => {
  assert.deepEqual(parseGlobalUserUpdatePayload({ fullName: "  Ana Souza  " }), {
    ok: true,
    value: { fullName: "Ana Souza" },
  });
  assert.deepEqual(parseGlobalStatusPayload({ isActive: false }), {
    ok: true,
    value: { isActive: false },
  });
  for (const forbidden of [
    { password: "secret" },
    { passwordConfirmation: "secret" },
    { passwordHash: "hash" },
    { isGlobalAdmin: true },
  ]) {
    assert.equal(parseGlobalUserUpdatePayload(forbidden).ok, false);
  }
  assert.equal(parseGlobalStatusPayload({ isActive: false, extra: true }).ok, false);
});

test("clinic create, update and status contracts forward only backend-supported fields", () => {
  assert.deepEqual(
    parseGlobalClinicCreatePayload({
      name: "  Clínica Central  ",
      cnpj: "12345678901234",
      addressState: "sp",
    }),
    {
      ok: true,
      value: {
        name: "Clínica Central",
        cnpj: "12345678901234",
        addressState: "SP",
      },
    },
  );
  assert.deepEqual(parseGlobalClinicUpdatePayload({ phone: null }), {
    ok: true,
    value: { phone: null },
  });
  assert.equal(parseGlobalClinicCreatePayload({ phone: "123" }).ok, false);
  assert.equal(parseGlobalClinicUpdatePayload({ isActive: false }).ok, false);
  assert.equal(parseGlobalClinicUpdatePayload({}).ok, false);
});

test("global response parsers expose only safe user, onboarding, clinic and pagination data", () => {
  assert.deepEqual(parseGlobalUsersResponse({ data: [onboardingUser], meta }), {
    data: [onboardingUser],
    meta,
  });
  assert.deepEqual(parseGlobalUserResponse({ user: onboardingUser }), {
    user: onboardingUser,
  });
  assert.deepEqual(
    parseGlobalUserStatusResponse({
      user: {
        id: userId,
        fullName: "Ana Silva",
        email: "ana@example.com",
        isGlobalAdmin: false,
        isActive: false,
        lastLoginAt: null,
        createdAt: onboardingUser.createdAt,
        updatedAt: onboardingUser.updatedAt,
      },
    })?.user.isActive,
    false,
  );
  assert.deepEqual(parseGlobalClinicsResponse({ data: [clinic], meta }), {
    data: [clinic],
    meta,
  });
  assert.deepEqual(parseGlobalClinicResponse({ clinic }), { clinic });

  for (const secret of [
    { password: "secret" },
    { passwordHash: "hash" },
    { token: "raw" },
    { tokenDigest: "digest" },
    { accessToken: "access" },
  ]) {
    assert.equal(
      parseGlobalUsersResponse({
        data: [{ ...onboardingUser, ...secret }],
        meta,
      }),
      null,
    );
    assert.equal(parseGlobalClinicsResponse({ data: [{ ...clinic, ...secret }], meta }), null);
  }
});

test("seven admin BFF routes cover the nine approved global operations", async () => {
  const paths = {
    users: "../src/app/api/admin/users/route.ts",
    user: "../src/app/api/admin/users/[userId]/route.ts",
    userStatus: "../src/app/api/admin/users/[userId]/status/route.ts",
    resend: "../src/app/api/admin/users/[userId]/invitations/resend/route.ts",
    clinics: "../src/app/api/admin/clinics/route.ts",
    clinic: "../src/app/api/admin/clinics/[clinicId]/route.ts",
    clinicStatus: "../src/app/api/admin/clinics/[clinicId]/status/route.ts",
  };
  const source = Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, path]) => [
        key,
        await readFile(new URL(path, import.meta.url), "utf8"),
      ]),
    ),
  );

  assert.match(source.users, /export async function GET/);
  assert.match(source.users, /export async function POST/);
  assert.match(source.users, /\/api\/v1\/users\?/);
  assert.match(source.users, /\/api\/v1\/users\/invitations/);
  assert.match(source.user, /export async function PATCH/);
  assert.match(source.userStatus, /\/status/);
  assert.match(source.resend, /\/invitations\/resend/);
  assert.match(source.clinics, /export async function GET/);
  assert.match(source.clinics, /export async function POST/);
  assert.match(source.clinic, /export async function PATCH/);
  assert.match(source.clinicStatus, /\/status/);

  for (const [key, text] of Object.entries(source)) {
    assert.doesNotMatch(text, /BACKEND_API_URL|Authorization.*Bearer/);
    assert.doesNotMatch(text, /role\.(?:name|code)|clinic_admin/);
    if (!["users", "clinics"].includes(key)) assert.match(text, /isUuid/);
  }
});

test("all global mutations enforce same-origin checks and backend remains final authority", async () => {
  const routePaths = [
    "../src/app/api/admin/users/route.ts",
    "../src/app/api/admin/users/[userId]/route.ts",
    "../src/app/api/admin/users/[userId]/status/route.ts",
    "../src/app/api/admin/users/[userId]/invitations/resend/route.ts",
    "../src/app/api/admin/clinics/route.ts",
    "../src/app/api/admin/clinics/[clinicId]/route.ts",
    "../src/app/api/admin/clinics/[clinicId]/status/route.ts",
  ];
  const routes = await Promise.all(
    routePaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const backend = await readFile(
    new URL("../src/lib/server/global-admin-backend.ts", import.meta.url),
    "utf8",
  );

  for (const route of routes) {
    assert.match(route, /authenticated(?:Invitation)?BackendJson|globalAdminBackendJson/);
    if (/export async function (?:POST|PATCH)/.test(route)) {
      assert.match(route, /rejectUntrustedMutation/);
    }
    assert.doesNotMatch(route, /isGlobalAdmin\s*===|roleCode|roleName/);
  }
  assert.match(backend, /authenticatedBackendJson/);
  assert.match(backend, /status: response\.status/);
  assert.match(backend, /case 403/);
  assert.doesNotMatch(backend, /isGlobalAdmin|membership|role\.(?:name|code)/);
});

test("assignable role discovery is reused and no global-admin promotion primitive is introduced", async () => {
  const assignable = await readFile(
    new URL(
      "../src/app/api/clinics/[clinicId]/roles/assignable/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const users = await readFile(
    new URL("../src/app/api/admin/users/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(assignable, /\/roles\/assignable/);
  assert.match(assignable, /authenticatedBackendJson/);
  assert.doesNotMatch(users, /promote|demote|global-admins|isGlobalAdmin/);
});
