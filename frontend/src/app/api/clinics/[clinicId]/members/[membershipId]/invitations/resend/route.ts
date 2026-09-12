import { isUuid } from "@/lib/administration/role-contract";
import { authenticatedInvitationBackendJson } from "@/lib/server/authenticated-invitation-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    membershipId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const { clinicId, membershipId } = await context.params;
  if (!isUuid(clinicId) || !isUuid(membershipId)) {
    return Response.json(
      { message: "Clínica ou vínculo inválido" },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await request.text();
  if (body.trim()) {
    return Response.json(
      { message: "Esta operação não aceita corpo" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return authenticatedInvitationBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/members/${encodeURIComponent(
      membershipId,
    )}/invitations/resend`,
    { method: "POST" },
  );
}
