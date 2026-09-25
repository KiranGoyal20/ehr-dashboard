"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PatientDetails } from "@/types/patient";

export const dynamic = "force-dynamic";

export default function PatientDetailsPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [patient, setPatient] =
        useState<PatientDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeSource =
        searchParams.get("source") || patient?.source || "HAPI";
    const backUrl = `/?source=${activeSource}`;
    const sourceLabel =
        activeSource === "ORACLE"
            ? "Oracle Health"
            : activeSource === "EPIC"
            ? "Epic"
            : "HAPI";

    useEffect(() => {
        async function loadPatient() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `/api/patients/${params.id}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load patient");
                }

                const result = await response.json();
                setPatient(result.data);
            } catch (error) {
                console.error(error);
                setError("Unable to load patient details.");
            } finally {
                setLoading(false);
            }
        }

        if (params.id) {
            loadPatient();
        }
    }, [params.id]);

    function formatDate(date: string | null) {
        if (!date) return "—";

        const [year, month, day] = date.split("-");

        return `${day}/${month}/${year}`;
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50 p-10 text-center text-gray-500">
                Loading patient details...
            </main>
        );
    }

    if (error || !patient) {
        return (
            <main className="min-h-screen bg-gray-50 p-10 text-center">
                <p className="text-red-600">
                    {error ?? "Patient not found."}
                </p>

                <button
                    onClick={() => router.push(backUrl)}
                    className="mt-4 text-sm font-medium text-gray-700 underline"
                >
                    Return to dashboard
                </button>
            </main>
        );
    }

    const fullName =
        [patient.first_name, patient.last_name]
            .filter(Boolean)
            .join(" ") || "Unknown patient";

    return (
        <main className="min-h-screen bg-gray-50 px-6 py-10">
            <div className="mx-auto max-w-5xl">
                <button
                    onClick={() => router.push(backUrl)}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900"
                >
                    ← Back to {sourceLabel} patients
                </button>

                <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900">
                                {fullName}
                            </h1>

                            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                                <span className="capitalize">
                                    {patient.gender ?? "Unknown gender"}
                                </span>

                                <span>
                                    DOB:{" "}
                                    {patient.birth_date
                                        ? formatDate(patient.birth_date)
                                        : "Unknown"}
                                </span>

                                <span>
                                    FHIR ID: {patient.external_id}
                                </span>
                            </div>
                        </div>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                            {patient.source}
                        </span>
                    </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                    <ClinicalSection
                        title="Conditions"
                        count={patient.conditions.length}
                    >
                        {patient.conditions.length === 0 ? (
                            <EmptyState text="No conditions found." />
                        ) : (
                            patient.conditions.map((condition) => (
                                <div
                                    key={condition.id}
                                    className="border-b border-gray-100 py-4 last:border-0"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <p className="font-medium text-gray-900">
                                            {condition.display ??
                                                "Unnamed condition"}
                                        </p>

                                        {condition.clinical_status && (
                                            <StatusBadge
                                                value={condition.clinical_status}
                                            />
                                        )}
                                    </div>

                                    {condition.code && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            Code: {condition.code}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </ClinicalSection>

                    <ClinicalSection
                        title="Medications"
                        count={patient.medications.length}
                    >
                        {patient.medications.length === 0 ? (
                            <EmptyState text="No medications found." />
                        ) : (
                            patient.medications.map((medication) => (
                                <div
                                    key={medication.id}
                                    className="border-b border-gray-100 py-4 last:border-0"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <p className="font-medium text-gray-900">
                                            {medication.display ??
                                                "Unnamed medication"}
                                        </p>

                                        {medication.status && (
                                            <StatusBadge
                                                value={medication.status}
                                            />
                                        )}
                                    </div>

                                    {medication.intent && (
                                        <p className="mt-1 text-sm text-gray-500">
                                            Intent: {medication.intent}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </ClinicalSection>
                </div>
            </div>
        </main>
    );
}

function ClinicalSection({
    title,
    count,
    children,
}: {
    title: string;
    count: number;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="font-semibold text-gray-900">
                    {title}
                </h2>

                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    {count}
                </span>
            </div>

            <div className="px-6">{children}</div>
        </section>
    );
}

function StatusBadge({ value }: { value: string }) {
    return (
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-600">
            {value}
        </span>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <p className="py-8 text-center text-sm text-gray-500">
            {text}
        </p>
    );
}