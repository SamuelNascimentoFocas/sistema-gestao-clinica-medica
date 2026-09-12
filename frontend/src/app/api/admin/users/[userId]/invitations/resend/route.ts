import { isUuid } from "@/lib/admin/global-admin-contract";
import { authenticatedInvitationBackendJson } from "@/lib/server/authenticated-invitation-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const { userId } = await context.params;
  if (!isUuid(userId)) {
    return Response.json({ message: "Usuário inválido" }, { status: 422 });
  }

  const body = await request.text();
  if (body.trim()) {
    return Response.json(
      { message: "Esta operação não aceita corpo" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return authenticatedInvitationBackendJson(
    "/api/v1/users/" + encodeURIComponent(userId) + "/invitations/resend",
    { method: "POST" },
  );
}
