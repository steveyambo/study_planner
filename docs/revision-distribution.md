# Étape 14 — Répartition des révisions

La fonction `distributeStudyTime` partage la charge totale d’une occurrence de cours entre les intervalles du compte. L’exemple du guide donne 360 minutes réparties en quatre répétitions : 90 minutes à J+1, J+3, J+7 et J+14.

Le calcul conserve exactement le total en minutes entières. Pour 361 minutes, la répartition donne 91, 90, 90 et 90 minutes. Les minutes restantes vont aux premiers intervalles dans l’ordre croissant. La liste fournie n’est pas modifiée.

Une charge plus petite que le nombre de répétitions attribue zéro minute aux dernières répétitions. L’aperçu le signale ; le futur moteur devra ignorer ces répétitions lors de la création de séances. Une charge nulle reste nulle. Les durées négatives, fractions, dépassements numériques, intervalles vides, doublons et jours invalides sont refusés.

Dans **Cours**, ouvrir **Répartition des révisions** sous un horaire. Les intervalles sont lus dans `revision_rules` pour le compte connecté, avec les valeurs initiales si la règle est absente. Après une modification dans **Paramètres**, recharger **Cours** pour afficher la nouvelle répartition.

Cette étape affiche un aperçu sans créer de séances en base. Les examens et les créneaux disponibles seront pris en compte aux étapes suivantes.

Validation locale : exemple du guide, reste, petites charges, absence de mutation, entrées invalides et conservation du total sur plusieurs combinaisons. Lint et TypeScript vérifiés. L’affichage avec un compte connecté reste à vérifier dans le navigateur.
