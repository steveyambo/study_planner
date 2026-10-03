# Étape 16 — Moteur de planification

Ouvrir **Planification** (`/calendar`). La page charge uniquement les cours, disponibilités, intervalles et révisions du compte connecté. Elle calcule une simulation sans écrire en base.

## Utilisation

1. Choisir le début des cours, par exemple le 14 septembre, puis la dernière date de cours à inclure. Tous les horaires hebdomadaires sont répétés entre ces dates, bornes incluses. Cette version applique une période commune à tous les cours et ne connaît pas encore les vacances ni les séances annulées.
2. Choisir la période du planning à partir de demain. Cette limite évite de proposer des heures déjà passées aujourd’hui. Les dates sont celles du fuseau du profil.
3. Pour rattraper les cours passés, cocher **Inclure les révisions déjà échues** uniquement si ces révisions restent à faire. Sinon leurs minutes sont exclues et affichées séparément, sans être considérées comme terminées.
4. Cliquer sur **Calculer l’aperçu**. Lire les créneaux proposés et les charges non placées.

Maximum : 366 jours de cours et 91 jours de planning. La fin des cours peut dépasser la fin du planning : seules les occurrences jusqu’à la fin du planning sont calculées. Les dates et horaires sont validés.

## Placement

`findAvailableSlots` fusionne les disponibilités chevauchantes, puis retire les occupations. `generateSchedule` énumère les occurrences hebdomadaires et utilise les fonctions de calcul, répartition et dates des étapes précédentes.

Les cours dans la période déclarée, tous les examens et les révisions existantes non annulées bloquent leurs heures. Les nouvelles révisions réservent leur créneau au fur et à mesure. Elles commencent après le jour de leur occurrence et restent strictement avant le prochain examen du cours.

La recherche commence à la date souhaitée, puis parcourt les jours suivants jusqu’à la limite. En l’absence de place, elle cherche les jours précédents dans la fenêtre autorisée. Les tâches sont traitées par date limite puis date souhaitée. Ce choix déterministe ne garantit pas un optimum global. La priorité selon importance, charge et proximité de l’examen sera définie à l’étape correspondante.

Chaque répétition reste entière : pas de découpage automatique. Une charge qui n’entre pas dans un créneau, qui tombe au-delà de la période, ou dont l’examen ne laisse aucune fenêtre est signalée. Les pauses et le plafond quotidien configurable seront ajoutés aux étapes suivantes.

## Limites de cette étape

Le schéma actuel ne mémorise pas encore la date d’occurrence d’origine d’une révision. Les séances existantes bloquent du temps mais ne sont pas déduites de la charge recalculée ; l’interface affiche cet avertissement lorsqu’elles existent. Il faudra ajouter une identité d’occurrence et un enregistrement atomique avant de sauvegarder un planning, pour conserver le suivi et éviter les doublons. Aucune simulation n’est présentée comme une séance enregistrée ou effectuée.

## Vérification

`node --test tests/scheduler.test.mjs` couvre la fusion des disponibilités, le retrait des occupations, plusieurs occurrences, la conservation des minutes, les conflits, les examens, les révisions existantes, le rattrapage explicite et les périodes invalides. Lint et TypeScript vérifiés. La simulation avec les données réelles d’un compte connecté reste à vérifier dans le navigateur.
