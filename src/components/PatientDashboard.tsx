"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Patient, PatientResponse } from "@/types/patient";

type EhrSource = "HAPI" | "ORACLE" | "EPIC";

const sources: { id: EhrSource; label: string; enabled: boolean }[] = [
    { id: "HAPI", label: "HAPI FHIR", enabled: true },
    { id: "ORACLE", label: "Oracle Health", enabled: true },
    { id: "EPIC", label: "Epic (SMART)", enabled: true },
];

export default function PatientDashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const sourceParam = searchParams.get("source");
    const source: EhrSource =
        sourceParam === "ORACLE"
            ? "ORACLE"
            : sourceParam === "EPIC"
                ? "EPIC"
                : "HAPI";

    const [patients, setPatients] = useState<Patient[]>([]);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] =
        useState<PatientResponse["pagination"] | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    // Watch for OAuth return parameters
    useEffect(() => {
        if (searchParams.get("synced") === "true") {
            setSyncFeedback({
                type: "success",
                message: "Successfully authenticated with Epic and synchronized patient clinical data!",
            });
        } else if (searchParams.get("error")) {
            setSyncFeedback({
                type: "error",
                message: `Epic OAuth: ${searchParams.get("error")}`,
            });
        }
    }, [searchParams]);

    // Whenever source in URL changes, reset pagination and clear stale patients immediately
    useEffect(() => {
        setPage(1);
        setPatients([]);
        setPagination(null);
        setError(null);
        if (!searchParams.get("synced") && !searchParams.get("error") && !searchParams.get("warning")) {
            setSyncFeedback(null);
        }
    }, [source, searchParams]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadPatients() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `/api/patients?source=${source}&page=${page}`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error("Failed to load patients");
                }

                const result: PatientResponse = await response.json();

                if (!controller.signal.aborted) {
                    setPatients(result.data);
                    setPagination(result.pagination);
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.name === "AbortError") {
                    return; // Ignore aborted requests from tab switching
                }
                console.error(err);
                setError("Unable to load patient data. Please check your connection and try again.");
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadPatients();

        return () => {
            // Cancel any in-flight request when source or page changes
            controller.abort();
        };
    }, [source, page, reloadKey]);

    function handleRetry() {
        setReloadKey((k) => k + 1);
    }

    async function handleSync() {
        if (syncing) return;

        // Epic uses interactive SMART on FHIR OAuth 2.0 PKCE launch
        if (source === "EPIC") {
            window.location.href = "/api/auth/epic/login";
            return;
        }

        try {
            setSyncing(true);
            setSyncFeedback(null);

            const endpoint =
                source === "ORACLE" ? "/api/sync/oracle" : "/api/sync/hapi";

            const response = await fetch(endpoint, { method: "POST" });
            const data = await response.json();

            if (!response.ok || data.status === "error" || data.status === "failed") {
                throw new Error(data.error || data.message || "Sync request failed");
            }

            const pCount = data.patientsProcessed ?? 0;
            const cCount = data.conditionsProcessed ?? 0;
            const mCount = data.medicationsProcessed ?? 0;

            setSyncFeedback({
                type: "success",
                message: `Successfully synced ${source}: ${pCount} patients, ${cCount} conditions, and ${mCount} medications processed.`,
            });

            handleRetry();
        } catch (err: unknown) {
            console.error(err);
            setSyncFeedback({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Failed to trigger synchronization.",
            });
        } finally {
            setSyncing(false);
        }
    }

    function changeSource(newSource: EhrSource) {
        if (newSource === source) return;

        setPatients([]);
        setPagination(null);
        setPage(1);
        setError(null);
        setSyncFeedback(null);
        setLoading(true);

        router.replace(`/?source=${newSource}`);
    }

    function formatDate(date: string | null) {
        if (!date) return "—";

        const [year, month, day] = date.split("-");

        return `${day}/${month}/${year}`;
    }

    return (
        <main className="min-h-screen bg-gray-50 px-6 py-10">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900">
                            EHR Patient Dashboard
                        </h1>

                        <p className="mt-2 text-gray-600">
                            Patient data synchronized from FHIR sandbox environments.
                        </p>
                    </div>

                    <button
                        disabled={syncing}
                        onClick={handleSync}
                        className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <svg
                            className={`h-4 w-4 text-gray-600 ${syncing ? "animate-spin" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        {syncing
                            ? `Syncing ${source}...`
                            : source === "EPIC"
                                ? "Connect Epic (SMART OAuth)"
                                : `Sync ${source} Data`}
                    </button>
                </div>

                {syncFeedback && (
                    <div
                        className={`mb-6 flex items-center justify-between rounded-lg p-4 text-sm ${
                            syncFeedback.type === "success"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border border-red-200 bg-red-50 text-red-800"
                        }`}
                    >
                        <span>{syncFeedback.message}</span>
                        <button
                            onClick={() => setSyncFeedback(null)}
                            className="ml-3 font-semibold hover:opacity-75"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="mb-6 flex gap-3">
                    {sources.map((item) => (
                        <button
                            key={item.id}
                            disabled={!item.enabled}
                            onClick={() => changeSource(item.id)}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${source === item.id
                                ? "border-gray-900 bg-gray-900 text-white"
                                : item.enabled
                                    ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                    : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                }`}
                        >
                            {item.label}

                            {!item.enabled && (
                                <span className="ml-2 text-xs">
                                    Coming soon
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                        <div>
                            <h2 className="font-semibold text-gray-900">
                                Patients
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                {loading
                                    ? "Loading records..."
                                    : pagination
                                        ? `${pagination.total} records`
                                        : "0 records"}
                            </p>
                        </div>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                            {source}
                        </span>
                    </div>

                    {loading && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-sm text-gray-600">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Patient</th>
                                        <th className="px-6 py-3 font-medium">Gender</th>
                                        <th className="px-6 py-3 font-medium">Date of Birth</th>
                                        <th className="px-6 py-3 font-medium">FHIR ID</th>
                                        <th className="px-6 py-3 font-medium text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {[...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-36 rounded bg-gray-200"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-16 rounded bg-gray-200"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-24 rounded bg-gray-200"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-44 rounded bg-gray-200"></div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="ml-auto h-4 w-4 rounded bg-gray-200"></div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="p-8 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="mt-3 text-base font-semibold text-gray-900">
                                Failed to load {source} patients
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {error}
                            </p>
                            <button
                                onClick={handleRetry}
                                className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {!loading && !error && patients.length === 0 && (
                        <div className="p-12 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <h3 className="mt-3 text-base font-semibold text-gray-900">
                                No {source === "EPIC" ? "Epic" : source} patients found
                            </h3>
                            <p className="mt-1 max-w-md text-sm text-gray-500">
                                {source === "EPIC"
                                    ? "No Epic patients synced yet. Click \"Connect Epic (SMART OAuth)\" above to authenticate with Epic's open sandbox and import patient data."
                                    : "No records are currently available in the database for this EHR source."}
                            </p>
                        </div>
                    )}

                    {!loading && !error && patients.length > 0 && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-sm text-gray-600">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">
                                                Patient
                                            </th>
                                            <th className="px-6 py-3 font-medium">
                                                Gender
                                            </th>
                                            <th className="px-6 py-3 font-medium">
                                                Date of Birth
                                            </th>
                                            <th className="px-6 py-3 font-medium">
                                                FHIR ID
                                            </th>
                                            <th className="px-6 py-3 font-medium text-right">
                                                Details
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {patients.map((patient) => (
                                            <tr
                                                key={patient.id}
                                                onClick={() => router.push(`/patients/${patient.id}?source=${source}`)}
                                                className="cursor-pointer hover:bg-gray-50"
                                            >
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {[
                                                        patient.first_name,
                                                        patient.last_name,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ") || "Unknown patient"}
                                                </td>

                                                <td className="px-6 py-4 capitalize text-gray-600">
                                                    {patient.gender ?? "—"}
                                                </td>

                                                <td className="px-6 py-4 text-gray-600">
                                                    {patient.birth_date
                                                        ? formatDate(patient.birth_date)
                                                        : "—"}
                                                </td>

                                                <td className="max-w-48 truncate px-6 py-4 font-mono text-xs text-gray-500">
                                                    {patient.external_id}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-400">
                                                    →
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {pagination && (
                                <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                                    <button
                                        disabled={page === 1}
                                        onClick={() =>
                                            setPage((current) =>
                                                Math.max(1, current - 1)
                                            )
                                        }
                                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                    >
                                        Previous
                                    </button>

                                    <span className="text-sm text-gray-600">
                                        Page {pagination.page} of{" "}
                                        {pagination.totalPages}
                                    </span>

                                    <button
                                        disabled={
                                            page >= pagination.totalPages
                                        }
                                        onClick={() =>
                                            setPage((current) => current + 1)
                                        }
                                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}