import { db } from "./index";
import { EhrPatient } from "../ehr/models";

export async function upsertPatient(
  source: string,
  patient: EhrPatient
) {
  const result = await db.query(
    `
      INSERT INTO patients (
        source,
        external_id,
        first_name,
        last_name,
        gender,
        birth_date,
        raw_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)

      ON CONFLICT (source, external_id)

      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        gender = EXCLUDED.gender,
        birth_date = EXCLUDED.birth_date,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()

      RETURNING id, source, external_id
    `,
    [
      source,
      patient.externalId,
      patient.firstName,
      patient.lastName,
      patient.gender,
      patient.birthDate,
      JSON.stringify(patient.rawData),
    ]
  );

  return result.rows[0];
}

export async function getPatients(
  source: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const [patientsResult, countResult] =
    await Promise.all([
      db.query(
        `
          SELECT
            id,
            source,
            external_id,
            first_name,
            last_name,
            gender,
            birth_date::text AS birth_date
          FROM patients
          WHERE source = $1
          ORDER BY last_name NULLS LAST,
                   first_name NULLS LAST
          LIMIT $2 OFFSET $3
        `,
        [source, limit, offset]
      ),

      db.query(
        `
          SELECT COUNT(*)::int AS total
          FROM patients
          WHERE source = $1
        `,
        [source]
      ),
    ]);

  return {
    patients: patientsResult.rows,
    total: countResult.rows[0].total,
  };
}

export async function getPatientById(id: string) {
  const patientResult = await db.query(
    `
      SELECT
        id,
        source,
        external_id,
        first_name,
        last_name,
        gender,
        birth_date::text AS birth_date
      FROM patients
      WHERE id = $1::uuid
    `,
    [id]
  );

  if (patientResult.rows.length === 0) {
    return null;
  }

  const [conditionsResult, medicationsResult] =
    await Promise.all([
      db.query(
        `
          SELECT
            id,
            external_id,
            code,
            display,
            clinical_status
          FROM conditions
          WHERE patient_id = $1::uuid
          ORDER BY display
        `,
        [id]
      ),

      db.query(
        `
          SELECT
            id,
            external_id,
            code,
            display,
            status,
            intent
          FROM medications
          WHERE patient_id = $1::uuid
          ORDER BY display
        `,
        [id]
      ),
    ]);

  return {
    ...patientResult.rows[0],
    conditions: conditionsResult.rows,
    medications: medicationsResult.rows,
  };
}