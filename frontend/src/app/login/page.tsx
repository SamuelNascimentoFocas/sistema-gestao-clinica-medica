import { redirect } from "next/navigation";
import { authenticatedDestination } from "@/lib/auth/authenticated-destination";
import { getCurrentUser } from "@/lib/server/current-user";
import LoginForm from "./login-form";

export const metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(authenticatedDestination(user));
  }

  return <LoginForm />;
}
