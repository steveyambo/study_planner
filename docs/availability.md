# Phase 11 : disponibilites

`/availability` affiche les sept jours, les creneaux declares et le total
hebdomadaire. Un jour sans creneau est indisponible. Plusieurs plages distinctes
peuvent etre ajoutees par jour ; elles peuvent etre modifiees ou supprimees.

Les calculs utilisent des minutes. Exemple : samedi 09:00-12:00 et 15:00-20:00
representent 8 h declarees. Ce total ne deduit pas encore les cours ou examens.
Le moteur de planification effectuera cette soustraction dans une phase suivante.

Le POST natif `/availability/manage` verifie l'identite et l'origine.
Le proprietaire est impose a la creation ; les autres operations filtrent
`user_id`, en complement de RLS. Les heures invalides, plages traversant minuit
et chevauchements d'un meme jour sont refuses. Deux plages consecutives sont
autorisees. La verification de chevauchement est applicative et ne garantit pas
l'exclusion de deux ecritures simultanees ; le moteur devra fusionner les plages
avant de calculer la capacite reelle.

Tests : ESLint et TypeScript ; calcul de deux plages (8 h), proprietaire impose,
chevauchement et jour invalide sans ecriture, suppression filtree (Supabase
simule) ; acces sans session refuse par redirection vers login.
Le parcours reel et l'isolation entre deux comptes restent a valider.

Test manuel : ajouter les deux plages du samedi ci-dessus, recharger, verifier
8 h, essayer une plage chevauchante, modifier une plage, puis la supprimer.
La prochaine phase du guide configure les intervalles de repetition espacee.
