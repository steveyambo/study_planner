# Enregistrement du planning

## Migration Supabase à appliquer

1. Dans Supabase, ouvrir **SQL Editor**, puis une nouvelle requête.
2. Copier tout `supabase/migrations/202610030001_save_schedule.sql` et exécuter la requête une seule fois.
3. Recharger Study Planner. Cette migration ajoute la date du cours d’origine, une protection des identités de répétition et la fonction transactionnelle de sauvegarde. Elle conserve les tables et les séances existantes.

4. Exécuter ensuite `supabase/migrations/202610030002_replanning.sql`. La replanification est décrite dans `replanning.md`.
5. Pour la version actuelle, exécuter `supabase/migrations/202610030003_clean_schedule_history.sql`. Elle retire les propositions remplacées sans perdre leur origine ni le travail effectué ; voir `clean-schedule-history.md`. Sans cette quatrième migration, la sauvegarde est désactivée.

6. Exécuter ensuite `202610030004_complete_study_session.sql`, puis `202610030005_course_periods.sql`. La sauvegarde actuelle exige les périodes par matière ; voir `course-periods.md`.

La migration a été compilée et testée dans PostgreSQL local. Elle n’a pas été exécutée sur le projet Supabase distant par l’agent.

## Utilisation

Calculer un aperçu dans **Planification**, puis cliquer sur **Enregistrer ce planning**. Seules les révisions placées sont enregistrées avec l’état `planned`. Les charges non placées restent visibles dans l’aperçu et ne deviennent pas des séances en base. Après sauvegarde, la section **Séances enregistrées** affiche les dates, horaires, séances d’origine et numéros de répétition, y compris après rechargement.

Le formulaire envoie les paramètres et une copie de l’aperçu. Le serveur recharge les données du compte connecté et recalcule le planning. Les lignes fournies par le navigateur ne sont jamais insérées : la copie sert uniquement à détecter un aperçu devenu obsolète. Si le résultat change, il faut recalculer avant de sauvegarder.

L’opération SQL actuelle utilise `replace_schedule`, la session authentifiée et les politiques RLS. Elle verrouille le profil pour sérialiser les appels par compte, impose le propriétaire, vérifie les sources, les disponibilités, les conflits, les pauses (y compris autour de minuit), les limites d’examen et l’ordre des répétitions. Si une ligne échoue, toute l’opération est annulée, y compris la suppression des propositions remplacées. L’index unique protège une identité d’occurrence/répétition avec le statut `planned` ou `completed` ; les lignes manquées ne bloquent pas un nouveau placement.

## Limites de cette version

La sauvegarde n’est plus limitée au premier planning. Une nouvelle sauvegarde remplace seulement les révisions encore planifiées dans la fenêtre future choisie et conserve les séances terminées et l’historique. Le moteur déduit le travail déjà réalisé. Les paramètres du dernier calcul sont conservés et préremplis après rechargement. La pause reste une réserve de temps, sans événement enregistré séparément.

Les modifications des données incrémentent une version sur le profil et prennent le même verrou que la sauvegarde. Le serveur compare la version de l’aperçu et celle des données rechargées, puis la fonction SQL la vérifie à nouveau sous verrou. Une modification concurrente ne valide donc pas silencieusement un aperçu ancien ; le planning est refusé ou signalé comme à recalculer après la modification.

## Tests

`tests/save-schedule.sql` couvre la fonction historique `save_initial_schedule` et reste réservé à une base de test contenant les deux premières migrations. Il vérifie le refus d’une source étrangère, l’absence d’insertion partielle après conflit, la sauvegarde de deux séances, le refus d’une seconde génération avec cette ancienne fonction et l’absence de permission anonyme. Les données du test sont annulées. La nouvelle fonction est vérifiée par les tests de replanification séparés.

La sauvegarde réelle sur Supabase et son affichage dans une session connectée restent à vérifier après l’application de la migration.

`node --test tests/calendar-save.test.mjs` vérifie les refus d’origine étrangère, d’aperçu périmé ou falsifié et de version obsolète, ainsi que les lectures limitées au compte connecté, les lignes recalculées côté serveur, la seconde génération et les remplacements vides (client Supabase simulé).
