import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";
import { sessionMinutes } from "@/lib/courses/session-time";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  function finish(result: string) {
    const destination = new URL("/courses", request.url);
    destination.searchParams.set("result", result);
    const response = NextResponse.redirect(destination, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  try {
    const fields = await request.formData();
    const course_id = String(fields.get("course_id") ?? "");
    const id = String(fields.get("id") ?? "");
    const day_of_week = Number(fields.get("day_of_week"));
    const start_time = String(fields.get("start_time") ?? "");
    const end_time = String(fields.get("end_time") ?? "");
    if (!isCourseId(course_id) || (id && !isCourseId(id)) || !Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7 || sessionMinutes(start_time, end_time) === null) return finish("session_invalid");

    const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("id", course_id).eq("user_id", userId).is("archived_at", null).maybeSingle();
    if (courseError) return finish("failed");
    if (!course) return finish("missing");

    let conflicts = supabase.from("course_sessions").select("id").eq("course_id", course_id).eq("day_of_week", day_of_week).lt("start_time", end_time).gt("end_time", start_time);
    if (id) conflicts = conflicts.neq("id", id);
    const { data: overlapping, error: conflictError } = await conflicts.limit(1);
    if (conflictError) return finish("failed");
    if (overlapping?.length) return finish("session_overlap");

    const values = { course_id, day_of_week, start_time, end_time };
    const query = id
      ? supabase.from("course_sessions").update(values).eq("id", id).eq("course_id", course_id)
      : supabase.from("course_sessions").insert(values);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return finish(error.code === "23505" ? "session_overlap" : "failed");
    if (!data) return finish("missing");
    return finish(id ? "session_updated" : "session_created");
  } catch { return finish("failed"); }
}
