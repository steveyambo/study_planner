import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion | Study Planner" };

const errors: Record<string, string> = {
  required: "Renseigne ton email et ton mot de passe.",
  unconfirmed: "Confirme ton email avant de te connecter.",
  rate_limit: "Trop de tentatives. Attends quelques minutes avant de réessayer.",
  credentials: "Connexion impossible. Vérifie ton email et ton mot de passe.",
  session: "La connexion n’a pas créé de session. Réessaie.",
  service: "Impossible de terminer la connexion. Réessaie dans quelques instants.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" && Object.hasOwn(errors, params.error) ? errors[params.error] : "";
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="font-semibold text-indigo-700">Study Planner</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Bon retour</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Connecte-toi pour retrouver ton planning.</p>
        <LoginForm error={error} />
      </section>
    </main>
  );
}
