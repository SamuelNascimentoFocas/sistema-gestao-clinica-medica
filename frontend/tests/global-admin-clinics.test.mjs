import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EMPTY_GLOBAL_CLINIC_FORM,
  globalClinicFormSchema,
  globalClinicPayload,
} from "../src/lib/admin/global-admin-clinic-schemas.ts";
import {
  authenticatedDestination,
  loginResponseDestination,
} from "../src/lib/auth/authenticated-destination.ts";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("global clinic form validates only the backend-supported fields", () => {
  const parsed = globalClinicFormSchema.safeParse({
    ...EMPTY_GLOBAL_CLINIC_FORM,
    name: "Clínica Central",
    cnpj: "12345678901234",
    addressState: "sp",
    addressPostalCode: "12345678",
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(
    parsed.success ? globalClinicPayload(parsed.data) : null,
    {
      name: "Clínica Central",
      cnpj: "12345678901234",
      phone: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: "SP",
      addressPostalCode: "12345678",
    },
  );

  for (const value of [
    { ...EMPTY_GLOBAL_CLINIC_FORM, name: "A" },
    { ...EMPTY_GLOBAL_CLINIC_FORM, name: "Clínica", cnpj: "123" },
    { ...EMPTY_GLOBAL_CLINIC_FORM, name: "Clínica", addressPostalCode: "123" },
    { ...EMPTY_GLOBAL_CLINIC_FORM, name: "Clínica", unknown: true },
  ]) {
    assert.equal(globalClinicFormSchema.safeParse(value).success, false);
  }
});

test("global clinics manager uses RemoteDataTable and server-side filters", async () => {
  const manager = await source(
    "../src/components/admin/global-clinics-manager.tsx",
  );

  assert.match(manager, /<RemoteDataTable/);
  assert.match(manager, /route="\/api\/admin\/clinics"/);
  assert.match(manager, /parseResponse=\{parseGlobalClinicsResponse\}/);
  assert.match(manager, /search: appliedSearch/);
  assert.match(manager, /isActive:/);
  assert.match(manager, /page=\{page\}/);
  assert.doesNotMatch(manager, /filter\(.*clinic|BACKEND_API_URL|\/api\/v1\//);
});

test("clinic create, edit and status actions stay on the approved global BFFs", async () => {
  const manager = await source(
    "../src/components/admin/global-clinics-manager.tsx",
  );
  const dialog = await source(
    "../src/components/admin/global-clinic-form-dialog.tsx",
  );

  assert.match(dialog, /useForm<GlobalClinicFormValues>/);
  assert.match(dialog, /zodResolver\(globalClinicFormSchema\)/);
  assert.match(dialog, /"\/api\/admin\/clinics"/);
  assert.match(dialog, /method: isEditing \? "PATCH" : "POST"/);
  assert.match(manager, /\/api\/admin\/clinics\//);
  assert.match(manager, /\/status/);
  assert.match(manager, /JSON\.stringify\(\{ isActive \}\)/);
  assert.doesNotMatch(dialog + manager, /delete|password|isGlobalAdmin|promote|demote/);
});

test("only active clinics expose the existing clinic administration entry", async () => {
  const manager = await source(
    "../src/components/admin/global-clinics-manager.tsx",
  );

  assert.match(manager, /clinic\.isActive \? \(/);
  assert.match(manager, /\/administration/);
  assert.match(manager, /Administrar clínica/);
  assert.match(manager, /clinic\.isActive[\s\S]*?Administrar clínica[\s\S]*?: null/);
  assert.match(manager, /Reativar/);
});

test("admin page composes users and clinics without a clinic context", async () => {
  const page = await source("../src/app/(authenticated)/admin/page.tsx");

  assert.match(page, /<GlobalUsersManager/);
  assert.match(page, /<GlobalClinicsManager/);
  assert.match(page, /canAccessGlobalAdminPage\(user\)/);
  assert.doesNotMatch(page, /clinicId|getClinicContext|getAccessibleClinics/);
});

test("global navigation is an identity-gated action outside clinic navigation", async () => {
  const layout = await source("../src/app/(authenticated)/layout.tsx");
  const clinicShell = await source(
    "../src/components/layout/clinic-app-shell.tsx",
  );

  assert.match(layout, /user\.isGlobalAdmin \? \(/);
  assert.match(layout, /href="\/admin"/);
  assert.match(layout, /Administração Global/);
  assert.doesNotMatch(layout, /role\.(?:name|code)|membership/);
  assert.doesNotMatch(clinicShell, /Administração Global/);

  const clinicItems = [
    "Painel",
    "Agendamentos",
    "Pacientes",
    "Profissionais",
    "Agendas",
    "Prontuários",
    "Administração",
    "Auditoria",
  ];
  assert.equal(
    clinicItems.filter((label) =>
      clinicShell.includes(`label: "${label}"`),
    ).length,
    8,
  );
});

test("global admin landing works without memberships and ordinary users keep clinics", () => {
  assert.equal(authenticatedDestination({ isGlobalAdmin: true }), "/admin");
  assert.equal(authenticatedDestination({ isGlobalAdmin: false }), "/clinics");
  assert.equal(
    loginResponseDestination({ user: { isGlobalAdmin: true, memberships: [] } }),
    "/admin",
  );
  assert.equal(
    loginResponseDestination({ user: { isGlobalAdmin: false } }),
    "/clinics",
  );
  assert.equal(loginResponseDestination({ user: {} }), null);
});

test("login and dashboard use the shared destination without another browser request", async () => {
  const loginForm = await source("../src/app/login/login-form.tsx");
  const loginPage = await source("../src/app/login/page.tsx");
  const dashboard = await source(
    "../src/app/(authenticated)/dashboard/page.tsx",
  );

  assert.match(loginForm, /loginResponseDestination\(body\)/);
  assert.match(loginForm, /router\.replace\(destination\)/);
  assert.doesNotMatch(loginForm, /\/api\/auth\/me|router\.replace\("\/clinics"\)/);
  assert.match(loginPage, /redirect\(authenticatedDestination\(user\)\)/);
  assert.match(dashboard, /getCurrentUser\(\)/);
  assert.match(dashboard, /redirect\(authenticatedDestination\(user\)\)/);
});

test("B3 completion adds no direct backend call, password UI or promotion UI", async () => {
  const adminPaths = [
    "../src/components/admin/global-clinics-manager.tsx",
    "../src/components/admin/global-clinic-form-dialog.tsx",
    "../src/app/(authenticated)/admin/page.tsx",
    "../src/app/(authenticated)/layout.tsx",
  ];
  const admin = (await Promise.all(adminPaths.map(source))).join("\n");
  const login = await source("../src/app/login/login-form.tsx");

  assert.doesNotMatch(admin + login, /BACKEND_API_URL|https?:\/\/.*\/api\/v1/);
  assert.doesNotMatch(admin, /name="password"|register\("password/);
  assert.doesNotMatch(admin + login, /promote|demote|global-admins/);
  assert.doesNotMatch(admin + login, /localStorage|sessionStorage|document\.cookie/);
});
