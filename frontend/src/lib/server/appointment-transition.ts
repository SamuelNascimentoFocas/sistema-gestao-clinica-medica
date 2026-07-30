import "server-only";

import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import {
  parseAppointmentVersionPayload,
  parseCancelAppointmentPayload,
  parseRescheduleAppointmentPayload,
} from "@/lib/server/appointment-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type VersionTransitionAction =
  | "confirm"
  | "complete"
  | "no-show";

type TransitionParameters = {
  request: Request;
  clinicId: string;
  appointmentId: string;
};

type VersionTransitionParameters =
  TransitionParameters & {
    action: VersionTransitionAction;
  };

function buildAppointmentActionPath({
  clinicId,
  appointmentId,
  action,
}: {
  clinicId: string;
  appointmentId: string;
  action: string;
}) {
  return `/api/v1/clinics/${encodeURIComponent(
    clinicId,
  )}/appointments/${encodeURIComponent(
    appointmentId,
  )}/${action}`;
}

async function readRequestBody(request: Request) {
  return request.json().catch(() => null) as Promise<unknown>;
}

export async function forwardAppointmentVersionTransition({
  request,
  clinicId,
  appointmentId,
  action,
}: VersionTransitionParameters) {
  const originError = rejectUntrustedMutation(request);

  if (originError) {
    return originError;
  }

  const parsedPayload =
    parseAppointmentVersionPayload(
      await readRequestBody(request),
    );

  if (!parsedPayload.ok) {
    return Response.json(
      {
        message: parsedPayload.message,
      },
      {
        status: parsedPayload.status,
      },
    );
  }

  return authenticatedBackendJson(
    buildAppointmentActionPath({
      clinicId,
      appointmentId,
      action,
    }),
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}

export async function forwardAppointmentCancellation({
  request,
  clinicId,
  appointmentId,
}: TransitionParameters) {
  const originError = rejectUntrustedMutation(request);

  if (originError) {
    return originError;
  }

  const parsedPayload =
    parseCancelAppointmentPayload(
      await readRequestBody(request),
    );

  if (!parsedPayload.ok) {
    return Response.json(
      {
        message: parsedPayload.message,
      },
      {
        status: parsedPayload.status,
      },
    );
  }

  return authenticatedBackendJson(
    buildAppointmentActionPath({
      clinicId,
      appointmentId,
      action: "cancel",
    }),
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}

export async function forwardAppointmentReschedule({
  request,
  clinicId,
  appointmentId,
}: TransitionParameters) {
  const originError =
    rejectUntrustedMutation(request);

  if (originError) {
    return originError;
  }

  const parsedPayload =
    parseRescheduleAppointmentPayload(
      await readRequestBody(request),
    );

  if (!parsedPayload.ok) {
    return Response.json(
      {
        message: parsedPayload.message,
      },
      {
        status: parsedPayload.status,
      },
    );
  }

  return authenticatedBackendJson(
    buildAppointmentActionPath({
      clinicId,
      appointmentId,
      action: "reschedule",
    }),
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}