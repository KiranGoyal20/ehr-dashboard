import { getPatientById } from "@/lib/db/patients";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const patient = await getPatientById(id);

    if (!patient) {
      return Response.json(
        { message: "Patient not found" },
        { status: 404 }
      );
    }

    return Response.json({
      data: patient,
    });
  } catch (error) {
    console.error("Failed to fetch patient:", error);

    return Response.json(
      { message: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}