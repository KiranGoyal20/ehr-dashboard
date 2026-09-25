// src/lib/ehr/oracle/conditionMapper.ts

import { FhirCondition } from "../types";
import { EhrCondition } from "../models";
import { mapFhirCondition } from "../hapi/conditionMapper";

export function mapOracleCondition(
  condition: FhirCondition
): EhrCondition | null {
  return mapFhirCondition(condition);
}