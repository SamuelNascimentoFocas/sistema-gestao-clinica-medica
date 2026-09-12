import { isUuid } from "@/lib/administration/role-contract";
import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";

type RouteContext = {
  params: Promise<{ clinicId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { clinicId } = await context.params;
  if (!isUuid(clinicId)) {
    return Response.json({ message: "Clínica inválida" }, { status: 422 });
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/roles/assignable`,
  );
}
