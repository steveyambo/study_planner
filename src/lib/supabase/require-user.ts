import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

// Réutilisé uniquement dans le rendu d'une même requête.
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) redirect("/login");
  return { supabase, userId: data.claims.sub };
});
