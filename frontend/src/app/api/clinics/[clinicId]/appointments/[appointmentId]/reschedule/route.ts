import { forwardAppointmentReschedule } from "@/lib/server/appointment-transition";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    appointmentId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const { clinicId, appointmentId } =
    await context.params;

  return forwardAppointmentReschedule({
    request,
    clinicId,
    appointmentId,
  });
}