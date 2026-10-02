import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Le rendu serveur doit recevoir les cookies actualisés lui aussi.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        const previousCookies = response.cookies.getAll();
        const previousHeaders = new Headers(response.headers);
        response = NextResponse.next({ request });

        for (const cookie of previousCookies) response.cookies.set(cookie);
        for (const name of ["cache-control", "expires", "pragma"]) {
          const value = previousHeaders.get(name);
          if (value) response.headers.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims.sub);
  const pathname = request.nextUrl.pathname;
  const privateRoutes = ["/dashboard", "/courses", "/exams", "/availability", "/calendar", "/settings"];
  const privateRoute = privateRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  let destination: string | undefined;
  if (privateRoute && !authenticated) destination = "/login";
  if (authenticated && (pathname === "/login" || pathname === "/register")) destination = "/dashboard";

  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirect.headers.set(name, value);
    }
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  if (privateRoute) response.headers.set("Cache-Control", "private, no-store");

  return response;
}
