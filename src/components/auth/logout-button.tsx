"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <Button variant="ghost" onClick={logout} disabled={pending} className="w-full justify-start text-slate-500">
        <LogOut className="size-4" aria-hidden="true" />
        {pending ? "Déconnexion…" : "Se déconnecter"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}
