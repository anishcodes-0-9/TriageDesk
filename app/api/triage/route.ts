import { handleTriageRequest } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  return handleTriageRequest(req);
}
