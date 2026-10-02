import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      const response = NextResponse.redirect(new URL("/dashboard", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  const response = NextResponse.redirect(new URL("/register?confirmation=failed", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
