import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";
import LoginForm from "./login-form";

export const metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}