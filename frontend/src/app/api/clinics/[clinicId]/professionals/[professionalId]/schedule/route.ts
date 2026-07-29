import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    professionalId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { clinicId, professionalId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/professionals/${encodeURIComponent(
      professionalId,
    )}/schedule`,
  );
}