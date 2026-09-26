export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  return Response.json({ error: "NOT_IMPLEMENTED" }, { status: 501 });
}
