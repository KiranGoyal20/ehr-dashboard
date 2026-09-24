import { syncHapiPatients } from "@/lib/ehr/hapi/sync";

export async function POST() {
  try {
    const result = await syncHapiPatients();

    return Response.json({
      status: "success",
      source: "HAPI",
      ...result,
    });
  } catch (error) {
    console.error("HAPI sync failed:", error);

    return Response.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}