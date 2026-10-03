# Phase 8 : gestion des cours

La route `/courses` propose l'ajout, la modification et la suppression.
Les champs suivent le guide : code, nom, couleur et multiplicateur de revision.
Le multiplicateur vaut 2 par defaut. Les codes sont normalises en majuscules,
et un code ne peut pas etre duplique pour le meme utilisateur.

Les POST HTML vers `/courses/save` et `/courses/delete` renvoient une redirection
303 pour recharger la liste. L'identite est verifiee cote serveur. Le proprietaire
est impose a la creation, et la modification/suppression filtrent aussi `user_id`.
La RLS reste active. Les origines externes sont refusees.

La suppression demande confirmation et supprime les horaires, examens et
revisions associes, conformement aux relations en cascade de la base.
Les horaires et leur calcul de revision seront ajoutes a la phase 9.

Verification locale avec Supabase simule : validation des champs et du
multiplicateur, proprietaire impose malgre un champ `user_id` falsifie,
filtre utilisateur pour la modification. Le test CRUD reel reste a effectuer.

Test manuel apres validation de la connexion :
1. Ajouter INF3105, Structures de donnees, multiplicateur 2.
2. Recharger et verifier sa presence.
3. Modifier son nom et son multiplicateur.
4. Tester un code deja utilise : un message doit refuser le doublon.
5. Verifier avec un autre compte que ce cours n'est pas visible.
6. Supprimer le cours de test et verifier sa disparition.

La validation connexion/deconnexion de la phase 7 reste ouverte tant que
l'utilisateur n'a pas confirme le resultat du dernier correctif.
