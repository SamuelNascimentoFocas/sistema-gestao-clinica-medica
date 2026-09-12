import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canResendInvitation,
  invitationStatusLabel,
  parseClinicMembersResponse,
  parseInvitationAcceptancePayload,
  parseInvitationTokenPayload,
  parseInvitationValidationResponse,
  takeInvitationTokenFromFragment,
} from "../src/lib/invitations/invitation-contract.ts";

const token = "a".repeat(43);
const clinicId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const roleId = "33333333-3333-4333-8333-333333333333";
const membershipId = "44444444-4444-4444-8444-444444444444";

function onboardingUser(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function clinicMember(user = onboardingUser()) {
  return {
    id: membershipId,
    userId,
    clinicId,
    roleId,
    isActive: true,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    user,
    role: {
      id: roleId,
      code: "custom_fixture",
      name: "Apoio",
      description: null,
      clinicId,
      isSystem: false,
      isActive: true,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    },
  };
}

test("fragment capture removes the secret URL immediately and keeps only a valid token", () => {
  const replacements = [];
  const history = {
    replaceState(data, title, url) {
      replacements.push({ data, title, url });
    },
  };

  assert.equal(
    takeInvitationTokenFromFragment(
      { hash: `#token=${token}`, pathname: "/accept-invitation" },
      history,
    ),
    token,
  );
  assert.deepEqual(replacements, [
    { data: null, title: "", url: "/accept-invitation" },
  ]);

  assert.equal(
    takeInvitationTokenFromFragment(
      { hash: "", pathname: "/accept-invitation" },
      history,
    ),
    null,
  );
  assert.equal(
    takeInvitationTokenFromFragment(
      { hash: `#token=${token}&other=value`, pathname: "/accept-invitation" },
      history,
    ),
    null,
  );
  assert.equal(
    takeInvitationTokenFromFragment(
      { hash: "#token=short", pathname: "/accept-invitation" },
      history,
    ),
    null,
  );
});

test("public invitation payloads are exact POST-body contracts", () => {
  assert.deepEqual(parseInvitationTokenPayload({ token }), {
    ok: true,
    value: { token },
  });
  assert.equal(parseInvitationTokenPayload({ token, extra: true }).ok, false);
  assert.deepEqual(
    parseInvitationAcceptancePayload({
      token,
      password: "a".repeat(12),
      passwordConfirmation: "a".repeat(12),
    }),
    {
      ok: true,
      value: {
        token,
        password: "a".repeat(12),
        passwordConfirmation: "a".repeat(12),
      },
    },
  );
  assert.equal(parseInvitationAcceptancePayload({ token }).ok, false);
  assert.deepEqual(parseInvitationValidationResponse({ valid: true }), {
    valid: true,
  });
  assert.equal(parseInvitationValidationResponse({ valid: true, userId }), null);
});

test("clinic member onboarding metadata is defensive and keeps active state independent", () => {
  const configuredInactive = onboardingUser({
    isActive: false,
    passwordConfigured: true,
    invitationStatus: "accepted",
  });
  const response = {
    data: [clinicMember(configuredInactive)],
    meta: { total: 1, perPage: 20, currentPage: 1, lastPage: 1 },
  };
  const parsed = parseClinicMembersResponse(response);

  assert.equal(parsed?.data[0]?.user.isActive, false);
  assert.equal(parsed?.data[0]?.user.passwordConfigured, true);
  assert.equal(canResendInvitation(configuredInactive), false);
  assert.equal(canResendInvitation(onboardingUser()), true);
  assert.equal(invitationStatusLabel("pending_dispatch"), "Envio pendente");
  assert.equal(
    parseClinicMembersResponse({
      ...response,
      data: [clinicMember(onboardingUser({ invitationStatus: "unknown" }))],
    }),
    null,
  );
  assert.equal(
    parseClinicMembersResponse({
      ...response,
      data: [clinicMember(onboardingUser({ invitationExpiresAt: "invalid" }))],
    }),
    null,
  );
  assert.equal(
    parseClinicMembersResponse({
      ...response,
      data: [clinicMember(onboardingUser({ passwordHash: "must-not-pass" }))],
    }),
    null,
  );
});

test("public BFFs forward token and passwords only in POST bodies with no-store responses", async () => {
  const validate = await readFile(
    new URL("../src/app/api/invitations/validate/route.ts", import.meta.url),
    "utf8",
  );
  const accept = await readFile(
    new URL("../src/app/api/invitations/accept/route.ts", import.meta.url),
    "utf8",
  );
  const server = await readFile(
    new URL("../src/lib/server/public-invitation-backend.ts", import.meta.url),
    "utf8",
  );

  assert.match(validate, /\/api\/v1\/invitations\/validate/);
  assert.match(accept, /\/api\/v1\/invitations\/accept/);
  assert.match(validate, /request\.json/);
  assert.match(accept, /request\.json/);
  assert.match(server, /method: "POST"/);
  assert.match(server, /body: JSON\.stringify\(payload\)/);
  assert.match(server, /"Cache-Control": "no-store"/);
  for (const source of [validate, accept, server]) {
    assert.doesNotMatch(source, /searchParams|URLSearchParams|Authorization.*Bearer/);
  }
});

test("acceptance page keeps the token in memory, exposes neutral states and never logs in automatically", async () => {
  const component = await readFile(
    new URL(
      "../src/components/invitations/invitation-acceptance.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const page = await readFile(
    new URL("../src/app/accept-invitation/page.tsx", import.meta.url),
    "utf8",
  );
  const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");

  assert.match(component, /useRef<string \| null>/);
  assert.match(component, /takeInvitationTokenFromFragment\(window\.location, window\.history\)/);
  assert.match(component, /validating|invalid-or-unavailable|submitting|safe-error|success/);
  assert.match(component, /autoComplete="new-password"/);
  assert.match(component, /href="\/login"/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|document\.cookie|console\./);
  assert.doesNotMatch(component, /\/api\/auth\/login|router\.(?:push|replace)\("\/clinics/);
  assert.match(page, /referrer: "no-referrer"/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(proxy, /"Cache-Control", "no-store"/);
  assert.match(proxy, /"Referrer-Policy", "no-referrer"/);
});

test("clinic administration creates invitations without a password and supports safe resend", async () => {
  const manager = await readFile(
    new URL(
      "../src/components/administration/clinic-members-manager.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const collection = await readFile(
    new URL(
      "../src/app/api/clinics/[clinicId]/members/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const resend = await readFile(
    new URL(
      "../src/app/api/clinics/[clinicId]/members/[membershipId]/invitations/resend/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(manager, /Senha inicial|name="password"/);
  assert.match(manager, /parseClinicMembersResponse/);
  assert.match(manager, /passwordConfigured/);
  assert.match(manager, /invitationStatus/);
  assert.match(manager, /Reenviar convite/);
  assert.match(manager, /disabled=\{isBusy\}/);
  assert.match(manager, /reloadMembers\(\)/);
  assert.match(collection, /\/members\/invitations/);
  assert.match(collection, /fullName,[\s\S]*email,[\s\S]*roleId: roleResult\.value\.roleId/);
  assert.doesNotMatch(collection, /JSON\.stringify\(\{[\s\S]{0,160}password,/);
  assert.match(resend, /\/invitations\/resend/);
  assert.match(resend, /method: "POST"/);
  assert.doesNotMatch(resend, /Authorization.*Bearer/);
});

test("changed invitation surfaces keep browser calls on relative BFF routes and avoid secret persistence", async () => {
  const paths = [
    "../src/components/invitations/invitation-acceptance.tsx",
    "../src/components/administration/clinic-members-manager.tsx",
    "../src/app/api/invitations/validate/route.ts",
    "../src/app/api/invitations/accept/route.ts",
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.doesNotMatch(source, /BACKEND_API_URL|https?:\/\/.*api\/v1/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\.(?:log|error)/);
  }
  assert.match(sources[0], /url: "\/api\/invitations\/validate"/);
  assert.match(sources[0], /url: "\/api\/invitations\/accept"/);
});
