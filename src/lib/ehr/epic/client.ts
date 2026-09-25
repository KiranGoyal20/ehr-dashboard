import {
    FhirBundle,
    FhirPatient,
    FhirCondition,
    FhirMedicationRequest,
} from "../types";

export const EPIC_CLIENT_ID =
    process.env.EPIC_CLIENT_ID || "eb0b13dd-42b6-4397-bce0-ab7bbe1efcc6";

export const EPIC_FHIR_BASE_URL =
    process.env.EPIC_FHIR_BASE_URL ||
    "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

export const EPIC_AUTH_URL =
    "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize";

export const EPIC_TOKEN_URL =
    "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token";

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 45000;
const BASE_DELAY_MS = 1500;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EpicTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    patient?: string;
    id_token?: string;
}

export async function exchangeEpicCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string
): Promise<EpicTokenResponse> {
    const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: EPIC_CLIENT_ID,
        code_verifier: codeVerifier,
    });

    const response = await fetch(EPIC_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "ehr-dashboard/1.0 (Health Integration Client)",
        },
        body: params.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Epic token exchange failed: ${response.status} ${response.statusText}\n${errorText}`
        );
    }

    return response.json();
}

async function fetchEpicResource<T>(
    url: string,
    accessToken: string,
    attempt = 0
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(url, {
            headers: {
                Accept: "application/fhir+json",
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "ehr-dashboard/1.0 (Health Integration Client)",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (error) {
        if (attempt < MAX_RETRIES) {
            const delayMs = BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
            console.warn(
                `Epic fetch error (${error instanceof Error ? error.message : String(error)}). Retrying ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${url}`
            );
            await sleep(delayMs);
            return fetchEpicResource<T>(url, accessToken, attempt + 1);
        }

        throw new Error(
            `Epic request failed after ${attempt + 1} attempt(s): ` +
            `${error instanceof Error ? error.message : String(error)} (URL: ${url})`
        );
    }

    if (response.ok) {
        return response.json();
    }

    const isTransient = response.status === 429 || response.status === 408 || (response.status >= 500 && response.status <= 599);

    if (isTransient && attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
        console.warn(
            `Epic request returned ${response.status}. Retrying in ${delayMs}ms: ${url}`
        );
        await sleep(delayMs);
        return fetchEpicResource<T>(url, accessToken, attempt + 1);
    }

    let body = "";
    try {
        body = await response.text();
    } catch {
        body = "<unable to read response>";
    }

    throw new Error(
        `Epic request failed: ${response.status} ${response.statusText}\nURL: ${url}\nResponse: ${body.slice(0, 500)}`
    );
}

export function fetchEpicPatient(
    patientId: string,
    accessToken: string
): Promise<FhirPatient> {
    return fetchEpicResource<FhirPatient>(
        `${EPIC_FHIR_BASE_URL}/Patient/${patientId}`,
        accessToken
    );
}

export function fetchEpicConditions(
    patientId: string,
    accessToken: string
): Promise<FhirBundle<FhirCondition>> {
    return fetchEpicResource<FhirBundle<FhirCondition>>(
        `${EPIC_FHIR_BASE_URL}/Condition?patient=${encodeURIComponent(patientId)}`,
        accessToken
    );
}

export function fetchEpicMedications(
    patientId: string,
    accessToken: string
): Promise<FhirBundle<FhirMedicationRequest>> {
    return fetchEpicResource<FhirBundle<FhirMedicationRequest>>(
        `${EPIC_FHIR_BASE_URL}/MedicationRequest?patient=${encodeURIComponent(patientId)}`,
        accessToken
    );
}
