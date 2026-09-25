"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Patient, PatientResponse } from "@/types/patient";

type EhrSource = "HAPI" | "ORACLE" | "EPIC";

const sources: { id: EhrSource; label: string; enabled: boolean }[] = [
    { id: "HAPI", label: "HAPI FHIR", enabled: true },
    { id: "ORACLE", label: "Oracle Health", enabled: true },
    { id: "EPIC", label: "Epic", enabled: false },
];

export default function PatientDashboard() {
    const searchParams = useSearchParams();

    const initialSource =
        searchParams.get("source") === "ORACLE"
            ? "ORACLE"
            : "HAPI";

    const [source, setSource] = useState(initialSource);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] =
        useState<PatientResponse["pagination"] | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();

    useEffect(() => {
        async function loadPatients() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `/api/patients?source=${source}&page=${page}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load patients");
                }

                const result: PatientResponse = await response.json();

                setPatients(result.data);
                setPagination(result.pagination);
            } catch (error) {
                console.error(error);
                setError("Unable to load patient data.");
            } finally {
                setLoading(false);
            }
        }

        loadPatients();
    }, [source, page]);

    function changeSource(newSource: EhrSource) {
        setSource(newSource);
        setPage(1);

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
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-gray-900">
                        EHR Patient Dashboard
                    </h1>

                    <p className="mt-2 text-gray-600">
                        Patient data synchronized from FHIR sandbox environments.
                    </p>
                </div>

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
                                {pagination
                                    ? `${pagination.total} records`
                                    : "Loading records..."}
                            </p>
                        </div>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                            {source}
                        </span>
                    </div>

                    {loading && (
                        <div className="p-10 text-center text-gray-500">
                            Loading patients...
                        </div>
                    )}

                    {error && (
                        <div className="p-10 text-center text-red-600">
                            {error}
                        </div>
                    )}

                    {!loading && !error && patients.length === 0 && (
                        <div className="p-10 text-center text-gray-500">
                            No patients found.
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