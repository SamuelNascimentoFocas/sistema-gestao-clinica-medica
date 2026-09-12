import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";
import { isUuid, parseRoleIdPayload } from "@/lib/administration/role-contract";

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

  const parsedPayload = parseRoleIdPayload(body);

  if (!parsedPayload.ok) {
    return Response.json(
      { message: parsedPayload.message },
      { status: parsedPayload.status },
    );
  }

  const { clinicId, membershipId } = await context.params;
  if (!isUuid(clinicId) || !isUuid(membershipId)) {
    return Response.json({ message: "Vínculo inválido" }, { status: 422 });
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/members/${encodeURIComponent(membershipId)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}
