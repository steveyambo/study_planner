# Étape 13 — Calcul des minutes de révision

La formule du guide est `minutes de cours × multiplicateur`. Par exemple, un cours de 14:00 à 17:00 dure 180 minutes ; avec un multiplicateur de 2, il demande 360 minutes (6 h) de révision au total par occurrence.

La fonction `src/lib/scheduler/calculateStudyTime.ts` centralise ce calcul pour les horaires et le futur moteur. Elle reçoit une durée entière positive en minutes et un multiplicateur entre 0,01 et 99,99, avec deux décimales maximum. Une entrée invalide ou une multiplication dépassant les entiers sûrs JavaScript retourne `null`.

Le multiplicateur est converti en centièmes entiers avant multiplication. Le résultat est arrondi à la minute la plus proche (une demi-minute est arrondie vers le haut). Une très petite charge peut donc donner zéro minute ; le moteur devra en tenir compte lors de la répartition. Le total hebdomadaire additionne les charges arrondies de chaque occurrence.

Dans **Cours**, chaque horaire affiche désormais sa durée et sa révision recommandée. Le formulaire donne le même aperçu pendant la saisie. Ces minutes représentent le total à répartir entre les répétitions, pas la durée de chacune. La répartition sera réalisée à l’étape 14.

Vérifications locales : exemple 180 × 2 = 360, multiplicateur décimal, seuils d’arrondi, durée maximale d’une journée, valeurs invalides et dépassement numérique. Le lint et TypeScript sont également vérifiés. Pour vérifier l’affichage avec un compte connecté, ouvrir **Cours**, ajouter 14:00–17:00 à un cours de multiplicateur 2 et vérifier 3 h de cours et 6 h de révision.
