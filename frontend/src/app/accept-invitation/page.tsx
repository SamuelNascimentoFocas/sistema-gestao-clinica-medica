import type { Metadata } from "next";
import { InvitationAcceptance } from "@/components/invitations/invitation-acceptance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aceitar convite",
  referrer: "no-referrer",
};

export default function AcceptInvitationPage() {
  return <InvitationAcceptance />;
}
