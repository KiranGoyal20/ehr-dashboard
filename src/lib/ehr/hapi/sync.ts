import { fetchHapiPatientPage } from "./client";
import { mapFhirPatient } from "./mapper";
import { upsertPatient } from "@/lib/db/patients";

const DEFAULT_MAX_PAGES = 3;

export async function syncHapiPatients(
  maxPages = DEFAULT_MAX_PAGES
) {
  let nextUrl: string | undefined;
  let page = 0;

  let processed = 0;
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
      processed++;
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
    processed,
    skipped,
    pagesProcessed: page,
    hasMorePages: Boolean(nextUrl),
  };
}