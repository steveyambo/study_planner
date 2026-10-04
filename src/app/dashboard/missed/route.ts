import { hasSameOrigin, requestOrigin } from "@/lib/http/request-origin";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase } = await requireUser();
  let result = "failed";
  try {
    const id = String((await request.formData()).get("id") ?? "");
    if (!isCourseId(id)) result = "invalid";
    else {
      const { data, error } = await supabase.rpc("mark_study_missed", { p_session_id: id });
      result = error ? error.code === "PGRST202" ? "missed_migration" : "failed"
        : data === "future" ? "missed_future" : ["missed", "missing", "unavailable"].includes(data) ? data : "failed";
    }
  } catch { result = "failed"; }
  // Un rattrapage est d'abord un apercu : aucune autre seance n'est deplacee ici.
  const destination = new URL(result === "missed" ? "/calendar?result=missed" : `/dashboard?result=${result}`, requestOrigin(request));
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
