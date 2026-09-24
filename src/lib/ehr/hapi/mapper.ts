import { FhirPatient } from "../types";
import { EhrPatient } from "../models";

export function mapFhirPatient(
  patient: FhirPatient
): EhrPatient | null {
  if (!patient.id) {
    return null;
  }

  const officialName =
    patient.name?.find((name) => name.use === "official") ??
    patient.name?.[0];

  return {
    externalId: patient.id,
    firstName: officialName?.given?.join(" ") ?? null,
    lastName: officialName?.family ?? null,
    gender: patient.gender ?? null,
    birthDate: patient.birthDate ?? null,
    rawData: patient,
  };
}