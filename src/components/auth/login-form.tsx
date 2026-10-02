"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });

  const inputStyle = "mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 focus:border-indigo-600 focus:outline-2 focus:outline-indigo-600";
  return (
    <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
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
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{state.error}</p>}
        <button className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
          {pending ? "Connexion en cours…" : "Se connecter"}
        </button>
      </fieldset>
      <p className="text-sm text-slate-600">Pas encore de compte ? <Link href="/register" className="font-semibold text-indigo-700 underline">Créer un compte</Link></p>
    </form>
  );
}
