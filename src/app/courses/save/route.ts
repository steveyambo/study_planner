import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId, parseCourse } from "@/lib/courses/validation";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  const destination = new URL("/courses", request.url);
  function finish(result: string) {
    destination.searchParams.set("result", result);
    const response = NextResponse.redirect(destination, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  try {
    const fields = await request.formData();
    const course = parseCourse(fields);
    const id = String(fields.get("id") ?? "");
    if (!course || (id && !isCourseId(id))) return finish("invalid");
    const query = id
      ? supabase.from("courses").update(course).eq("id", id).eq("user_id", userId).is("archived_at", null)
      : supabase.from("courses").insert({ ...course, user_id: userId });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return finish(error.code === "23505" ? "duplicate" : ["42703", "PGRST204"].includes(error.code) ? "period_migration" : "failed");
    if (!data) return finish("missing");
    return finish(id ? "updated" : "created");
  } catch {
    return finish("failed");
  }
}
