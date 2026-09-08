import "server-only";

import { emitSafeServerError } from "@/lib/server/safe-server-error";

export function logServerError(event: string, error: unknown): void {
  emitSafeServerError(event, error, (entry) => {
    console.error(entry);
  });
}
