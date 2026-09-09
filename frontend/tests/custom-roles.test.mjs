import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  customRoleInputToPayload,
  parseClinicRolePermissionsResponse,
  parseClinicRoleResponse,
  parseClinicRolesResponse,
  parseCustomRolePayload,
  parseRoleIdPayload,
  parseRoleStatusPayload,
  rolesForMembershipSelect,
} from "../src/lib/administration/role-contract.ts";

const systemRole = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "fixture-system",
  name: "Perfil do sistema",
  description: "Somente leitura",
  clinicId: null,
  isSystem: true,
  isActive: true,
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
  permissions: [],
};
const permission = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "patients.read",
  description: "Consultar pacientes",
  isActive: true,
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
};
const customRole = {
  ...systemRole,
  id: "33333333-3333-4333-8333-333333333333",
  code: "custom_fixture",
  name: "Apoio clínico",
  clinicId: "44444444-4444-4444-8444-444444444444",
  isSystem: false,
  permissions: [permission],
};

test("role contracts parse system, custom and permission catalogs without role-code assumptions", () => {
  assert.deepEqual(parseClinicRolesResponse({ data: [systemRole, customRole] }), [
    systemRole,
    customRole,
  ]);
  assert.deepEqual(parseClinicRoleResponse({ role: customRole }), customRole);
  assert.deepEqual(parseClinicRolePermissionsResponse({ data: [permission] }), [permission]);
  assert.equal(parseClinicRolesResponse({ data: [{ ...customRole, clinicId: "invalid" }] }), null);
  assert.equal(parseClinicRolesResponse({ data: [{ ...systemRole, clinicId: customRole.clinicId }] }), null);
  assert.equal(parseClinicRolesResponse({ data: [{ ...customRole, clinicId: null }] }), null);
});

test("custom-role payloads forward only mutable fields and status stays independent", () => {
  const input = {
    name: "  Apoio clínico  ",
    description: "  Contexto local  ",
    permissionCodes: [permission.code],
    code: "client-code",
    clinicId: systemRole.id,
    isSystem: true,
    isGlobalAdmin: true,
  };
  assert.deepEqual(parseCustomRolePayload(input), {
    ok: true,
    value: {
      name: "Apoio clínico",
      description: "Contexto local",
      permissionCodes: [permission.code],
    },
  });
  assert.deepEqual(
    customRoleInputToPayload({
      name: input.name,
      description: "   ",
      permissionCodes: input.permissionCodes,
    }),
    { name: "Apoio clínico", description: null, permissionCodes: [permission.code] },
  );
  assert.deepEqual(parseRoleStatusPayload({ isActive: false, permissionCodes: ["ignored"] }), {
    ok: true,
    value: { isActive: false },
  });
});

test("membership writes accept roleId only and preserve unavailable current roles for display", () => {
  assert.deepEqual(parseRoleIdPayload({ roleId: customRole.id }), {
    ok: true,
    value: { roleId: customRole.id },
  });
  assert.equal(parseRoleIdPayload({ roleCode: "fixture-system" }).ok, false);
  assert.equal(
    parseRoleIdPayload({ roleId: customRole.id, roleCode: "fixture-system" }).ok,
    false,
  );
  assert.deepEqual(rolesForMembershipSelect([systemRole], customRole), [customRole, systemRole]);
  assert.deepEqual(rolesForMembershipSelect([systemRole, customRole], customRole), [
    systemRole,
    customRole,
  ]);
});

test("role BFF routes preserve backend topology and mutation boundaries", async () => {
  const files = {
    collection: "../src/app/api/clinics/[clinicId]/roles/route.ts",
    assignable: "../src/app/api/clinics/[clinicId]/roles/assignable/route.ts",
    permissions: "../src/app/api/clinics/[clinicId]/roles/permissions/route.ts",
    resource: "../src/app/api/clinics/[clinicId]/roles/[roleId]/route.ts",
    status: "../src/app/api/clinics/[clinicId]/roles/[roleId]/status/route.ts",
  };
  const source = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, path]) => [key, await readFile(new URL(path, import.meta.url), "utf8")]),
    ),
  );

  assert.match(source.collection, /authenticatedBackendJson[\s\S]*\/roles/);
  assert.match(source.collection, /rejectUntrustedMutation/);
  assert.match(source.assignable, /\/roles\/assignable/);
  assert.match(source.permissions, /\/roles\/permissions/);
  assert.match(source.resource, /method: "PATCH"/);
  assert.match(source.status, /parseRoleStatusPayload/);
  assert.match(source.status, /method: "PATCH"/);
  for (const text of Object.values(source)) assert.match(text, /isUuid\(clinicId\)/);
  for (const text of Object.values(source)) assert.doesNotMatch(text, /Authorization.*Bearer/);
});

test("membership BFF and UI use roleId without a legacy write path", async () => {
  const files = [
    "../src/app/api/clinics/[clinicId]/members/route.ts",
    "../src/app/api/clinics/[clinicId]/members/[membershipId]/role/route.ts",
    "../src/components/administration/clinic-members-manager.tsx",
  ];
  const source = await Promise.all(
    files.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.match(source[0], /parseRoleIdPayload/);
  assert.match(source[1], /parseRoleIdPayload/);
  assert.match(source[2], /roleId/);
  for (const text of source) assert.doesNotMatch(text, /JSON\.stringify\(\{\s*roleCode/);
  assert.doesNotMatch(source[2], /CLINIC_MEMBER_ROLES|role\.code\s*===/);
});

test("administration uses permission visibility while system flags only control resource mutability", async () => {
  const manager = await readFile(
    new URL("../src/components/administration/clinic-roles-manager.tsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../src/app/(authenticated)/clinics/[clinicId]/administration/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /roles\.manage/);
  assert.match(manager, /!role\.isSystem/);
  assert.doesNotMatch(manager, /role\.(?:name|code)\s*===/);
  assert.doesNotMatch(page, /clinic_admin|receptionist|doctor/);
});

test("professional account candidates depend on active clinic links rather than role identity", async () => {
  const page = await readFile(
    new URL(
      "../src/app/(authenticated)/clinics/[clinicId]/professionals/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const form = await readFile(
    new URL(
      "../src/components/professionals/create-professional-card.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /membership\.isActive/);
  assert.match(page, /membership\.role\.isActive/);
  assert.match(page, /membership\.user\.isActive/);
  assert.doesNotMatch(page, /role\.(?:code|name)/);
  assert.doesNotMatch(page, /roleCode|clinic_admin|receptionist|doctor/i);
  assert.match(form, /permissões continuam determinadas pelo perfil de acesso/i);
  assert.doesNotMatch(form, /vínculo médico|contas médicas/i);
});
