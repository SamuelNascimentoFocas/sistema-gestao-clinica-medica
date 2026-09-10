import { parseInvitationAcceptancePayload } from "@/lib/invitations/invitation-contract";
import {
  publicInvitationBackendJson,
  publicInvitationJson,
} from "@/lib/server/public-invitation-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const result = parseInvitationAcceptancePayload(
    await request.json().catch(() => null),
  );

  if (!result.ok) {
    return publicInvitationJson({ message: result.message }, result.status);
  }

  return publicInvitationBackendJson(
    "/api/v1/invitations/accept",
    result.value,
  );
}
