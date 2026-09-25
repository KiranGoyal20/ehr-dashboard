import { NextResponse } from "next/server";
import crypto from "crypto";
import {
    EPIC_AUTH_URL,
    EPIC_CLIENT_ID,
    EPIC_FHIR_BASE_URL,
} from "@/lib/ehr/epic/client";

function base64Url(buffer: Buffer) {
    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export async function GET() {
    const redirectUri =
        process.env.EPIC_REDIRECT_URI ??
        "http://localhost:3000/api/auth/epic/callback";

    const state = crypto.randomUUID();

    const codeVerifier = base64Url(
        crypto.randomBytes(64)
    );

    const codeChallenge = base64Url(
        crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest()
    );

    const params = new URLSearchParams({
        response_type: "code",
        client_id: EPIC_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: "openid fhirUser",
        state,
        aud: EPIC_FHIR_BASE_URL,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(
        `${EPIC_AUTH_URL}?${params.toString()}`
    );

    response.cookies.set("epic_oauth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 600,
        path: "/",
    });

    response.cookies.set("epic_code_verifier", codeVerifier, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 600,
        path: "/",
    });

    return response;
}