# Phase 9 : horaires de cours

Chaque cours dispose d'horaires hebdomadaires : jour ISO (lundi 1, dimanche 7),
debut et fin dans la meme journee. L'utilisateur peut ajouter plusieurs horaires,
les modifier et les supprimer. Les horaires sont tries par jour puis par heure.

Les formulaires utilisent des POST HTML et une redirection 303. Chaque operation
verifie le proprietaire du cours avant d'acceder a ses horaires, avec RLS en plus.
La sauvegarde refuse les heures invalides et les chevauchements du meme cours,
hors horaire en cours de modification. Deux horaires consecutifs sont possibles.
Le controle de chevauchement est applicatif ; il ne garantit pas l'exclusion de
deux ecritures simultanees. Les conflits entre cours differents seront controles
avec le moteur de planification prevu dans le guide.

La duree est calculee en minutes. La revision recommandee par occurrence vaut
la duree multipliee par le multiplicateur, arrondie a la minute la plus proche.
Le total hebdomadaire additionne ces valeurs. Aucun planning n'est genere ici.

Tests locaux : 14:00-17:00 vaut 180 minutes, multiplicateur 2 donne 360 minutes ;
heures inversees, identiques et passage a minuit refuses ; cours non possede
et horaire chevauchant refuses avant ecriture (Supabase simule).
Le parcours reel reste a valider avec un compte connecte.

Test manuel :
1. Ajouter lundi 14:00-17:00 a INF3105 (multiplicateur 2).
2. Verifier 3 h de cours et 6 h de revision, puis recharger.
3. Essayer lundi 16:00-18:00 : un chevauchement doit etre signale.
4. Modifier l'horaire, puis le supprimer avec confirmation.
5. Verifier qu'un autre compte ne voit pas cet horaire.
