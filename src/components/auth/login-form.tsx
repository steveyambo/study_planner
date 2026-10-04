"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

export function LoginForm({ error }: { error: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form action="/auth/login" method="post" onSubmit={() => setPending(true)} className="mt-7 space-y-5" aria-busy={pending}>
      <fieldset className="space-y-5">
        <legend className="sr-only">Identifiants de connexion</legend>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" required className="field-input" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
        <Button disabled={pending} size="lg" className="w-full">
          {pending ? "Connexion en cours…" : "Se connecter"}
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        </Button>
      </fieldset>
      <p className="text-center text-sm text-slate-500">Pas encore de compte ? <Link href="/register" className="inline-flex min-h-11 items-center font-semibold text-indigo-700 underline underline-offset-4">Créer un compte</Link></p>
    </form>
  );
}
