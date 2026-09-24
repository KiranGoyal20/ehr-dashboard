import { EhrMedication } from "../models";
import { FhirMedicationRequest } from "../types";

export function mapFhirMedicationRequest(
  medication: FhirMedicationRequest
): EhrMedication | null {
  if (!medication.id) {
    return null;
  }

  const patientReference = medication.subject?.reference;

  if (!patientReference?.startsWith("Patient/")) {
    return null;
  }

  const patientExternalId =
    patientReference.replace("Patient/", "");

  const coding =
    medication.medicationCodeableConcept?.coding?.[0];

  const display =
    coding?.display ??
    medication.medicationCodeableConcept?.text ??
    medication.medicationReference?.reference ??
    null;

  return {
    externalId: medication.id,
    patientExternalId,
    code: coding?.code ?? null,
    display,
    status: medication.status ?? null,
    intent: medication.intent ?? null,
    rawData: medication,
  };
}