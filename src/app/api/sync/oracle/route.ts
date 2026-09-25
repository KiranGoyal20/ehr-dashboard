import { NextResponse } from "next/server";
import { syncOraclePatients } from "@/lib/ehr/oracle/sync";

export async function POST() {
  try {
    const result = await syncOraclePatients();

    return NextResponse.json({
      source: "ORACLE",
      status: "completed",
      ...result,
    });
  } catch (error) {
    console.error("Oracle sync failed:", error);

    return NextResponse.json(
      {
        source: "ORACLE",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}