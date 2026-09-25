import { NextResponse } from "next/server";
import { fetchOraclePatientPage } from "@/lib/ehr/oracle/client";
import { mapOraclePatient } from "@/lib/ehr/oracle/mapper";

export async function GET() {
  try {
    const firstPage = await fetchOraclePatientPage();

    const patients =
      firstPage.entry
        ?.map((entry) => entry.resource)
        .filter(
          (resource): resource is NonNullable<typeof resource> =>
            Boolean(resource)
        )
        .map(mapOraclePatient)
        .filter(
          (patient): patient is NonNullable<typeof patient> =>
            Boolean(patient)
        ) ?? [];

    const nextUrl = firstPage.link?.find(
      (link) => link.relation === "next"
    )?.url;

    return NextResponse.json({
      patientCount: patients.length,
      patients,
      hasNextPage: Boolean(nextUrl),
      nextUrl,
    });
  } catch (error) {
    console.error("Oracle patient test failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}