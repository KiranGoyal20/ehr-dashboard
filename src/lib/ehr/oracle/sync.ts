import {
    fetchOraclePatientPage,
    fetchOraclePatient,
    fetchOracleConditions,
    fetchOracleMedications,
} from "./client";

import { mapOraclePatient } from "./mapper";
import { mapOracleCondition } from "./conditionMapper";
import { mapOracleMedicationRequest } from "./medicationMapper";

import { upsertPatient } from "@/lib/db/patients";
import { upsertCondition } from "@/lib/db/conditions";
import { upsertMedication } from "@/lib/db/medications";

const DEFAULT_MAX_PAGES = 2;
const CLINICAL_TEST_PATIENT_ID = "12724066";
const PATIENT_LIMIT = 20;
const CLINICAL_RESOURCE_LIMIT = 20;

async function syncClinicalData(patientExternalId: string) {
    let conditionsProcessed = 0;
    let medicationsProcessed = 0;
    let skipped = 0;

    const conditionBundle =
        await fetchOracleConditions(patientExternalId);

    const conditionEntries =
        conditionBundle.entry?.slice(
            0,
            CLINICAL_RESOURCE_LIMIT
        ) ?? [];

    for (const entry of conditionEntries) {
        if (!entry.resource) {
            skipped++;
            continue;
        }

        const condition =
            mapOracleCondition(entry.resource);

        if (!condition) {
            skipped++;
            continue;
        }

        const saved =
            await upsertCondition("ORACLE", condition);

        if (saved) conditionsProcessed++;
        else skipped++;
    }

    const medicationBundle =
        await fetchOracleMedications(patientExternalId);

    const medicationEntries =
        medicationBundle.entry?.slice(
            0,
            CLINICAL_RESOURCE_LIMIT
        ) ?? [];

    for (const entry of medicationEntries) {
        if (!entry.resource) {
            skipped++;
            continue;
        }

        const medication =
            mapOracleMedicationRequest(entry.resource);

        if (!medication) {
            skipped++;
            continue;
        }

        const saved =
            await upsertMedication("ORACLE", medication);

        if (saved) medicationsProcessed++;
        else skipped++;
    }

    return {
        conditionsProcessed,
        medicationsProcessed,
        skipped,
    };
}

export async function syncOraclePatients(
    maxPages = DEFAULT_MAX_PAGES
) {
    let nextUrl: string | undefined;
    let page = 0;

    let patientsProcessed = 0;
    let conditionsProcessed = 0;
    let medicationsProcessed = 0;
    let skipped = 0;

    // 1. Sync the known Oracle sandbox patient first.
    // This patient has verified Conditions and MedicationRequests.
    try {
        const clinicalPatientResource =
            await fetchOraclePatient(CLINICAL_TEST_PATIENT_ID);

        const clinicalPatient =
            mapOraclePatient(clinicalPatientResource);

        if (clinicalPatient) {
            await upsertPatient("ORACLE", clinicalPatient);
            patientsProcessed++;

            try {
                const clinical =
                    await syncClinicalData(
                        clinicalPatient.externalId
                    );

                conditionsProcessed +=
                    clinical.conditionsProcessed;

                medicationsProcessed +=
                    clinical.medicationsProcessed;

                skipped += clinical.skipped;
            } catch (error) {
                skipped++;

                console.error(
                    `Failed to sync Oracle clinical data for patient ${clinicalPatient.externalId}:`,
                    error
                );
            }
        }
    } catch (error) {
        skipped++;

        console.error(
            `Failed to fetch Oracle clinical test patient ${CLINICAL_TEST_PATIENT_ID}:`,
            error
        );
    }

    // 2. Fetch additional patients through Oracle's
    // paginated Patient search.
    while (
        page < maxPages &&
        patientsProcessed < PATIENT_LIMIT
    ) {
        const bundle =
            await fetchOraclePatientPage(nextUrl);

        for (const entry of bundle.entry ?? []) {
            if (patientsProcessed >= PATIENT_LIMIT) {
                break;
            }

            if (!entry.resource) {
                skipped++;
                continue;
            }

            const patient =
                mapOraclePatient(entry.resource);

            if (!patient) {
                skipped++;
                continue;
            }

            // Avoid processing the known clinical patient twice
            if (
                patient.externalId ===
                CLINICAL_TEST_PATIENT_ID
            ) {
                continue;
            }

            await upsertPatient("ORACLE", patient);
            patientsProcessed++;

            try {
                const clinical =
                    await syncClinicalData(
                        patient.externalId
                    );

                conditionsProcessed +=
                    clinical.conditionsProcessed;

                medicationsProcessed +=
                    clinical.medicationsProcessed;

                skipped += clinical.skipped;
            } catch (error) {
                skipped++;

                console.error(
                    `Failed to sync Oracle clinical data for patient ${patient.externalId}:`,
                    error
                );
            }
        }

        page++;

        nextUrl = bundle.link?.find(
            (link) => link.relation === "next"
        )?.url;

        if (!nextUrl) {
            break;
        }
    }

    return {
        patientsProcessed,
        conditionsProcessed,
        medicationsProcessed,
        skipped,
        pagesProcessed: page,
        hasMorePages: Boolean(nextUrl),
    };
}