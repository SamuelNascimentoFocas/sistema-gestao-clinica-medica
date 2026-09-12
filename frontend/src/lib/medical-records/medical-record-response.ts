export const MEDICAL_RECORD_ACCESS_DENIED_MESSAGE =
  "Você não tem permissão para acessar este prontuário.";

export function sanitizeMedicalRecordBackendResponse(
  response: Response,
) {
  if (response.status !== 403) {
    return response;
  }

  return Response.json(
    {
      message: MEDICAL_RECORD_ACCESS_DENIED_MESSAGE,
    },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
