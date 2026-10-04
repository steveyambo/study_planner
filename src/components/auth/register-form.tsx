"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

export function RegisterForm({ confirmationError }: { confirmationError: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(confirmationError);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("fullName") ?? "").trim();
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    const confirmation = String(fields.get("confirmation") ?? "");
    setError("");
    if (!name || !email || password.length < 8) {
      setError("Renseigne ton nom, ton email et un mot de passe d’au moins 8 caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe doivent être identiques.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signupError) {
        setError(signupError.status === 429
          ? "Trop de demandes. Attends quelques minutes avant de réessayer."
          : "L’inscription n’a pas abouti. Vérifie les informations et réessaie ; le mot de passe doit respecter les règles du projet.");
        return;
      }
      form.reset();
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setSent(true);
      }
    } catch {
      setError("Impossible de joindre le service d’inscription. Réessaie dans quelques instants.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="mt-6 rounded-xl bg-indigo-50 p-5 text-sm leading-7 text-indigo-950">
        <MailCheck className="mb-3 size-6" aria-hidden="true" />
        Si cette adresse peut être inscrite, tu recevras un email de confirmation.
        Consulte aussi les courriers indésirables et ouvre le lien dans ce même navigateur.
      </div>
    );
  }

  const inputStyle = "field-input";
  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
        <legend className="sr-only">Informations d’inscription</legend>
        <div>
          <label htmlFor="fullName" className="text-sm font-medium">Nom complet</label>
          <input id="fullName" name="fullName" autoComplete="name" required maxLength={120} className={inputStyle} />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" required maxLength={254} className={inputStyle} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} aria-describedby="password-help" />
          <p id="password-help" className="mt-2 text-xs text-slate-600">Au moins 8 caractères.</p>
        </div>
        <div>
          <label htmlFor="confirmation" className="text-sm font-medium">Confirmer le mot de passe</label>
          <PasswordInput id="confirmation" name="confirmation" autoComplete="new-password" required minLength={8} />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
        <Button type="submit" size="lg" className="w-full">
          {pending ? "Inscription en cours…" : "Créer mon compte"}
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        </Button>
      </fieldset>
    </form>
  );
}
