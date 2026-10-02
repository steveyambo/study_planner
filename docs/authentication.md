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

L'utilisateur a ensuite confirme avec succes une nouvelle adresse et estime
avoir ouvert le premier lien dans un autre navigateur. Cette explication est
compatible avec PKCE ; la cause historique n'est pas prouvee faute de traces.

## Partie 3 : connexion, protection et deconnexion

- `/login` appelle `signInWithPassword` et distingue email non confirme,
  limite de tentatives et identifiants refuses.
- Le proxy redirige les visiteurs sans identite valide vers `/login` pour les
  six routes privees du guide, y compris leurs sous-routes.
- Le tableau de bord verifie aussi l'identite dans son rendu serveur avec
  `requireUser`, puis charge uniquement le nom du profil correspondant.
- Le bouton de deconnexion ferme la session du navigateur (`scope: local`).
- Les utilisateurs connectes sont rediriges depuis `/login` et `/register`
  vers `/dashboard`. Les reponses privees ne sont pas mises en cache.

Verification : ESLint et TypeScript sans erreur, page login HTTP 200,
redirection sans session de dashboard et des autres routes privees vers login.
Le test reel connexion/deconnexion, le rechargement avec session et l'isolation
entre deux comptes connectes restent a effectuer ; cette phase n'est pas encore
entierement validee.

Test utilisateur : se connecter avec un compte confirme, verifier son nom,
recharger le tableau de bord, se deconnecter puis tenter d'ouvrir `/dashboard`.
La page doit alors renvoyer vers `/login`.

## Correction du retour apres connexion

L'utilisateur restait sur `/login`. Le formulaire utilise maintenant une Server
Action : connexion Supabase, ecriture des cookies avec erreurs non masquees,
invalidation du cache de layout, puis redirection serveur vers `/dashboard`.
Il ne lance plus `router.replace` et `router.refresh` a la suite apres une
connexion navigateur. La cause historique reste a confirmer : aucune trace
ne permet d'affirmer que le cache etait seul responsable.
Le parcours avec les identifiants reels doit etre reteste par l'utilisateur.

## Correction de la navigation avec URL modifiee mais contenu conserve

Apres le premier correctif, l'utilisateur rapporte que l'URL change mais que
le formulaire de connexion reste affiche. Le formulaire fait desormais un POST
HTML natif vers `/auth/login`, sans navigation React ni Server Action.
La reponse HTTP 303 contient directement les cookies de session et la destination
`/dashboard`. Le navigateur charge ensuite un nouveau document.
Le POST refuse les origines externes ; les messages d'erreur sont des categories
fixes, et aucun identifiant n'est ajoute a l'URL. Les champs restent actifs pendant
la soumission pour etre inclus dans le POST ; seul le bouton est desactive.
Le resultat avec un compte reel reste a valider dans le navigateur de l'utilisateur.
