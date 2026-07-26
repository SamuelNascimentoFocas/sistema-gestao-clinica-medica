export type Clinic = {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  isActive: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type ClinicRole = {
  id: string;
  code: string;
  name: string;
};

export type AccessibleClinic = {
  clinic: Clinic;
  access: {
    scope: "global" | "clinic";
    membershipId: string | null;
    role: ClinicRole | null;
  };
};

export type AccessibleClinicsResponse = {
  data: AccessibleClinic[];
};

export type ClinicContext = {
  clinic: Clinic;
  access: {
    scope: "global" | "clinic";
    membershipId: string | null;
    role: ClinicRole | null;
    permissions: string[];
  };
};