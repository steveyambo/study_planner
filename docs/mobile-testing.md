# Tester sur telephone avec ngrok

Le tunnel HTTPS expose temporairement l'application compilee. La connexion reste obligatoire pour les pages privees. L'inspection des requetes ngrok est desactivee pour ne pas conserver les formulaires de connexion dans son inspecteur local.

1. Compiler avec `npm.cmd run build`.
2. Dans un terminal, lancer `ngrok http http://127.0.0.1:3001 --inspect=false`. Garder ce terminal actif et relever l'adresse HTTPS affichee.
3. Dans un autre terminal, definir l'adresse pour cette instance seulement et lancer le serveur :

```powershell
$env:APP_PUBLIC_ORIGIN = 'https://ADRESSE-DU-TUNNEL.ngrok-free.app'
npm.cmd run start -- --hostname 127.0.0.1 --port 3001
```

Ouvrir cette adresse sur le telephone, puis se connecter avec son compte habituel. Le PC et les deux processus doivent rester actifs. Ngrok peut afficher une page d'accueil avant le site : utiliser « Visit Site ».

`APP_PUBLIC_ORIGIN` est une variable serveur facultative. Elle donne une origine publique explicite aux redirections et aux controles d'origine des formulaires derriere le tunnel. Sans cette variable, le fonctionnement local habituel est conserve. Les en-tetes `X-Forwarded-Host` et `X-Forwarded-Proto` ne peuvent pas choisir l'origine autorisee. Une nouvelle adresse ngrok demande de relancer le serveur avec sa nouvelle valeur. Cette valeur n'est pas une cle Supabase ; les cles et mots de passe ne doivent jamais etre places dans l'URL.

Pour une inscription avec confirmation par courriel, ajouter l'URL exacte du callback du tunnel (`https://ADRESSE-DU-TUNNEL.ngrok-free.app/auth/callback`) aux URL de redirection autorisees dans Supabase. Ouvrir le lien dans le meme navigateur du telephone qui a lance l'inscription.

Pour arreter le test, fermer le tunnel et le serveur avec Ctrl+C dans leurs terminaux. Dans le terminal qui servait l'application, retirer la variable temporaire avec `Remove-Item Env:APP_PUBLIC_ORIGIN` avant de relancer un serveur local sans tunnel. Le port 3000 du serveur de developpement existant reste independant.
