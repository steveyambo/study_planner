# Étape 19 — Priorité des examens

Le guide exige de tenir compte du temps avant l’examen, de la charge restante et de l’importance. La règle V1 choisie et vérifiée avant son intégration est :

`score = minutes à placer × importance / jours avant l’examen`

À importance 1, les exemples du guide donnent 90 pour 360 minutes en 4 jours, 24 pour 240 minutes en 10 jours et 4 pour 120 minutes en 30 jours. Une importance 3 triple le score. Le score le plus élevé est traité d’abord.

La charge est celle calculée dans cette simulation pour un cours et son prochain examen : les répétitions admises dans l’horizon et dont la fenêtre n’est pas déjà fermée. Ce n’est pas encore un solde déduit des révisions réellement terminées. Les jours sont mesurés depuis le début du planning. Le score est fixé au début du calcul, pas recalculé après chaque placement.

Les cours sans examen reçoivent un score de zéro. Un examen le jour du début du planning ou déjà passé ne crée pas de priorité utile : ses charges restent soumises aux messages de fenêtre fermée. Si plusieurs examens d’un cours ont la même date, l’importance maximale est utilisée.

Les répétitions liées à un même cours/examen partagent le score. Les égalités sont départagées par la date limite, la date souhaitée et les identifiants stables. Les séries conservent ainsi leur ordre. Les pauses, conflits, frontières d’examen et placements partiels restent appliqués. Cette heuristique ne garantit pas un planning optimal et peut favoriser les cours avec une forte charge.

Validation : formule, urgence, charge, importance, absence d’examen, valeurs invalides et concurrence de deux cours pour un seul créneau. Les tests du moteur vérifient également les contraintes précédentes. L’affichage réel du nouveau classement reste à vérifier avec un compte connecté.
