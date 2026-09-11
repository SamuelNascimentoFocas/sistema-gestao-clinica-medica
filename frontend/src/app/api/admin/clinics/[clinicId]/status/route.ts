import {
  isUuid,
  parseGlobalClinicResponse,
  parseGlobalStatusPayload,
} from "@/lib/admin/global-admin-contract";
import { globalAdminBackendJson } from "@/lib/server/global-admin-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{ clinicId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const { clinicId } = await context.params;
  if (!isUuid(clinicId)) {
    return Response.json({ message: "Consultório inválido" }, { status: 422 });
  }

  const payload = parseGlobalStatusPayload(await request.json().catch(() => null));
  if (!payload.ok) {
    return Response.json({ message: payload.message }, { status: payload.status });
  }

  return globalAdminBackendJson(
    "/api/v1/clinics/" + encodeURIComponent(clinicId) + "/status",
    { method: "PATCH", body: JSON.stringify(payload.value) },
    parseGlobalClinicResponse,
  );
}
