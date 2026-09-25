import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeEpicCodeForToken } from "@/lib/ehr/epic/client";
import { syncEpicPatientData } from "@/lib/ehr/epic/sync";

export const maxDuration = 60;

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    const cookieStore = await cookies();
    const storedState =
        cookieStore.get("epic_oauth_state")?.value ||
        cookieStore.get("epic_auth_state")?.value;
    const codeVerifier = cookieStore.get("epic_code_verifier")?.value;
    const returnTo = cookieStore.get("epic_return_to")?.value || "/?source=EPIC";

    const baseHost = url.origin;

    if (error) {
        console.error("Epic authorization error:", error, errorDescription);
        return NextResponse.redirect(
            `${baseHost}/?source=EPIC&error=${encodeURIComponent(
                errorDescription || error
            )}`
        );
    }

    if (!code || !state || state !== storedState || !codeVerifier) {
        console.error("Invalid Epic OAuth callback state or missing code/verifier");
        return NextResponse.redirect(
            `${baseHost}/?source=EPIC&error=${encodeURIComponent(
                "Invalid OAuth state or missing authorization code."
            )}`
        );
    }

    const redirectUri =
        process.env.EPIC_REDIRECT_URI ||
        new URL("/api/auth/epic/callback", request.url).toString();

    try {
        // 1. Exchange authorization code for access token via PKCE
        const tokenData = await exchangeEpicCodeForToken(
            code,
            codeVerifier,
            redirectUri
        );

        const targetPatientIds = tokenData.patient
            ? [tokenData.patient]
            : [
                "eq081-VQEgP8drUUqCWzHfw3", // Derrick Lin
                "erHIxAOdropDUHGkVZm2HgA3", // Camilla Lopez
            ];

        if (!tokenData.patient) {
            console.info(
                "Epic token response did not include a patient context ID; syncing sandbox test patients:",
                targetPatientIds
            );
        }

        let syncedCount = 0;

        for (const pid of targetPatientIds) {
            try {
                const syncResult = await syncEpicPatientData(
                    pid,
                    tokenData.access_token
                );
                syncedCount++;
                console.log(`Epic patient ${pid} synced successfully:`, syncResult);
            } catch (syncErr) {
                console.warn(`Failed to sync Epic patient ${pid}:`, syncErr);
            }
        }

        if (syncedCount === 0) {
            throw new Error(
                `Unable to fetch Epic patient record from sandbox using ID(s): ${targetPatientIds.join(", ")}`
            );
        }

        const response = NextResponse.redirect(
            `${baseHost}/?source=EPIC&synced=true&count=${syncedCount}`
        );

        // 3. Clear temporary OAuth cookies
        response.cookies.delete("epic_oauth_state");
        response.cookies.delete("epic_auth_state");
        response.cookies.delete("epic_code_verifier");
        response.cookies.delete("epic_return_to");

        return response;
    } catch (err) {
        console.error("Failed to complete Epic OAuth sync:", err);
        return NextResponse.redirect(
            `${baseHost}/?source=EPIC&error=${encodeURIComponent(
                err instanceof Error ? err.message : "Failed to sync Epic patient"
            )}`
        );
    }
}
