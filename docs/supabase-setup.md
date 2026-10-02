# Configuration Supabase

## Créer le projet

1. Ouvrir https://supabase.com/dashboard et se connecter.
2. Créer un projet nommé `study-planner` dans son organisation.
3. Choisir un mot de passe de base de données et le conserver dans son gestionnaire de mots de passe.
4. Attendre que le projet soit prêt, puis ouvrir le dialogue **Connect**.
5. Récupérer le **Project URL** et la clé publique **publishable**.

## Configurer l’application

À la racine de `study-planner`, copier `.env.example` en `.env.local` :

```powershell
Copy-Item .env.example .env.local
```

Renseigner les deux variables dans `.env.local`, puis redémarrer `npm.cmd run dev`.
Une clé publique `anon` héritée peut également être utilisée comme valeur de
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Ne pas utiliser de clé `secret` ou `service_role` dans ces variables publiques.
Le fichier `.env.local` est ignoré par Git ; seul le modèle vide est versionné.

## État de cette étape

Les bibliothèques officielles et le client navigateur sont préparés.
La connexion réelle nécessite les valeurs du projet. Les tables, leurs politiques
de sécurité, le client serveur et le renouvellement des sessions seront ajoutés
aux étapes base de données et authentification, avant toute gestion de données utilisateur.

Documentation : https://supabase.com/docs/guides/auth/server-side/creating-a-client

## Validation de la connexion — 2 octobre 2026

- Les deux variables requises sont renseignées dans `.env.local`.
- Une requête en lecture seule à `/auth/v1/settings` avec la clé publique a répondu HTTP 200.
- `.env.local` est bien exclu de Git.

La connexion au service Auth est validée. Ce contrôle ne valide pas encore
les tables, les politiques de sécurité ou les parcours d'inscription et de connexion.
La prochaine étape est la création du schéma de base de données.
