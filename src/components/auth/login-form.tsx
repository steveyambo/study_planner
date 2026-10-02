"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      const { error: loginError } = await createClient().auth.signInWithPassword({
        email: String(fields.get("email") ?? "").trim(),
        password: String(fields.get("password") ?? ""),
      });
      if (loginError) {
        setError(loginError.code === "email_not_confirmed"
          ? "Confirme ton email avant de te connecter. Tu peux demander un nouveau lien sur la page d’inscription."
          : loginError.status === 429
            ? "Trop de tentatives. Attends quelques minutes avant de réessayer."
            : "Connexion impossible. Vérifie ton email et ton mot de passe.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Impossible de joindre le service de connexion. Réessaie dans quelques instants.");
    } finally {
      setPending(false);
    }
  }

  const inputStyle = "mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 focus:border-indigo-600 focus:outline-2 focus:outline-indigo-600";
  return (
    <form onSubmit={login} className="mt-8 space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
        <legend className="sr-only">Identifiants de connexion</legend>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputStyle} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputStyle} />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
        <button className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
          {pending ? "Connexion en cours…" : "Se connecter"}
        </button>
      </fieldset>
      <p className="text-sm text-slate-600">Pas encore de compte ? <Link href="/register" className="font-semibold text-indigo-700 underline">Créer un compte</Link></p>
    </form>
  );
}
