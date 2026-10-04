import { hasSameOrigin, requestOrigin } from "@/lib/http/request-origin";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { parseRevisionIntervals } from "@/lib/scheduler/revision-intervals";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  let result = "failed";
  try {
    const fields = await request.formData();
    const intervals = parseRevisionIntervals(String(fields.get("intervals") ?? ""));
    if (!intervals) result = "invalid";
    else {
      const { error } = await supabase.from("revision_rules").upsert({ user_id: userId, intervals }, { onConflict: "user_id" });
      result = error ? "failed" : "saved";
    }
  } catch { result = "failed"; }
  const destination = new URL("/settings", requestOrigin(request));
  destination.searchParams.set("result", result);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
