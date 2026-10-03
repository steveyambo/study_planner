# Étape 16 — Moteur de planification

Ouvrir **Planification** (`/calendar`). La page charge uniquement les cours, disponibilités, intervalles et révisions du compte connecté. Elle calcule une simulation sans écrire en base.

## Utilisation

1. Choisir le début des cours, par exemple le 14 septembre, puis la dernière date de cours à inclure. Tous les horaires hebdomadaires sont répétés entre ces dates, bornes incluses. Cette version applique une période commune à tous les cours et ne connaît pas encore les vacances ni les séances annulées.
2. Choisir la période du planning à partir de demain. Cette limite évite de proposer des heures déjà passées aujourd’hui. Les dates sont celles du fuseau du profil.
3. Pour rattraper les cours passés, cocher **Inclure les révisions déjà échues** uniquement si ces révisions restent à faire. Sinon leurs minutes sont exclues et affichées séparément, sans être considérées comme terminées.
4. Choisir la **Pause entre deux révisions**, de 0 à 60 minutes (15 minutes par défaut). Cette pause réserve du temps entre deux révisions, sans être ajoutée aux minutes de travail.
5. Cliquer sur **Calculer l’aperçu**. Lire les créneaux proposés et les charges non placées, avec leur numéro de répétition lorsqu’il est disponible.

Maximum : 366 jours de cours et 91 jours de planning. La fin des cours peut dépasser la fin du planning : seules les occurrences jusqu’à la fin du planning sont calculées. Les dates et horaires sont validés.

## Placement

`findAvailableSlots` fusionne les disponibilités chevauchantes, puis retire les occupations. `generateSchedule` énumère les occurrences hebdomadaires et utilise les fonctions de calcul, répartition et dates des étapes précédentes.

Les cours dans la période déclarée, tous les examens et les révisions existantes non annulées bloquent leurs heures. Les nouvelles révisions réservent leur créneau au fur et à mesure. La pause choisie est également respectée autour des révisions existantes et des nouvelles révisions. Elle ne modifie ni leur durée de travail ni les totaux de minutes. Les révisions commencent après le jour de leur occurrence et restent strictement avant le prochain examen du cours.

Pour chaque occurrence de cours, les répétitions sont placées dans l’ordre et sur des dates distinctes. Le moteur recherche d’abord un créneau qui conserve l’écart configuré depuis la répétition précédente réellement placée. Si la fenêtre avant l’examen ou la fin du planning ne le permet pas, cet écart peut être réduit, avec au moins un jour entre deux répétitions. Si une répétition ne peut pas être placée, les suivantes de cette occurrence sont signalées comme bloquées : elles ne passent pas avant une répétition manquante. Les occurrences de cours différentes gardent chacune leur série de répétitions et peuvent avoir des révisions le même jour.

Avant de réserver une date, le moteur vérifie aussi qu’il reste des créneaux assez longs sur des jours distincts pour les répétitions suivantes de cette occurrence. Cela évite de choisir un jeudi pour la première répétition si un placement mardi puis jeudi permet d’effectuer toute la série. Si aucune série compatible n’est disponible, la charge est signalée sans placer les dernières répétitions avant les premières.

Une date souhaitée au-delà de la fin du planning est signalée explicitement : le moteur ne l’avance pas uniquement pour la faire entrer dans cet aperçu. Les tâches sont traitées selon une règle déterministe ; celle-ci ne garantit pas un optimum global entre tous les cours. La priorité selon importance, charge et proximité de l’examen sera définie à l’étape correspondante.

Chaque répétition reste entière : pas de découpage automatique. Les messages distinguent une date souhaitée au-delà de la fin du planning, l’absence de jours avant l’examen, le manque de créneaux assez longs et une répétition bloquée par la précédente. Le manque de place peut aussi venir de la pause ou de l’espacement requis ; il ne signifie pas systématiquement que l’examen est en cause. Le plafond quotidien configurable sera ajouté à une étape suivante.

## Limites de cette étape

Le schéma actuel ne mémorise pas encore la date d’occurrence d’origine d’une révision. Les séances existantes bloquent du temps mais ne sont pas déduites de la charge recalculée ; l’interface affiche cet avertissement lorsqu’elles existent. Il faudra ajouter une identité d’occurrence et un enregistrement atomique avant de sauvegarder un planning, pour conserver le suivi et éviter les doublons. Aucune simulation n’est présentée comme une séance enregistrée ou effectuée.

## Vérification

`node --test tests/scheduler.test.mjs` : 16 tests réussis sur la fusion des disponibilités, le retrait des occupations, plusieurs occurrences, la conservation des minutes, les conflits, les examens, les révisions existantes, le rattrapage explicite, les périodes invalides, les jours distincts, l’ordre et les écarts des répétitions, les pauses configurables (y compris autour de minuit), les disponibilités rares et les raisons des charges non placées. Lint et TypeScript réussis.

Les captures d’une simulation avec un compte connecté ont confirmé l’affichage d’un planning de 30 occurrences et la conservation de 180 heures de révision (150 heures placées et 30 heures non placées avant ces corrections). Elles ont aussi révélé des répétitions rapprochées, l’absence de pause et des raisons trop générales. Le résultat corrigé avec les données réelles reste à vérifier dans le navigateur.
