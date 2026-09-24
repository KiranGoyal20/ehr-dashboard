import { getPatients } from "@/lib/db/patients";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const source = searchParams.get("source") ?? "HAPI";

    const requestedPage = Number(
      searchParams.get("page") ?? 1
    );

    const page =
      Number.isFinite(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit = 20;

    const { patients, total } = await getPatients(
      source,
      page,
      limit
    );

    return Response.json({
      data: patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch patients:", error);

    return Response.json(
      { message: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}