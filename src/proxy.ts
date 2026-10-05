import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/getting-started/:path*",
    "/courses/:path*",
    "/exams/:path*",
    "/availability/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/login/:path*",
    "/register/:path*",
    "/auth/:path*",
  ],
};
