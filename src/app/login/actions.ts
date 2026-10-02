"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

export async function login(_previous: LoginState, fields: FormData): Promise<LoginState> {
  const email = String(fields.get("email") ?? "").trim();
  const password = String(fields.get("password") ?? "");
  if (!email || !password) return { error: "Renseigne ton email et ton mot de passe." };

  try {
    const supabase = await createClient({ writable: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.code === "email_not_confirmed"
        ? "Confirme ton email avant de te connecter. Tu peux demander un nouveau lien sur la page d’inscription."
        : error.status === 429
          ? "Trop de tentatives. Attends quelques minutes avant de réessayer."
          : "Connexion impossible. Vérifie ton email et ton mot de passe." };
    }
    if (!data.session) return { error: "La connexion n’a pas créé de session. Réessaie." };
  } catch {
    return { error: "Impossible de terminer la connexion. Vérifie que le serveur peut joindre Supabase et réessaie." };
  }

  // Les cookies sont écrits avant l'invalidation et la redirection.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
