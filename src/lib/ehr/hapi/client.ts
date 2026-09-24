import { FhirBundle, FhirPatient } from "../types";

const HAPI_BASE_URL = "https://hapi.fhir.org/baseR4";

export async function fetchHapiPatientPage(
  url?: string
): Promise<FhirBundle<FhirPatient>> {
  const requestUrl =
    url ?? `${HAPI_BASE_URL}/Patient?_count=20`;

  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/fhir+json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `HAPI request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();

}

export function getNextPageUrl<T>(
  bundle: FhirBundle<T>
): string | undefined {
  return bundle.link?.find(
    (link) => link.relation === "next"
  )?.url;
}