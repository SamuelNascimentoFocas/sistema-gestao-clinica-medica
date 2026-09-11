import { redirect } from "next/navigation";
import { authenticatedDestination } from "@/lib/auth/authenticated-destination";
import { getCurrentUser } from "@/lib/server/current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(authenticatedDestination(user));
}
