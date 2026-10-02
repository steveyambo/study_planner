"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { error: logoutError } = await createClient().auth.signOut({ scope: "local" });
      if (logoutError) {
        setError("La déconnexion a échoué. Réessaie.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Impossible de terminer la déconnexion. Réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button onClick={logout} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
        {pending ? "Déconnexion…" : "Se déconnecter"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}
