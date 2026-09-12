import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";

type RouteContext = {
  params: Promise<{
    clinicId: string;
  }>;
};

const ALLOWED_QUERY_PARAMETERS = [
  "page",
  "perPage",
  "from",
  "to",
  "userId",
  "patientId",
  "accessAction",
  "purposeCode",
] as const;

export async function GET(request: Request, context: RouteContext) {
  const { clinicId } = await context.params;
  const requestUrl = new URL(request.url);
  const backendSearchParams = new URLSearchParams();

  for (const parameter of ALLOWED_QUERY_PARAMETERS) {
    const value = requestUrl.searchParams.get(parameter);

    if (value !== null && value !== "") {
      backendSearchParams.set(parameter, value);
    }
  }

  const query = backendSearchParams.toString();

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/audit-logs${query ? `?${query}` : ""}`,
  );
}
