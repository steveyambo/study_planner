# Verification de l'isolation des comptes

Les huit tables applicatives utilisent la securite au niveau des lignes (RLS). Les profils sont lies a `auth.uid()` ; les cours, disponibilites, regles et revisions utilisent leur proprietaire ; les horaires et examens passent par le cours parent. Les occurrences de cours suivent la meme isolation. Les liens composites empechent une revision ou une occurrence de referencer un cours appartenant a un autre compte.

Les routes privees recuperent l'identite des claims verifies par Supabase et ignorent un proprietaire transmis dans un formulaire. Toutes les routes POST verifient une origine identique avant toute modification. Les fonctions de planification, d'archivage et de suivi s'executent avec les droits de l'appelant, avec un chemin de recherche fixe et sans permission d'execution pour `anon`. L'ancienne fonction de premiere sauvegarde n'est plus executable par les clients authentifies.

Les tests suivants ont ete executes sur une base PostgreSQL locale avec les migrations jusqu'a 007. Les comptes fictifs et leurs donnees sont crees dans une transaction terminee par `ROLLBACK` :

- `tests/security-isolation.sql` : RLS active, permissions anonymes, absence d'acces en lecture/modification/suppression aux huit tables d'un autre compte, insertions avec un proprietaire ou parent etranger refusees, refus des RPC sur des identifiants etrangers, identite absente et acces legitime preserve.
- `tests/security-routes.test.mjs` : onze routes POST refusent les origines etrangeres, absentes et `null` avant l'acces aux donnees ; dix routes privees exigent l'authentification ; `requireUser` refuse les claims absents ou invalides.
- Les tests existants de sauvegarde, archivage et suivi verifient aussi l'utilisation du proprietaire authentifie, les identifiants falsifies, les revisions obsoletes et les conflits de planning.

Commandes de verification :

```powershell
node --test tests/security-routes.test.mjs tests/calendar-save.test.mjs tests/courses-archive.test.mjs tests/session-tracking.test.mjs
psql -h 127.0.0.1 -p 55439 -U postgres -d planner_clean_history_final -v ON_ERROR_STOP=1 -f tests/security-isolation.sql
```

Le test SQL est reserve a une base de test contenant un schema `auth` de simulation. Il ne doit pas etre execute dans le SQL Editor du projet Supabase reel. Aucune nouvelle migration n'est necessaire pour cette verification.

Cette verification couvre le code du depot et la base locale reconstruite avec ses migrations. Elle ne confirme pas les permissions effectivement configurees dans le projet Supabase distant ni les parametres de son hebergement. Les cles `service_role` et les secrets serveur ne doivent jamais etre places dans des variables `NEXT_PUBLIC_*` ; le client de l'application utilise uniquement la cle publique Supabase, avec RLS.
