import { db } from "./index";
import { EhrMedication } from "@/lib/ehr/models";

export async function upsertMedication(
  source: string,
  medication: EhrMedication
) {
  const result = await db.query(
    `
      INSERT INTO medications (
        source,
        external_id,
        patient_id,
        code,
        display,
        status,
        intent,
        raw_data
      )
      SELECT
        $1::varchar,
        $2::varchar,
        p.id,
        $4::varchar,
        $5::text,
        $6::varchar,
        $7::varchar,
        $8::jsonb
      FROM patients p
      WHERE p.source = $1::varchar
        AND p.external_id = $3::varchar

      ON CONFLICT (source, external_id)
      DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        code = EXCLUDED.code,
        display = EXCLUDED.display,
        status = EXCLUDED.status,
        intent = EXCLUDED.intent,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()

      RETURNING id
    `,
    [
      source,
      medication.externalId,
      medication.patientExternalId,
      medication.code,
      medication.display,
      medication.status,
      medication.intent,
      JSON.stringify(medication.rawData),
    ]
  );

  return result.rows[0] ?? null;
}