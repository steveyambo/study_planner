import { hasSameOrigin, requestOrigin } from "@/lib/http/request-origin";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase } = await requireUser();
  const destination = new URL("/courses", requestOrigin(request));
  let result = "failed";
  try {
    const id = String((await request.formData()).get("id") ?? "");
    if (!isCourseId(id)) result = "invalid";
    else {
      // The RPC obtains the owner from the authenticated session and preserves history.
      const { data, error } = await supabase.rpc("archive_course", { p_course_id: id });
      result = error ? error.code === "PGRST202" ? "migration" : "failed" : data ? "archived" : "missing";
    }
  } catch { result = "failed"; }
  destination.searchParams.set("result", result);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
