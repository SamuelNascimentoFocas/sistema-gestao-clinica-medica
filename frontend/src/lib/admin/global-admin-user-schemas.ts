import { z } from "zod";

const HTML_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const identityFields = {
  fullName: z
    .string()
    .trim()
    .min(3, "Use ao menos 3 caracteres.")
    .max(180, "Use no máximo 180 caracteres."),
  email: z
    .string()
    .trim()
    .min(1, "Preencha este campo.")
    .max(254, "Use no máximo 254 caracteres.")
    .regex(HTML_EMAIL, "Informe um e-mail válido."),
};

export const globalUserInitialMembershipSchema = z
  .object({
    clinicId: z.string().uuid("Selecione um consultório válido."),
    roleId: z.string().uuid("Selecione um perfil válido."),
  })
  .strict();

export const globalUserInvitationFormSchema = z
  .object({
    ...identityFields,
    memberships: z.array(globalUserInitialMembershipSchema),
  })
  .strict()
  .superRefine(({ memberships }, context) => {
    const seenClinicIds = new Set<string>();
    memberships.forEach((membership, index) => {
      if (seenClinicIds.has(membership.clinicId)) {
        context.addIssue({
          code: "custom",
          path: ["memberships", index, "clinicId"],
          message: "O consultório já foi selecionado em outro vínculo.",
        });
      }
      seenClinicIds.add(membership.clinicId);
    });
  });

export const globalUserEditFormSchema = z
  .object(identityFields)
  .strict();

export type GlobalUserInvitationFormValues = z.infer<
  typeof globalUserInvitationFormSchema
>;
export type GlobalUserEditFormValues = z.infer<
  typeof globalUserEditFormSchema
>;
