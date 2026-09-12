import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canAccessGlobalAdminPage } from "../src/lib/admin/global-admin-contract.ts";
import {
  globalUserEditFormSchema,
  globalUserInvitationFormSchema,
} from "../src/lib/admin/global-admin-user-schemas.ts";

const clinicId = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";

test("global admin gate depends only on the authenticated identity, never membership", () => {
  assert.equal(canAccessGlobalAdminPage({ isGlobalAdmin: true }), true);
  assert.equal(canAccessGlobalAdminPage({ isGlobalAdmin: false }), false);
  assert.equal(canAccessGlobalAdminPage(null), false);
});

test("admin page applies a server-side global gate without clinic context", async () => {
  const page = await readFile(
    new URL("../src/app/(authenticated)/admin/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /getCurrentUser\(\)/);
  assert.match(page, /canAccessGlobalAdminPage\(user\)/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /redirect\("\/login"\)/);
  assert.doesNotMatch(page, /clinicId|membership|getAccessibleClinics|getClinicContext/);
  assert.match(page, /<GlobalUsersManager/);
});

test("global invitation schema supports zero or more unique clinicId and roleId pairs", () => {
  assert.equal(
    globalUserInvitationFormSchema.safeParse({
      fullName: "Ana Silva",
      email: "ana@example.com",
      memberships: [],
    }).success,
    true,
  );
  assert.equal(
    globalUserInvitationFormSchema.safeParse({
      fullName: "Ana Silva",
      email: "ana@example.com",
      memberships: [{ clinicId, roleId }],
    }).success,
    true,
  );
  assert.equal(
    globalUserInvitationFormSchema.safeParse({
      fullName: "Ana Silva",
      email: "ana@example.com",
      memberships: [
        { clinicId, roleId },
        { clinicId, roleId: "33333333-3333-4333-8333-333333333333" },
      ],
    }).success,
    false,
  );
  assert.equal(
    globalUserInvitationFormSchema.safeParse({
      fullName: "Ana Silva",
      email: "ana@example.com",
      memberships: [{ clinicId, roleCode: "doctor" }],
    }).success,
    false,
  );
});

test("invitation and edit schemas reject password and global-admin promotion fields", () => {
  for (const forbidden of [
    { password: "administrative-secret" },
    { passwordConfirmation: "administrative-secret" },
    { passwordHash: "hash" },
    { isGlobalAdmin: true },
  ]) {
    assert.equal(
      globalUserInvitationFormSchema.safeParse({
        fullName: "Ana Silva",
        email: "ana@example.com",
        memberships: [],
        ...forbidden,
      }).success,
      false,
    );
    assert.equal(
      globalUserEditFormSchema.safeParse({
        fullName: "Ana Silva",
        email: "ana@example.com",
        ...forbidden,
      }).success,
      false,
    );
  }
});

test("global users manager keeps remote pagination and every mutation on global BFFs", async () => {
  const manager = await readFile(
    new URL("../src/components/admin/global-users-manager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(manager, /<RemoteDataTable/);
  assert.match(manager, /route="\/api\/admin\/users"/);
  assert.match(manager, /parseResponse=\{parseGlobalUsersResponse\}/);
  assert.match(manager, /search: appliedSearch/);
  assert.match(manager, /isActive:/);
  assert.match(manager, /\/api\/admin\/users\//);
  assert.match(manager, /\/status/);
  assert.match(manager, /\/invitations\/resend/);
  assert.match(manager, /passwordConfigured/);
  assert.match(manager, /invitationStatusLabel/);
  assert.match(manager, /invitationSentAt/);
  assert.match(manager, /invitationExpiresAt/);
  assert.doesNotMatch(manager, /BACKEND_API_URL|https?:\/\/.*api\/v1/);
});

test("invitation dialog sends only the safe global invitation payload", async () => {
  const dialog = await readFile(
    new URL(
      "../src/components/admin/global-user-invitation-dialog.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(dialog, /useForm<GlobalUserInvitationFormValues>/);
  assert.match(dialog, /useFieldArray/);
  assert.match(dialog, /parseGlobalUserInvitationPayload\(values\)/);
  assert.match(dialog, /url: "\/api\/admin\/users"/);
  assert.match(dialog, /clinicId/);
  assert.match(dialog, /roleId/);
  assert.doesNotMatch(dialog, /name="password"|register\("password|passwordHash/);
  assert.doesNotMatch(dialog, /name="isGlobalAdmin"|register\("isGlobalAdmin/);
});

test("clinic selection is server-paginated and assignable roles reuse the clinic BFF", async () => {
  const row = await readFile(
    new URL(
      "../src/components/admin/global-user-membership-row.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(row, /"\/api\/admin\/clinics\?" \+ query\.toString\(\)/);
  assert.match(row, /page: String\(page\)/);
  assert.match(row, /perPage: "10"/);
  assert.match(row, /isActive: "true"/);
  assert.match(row, /setPage\(\(current\) => current [+-] 1\)/);
  assert.match(row, /\/roles\/assignable/);
  assert.match(row, /parseClinicRolesResponse/);
  assert.doesNotMatch(row, /clinic_admin|receptionist|doctor|roleCode/);
  assert.doesNotMatch(row, /BACKEND_API_URL|https?:\/\/.*api\/v1/);
});

test("edit UI exposes only name and email while status and resend stay separate", async () => {
  const edit = await readFile(
    new URL("../src/components/admin/global-user-edit-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(edit, /register\("fullName"\)/);
  assert.match(edit, /register\("email"\)/);
  assert.match(edit, /parseGlobalUserUpdatePayload\(values\)/);
  assert.match(edit, /method: "PATCH"/);
  assert.doesNotMatch(edit, /register\("password|passwordHash/);
  assert.doesNotMatch(edit, /register\("isGlobalAdmin/);
  assert.doesNotMatch(edit, /BACKEND_API_URL|https?:\/\/.*api\/v1/);
});
