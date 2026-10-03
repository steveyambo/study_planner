import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase } = await requireUser();
  let result = "failed";
  try {
    const id = String((await request.formData()).get("id") ?? "");
    if (!isCourseId(id)) result = "invalid";
    else {
      const { data, error } = await supabase.rpc("complete_study_session", { p_session_id: id });
      result = error ? error.code === "PGRST202" ? "migration" : "failed"
        : ["completed", "missing", "unavailable", "future"].includes(data) ? data : "failed";
    }
  } catch { result = "failed"; }
  const destination = new URL("/dashboard", request.url);
  destination.searchParams.set("result", result);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
