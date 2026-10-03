# Étape 16 — Moteur de planification

Ouvrir **Planification** (`/calendar`). La page charge uniquement les cours, disponibilités, intervalles, origines et révisions du compte connecté. Le calcul reste une simulation jusqu’à l’enregistrement explicite. La sauvegarde est décrite dans `save-schedule.md`, la mise à jour dans `replanning.md` et le nettoyage des propositions dans `clean-schedule-history.md` ; appliquer les migrations dans l’ordre jusqu’à `202610030006_missed_sessions.sql` est nécessaire. Le suivi et les périodes par matière sont décrits dans `session-tracking.md` et `course-periods.md`.

## Utilisation

1. Choisir le début des cours, par exemple le 14 septembre, puis la dernière date de cours à inclure. Tous les horaires hebdomadaires sont répétés entre ces dates, bornes incluses. Les dates propres à chaque matière, renseignées dans Mes cours, réduisent cette période pour la matière concernée. Sans limite personnelle, la limite globale s’applique. Les vacances et séances de cours annulées ne sont pas encore connues.
2. Choisir la période du planning à partir de demain. Cette limite évite de proposer des heures déjà passées aujourd’hui. Les dates sont celles du fuseau du profil.
3. Pour rattraper les cours passés, cocher **Inclure les révisions déjà échues** uniquement si ces révisions restent à faire. Sinon leurs minutes sont exclues et affichées séparément, sans être considérées comme terminées.
4. Choisir la **Pause entre deux révisions**, de 0 à 60 minutes (15 minutes par défaut). Cette pause réserve du temps entre deux révisions, sans être ajoutée aux minutes de travail.
5. Cliquer sur **Calculer l’aperçu**. Lire les créneaux proposés et les charges non placées, avec leur numéro de répétition lorsqu’il est disponible.

Maximum : 366 jours de cours et 91 jours de planning. La fin des cours peut dépasser la fin du planning : seules les occurrences jusqu’à la fin du planning sont calculées. Les dates et horaires sont validés.

## Placement

`findAvailableSlots` fusionne les disponibilités chevauchantes, puis retire les occupations. `generateSchedule` énumère les occurrences hebdomadaires et utilise les fonctions de calcul, répartition et dates des étapes précédentes.

Les cours actifs dans la période déclarée, leurs examens et les révisions conservées bloquent leurs heures. Les anciennes révisions encore planifiées dans la fenêtre future à remplacer libèrent leurs créneaux pendant la simulation. Les nouvelles révisions réservent leur créneau au fur et à mesure. La pause choisie est également respectée autour des révisions conservées et des nouvelles révisions. Elle ne modifie ni leur durée de travail ni les totaux de minutes. Les révisions commencent après le jour de leur occurrence et restent strictement avant le prochain examen du cours.

Pour chaque occurrence de cours, les répétitions sont placées dans l’ordre et sur des dates distinctes. Le moteur recherche d’abord un créneau qui conserve l’écart configuré depuis la répétition précédente réellement placée. Si la fenêtre avant l’examen ou la fin du planning ne le permet pas, cet écart peut être réduit, avec au moins un jour entre deux répétitions. Si une répétition ne peut pas être placée, les suivantes de cette occurrence sont signalées comme bloquées : elles ne passent pas avant une répétition manquante. Les occurrences de cours différentes gardent chacune leur série de répétitions et peuvent avoir des révisions le même jour.

Avant de réserver une date, le moteur estime combien de répétitions suivantes peuvent encore tenir sur des jours distincts dans les créneaux libres. Il favorise la date qui permet la plus longue suite de premières répétitions, puis la date souhaitée en cas d’égalité. Cela évite de choisir un jeudi pour la première répétition si un placement mardi puis jeudi permet d’en effectuer deux.

Une série complète n’est plus obligatoire : si seulement les répétitions 1 et 2 trouvent des créneaux, elles sont conservées et seules les répétitions restantes sont signalées. Les jours ne sont pas réservés à des répétitions futures au prix de bloquer celles qui peuvent déjà être placées. Si la répétition courante ne trouve aucun créneau, les suivantes restent bloquées pour respecter l’ordre ; le moteur ne saute pas une répétition.

Une date souhaitée au-delà de la fin du planning est signalée explicitement : le moteur ne l’avance pas uniquement pour la faire entrer dans cet aperçu. Les tâches sont traitées selon une règle déterministe ; celle-ci ne garantit pas un optimum global entre tous les cours. La priorité combine importance, charge à placer et proximité de l’examen ; la formule et ses limites sont décrites dans `exam-priority.md`.

Chaque répétition reste entière : pas de découpage automatique. Les messages distinguent une date souhaitée au-delà de la fin du planning, l’absence de jours avant l’examen, le manque de créneaux assez longs et une répétition bloquée par la précédente. Le manque de place peut aussi venir de la pause ou de l’espacement requis ; il ne signifie pas systématiquement que l’examen est en cause. Le plafond quotidien configurable vaut 240 minutes par défaut ; il compte les révisions de toutes les matières, y compris celles conservées, sans les pauses ni les cours. Le rattrapage est décrit dans `missed-sessions.md`.

## Limites de cette étape

La migration de replanification conserve l’historique, les origines, les intervalles et les paramètres du dernier planning. Les révisions terminées sont déduites de la charge restante ; les séances conservées ne sont pas dupliquées. Les cours archivés et les horaires supprimés ne créent plus de nouvelles révisions. L’interface signale les données modifiées et exige un nouveau calcul avant de sauvegarder une version périmée. Aucune simulation n’est présentée comme une séance enregistrée ou effectuée avant l’enregistrement explicite.

## Vérification

`node --test tests/scheduler.test.mjs` vérifie la fusion des disponibilités, plusieurs occurrences, la conservation des minutes, les conflits, les examens, le rattrapage, l’ordre et les écarts des répétitions, les pauses autour de minuit et les séries partiellement réalisables. Les tests de replanification couvrent aussi la déduction du travail terminé, les changements de multiplicateur et d’intervalles, les séances conservées hors période, les cours archivés et les horaires futurs déplacés ou raccourcis.

Les captures d’une simulation avec un compte connecté ont confirmé l’affichage d’un planning de 30 occurrences et la conservation de 180 heures de révision (150 heures placées et 30 heures non placées avant ces corrections). Elles ont aussi révélé des répétitions rapprochées, l’absence de pause et des raisons trop générales. Le résultat corrigé avec les données réelles reste à vérifier dans le navigateur.
