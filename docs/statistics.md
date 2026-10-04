# Statistiques de révision

Le tableau de bord affiche le temps terminé, le temps encore planifié et la progression globale du planning enregistré. Le total est la somme des minutes des séances `planned` et `completed`, toutes périodes, y compris futures. La progression est le temps terminé divisé par ce total ; sans total, aucun pourcentage global n’est affiché.

Les séances `missed` constituent un historique séparé. Elles ne s’ajoutent pas à la charge restante, car une tentative manquée peut déjà avoir été replanifiée ou rattrapée. Les séances annulées sont exclues. Les révisions non placées et le travail réalisé hors de l’application ne sont pas mesurés. Une replanification peut modifier le dénominateur sans effacer le travail terminé.

Le tableau par matière regroupe les séances par identifiant du cours. Les cours archivés gardent leur suivi et les noms conservés dans les séances servent de repli si le cours n’est plus chargé. Il affiche les durées, les nombres de séances, la progression et le nombre historique de séances manquées.

Le volet des six dernières semaines comprend la semaine en cours et les cinq précédentes, du lundi au dimanche. Comme la carte hebdomadaire existante, il utilise les dates prévues des séances, même si leur validation a eu lieu plus tard. Il ne constitue pas un journal immuable des anciennes propositions remplacées.

Les données utilisent le chargement paginé des séances du compte connecté, déjà utilisé par le tableau de bord. Aucun changement de base de données, aucune migration supplémentaire, aucun nouveau plafond quotidien.

Vérification : `node --test tests/statistics.test.mjs tests/session-tracking.test.mjs` ; tests des totaux sans double comptage, des matières archivées, des limites de semaines, du rendu et de l’intégration dans le tableau de bord.
