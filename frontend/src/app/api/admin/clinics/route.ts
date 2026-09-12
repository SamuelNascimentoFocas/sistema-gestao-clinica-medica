import {
  parseGlobalClinicCreatePayload,
  parseGlobalClinicResponse,
  parseGlobalClinicsQuery,
  parseGlobalClinicsResponse,
} from "@/lib/admin/global-admin-contract";
import { globalAdminBackendJson } from "@/lib/server/global-admin-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

export async function GET(request: Request) {
  const query = parseGlobalClinicsQuery(new URL(request.url).searchParams);
  if (!query.ok) {
    return Response.json({ message: query.message }, { status: query.status });
  }

  return globalAdminBackendJson(
    "/api/v1/clinics?" + query.value.toString(),
    {},
    parseGlobalClinicsResponse,
  );
}

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const payload = parseGlobalClinicCreatePayload(
    await request.json().catch(() => null),
  );
  if (!payload.ok) {
    return Response.json({ message: payload.message }, { status: payload.status });
  }

  return globalAdminBackendJson(
    "/api/v1/clinics",
    { method: "POST", body: JSON.stringify(payload.value) },
    parseGlobalClinicResponse,
  );
}
