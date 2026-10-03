# Propositions remplacées et suivi des révisions

## Activer la correction

Exécuter une seule fois `supabase/migrations/202610030003_clean_schedule_history.sql` dans **Supabase → SQL Editor**, après les trois migrations précédentes. Recharger **Planification**, calculer l’aperçu puis enregistrer.

La migration nettoie aussi les anciennes propositions déjà accumulées. Elle copie d’abord leur origine dans `course_occurrences`, à raison d’une ligne par horaire et date de cours, puis supprime les propositions annulées par replanification, changement d’horaire ou archivage. Elle garde les lignes terminées et manquées. Les anciennes lignes sans origine identifiable restent conservées.

## Règle de conservation

- Une proposition encore planifiée dans la période à remplacer est supprimée à la sauvegarde. Cela concerne la première répétition et les suivantes, même si d’autres répétitions de ce cours ont déjà été terminées.
- Une révision terminée reste enregistrée et ses minutes sont déduites de la charge restante.
- Une révision manquée conserve son suivi. Les séances en dehors de la période à remplacer restent planifiées.
- Un cours d’origine reste connu même si aucune révision n’a été effectuée, si toutes ses propositions ont été supprimées ou si le dernier aperçu était vide.

Les origines ne représentent pas du travail effectué. Le moteur calcule la charge restante à partir de la durée du cours, du multiplicateur actuel, des révisions terminées et des séances conservées hors période. Une origine déjà suivie permet de retrouver le travail à rattraper sans conserver chaque ancien créneau proposé.

Si un cours futur a été déplacé avant d’avoir lieu, son ancienne origine est marquée obsolète. Elle ne redevient pas un cours passé à rattraper après un autre changement d’horaire. Les horaires originaux des cours passés restent conservés.

## Sauvegarde et vérification

Le remplacement, la conservation des origines et la suppression des anciennes propositions font partie de la même transaction. Si une nouvelle séance est refusée, les anciennes propositions et la version des données sont restaurées. Les contrôles de propriétaire, disponibilité, ordre des répétitions et pauses sont conservés.

Les tests applicatifs couvrent le rattrapage sans propositions annulées, la déduction du travail terminé, les durées historiques, les origines obsolètes, la pagination et le refus de sauvegarde sans la migration.

Pour les tests PostgreSQL, utiliser une **base locale isolée** : appliquer les trois anciennes migrations, charger `tests/clean-history-fixture.sql`, appliquer la nouvelle migration, puis exécuter `tests/clean-schedule-history.sql` avec `ON_ERROR_STOP=1`. Les tests vérifient le nettoyage existant, onze sauvegardes sans accumulation, les révisions terminées et manquées, les fenêtres partielles, une sauvegarde vide, le rollback, les changements d’horaires et la RLS. Les données des vérifications transactionnelles sont annulées ; la fixture initiale reste dans cette base de test.
