import { EhrCondition } from "../models";
import { FhirCondition } from "../types";

export function mapFhirCondition(
  condition: FhirCondition
): EhrCondition | null {
  if (!condition.id) {
    return null;
  }

  const patientReference = condition.subject?.reference;

  if (!patientReference?.startsWith("Patient/")) {
    return null;
  }

  const patientExternalId =
    patientReference.replace("Patient/", "");

  const coding = condition.code?.coding?.[0];

  return {
    externalId: condition.id,
    patientExternalId,
    code: coding?.code ?? null,

    // Your actual HAPI records use code.text,
    // so fall back to it when coding.display isn't present.
    display:
      coding?.display ??
      condition.code?.text ??
      null,

    clinicalStatus:
      condition.clinicalStatus?.coding?.[0]?.code ??
      null,

    rawData: condition,
  };
}