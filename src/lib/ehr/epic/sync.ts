import {
    fetchEpicPatient,
    fetchEpicConditions,
    fetchEpicMedications,
} from "./client";
import { mapFhirPatient } from "../hapi/mapper";
import { mapFhirCondition } from "../hapi/conditionMapper";
import { mapFhirMedicationRequest } from "../hapi/medicationMapper";
import { upsertPatient } from "@/lib/db/patients";
import { upsertCondition } from "@/lib/db/conditions";
import { upsertMedication } from "@/lib/db/medications";

export async function syncEpicPatientData(
    patientId: string,
    accessToken: string
) {
    let patientsProcessed = 0;
    let conditionsProcessed = 0;
    let medicationsProcessed = 0;
    let skipped = 0;

    // 1. Fetch & upsert patient demographic resource
    const patientResource = await fetchEpicPatient(patientId, accessToken);
    const mappedPatient = mapFhirPatient(patientResource);

    if (!mappedPatient) {
        throw new Error(`Unable to map Epic patient resource for ID: ${patientId}`);
    }

    await upsertPatient("EPIC", mappedPatient);
    patientsProcessed++;

    // 2. Fetch & upsert patient conditions
    try {
        const conditionBundle = await fetchEpicConditions(patientId, accessToken);

        for (const entry of conditionBundle.entry ?? []) {
            if (!entry.resource) {
                skipped++;
                continue;
            }

            const mappedCondition = mapFhirCondition(entry.resource);
            if (!mappedCondition) {
                skipped++;
                continue;
            }

            const saved = await upsertCondition("EPIC", mappedCondition);
            if (saved) {
                conditionsProcessed++;
            } else {
                skipped++;
            }
        }
    } catch (err) {
        console.warn(`Failed to pull Epic conditions for patient ${patientId}:`, err);
        skipped++;
    }

    // 3. Fetch & upsert patient medications
    try {
        const medicationBundle = await fetchEpicMedications(patientId, accessToken);

        for (const entry of medicationBundle.entry ?? []) {
            if (!entry.resource) {
                skipped++;
                continue;
            }

            const mappedMedication = mapFhirMedicationRequest(entry.resource);
            if (!mappedMedication) {
                skipped++;
                continue;
            }

            const saved = await upsertMedication("EPIC", mappedMedication);
            if (saved) {
                medicationsProcessed++;
            } else {
                skipped++;
            }
        }
    } catch (err) {
        console.warn(`Failed to pull Epic medications for patient ${patientId}:`, err);
        skipped++;
    }

    return {
        patientId,
        patientsProcessed,
        conditionsProcessed,
        medicationsProcessed,
        skipped,
    };
}
