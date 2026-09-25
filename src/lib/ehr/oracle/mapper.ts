// src/lib/ehr/oracle/mapper.ts

import { FhirPatient } from "../types";
import { EhrPatient } from "../models";
import { mapFhirPatient } from "../hapi/mapper";

export function mapOraclePatient(
  patient: FhirPatient
): EhrPatient | null {
  return mapFhirPatient(patient);
}