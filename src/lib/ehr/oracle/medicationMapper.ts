import { FhirMedicationRequest } from "../types";
import { EhrMedication } from "../models";
import { mapFhirMedicationRequest } from "../hapi/medicationMapper";

export function mapOracleMedicationRequest(
  medication: FhirMedicationRequest
): EhrMedication | null {
  return mapFhirMedicationRequest(medication);
}