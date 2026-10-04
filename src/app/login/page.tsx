import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLayout } from "@/components/auth/auth-layout";

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
    <AuthLayout title="Bon retour" description="Retrouve tes cours et ton planning de révision.">
      <LoginForm error={error} />
    </AuthLayout>
  );
}
