import { requestOrigin } from "@/lib/http/request-origin";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyConfirmationError, type ConfirmationFailure } from "@/lib/supabase/confirmation-errors";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  let reason: ConfirmationFailure = "missing_code";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      const response = NextResponse.redirect(new URL("/dashboard", requestOrigin(request)));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    reason = classifyConfirmationError(error.code);
    // Ne jamais journaliser l'URL, le code de connexion ou les cookies.
    console.warn("[auth/callback]", {
      reason,
      errorCode: error.code && /^[a-z_]{1,80}$/.test(error.code) ? error.code : "unknown",
      status: error.status,
    });
  } else {
    console.warn("[auth/callback]", { reason });
  }
  const destination = new URL("/register", requestOrigin(request));
  destination.searchParams.set("confirmation", "failed");
  destination.searchParams.set("reason", reason);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
