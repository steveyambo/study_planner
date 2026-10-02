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

  // Vérifie le jeton et déclenche son renouvellement lorsque nécessaire.
  // Les contrôles d'accès seront ajoutés avec les pages d'authentification.
  await supabase.auth.getClaims();

  return response;
}
