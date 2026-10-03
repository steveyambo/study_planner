# Enregistrement du premier planning

## Migration Supabase à appliquer

1. Dans Supabase, ouvrir **SQL Editor**, puis une nouvelle requête.
2. Copier tout `supabase/migrations/202610030001_save_schedule.sql` et exécuter la requête une seule fois.
3. Recharger Study Planner. Cette migration ajoute la date du cours d’origine, une protection des identités de répétition et la fonction transactionnelle de sauvegarde. Elle conserve les tables et les séances existantes.

La migration a été compilée et testée dans PostgreSQL local. Elle n’a pas été exécutée sur le projet Supabase distant par l’agent.

## Utilisation

Calculer un aperçu dans **Planification**, puis cliquer sur **Enregistrer ce planning**. Seules les révisions placées sont enregistrées avec l’état `planned`. Les charges non placées restent visibles dans l’aperçu et ne deviennent pas des séances en base. Après sauvegarde, la section **Séances enregistrées** affiche les dates, horaires, séances d’origine et numéros de répétition, y compris après rechargement.

Le formulaire envoie les paramètres et une copie de l’aperçu. Le serveur recharge les données du compte connecté et recalcule le planning. Les lignes fournies par le navigateur ne sont jamais insérées : la copie sert uniquement à détecter un aperçu devenu obsolète. Si le résultat change, il faut recalculer avant de sauvegarder.

L’opération SQL utilise la session authentifiée et les politiques RLS. Elle verrouille le profil pour sérialiser les appels de cette fonction par compte, impose le propriétaire, vérifie les sources, les disponibilités, les conflits, les pauses (y compris autour de minuit), les limites d’examen et l’ordre des répétitions. Si une ligne échoue, toute l’opération est annulée. L’index unique protège une identité d’occurrence/répétition non annulée.

## Limites de cette version

Il s’agit de la sauvegarde d’un premier planning. Un compte avec une séance non annulée, même terminée ou manquée, ne peut pas encore générer un second planning. Aucun planning ni suivi existant n’est remplacé. La replanification et la déduction des séances terminées seront ajoutées avec le suivi. La pause n’est pas un événement enregistré et sa valeur n’est pas encore conservée comme paramètre permanent.

Les contrôles SQL vérifient les données au moment de l’appel. La sérialisation couvre les appels de sauvegarde de cette fonction ; elle ne verrouille pas toutes les modifications concurrentes des cours et disponibilités effectuées ailleurs.

## Tests

`tests/save-schedule.sql` est réservé à une base de test contenant les deux migrations. Il vérifie le refus d’une source étrangère, l’absence d’insertion partielle après conflit, la sauvegarde de deux séances, le refus d’une seconde génération et l’absence de permission anonyme. Les données du test sont annulées.

La sauvegarde réelle sur Supabase et son affichage dans une session connectée restent à vérifier après l’application de la migration.

`node --test tests/calendar-save.test.mjs` vérifie également le refus d’une origine étrangère, d’un aperçu périmé ou falsifié et d’une seconde génération, ainsi que les lectures limitées au compte connecté et les lignes recalculées côté serveur (client Supabase simulé). Les 20 tests du moteur, ces 4 tests de route, le lint et TypeScript passent.
