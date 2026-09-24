export interface EhrPatient {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  birthDate: string | null;
  rawData: unknown;
}