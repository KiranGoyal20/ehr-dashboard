import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const source = searchParams.get("source") ?? "HAPI";
    const page = Math.max(
      Number(searchParams.get("page") ?? 1),
      1
    );

    const limit = 20;
    const offset = (page - 1) * limit;

    const [patientsResult, countResult] = await Promise.all([
      db.query(
        `
          SELECT
            id,
            source,
            external_id,
            first_name,
            last_name,
            gender,
            birth_date
          FROM patients
          WHERE source = $1
          ORDER BY last_name NULLS LAST, first_name NULLS LAST
          LIMIT $2 OFFSET $3
        `,
        [source, limit, offset]
      ),

      db.query(
        `
          SELECT COUNT(*)::int AS total
          FROM patients
          WHERE source = $1
        `,
        [source]
      ),
    ]);

    return Response.json({
      data: patientsResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(
          countResult.rows[0].total / limit
        ),
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