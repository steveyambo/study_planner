# Suivi des séances — phase 20

Exécuter une seule fois `supabase/migrations/202610030004_complete_study_session.sql`
dans le SQL Editor Supabase, après la migration 003 de nettoyage de l’historique.

Le tableau de bord affiche les révisions sauvegardées : aujourd’hui, les séances
passées encore planifiées, les dix prochaines et les dix dernières terminées.
Le prochain examen est chargé depuis les cours actifs. Les totaux du jour et de
la semaine utilisent les dates prévues des séances planifiées ou terminées ;
les séances manquées et annulées sont exclues de ce total.

Cliquer sur **Terminé** seulement après avoir réellement fait la révision.
Une séance planifiée est validable à partir du jour prévu, dans le fuseau du profil.
La fonction authentifiée passe son statut à `completed` et inscrit `completed_at`
avec l’heure du serveur. Un second envoi conserve la première date de réalisation.
Les séances manquées ou annulées ne peuvent pas être validées par cette action.
Une proposition supprimée par une replanification n’est pas recréée par un ancien bouton.

La validation verrouille le profil avant la séance, comme la replanification.
Les politiques RLS limitent l’action au compte connecté ; aucun identifiant
utilisateur ou statut soumis par le formulaire n’est utilisé. Les triggers
existants rendent les anciens aperçus obsolètes et conservent l’origine du cours.
Le moteur déduit le temps terminé et préserve ces séances lors du recalcul.

## Vérification dans l’application

1. Enregistrer un planning, puis ouvrir le tableau de bord.
2. Terminer une révision prévue aujourd’hui (ou une séance passée encore planifiée).
3. Vérifier le message, le statut terminé et les compteurs correspondant à sa date prévue.
4. Recalculer puis enregistrer le planning : la séance terminée reste conservée,
   et son temps est déduit du travail restant pour cette occurrence de cours.
5. Une séance future présente son horaire sans bouton de validation.

La gestion des séances manquées (phase 21) et le calendrier visuel (phase 22)
restent les étapes suivantes.
