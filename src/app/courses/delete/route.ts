import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { isCourseId } from "@/lib/courses/validation";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  const destination = new URL("/courses", request.url);
  let result = "failed";
  try {
    const id = String((await request.formData()).get("id") ?? "");
    if (!isCourseId(id)) result = "invalid";
    else {
      const { data, error } = await supabase.from("courses").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      result = error ? "failed" : data ? "deleted" : "missing";
    }
  } catch { result = "failed"; }
  destination.searchParams.set("result", result);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
