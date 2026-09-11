import { z } from "zod";
import type { GlobalClinicPayload } from "@/lib/admin/global-admin-contract";
import type { Clinic } from "@/types/clinic";

const optionalText = (maximum: number, message: string) =>
  z.string().trim().max(maximum, message);

export const globalClinicFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Use ao menos 2 caracteres.")
      .max(180, "Use no máximo 180 caracteres."),
    cnpj: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^[0-9]{14}$/.test(value),
        "Informe exatamente 14 dígitos.",
      ),
    phone: optionalText(20, "Use no máximo 20 caracteres."),
    addressStreet: optionalText(180, "Use no máximo 180 caracteres."),
    addressNumber: optionalText(30, "Use no máximo 30 caracteres."),
    addressComplement: optionalText(120, "Use no máximo 120 caracteres."),
    addressNeighborhood: optionalText(120, "Use no máximo 120 caracteres."),
    addressCity: optionalText(120, "Use no máximo 120 caracteres."),
    addressState: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || value.length === 2,
        "Informe uma UF com 2 caracteres.",
      ),
    addressPostalCode: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^[0-9]{8}$/.test(value),
        "Informe exatamente 8 dígitos.",
      ),
  })
  .strict();

export type GlobalClinicFormValues = z.infer<typeof globalClinicFormSchema>;

export const EMPTY_GLOBAL_CLINIC_FORM: GlobalClinicFormValues = {
  name: "",
  cnpj: "",
  phone: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  addressCity: "",
  addressState: "",
  addressPostalCode: "",
};

export function globalClinicFormValues(
  clinic?: Clinic,
): GlobalClinicFormValues {
  if (!clinic) return EMPTY_GLOBAL_CLINIC_FORM;

  return {
    name: clinic.name,
    cnpj: clinic.cnpj ?? "",
    phone: clinic.phone ?? "",
    addressStreet: clinic.addressStreet ?? "",
    addressNumber: clinic.addressNumber ?? "",
    addressComplement: clinic.addressComplement ?? "",
    addressNeighborhood: clinic.addressNeighborhood ?? "",
    addressCity: clinic.addressCity ?? "",
    addressState: clinic.addressState ?? "",
    addressPostalCode: clinic.addressPostalCode ?? "",
  };
}

function nullable(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function globalClinicPayload(
  values: GlobalClinicFormValues,
): GlobalClinicPayload {
  return {
    name: values.name.trim(),
    cnpj: nullable(values.cnpj),
    phone: nullable(values.phone),
    addressStreet: nullable(values.addressStreet),
    addressNumber: nullable(values.addressNumber),
    addressComplement: nullable(values.addressComplement),
    addressNeighborhood: nullable(values.addressNeighborhood),
    addressCity: nullable(values.addressCity),
    addressState: nullable(values.addressState)?.toUpperCase() ?? null,
    addressPostalCode: nullable(values.addressPostalCode),
  };
}
