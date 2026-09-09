import { isUuid, parseRoleStatusPayload } from "@/lib/administration/role-contract";
import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{ clinicId: string; roleId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const { clinicId, roleId } = await context.params;
  if (!isUuid(clinicId) || !isUuid(roleId)) {
    return Response.json({ message: "Perfil inválido" }, { status: 422 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedPayload = parseRoleStatusPayload(body);

  if (!parsedPayload.ok) {
    return Response.json(
      { message: parsedPayload.message },
      { status: parsedPayload.status },
    );
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/roles/${encodeURIComponent(roleId)}/status`,
    { method: "PATCH", body: JSON.stringify(parsedPayload.value) },
  );
}
