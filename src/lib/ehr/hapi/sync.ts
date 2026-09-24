import { fetchHapiConditions, fetchHapiMedications, fetchHapiPatientPage } from "./client";
import { mapFhirPatient } from "./mapper";
import { mapFhirCondition } from "./conditionMapper";
import { upsertPatient } from "@/lib/db/patients";
import { upsertCondition } from "@/lib/db/conditions";
import { mapFhirMedicationRequest } from "./medicationMapper";
import { upsertMedication } from "@/lib/db/medications";

const DEFAULT_MAX_PAGES = 3;

export async function syncHapiPatients(
  maxPages = DEFAULT_MAX_PAGES
) {
  let nextUrl: string | undefined;
  let page = 0;

  let patientsProcessed = 0;
  let conditionsProcessed = 0;
  let medicationsProcessed = 0;
  let skipped = 0;

  while (page < maxPages) {
    const bundle = await fetchHapiPatientPage(nextUrl);

    for (const entry of bundle.entry ?? []) {
      const resource = entry.resource;

      if (!resource || resource.resourceType !== "Patient") {
        skipped++;
        continue;
      }

      const patient = mapFhirPatient(resource);

      if (!patient) {
        skipped++;
        continue;
      }

      await upsertPatient("HAPI", patient);
      patientsProcessed++;

      // Fetch this patient's conditions
      const conditionBundle = await fetchHapiConditions(
        patient.externalId
      );

      for (const conditionEntry of conditionBundle.entry ?? []) {
        const conditionResource = conditionEntry.resource;

        if (!conditionResource) {
          skipped++;
          continue;
        }

        const condition =
          mapFhirCondition(conditionResource);

        if (!condition) {
          skipped++;
          continue;
        }

        const saved = await upsertCondition(
          "HAPI",
          condition
        );

        if (saved) {
          conditionsProcessed++;
        } else {
          skipped++;
        }
      }

      const medicationBundle =
        await fetchHapiMedications(patient.externalId);

      for (const medicationEntry of medicationBundle.entry ?? []) {
        const medicationResource = medicationEntry.resource;

        if (!medicationResource) {
          skipped++;
          continue;
        }

        const medication =
          mapFhirMedicationRequest(medicationResource);

        if (!medication) {
          skipped++;
          continue;
        }

        const saved = await upsertMedication(
          "HAPI",
          medication
        );

        if (saved) {
          medicationsProcessed++;
        } else {
          skipped++;
        }
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