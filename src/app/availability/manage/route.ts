import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";
import { sessionMinutes } from "@/lib/courses/session-time";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  function finish(result: string) {
    const destination = new URL("/availability", request.url);
    destination.searchParams.set("result", result);
    const response = NextResponse.redirect(destination, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  try {
    const fields = await request.formData();
    const action = fields.get("action");
    const id = String(fields.get("id") ?? "");
    if ((id && !isCourseId(id)) || (action !== "save" && action !== "delete")) return finish("invalid");
    if (action === "delete") {
      if (!id) return finish("invalid");
      const { data, error } = await supabase.from("availabilities").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      return finish(error ? "failed" : data ? "deleted" : "missing");
    }
    const day_of_week = Number(fields.get("day_of_week"));
    const start_time = String(fields.get("start_time") ?? "");
    const end_time = String(fields.get("end_time") ?? "");
    if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7 || sessionMinutes(start_time, end_time) === null) return finish("invalid");
    let conflicts = supabase.from("availabilities").select("id").eq("user_id", userId).eq("day_of_week", day_of_week).lt("start_time", end_time).gt("end_time", start_time);
    if (id) conflicts = conflicts.neq("id", id);
    const { data: overlapping, error: overlapError } = await conflicts.limit(1);
    if (overlapError) return finish("failed");
    if (overlapping?.length) return finish("overlap");
    const values = { day_of_week, start_time, end_time };
    const query = id ? supabase.from("availabilities").update(values).eq("id", id).eq("user_id", userId) : supabase.from("availabilities").insert({ ...values, user_id: userId });
    const { data, error } = await query.select("id").maybeSingle();
    return finish(error ? error.code === "23505" ? "overlap" : "failed" : !data ? "missing" : id ? "updated" : "created");
  } catch { return finish("failed"); }
}
