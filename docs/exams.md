# Phase 10 : examens

`/exams` permet d'ajouter, modifier et supprimer un examen avec confirmation.
Les champs suivent le guide : cours, titre, date, debut, fin, importance et notes.
L'importance est stockee de 1 (faible) a 3 (elevee). Les deux heures sont requises
pour disposer plus tard de la duree bloquee dans le calendrier.

Les dates impossibles et les horaires inverses sont refuses cote serveur.
Les examens a venir sont affiches avant les examens passes. Le nombre de jours
restants utilise la date locale du profil et des jours calendaires, sans derive
lors des changements d'heure. La date du jour est incluse parmi les examens a venir.

La liste et les mutations se limitent aux cours de l'utilisateur connecte.
Chaque POST `/exams/manage` verifie l'identite et l'origine, et les modifications
et suppressions filtrent les identifiants de cours possedes, en plus de RLS.
La priorite de planification sera implementee a la phase du moteur du guide.

Tests : ESLint/TypeScript ; dates impossibles et annee bissextile ; calcul de jours
durant le changement d'heure ; fuseau New York ; refus d'un cours etranger avant
ecriture et filtre de propriete pour la modification avec Supabase simule.
Le test reel du parcours et de l'isolation entre deux comptes reste ouvert.

Test manuel : ajouter un examen a un cours existant, recharger, verifier les
jours restants, modifier la date et le cours, puis supprimer l'examen de test.
Un compte sans cours doit etre invite a en ajouter un avant de creer un examen.
