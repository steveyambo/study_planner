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

## Phase 6 : appliquer le schema

Le script versionne est `supabase/migrations/202610020001_initial_schema.sql`.
Il cree les sept tables du guide avec RLS et les relations de propriete.
Les jours suivent ISO (lundi 1, dimanche 7), les heures sont locales au profil,
et l'importance d'un examen vaut 1 (faible), 2 (normale) ou 3 (elevee).
Les plages doivent commencer et finir le meme jour ; les chevauchements et les
priorites seront traites dans les phases de planification du guide.

1. Ouvrir le projet Supabase, puis **SQL Editor** et **New query**.
2. Copier tout le script de migration et cliquer **Run**.
3. Executer ensuite `supabase/checks/initial_schema.sql`.
4. Verifier les sept tables avec RLS active et une politique chacune,
   puis la presence du trigger `study_planner_user_created`.

Cette migration doit etre executee une seule fois sur un projet sans ces tables.
Elle ne supprime aucune table existante et s'annule en cas d'erreur.
Le script a ete applique dans Supabase : la capture du schema montre les sept tables et leurs relations.
L'isolation entre deux comptes sera testee avant de terminer l'authentification.

Validation locale effectuee sur PostgreSQL 17 : migration executee, sept tables
avec RLS, trigger present, profils et intervalles initiaux crees automatiquement.
Le test `supabase/checks/ownership_local.sql` a confirme qu'un compte ne peut pas
lire ou modifier le cours d'un autre, ajouter un horaire a ce cours ni y rattacher
une revision. Les horaires inverses et intervalles non positifs sont refuses.
Ces tests utilisent un schema `auth` simule dans une base jetable ; ils devront
etre completes par des tests de vrais comptes Supabase lors de l'authentification.

References :
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/managing-user-data

## Verification distante du schema — 2 octobre 2026

Les sept endpoints REST ont ete controles avec la cle publique sans session
utilisateur. Chacun renvoie HTTP 401 avec le code PostgreSQL `42501`
(permission refusee), conformement au retrait des droits du role `anon`.
Ce controle confirme le refus de l'acces anonyme ; il ne suffit pas a valider
les politiques RLS entre vrais utilisateurs connectes. Ce test reste prevu
pendant la phase d'authentification.
