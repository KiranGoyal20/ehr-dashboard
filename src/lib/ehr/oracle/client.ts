import {
    FhirBundle,
    FhirPatient,
    FhirCondition,
    FhirMedicationRequest,
} from "../types";

export const ORACLE_BASE_URL =
    "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d";

const MAX_RETRIES = 3;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOracle<T>(
    url: string,
    attempt = 0
): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: "application/fhir+json",
        },
        cache: "no-store",
    });

    if (response.ok) {
        return response.json();
    }

    const isRateLimited = response.status === 429;
    const isServerError = response.status >= 500;

    if (
        (isRateLimited || isServerError) &&
        attempt < MAX_RETRIES
    ) {
        let delayMs = 1000 * Math.pow(2, attempt);

        const retryAfter =
            response.headers.get("retry-after");

        if (isRateLimited && retryAfter) {
            const seconds = Number(retryAfter);

            if (!Number.isNaN(seconds)) {
                delayMs = seconds * 1000;
            }
        }

        console.warn(
            `Oracle request ${response.status}. Retrying in ${delayMs}ms: ${url}`
        );

        await sleep(delayMs);

        return fetchOracle<T>(url, attempt + 1);
    }

    const body = await response.text();

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