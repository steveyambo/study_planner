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

## Renvoi de confirmation

Un formulaire sur `/register` appelle `auth.resend({ type: 'signup', email })`
pour les comptes existants non confirmes. Il impose une minute entre demandes
dans l'interface et signale les limites d'envoi renvoyees par Supabase.
Une reponse sans erreur ne prouve pas la livraison de l'email.

Le message d'echec de callback n'affirme plus que le lien est expire : cette
route peut aussi echouer faute de code ou de cookie PKCE dans le navigateur.
Utiliser uniquement le nouveau lien, dans le navigateur de la demande.
Si le compte est deja confirme, il faut se connecter plutot que se reinscrire.
Le service email integre Supabase a un quota de 2 emails par heure ; verifier
les logs Auth et la configuration SMTP si le quota empeche les tests.

References :
- https://supabase.com/docs/reference/javascript/auth-resend
- https://supabase.com/docs/guides/auth/passwords

## Diagnostic du premier retour de confirmation

La capture Supabase montre le compte confirme ; elle ne prouve pas que la session
a ete creee. L'ancien callback masquait toutes les erreurs sous un message unique
et n'enregistrait pas leur code. La cause historique ne peut donc pas etre deduite
de ce message. Les logs Auth autour de l'echange `/token` sont a consulter.

Le callback distingue maintenant code absent, verificateur PKCE absent ou
incorrect, tentative expiree, tentative introuvable et autre erreur d'echange.
Il journalise uniquement le code d'erreur, son statut et une categorie fixe.
Aucun code de connexion, URL complete, cookie ou mot de passe n'est journalise
par ce diagnostic. Le diagnostic historique reste ouvert ; ne pas recreer le compte.
