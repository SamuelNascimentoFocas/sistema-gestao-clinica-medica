"use client";

import { useState } from "react";
import { ClinicMembersManager } from "@/components/administration/clinic-members-manager";
import { ClinicRolesManager } from "@/components/administration/clinic-roles-manager";

type ClinicAdministrationManagerProps = {
  clinicId: string;
  currentMembershipId: string | null;
  canReadMembers: boolean;
  canCreateMembers: boolean;
  canResendInvitations: boolean;
  canAssignRole: boolean;
  canChangeMemberStatus: boolean;
  canManageRoles: boolean;
};

export function ClinicAdministrationManager({
  clinicId,
  currentMembershipId,
  canReadMembers,
  canCreateMembers,
  canResendInvitations,
  canAssignRole,
  canChangeMemberStatus,
  canManageRoles,
}: ClinicAdministrationManagerProps) {
  const [rolesRevision, setRolesRevision] = useState(0);

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <p className="text-sm font-medium text-muted-foreground">Administração</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Usuários e perfis</h1>
          <p className="mt-2 text-muted-foreground">Gerencie acessos da clínica sem duplicar as regras de autorização do backend.</p>
        </header>

        {canManageRoles ? (
          <ClinicRolesManager clinicId={clinicId} onRolesChanged={() => setRolesRevision((value) => value + 1)} />
        ) : null}

        {canReadMembers ? (
          <ClinicMembersManager
            clinicId={clinicId}
            currentMembershipId={currentMembershipId}
            canCreate={canCreateMembers}
            canResendInvitations={canResendInvitations}
            canAssignRole={canAssignRole}
            canChangeStatus={canChangeMemberStatus}
            assignableRolesRefreshKey={rolesRevision}
          />
        ) : null}
      </div>
    </main>
  );
}
