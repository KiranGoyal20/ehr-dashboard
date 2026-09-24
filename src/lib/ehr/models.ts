export interface EhrPatient {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  birthDate: string | null;
  rawData: unknown;
}

export interface EhrCondition {
  externalId: string;
  patientExternalId: string;
  code: string | null;
  display: string | null;
  clinicalStatus: string | null;
  rawData: unknown;
}

export interface EhrMedication {
  externalId: string;
  patientExternalId: string;
  code: string | null;
  display: string | null;
  status: string | null;
  intent: string | null;
  rawData: unknown;
}