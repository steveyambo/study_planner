# Phase 8 : gestion des cours

La route `/courses` propose l'ajout, la modification et l'archivage.
Les champs suivent le guide : code, nom, couleur et multiplicateur de revision.
Le multiplicateur vaut 2 par defaut. Les codes sont normalises en majuscules,
et un code ne peut pas etre duplique pour le meme utilisateur.

Les POST HTML vers `/courses/save` et `/courses/delete` renvoient une redirection
303 pour recharger la liste. L'identite est verifiee cote serveur. Le proprietaire
est impose a la creation, et la modification filtre aussi `user_id` et exige un
cours actif. L'archivage utilise `archive_course(p_course_id)` ; cette fonction
obtient le proprietaire depuis la session authentifiee, sans identite envoyee
par le navigateur.
La RLS reste active. Les origines externes sont refusees.

L'archivage demande confirmation. Il retire le cours des prochains calculs et
annule ses revisions planifiees a partir d'aujourd'hui, mais conserve ses horaires, examens et
seances terminees pour l'historique. La liste des cours archives reste visible,
sans formulaires de modification. Le code d'un cours archive reste reserve.
Les choix de cours pour les examens, ainsi que les POST d'edition de cours,
d'horaires et d'examens, excluent les cours archives. La migration de
replanification doit etre appliquee dans Supabase pour activer l'archivage ;
sans elle, le bouton affiche un message demandant son installation.

Apres la premiere sauvegarde du planning, un horaire hebdomadaire ajoute ou
modifie devient effectif a partir d'aujourd'hui. Cette date est definie par la
base, sans champ modifiable dans le formulaire. Les anciennes seances gardent
leurs donnees d'origine pour la replanification et l'historique.

Verification locale avec Supabase simule : validation des champs et du
multiplicateur, proprietaire impose malgre un champ `user_id` falsifie,
filtre utilisateur pour la modification. Le test CRUD reel reste a effectuer.

Test manuel apres validation de la connexion :
1. Ajouter INF3105, Structures de donnees, multiplicateur 2.
2. Recharger et verifier sa presence.
3. Modifier son nom et son multiplicateur.
4. Tester un code deja utilise : un message doit refuser le doublon.
5. Verifier avec un autre compte que ce cours n'est pas visible.
6. Archiver le cours de test et verifier son passage dans la liste des archives.
7. Verifier que les seances terminees subsistent et que les prochaines revisions
   de ce cours sont annulees. Recalculer avec les autres cours actifs.

La validation connexion/deconnexion de la phase 7 reste ouverte tant que
l'utilisateur n'a pas confirme le resultat du dernier correctif.
