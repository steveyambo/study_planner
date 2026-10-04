import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { getConfirmationMessage } from "@/lib/supabase/confirmation-errors";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata: Metadata = { title: "Inscription | Study Planner" };

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ confirmation?: string | string[]; reason?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <AuthLayout title="Créer ton compte" description="Un espace à toi pour organiser les cours et les révisions.">
      <RegisterForm confirmationError={params.confirmation === "failed" ? getConfirmationMessage(params.reason) : ""} />
      <ResendConfirmationForm />
      <p className="mt-6 text-center text-sm text-slate-500">Déjà un compte ? <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-indigo-700 underline underline-offset-4">Se connecter</Link></p>
    </AuthLayout>
  );
}
