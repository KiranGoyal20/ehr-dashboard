import {
    FhirBundle,
    FhirPatient,
    FhirCondition,
    FhirMedicationRequest,
} from "../types";

export const ORACLE_BASE_URL =
    "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d";

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 45000; // 45 seconds: accommodates multi-tenant FHIR sandbox search latency
const BASE_DELAY_MS = 1500;
const MAX_RETRY_AFTER_MS = 30000; // 30 seconds maximum delay ceiling

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses the Retry-After header per RFC 7231 §7.1.3:
 * Accepts either delta-seconds ("120") or an HTTP-date ("Wed, 21 Oct 2026 07:28:00 GMT").
 * Returns delay in milliseconds, capped at MAX_RETRY_AFTER_MS.
 */
function parseRetryAfter(header: string | null): number | null {
    if (!header) return null;

    // Format 1: integer seconds
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }

    // Format 2: HTTP-date string
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) {
        const diff = dateMs - Date.now();
        if (diff > 0) {
            return Math.min(diff, MAX_RETRY_AFTER_MS);
        }
    }

    return null;
}

/**
 * Calculates exponential backoff with full jitter to avoid thundering-herd issues.
 */
function getBackoffWithJitter(
    attempt: number,
    retryAfterMs?: number | null
): number {
    if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
        // Add subtle jitter (up to 500ms) to Retry-After
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
    // 429 Too Many Requests, 408 Request Timeout, or transient 5xx (500, 502, 503, 504 Gateway Timeout)
    return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

async function fetchOracle<T>(
    url: string,
    attempt = 0
): Promise<T> {
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
        // Catches timeouts (AbortError/TimeoutError) and socket/network drops
        if (attempt < MAX_RETRIES) {
            const delayMs = getBackoffWithJitter(attempt);
            const isTimeout =
                error instanceof Error &&
                (error.name === "TimeoutError" || error.name === "AbortError");

            console.warn(
                `Oracle fetch ${isTimeout ? "timed out" : "network failure"} (${error instanceof Error ? error.message : String(error)
                }). Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${url}`
            );

            await sleep(delayMs);
            return fetchOracle<T>(url, attempt + 1);
        }

        throw new Error(
            `Oracle request failed due to network/timeout error after ${attempt + 1} attempt(s): ` +
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
            `Oracle request returned ${response.status} ${response.statusText}${retryAfter ? ` [Retry-After: ${retryAfter}]` : ""
            }. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${url}`
        );

        await sleep(delayMs);
        return fetchOracle<T>(url, attempt + 1);
    }

    let body = "";
    try {
        body = await response.text();
    } catch {
        body = "<unable to read response body>";
    }

    throw new Error(
        `Oracle request failed after ${attempt + 1} attempt(s): ` +
        `${response.status} ${response.statusText}\n` +
        `URL: ${url}\n` +
        `Response: ${body.slice(0, 500)}`
    );
}

export function fetchOraclePatient(
    patientId: string
): Promise<FhirPatient> {
    return fetchOracle<FhirPatient>(
        `${ORACLE_BASE_URL}/Patient/${patientId}`
    );
}

export function fetchOracleConditions(
    patientId: string
): Promise<FhirBundle<FhirCondition>> {
    return fetchOracle<FhirBundle<FhirCondition>>(
        `${ORACLE_BASE_URL}/Condition?patient=${encodeURIComponent(patientId)}`
    );
}

export function fetchOracleMedications(
    patientId: string
): Promise<FhirBundle<FhirMedicationRequest>> {
    return fetchOracle<FhirBundle<FhirMedicationRequest>>(
        `${ORACLE_BASE_URL}/MedicationRequest?patient=${encodeURIComponent(patientId)}`
    );
}

export async function fetchOraclePatientPage(
    url?: string
): Promise<FhirBundle<FhirPatient>> {
    const requestUrl =
        url ??
        `${ORACLE_BASE_URL}/Patient?family=smart&given=joe&birthdate=1990-09-15`;

    return fetchOracle<FhirBundle<FhirPatient>>(requestUrl);
}