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

La limite quotidienne est **facultative et désactivée par défaut** après la
migration `202610030007_optional_daily_limit.sql`, à appliquer après la 006.
Les disponibilités représentent les heures où l’utilisateur souhaite travailler.
Le planning utilise ces heures en respectant les occupations, pauses et examens.

Cocher **Ajouter une limite de révision par jour** uniquement si une contrainte
supplémentaire est souhaitée. Le champ propose alors 240 minutes, modifiable de
15 à 1440 minutes. Le total couvre toutes les matières, sans les cours ni les pauses.
Une révision reste entière. Les séances conservées comptent dans ce total ; celles
déjà au-delà d’un nouveau maximum sont signalées et aucune nouvelle séance n’est
ajoutée sur ces jours. L’activation est sauvegardée explicitement. Décocher l’option
transmet `null` au moteur et à la fonction SQL. Un refus conserve l’ancien planning.
La migration désactive l’ancien plafond imposé ; recalculer puis sauvegarder pour
utiliser les disponibilités sans cette limite supplémentaire.

Les séances passées encore planifiées restent à valider à la lecture du tableau
de bord : la consultation ne modifie pas la base. Une sauvegarde du planning
continue de classer les propositions des jours précédents comme manquées.
Les données réelles ne sont pas considérées comme terminées automatiquement.

Tests : identification selon l’heure locale, confirmations et doubles envois,
séances étrangères, plafond commun, séances conservées, durée indivisible,
enregistrement atomique et conservation de l’historique.
