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

## Partie 2 : inscription

`/register` utilise `signUp` avec `full_name` pour le trigger de profil.
Le formulaire valide les champs, le mot de passe (minimum 8 caracteres) et sa
confirmation. Il bloque les doubles envois pendant une requete et n'enregistre
ni ne journalise le mot de passe. Supabase applique aussi ses regles serveur.

Si la confirmation email est active, un message invite a consulter sa boite.
Si elle est desactivee, la session obtenue mene directement au tableau de bord.
`/auth/callback` echange le code PKCE contre une session et renvoie au tableau
de bord. Le lien doit etre ouvert dans le navigateur utilise a l'inscription.

Configuration a verifier dans Supabase, **Authentication > URL Configuration** :
- Site URL : `http://localhost:3000`
- Redirect URLs : `http://localhost:3000/auth/callback`

Le test reel d'inscription et de reception de l'email reste a effectuer avec
une adresse accessible a l'utilisateur. Aucun compte de test distant n'a ete cree.

Reference : https://supabase.com/docs/reference/javascript/auth-signup
