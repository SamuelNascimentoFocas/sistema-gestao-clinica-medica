import { isUuid, parseCustomRolePayload } from "@/lib/administration/role-contract";
import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{ clinicId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { clinicId } = await context.params;
  if (!isUuid(clinicId)) {
    return Response.json({ message: "Clínica inválida" }, { status: 422 });
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/roles`,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const body: unknown = await request.json().catch(() => null);
  const parsedPayload = parseCustomRolePayload(body);

  if (!parsedPayload.ok) {
    return Response.json(
      { message: parsedPayload.message },
      { status: parsedPayload.status },
    );
  }

  const { clinicId } = await context.params;
  if (!isUuid(clinicId)) {
    return Response.json({ message: "Clínica inválida" }, { status: 422 });
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/roles`,
    { method: "POST", body: JSON.stringify(parsedPayload.value) },
  );
}
