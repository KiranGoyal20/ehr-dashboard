import { FhirBundle, FhirCondition, FhirMedicationRequest, FhirPatient } from "../types";

const HAPI_BASE_URL = "https://hapi.fhir.org/baseR4";

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 45000;
const BASE_DELAY_MS = 1500;
const MAX_RETRY_AFTER_MS = 30000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    if (diff > 0) {
      return Math.min(diff, MAX_RETRY_AFTER_MS);
    }
  }
  return null;
}

function getBackoffWithJitter(
  attempt: number,
  retryAfterMs?: number | null
): number {
  if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
    return Math.min(
      retryAfterMs + Math.floor(Math.random() * 500),
      MAX_RETRY_AFTER_MS
    );
  }
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(exponential + jitter, MAX_RETRY_AFTER_MS);
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

async function fetchHapi<T>(url: string, attempt = 0): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/fhir+json",
        "User-Agent": "ehr-dashboard/1.0 (Health Integration Client)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delayMs = getBackoffWithJitter(attempt);
      const isTimeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");

      console.warn(
        `HAPI fetch ${isTimeout ? "timed out" : "network failure"} (${error instanceof Error ? error.message : String(error)
        }). Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${url}`
      );

      await sleep(delayMs);
      return fetchHapi<T>(url, attempt + 1);
    }

    throw new Error(
      `HAPI request failed due to network/timeout error after ${attempt + 1} attempt(s): ` +
      `${error instanceof Error ? error.message : String(error)} (URL: ${url})`
    );
  }

  if (response.ok) {
    return response.json();
  }

  if (isTransientStatus(response.status) && attempt < MAX_RETRIES) {
    const retryAfter = response.headers.get("retry-after");
    const retryAfterMs = parseRetryAfter(retryAfter);
    const delayMs = getBackoffWithJitter(attempt, retryAfterMs);

    console.warn(
      `HAPI request returned ${response.status} ${response.statusText}${retryAfter ? ` [Retry-After: ${retryAfter}]` : ""
      }. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${url}`
    );

    await sleep(delayMs);
    return fetchHapi<T>(url, attempt + 1);
  }

  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "<unable to read response body>";
  }

  throw new Error(
    `HAPI request failed after ${attempt + 1} attempt(s): ` +
    `${response.status} ${response.statusText}\n` +
    `URL: ${url}\n` +
    `Response: ${body.slice(0, 500)}`
  );
}

export async function fetchHapiPatientPage(
  url?: string
): Promise<FhirBundle<FhirPatient>> {
  const requestUrl =
    url ?? `${HAPI_BASE_URL}/Patient?_count=20`;

  return fetchHapi<FhirBundle<FhirPatient>>(requestUrl);
}

export function getNextPageUrl<T>(
  bundle: FhirBundle<T>
): string | undefined {
  return bundle.link?.find(
    (link) => link.relation === "next"
  )?.url;
}

export async function fetchHapiConditions(
  patientId: string
): Promise<FhirBundle<FhirCondition>> {
  const url =
    `${HAPI_BASE_URL}/Condition` +
    `?patient=${encodeURIComponent(patientId)}` +
    `&_count=100`;

  return fetchHapi<FhirBundle<FhirCondition>>(url);
}

export async function fetchHapiMedications(
  patientId: string
): Promise<FhirBundle<FhirMedicationRequest>> {
  const url =
    `${HAPI_BASE_URL}/MedicationRequest` +
    `?patient=${encodeURIComponent(patientId)}` +
    `&_count=100`;

  return fetchHapi<FhirBundle<FhirMedicationRequest>>(url);
}