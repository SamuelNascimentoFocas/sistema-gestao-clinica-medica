import {
  parseGlobalUserInvitationPayload,
  parseGlobalUsersQuery,
  parseGlobalUsersResponse,
} from "@/lib/admin/global-admin-contract";
import { authenticatedInvitationBackendJson } from "@/lib/server/authenticated-invitation-backend";
import { globalAdminBackendJson } from "@/lib/server/global-admin-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

export async function GET(request: Request) {
  const query = parseGlobalUsersQuery(new URL(request.url).searchParams);
  if (!query.ok) {
    return Response.json({ message: query.message }, { status: query.status });
  }

  return globalAdminBackendJson(
    "/api/v1/users?" + query.value.toString(),
    {},
    parseGlobalUsersResponse,
  );
}

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const payload = parseGlobalUserInvitationPayload(
    await request.json().catch(() => null),
  );
  if (!payload.ok) {
    return Response.json({ message: payload.message }, { status: payload.status });
  }

  return authenticatedInvitationBackendJson("/api/v1/users/invitations", {
    method: "POST",
    body: JSON.stringify(payload.value),
  });
}
