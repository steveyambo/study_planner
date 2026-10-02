import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { getConfirmationMessage } from "@/lib/supabase/confirmation-errors";

export const metadata: Metadata = { title: "Inscription | Study Planner" };

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ confirmation?: string | string[]; reason?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="font-semibold text-indigo-700">Study Planner</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Créer ton compte</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Prépare ton espace personnel pour organiser tes révisions.</p>
        <RegisterForm confirmationError={params.confirmation === "failed" ? getConfirmationMessage(params.reason) : ""} />
        <ResendConfirmationForm />
        <p className="mt-6 text-sm text-slate-600">Déjà un compte ? <Link href="/login" className="font-semibold text-indigo-700 underline">Se connecter</Link></p>
      </section>
    </main>
  );
}
