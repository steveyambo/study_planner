import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  let result = "failed";
  try {
    const fields = await request.formData();
    const id = String(fields.get("id") ?? "");
    const courseId = String(fields.get("course_id") ?? "");
    if (!isCourseId(id) || !isCourseId(courseId)) result = "session_invalid";
    else {
      const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("id", courseId).eq("user_id", userId).is("archived_at", null).maybeSingle();
      if (courseError) result = "failed";
      else if (!course) result = "missing";
      else {
        const { data, error } = await supabase.from("course_sessions").delete().eq("id", id).eq("course_id", courseId).select("id").maybeSingle();
        result = error ? "failed" : data ? "session_deleted" : "missing";
      }
    }
  } catch { result = "failed"; }
  const destination = new URL("/courses", request.url);
  destination.searchParams.set("result", result);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
