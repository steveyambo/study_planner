# Replanification et conservation de l’historique

## Migration Supabase

Dans **Supabase → SQL Editor**, exécuter `supabase/migrations/202610030002_replanning.sql` après les migrations `202610020001_initial_schema.sql` et `202610030001_save_schedule.sql`. La nouvelle migration ajoute l’archivage, les instantanés historiques, la version des données du planning et la fonction transactionnelle `replace_schedule`.

La version actuelle nécessite aussi `202610030003_clean_schedule_history.sql`, après ces trois migrations. Elle nettoie les propositions annulées et conserve séparément les séances de cours d’origine. Les règles et l’installation sont décrites dans `clean-schedule-history.md`. Sans la nouvelle migration, l’aperçu reste disponible mais la sauvegarde est désactivée. L’application ne lance pas les migrations sur le projet distant.

## Après une modification

Les changements de cours, horaires, examens, disponibilités, intervalles et suivi des séances rendent le planning **à recalculer**. Modifier des données ne remplace pas automatiquement les séances déjà enregistrées. Le moteur travaille sur les données actuelles du compte et conserve le suivi existant.

1. Ouvrir **Planification**. Les dates, le rattrapage et la pause du dernier planning sont préremplis. Si le début sauvegardé est passé, le nouveau début proposé est demain, dans le fuseau du profil.
2. Choisir la fenêtre à mettre à jour et cliquer sur **Calculer l’aperçu**.
3. Vérifier les séances proposées et les révisions non placées.
4. Cliquer sur **Remplacer ce planning**. La confirmation précise le nombre de révisions encore planifiées dans la fenêtre. L’enregistrement est explicite.

La fenêtre comprend ses deux bornes. Seules les séances avec le statut `planned`, à partir de demain et dans cette fenêtre, sont remplacées. Leurs anciennes propositions sont supprimées. Les séances terminées, les séances manquées et les séances en dehors de la fenêtre sont conservées. Les séances conservées encore planifiées ou terminées continuent à occuper leurs créneaux ; les révisions déjà terminées ne sont pas recréées. Une origine unique par séance de cours permet de retrouver le travail restant sans conserver toutes les générations du planning.

Les anciennes lignes dont la séance d’origine ne peut pas être identifiée restent conservées. Le nombre affiché dans la confirmation ne les inclut pas. Les séances manquées et les annulations explicites restent dans **Historique** ; les propositions annulées par recalcul ou archivage n’y sont plus empilées.

Le bandeau de sauvegarde précise la dernière fenêtre mise à jour. Des révisions futures peuvent rester en dehors de cette fenêtre ; un avertissement les signale même si la version des données est inchangée depuis la dernière sauvegarde. Après une modification, élargir la fenêtre si ces séances doivent également être replacées.

Un aperçu vide peut remplacer un planning existant : l’interface avertit alors que les révisions encore planifiées de cette fenêtre seront retirées sans nouvelles séances. S’il n’y a aucune séance à remplacer, **Enregistrer ce planning vide** mémorise les paramètres et la version actuelle des données, par exemple après l’archivage du dernier cours. Les charges non placées restent des explications de l’aperçu, pas des séances fictives en base.

## Ajout, modification et suppression

Un nouveau cours ou horaire participe à la prochaine simulation. Un nouvel horaire ajouté après une première sauvegarde s’applique à partir de sa date d’ajout et ne crée pas artificiellement des cours dans le passé. Les cours archivés et les horaires supprimés ne génèrent plus de nouvelles révisions. L’archivage d’un cours conserve les séances réalisées ; la suppression d’un horaire garde sa clé et ses informations d’origine dans les révisions historiques. Les instantanés du code et du nom du cours permettent de lire l’historique même après une modification.

Les changements d’horaires s’appliquent aux occurrences futures, y compris celles dont des révisions étaient déjà planifiées. Une ancienne occurrence future déplacée vers un autre jour ne génère plus de nouvelles révisions. Pour une séance d’origine antérieure au changement et possédant déjà des révisions enregistrées, la durée du cours conservée dans l’instantané sert à recalculer la charge restante ; modifier les horaires ne réécrit pas le passé. Les changements de multiplicateur et d’intervalles s’appliquent à la charge restante ; une replanification ne supprime pas le travail déjà effectué. Le numéro de répétition, la date de la séance d’origine et l’intervalle sauvegardé servent au rapprochement. Les révisions réalisées hors de l’application ne sont pas connues automatiquement : le rattrapage reste une décision explicite.

Les anciennes prévisions retirées parce qu’un horaire futur a changé sont supprimées. Leur origine reste marquée obsolète, pour ne pas les transformer en cours à rattraper lorsque leur date passe ou que l’horaire change à nouveau.

Si une révision a été terminée après des répétitions manquées, le travail restant est réparti en nouvelles répétitions complémentaires après les séances conservées. Leurs numéros prolongent la série historique : le moteur ne tente pas de placer une révision dans le passé avant une séance déjà terminée. Les minutes effectuées restent déduites.

## Contrôles de sauvegarde

Le formulaire envoie les paramètres, une copie du résultat affiché et la version des données ayant servi à l’aperçu. Le serveur recharge les données du compte connecté et recalcule les lignes. Il compare la copie et la version : des données modifiées entre l’aperçu et le clic imposent un nouveau calcul, même si le résultat visible serait identique.

La page et la route chargent toutes les révisions et origines du compte par pages, dans un ordre stable, jusqu’à une page vide. Elles ne supposent pas que le plafond PostgREST est fixé à 1 000 lignes. L’échec d’une page arrête le chargement et empêche toute sauvegarde basée sur un suivi incomplet.

La fonction SQL `replace_schedule` vérifie à nouveau la version sous verrou du compte, puis remplace et insère dans une transaction. Un conflit annule toute l’opération. La copie fournie par le navigateur n’est jamais utilisée directement comme liste de lignes à insérer. L’origine HTTP, le compte, les sources, les pauses, les limites et les conflits restent contrôlés.

## Vérification

`node --test tests/calendar-save.test.mjs` vérifie les lectures limitées au compte connecté, les lignes recalculées, une seconde sauvegarde avec séances existantes, un aperçu vide, les versions périmées avant et pendant la sauvegarde, une origine étrangère, une migration manquante, une date de début passée, plus de 1 000 lignes historiques, un plafond de page réduit et le refus de sauvegarde si une page échoue. Le client Supabase et le calcul sont simulés dans ces tests de route ; les contrôles SQL et les déductions de charge ont leurs tests séparés.

Le parcours connecté sur le projet Supabase distant doit être vérifié après l’application de la migration : enregistrer, ajouter une disponibilité, recalculer, remplacer et recharger. Le calendrier graphique et le bouton de suivi des séances restent des étapes distinctes.
