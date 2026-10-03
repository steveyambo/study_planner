# Périodes propres à chaque matière

Exécuter une fois `202610030005_course_periods.sql` dans Supabase après la 004.
Dans **Mes cours → Modifier le cours**, renseigner le premier et le dernier jour
de cours, puis enregistrer. Les deux dates sont facultatives, incluses, et la fin
doit être égale ou postérieure au début.

Exemple : anglais du 8 septembre au 30 octobre, algorithmie du 14 septembre au
14 décembre. Garder une période globale assez large dans **Planification**, puis
recalculer et enregistrer le planning. Les dates propres à la matière réduisent
la période globale à inclure ; une limite laissée vide reprend la limite globale.
La date d’examen se renseigne toujours séparément dans **Examens**.

Après le dernier cours d’anglais, aucune nouvelle occurrence hebdomadaire
d’anglais n’est créée et cet horaire ne bloque plus les disponibilités. Les
révisions des dernières occurrences restent possibles après la fin des cours,
strictement avant l’examen et dans la période de planning choisie.

Modifier la période invalide les anciens aperçus. Les propositions rattachées à
des occurrences futures désormais exclues sont supprimées, même hors de la
fenêtre de replanification précédente. Les séances terminées ou manquées restent
conservées. Les propositions d’anciennes occurrences encore dans le passé sont
remplacées lors du recalcul de leur fenêtre ; elles ne créent pas d’occurrences
en dehors des nouvelles limites. Les règles existantes sur la date d’effet des
horaires ajoutés/modifiés restent applicables.

Tests : périodes différentes, bornes incluses, révisions après le dernier cours,
libération des horaires, conservation de l’historique et contrôle SQL des sources.
