import {
  isUuid,
  parseGlobalUserResponse,
  parseGlobalUserUpdatePayload,
} from "@/lib/admin/global-admin-contract";
import { globalAdminBackendJson } from "@/lib/server/global-admin-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const { userId } = await context.params;
  if (!isUuid(userId)) {
    return Response.json({ message: "Usuário inválido" }, { status: 422 });
  }

  const payload = parseGlobalUserUpdatePayload(
    await request.json().catch(() => null),
  );
  if (!payload.ok) {
    return Response.json({ message: payload.message }, { status: payload.status });
  }

  return globalAdminBackendJson(
    "/api/v1/users/" + encodeURIComponent(userId),
    { method: "PATCH", body: JSON.stringify(payload.value) },
    parseGlobalUserResponse,
  );
}
