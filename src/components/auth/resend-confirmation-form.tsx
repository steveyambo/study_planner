"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResendConfirmationForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setMessage("");
    if (Date.now() < retryAfter) {
      setError("Attends au moins une minute entre deux demandes d’envoi.");
      return;
    }
    const email = String(new FormData(event.currentTarget).get("resendEmail") ?? "").trim();
    setPending(true);
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendError) {
        setError(resendError.status === 429
          ? "La limite d’envoi Supabase est atteinte. Attends avant de réessayer ; avec le service email intégré, le quota peut être horaire."
          : "Le renvoi n’a pas abouti. Vérifie ton adresse et réessaie plus tard. Si ton compte est déjà confirmé, aucun nouvel email de confirmation n’est nécessaire.");
      } else {
        setMessage("Demande reçue. Si ce compte attend une confirmation, consulte ta messagerie et utilise uniquement le nouvel email, dans ce navigateur.");
      }
      setRetryAfter(Date.now() + 60_000);
    } catch {
      setError("Impossible de joindre Supabase. Vérifie ta connexion et réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="mt-6 border-t border-slate-100 pt-3">
      <summary className="flex min-h-11 items-center justify-between gap-2 text-sm font-medium text-slate-600">Email de confirmation non reçu ?<ChevronDown className="disclosure-chevron size-4 shrink-0" aria-hidden="true" /></summary>
      <p className="mt-2 text-sm leading-6 text-slate-600">Demande un nouveau lien sans recommencer ton inscription.</p>
      <form onSubmit={resend} className="mt-4 space-y-3" aria-busy={pending}>
        <label htmlFor="resendEmail" className="block text-sm font-medium">Email du compte</label>
        <input id="resendEmail" name="resendEmail" type="email" autoComplete="email" required disabled={pending} className="field-input" />
        {error && <p role="alert" className="text-sm leading-6 text-red-800">{error}</p>}
        {message && <p role="status" className="text-sm leading-6 text-indigo-800">{message}</p>}
        <Button variant="outline" disabled={pending} className="w-full">
          {pending ? "Envoi en cours…" : "Renvoyer l’email de confirmation"}
        </Button>
      </form>
    </details>
  );
}
