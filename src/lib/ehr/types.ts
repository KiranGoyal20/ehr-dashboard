
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