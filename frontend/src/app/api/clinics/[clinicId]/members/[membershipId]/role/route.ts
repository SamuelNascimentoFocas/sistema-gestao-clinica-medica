import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";
import { isClinicMemberRoleCode } from "@/types/administration";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    membershipId: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const originError = rejectUntrustedMutation(request);

  if (originError) {
    return originError;
  }

  const body: unknown = await request.json().catch(() => null);

  const roleCode =
    typeof body === "object" &&
    body !== null &&
    "roleCode" in body
      ? body.roleCode
      : null;

  if (!isClinicMemberRoleCode(roleCode)) {
    return Response.json(
      {
        message: "Perfil inválido",
      },
      {
        status: 422,
      },
    );
  }

  const { clinicId, membershipId } = await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/members/${encodeURIComponent(membershipId)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({
        roleCode,
      }),
    },
  );
}