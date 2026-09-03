"use client";

import {
  browserApi,
} from "@/lib/client/browser-api";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await browserApi.request<string>({
        url: "/api/auth/logout",
        method: "DELETE",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isLoggingOut}
      onClick={handleLogout}
    >
      {isLoggingOut ? "Saindo..." : "Sair"}
    </Button>
  );
}
