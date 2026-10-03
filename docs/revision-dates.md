# Étape 15 — Dates de révision et examens

Dans **Cours**, ouvrir **Dates et examens** sous un horaire et choisir une occurrence correspondant à son jour de semaine. L’aperçu utilise les intervalles du compte et les examens associés au cours, lus avec les cours du propriétaire connecté.

`generateRevisionDates` répartit les minutes et ajoute les intervalles à la date du cours. Le prochain examen à partir de cette date sert de limite. Les examens antérieurs sont ignorés. Une révision le jour de l’examen ou après est avancée à la veille, sans modifier sa durée. Plusieurs répétitions peuvent ainsi partager une date ; les conflits et la capacité seront traités par le planificateur.

Exemple du guide : cours le 1er décembre, examen le 10 décembre, intervalles 1, 3, 7, 14. Les dates souhaitées deviennent les 2, 4, 8 et 9 décembre, avec 90 minutes chacune pour un total de 360 minutes.

Les révisions sont strictement après le jour du cours et avant celui de l’examen. Un examen le jour même ou le lendemain ne laisse donc aucun jour : le résultat indique `no_window`, sans prétendre avoir planifié la charge. Les allocations de zéro minute sont ignorées. Aucun enregistrement de séance n’est créé par cet aperçu.

Les calculs utilisent des jours calendaires UTC pour éviter les décalages dus aux changements d’heure. Les dates doivent être réelles et comprises entre les années 0001 et 9999. Les dépassements sans examen limite sont refusés.

Tests locaux réussis : exemple du guide, conservation du total, prochain examen, examen le jour même ou le lendemain, charge nulle, allocations nulles, année bissextile, changement d’heure, date invalide et dépassement de l’année 9999. Lint et TypeScript réussis. L’aperçu avec un compte connecté reste à vérifier dans le navigateur.
