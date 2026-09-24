
export interface FhirHumanName {
  use?: string;
  family?: string;
  given?: string[];
}

export interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  name?: FhirHumanName[];
  gender?: string;
  birthDate?: string;
}

export interface FhirBundleEntry<T> {
  resource?: T;
}

export interface FhirBundleLink {
  relation: string;
  url: string;
}

export interface FhirBundle<T> {
  resourceType: "Bundle";
  type?: string;
  total?: number;
  entry?: FhirBundleEntry<T>[];
  link?: FhirBundleLink[];
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
}

export interface FhirCondition {
  resourceType: "Condition";
  id?: string;

  clinicalStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;

  subject?: FhirReference;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  intent?: string;

  medicationCodeableConcept?: FhirCodeableConcept;

  medicationReference?: FhirReference;

  subject?: FhirReference;
}