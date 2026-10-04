# Calendrier visuel

La page `/calendar` affiche les cours, les examens et les révisions enregistrées en vue semaine ou mois. Les flèches changent de période ; « Aujourd’hui » revient au jour local du profil. La semaine commence le lundi. Sur un petit écran, la grille défile horizontalement.

Les cours sont bleus, les révisions violettes et les examens jaunes. Les révisions terminées portent une coche ; les séances manquées restent identifiables. Les propositions annulées restent dans l’historique en liste. Un clic affiche les horaires, la durée et, pour une révision, la date du cours dont le contenu est à revoir. Le suivi et la validation restent dans le tableau de bord.

Les cours hebdomadaires respectent les dates propres à la matière, la période de cours de la dernière sauvegarde et la date d’application de l’horaire. Les occurrences conservées affichent leurs anciens horaires. Sans période connue, renseigner les dates des matières ou enregistrer un planning. Les révisions enregistrées et les examens gardent leurs dates, même après la fin des cours.

La vue mois affiche trois événements par jour, puis un bouton pour consulter toutes les séances du jour. La vue semaine place les événements sur une grille horaire et sépare ceux qui se chevauchent. Les listes détaillées et l’historique restent disponibles sous le calendrier ; le formulaire de calcul et de sauvegarde reste en dessous. Les aperçus non enregistrés ne sont pas ajoutés au calendrier.

Aucune migration supplémentaire. Les migrations existantes jusqu’à `202610030007_optional_daily_limit.sql` restent nécessaires à la sauvegarde du planning.

Vérification : `node --test tests/visual-calendar.test.mjs`, puis les tests du planning, TypeScript, ESLint et compilation Next.js. Les tests couvrent la navigation et les détails, les limites de mois, les horaires historiques, les périodes par matière et les révisions après la fin d’un cours.
