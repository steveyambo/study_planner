# Phase 7 : authentification

## Partie 1 : sessions

- `src/lib/supabase/server.ts` cree un client par requete avec les cookies Next.js.
- `src/lib/supabase/proxy.ts` verifie les jetons avec `getClaims()` et transmet
  les cookies actualises au rendu serveur et au navigateur.
- Les en-tetes anti-cache fournis par Supabase sont conserves avec les cookies.
- `src/proxy.ts` cible les routes d'authentification et de l'application.
  L'accueil et les fichiers statiques ne passent pas par ce controle.

Cette partie prepare la session. Elle ne protege pas encore le tableau de bord.
La protection sera ajoutee avec `/login` et `/register`, pour disposer d'une
destination fonctionnelle lors de la redirection des visiteurs non connectes.

Le renouvellement d'une vraie session sera teste apres creation des formulaires.

Verification de cette partie : ESLint et TypeScript sans erreur ; requetes HTTP
sans session sur `/`, `/dashboard` et `/next.svg` reussies (200).

Reference : https://supabase.com/docs/guides/auth/server-side/creating-a-client
