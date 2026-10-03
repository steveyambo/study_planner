import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";
import { parseExam } from "@/lib/exams/validation";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  function finish(result: string) {
    const destination = new URL("/exams", request.url);
    destination.searchParams.set("result", result);
    const response = NextResponse.redirect(destination, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  try {
    const fields = await request.formData();
    const action = fields.get("action");
    const id = String(fields.get("id") ?? "");
    if ((action !== "save" && action !== "delete") || (id && !isCourseId(id))) return finish("invalid");
    const exam = action === "save" ? parseExam(fields) : null;
    if (action === "save" && !exam) return finish("invalid");
    const { data: courses, error: coursesError } = await supabase.from("courses").select("id").eq("user_id", userId);
    if (coursesError) return finish("failed");
    const courseIds = (courses ?? []).map((course) => course.id);
    if (courseIds.length === 0 || (exam && !courseIds.includes(exam.course_id))) return finish("missing");

    if (action === "delete") {
      if (!id) return finish("invalid");
      const { data, error } = await supabase.from("exams").delete().eq("id", id).in("course_id", courseIds).select("id").maybeSingle();
      return finish(error ? "failed" : data ? "deleted" : "missing");
    }
    const query = id
      ? supabase.from("exams").update(exam!).eq("id", id).in("course_id", courseIds)
      : supabase.from("exams").insert(exam!);
    const { data, error } = await query.select("id").maybeSingle();
    return finish(error ? "failed" : !data ? "missing" : id ? "updated" : "created");
  } catch { return finish("failed"); }
}
