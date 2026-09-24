import { db } from "./index";
import { EhrCondition } from "@/lib/ehr/models";

export async function upsertCondition(
  source: string,
  condition: EhrCondition
) {
  const result = await db.query(
    `
      INSERT INTO conditions (
        source,
        external_id,
        patient_id,
        code,
        display,
        clinical_status,
        raw_data
      )
      SELECT
        $1::varchar,
        $2::varchar,
        p.id,
        $4::varchar,
        $5::text,
        $6::varchar,
        $7::jsonb
      FROM patients p
      WHERE p.source = $1::varchar
        AND p.external_id = $3::varchar

      ON CONFLICT (source, external_id)
      DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        code = EXCLUDED.code,
        display = EXCLUDED.display,
        clinical_status = EXCLUDED.clinical_status,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()

      RETURNING id
    `,
    [
      source,
      condition.externalId,
      condition.patientExternalId,
      condition.code,
      condition.display,
      condition.clinicalStatus,
      JSON.stringify(condition.rawData),
    ]
  );

  return result.rows[0] ?? null;
}