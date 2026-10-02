export const confirmationErrors = {
  missing_code: "Le retour de confirmation ne contient pas de code de connexion. Vérifie l’URL de retour et le modèle d’email dans Supabase.",
  missing_verifier: "Le navigateur ne possède pas les informations nécessaires pour terminer cette inscription. Elles peuvent avoir été effacées, remplacées par une nouvelle demande, ou créées dans un autre navigateur.",
  verifier_mismatch: "Les informations du navigateur ne correspondent pas à ce lien. Une autre demande d’inscription a pu les remplacer.",
  expired: "Supabase indique que ce lien de connexion a expiré.",
  unavailable: "Supabase ne retrouve plus cette tentative de connexion. Le lien peut avoir déjà été utilisé.",
  exchange_failed: "Supabase n’a pas pu établir la session après la confirmation. Le diagnostic est disponible dans le terminal du serveur.",
} as const;

export type ConfirmationFailure = keyof typeof confirmationErrors;

export function classifyConfirmationError(code?: string): ConfirmationFailure {
  switch (code) {
    case "pkce_code_verifier_not_found": return "missing_verifier";
    case "bad_code_verifier": return "verifier_mismatch";
    case "flow_state_expired":
    case "otp_expired": return "expired";
    case "flow_state_not_found": return "unavailable";
    default: return "exchange_failed";
  }
}

export function getConfirmationMessage(reason?: string | string[]) {
  if (typeof reason === "string" && Object.hasOwn(confirmationErrors, reason)) {
    return confirmationErrors[reason as ConfirmationFailure];
  }
  return "La confirmation n’a pas abouti. L’ancien message ne permet pas d’en déterminer la cause. Si ton compte est confirmé dans Supabase, ne recommence pas l’inscription.";
}
