import "server-only";

export function rejectUntrustedMutation(
  request: Request,
): Response | null {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");

  const hasTrustedOrigin = origin === requestOrigin;
  const hasTrustedFetchSite =
    !fetchSite || ["same-origin", "same-site"].includes(fetchSite);

  if (!hasTrustedOrigin || !hasTrustedFetchSite) {
    return Response.json(
      {
        message: "Origem da requisição não autorizada",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return null;
}