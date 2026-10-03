# Séances manquées — phase 21

Exécuter une fois `202610030006_missed_sessions.sql` dans Supabase après la 005.

Dans le tableau de bord, une séance encore planifiée dont l’heure de fin est
passée présente deux choix : **Terminé** si elle a été réalisée, ou **Séance
manquée · Préparer le rattrapage** si elle n’a pas été faite. La date et l’heure
sont évaluées dans le fuseau du profil ; le serveur vérifie à nouveau l’échéance.
Les propositions futures, annulées ou terminées ne peuvent pas devenir manquées.
Les anciennes séances sans origine connue ne proposent pas ce rattrapage.

Le second choix enregistre uniquement le statut `missed`, conserve son origine,
invalide les anciens aperçus, puis ouvre Planification. Vérifier que la période
des cours inclut l’occurrence à rattraper, calculer l’aperçu et l’enregistrer.
L’aperçu réorganise les révisions futures de la fenêtre choisie, selon les
disponibilités, examens, pauses et ordre des répétitions. Il prend en compte tout
le travail restant des occurrences incluses ; il ne déplace pas une seule séance
en ignorant les suivantes. Les charges impossibles restent signalées.

Les occurrences déjà suivies comme manquées sont connues du moteur même si la
case de rattrapage des anciennes révisions inconnues reste décochée. Le travail
terminé et les séances conservées sont déduits : l’historique manqué reste visible
après le rattrapage sans provoquer une copie supplémentaire à chaque recalcul.

Le **Maximum de révision par jour** vaut 240 minutes (4 h) par défaut. Il est
configurable de 15 à 1440 minutes et couvre toutes les matières, sans les cours ni
les pauses. Une révision reste entière ; si elle dépasse ce maximum, elle ne peut
pas être placée. Les séances conservées comptent dans ce total. Celles déjà au-delà
d’un nouveau maximum restent conservées et sont signalées, sans ajout sur ce jour.
Le plafond est contrôlé dans l’aperçu et dans la transaction SQL, puis sauvegardé
avec les paramètres du planning. Un refus ne supprime pas l’ancien planning.

Les séances passées encore planifiées restent à valider à la lecture du tableau
de bord : la consultation ne modifie pas la base. Une sauvegarde du planning
continue de classer les propositions des jours précédents comme manquées.
Les données réelles ne sont pas considérées comme terminées automatiquement.

Tests : identification selon l’heure locale, confirmations et doubles envois,
séances étrangères, plafond commun, séances conservées, durée indivisible,
enregistrement atomique et conservation de l’historique.
