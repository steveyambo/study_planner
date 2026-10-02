import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return new NextResponse("Requête non autorisée", { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  function fail(reason: string) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("error", reason);
    response.headers.set("Location", destination.toString());
    return response;
  }

  try {
    const fields = await request.formData();
    const email = fields.get("email");
    const password = fields.get("password");
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return fail("required");
    }
    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookies, headers) {
          for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
          for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        },
      },
    });
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return fail(error.code === "email_not_confirmed" ? "unconfirmed" : error.status === 429 ? "rate_limit" : "credentials");
    if (!data.session) return fail("session");
    return response;
  } catch {
    return fail("service");
  }
}
