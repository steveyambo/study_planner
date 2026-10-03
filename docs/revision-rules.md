# Étape 12 — Répétition espacée

La page `/settings`, accessible par **Paramètres**, affiche les intervalles du compte connecté. Les valeurs initiales sont J+1, J+3, J+7 et J+14 : chaque nombre représente des jours après une séance de cours.

Pour modifier la règle, saisir par exemple `1, 4, 10`, puis cliquer sur **Enregistrer les intervalles**. L’aperçu affiche les jours dans l’ordre croissant. Le bouton de réinitialisation enregistre les valeurs initiales.

La validation accepte des entiers positifs uniques, séparés par des virgules, des points-virgules ou des espaces. Chaque valeur doit tenir dans un entier PostgreSQL (maximum 2147483647) et le texte est limité à 512 caractères. Les doublons, fractions, valeurs nulles et négatives sont refusés.

Le serveur vérifie l’origine de la requête et la session. Il impose l’identifiant du compte connecté et enregistre `revision_rules` avec `user_id` comme clé de conflit. Les politiques RLS de la migration initiale protègent les données. Une règle absente est affichée avec les valeurs initiales sans écriture lors de la lecture.

Cette étape configure la règle ; elle ne génère pas encore de séances. Le futur moteur devra contrôler les limites des dates avant d’appliquer les intervalles, répartir les minutes et tenir compte des disponibilités et examens.

Vérification locale : lint et TypeScript réussis ; tests de validation, tri, refus des doublons et dépassements, identité imposée du compte, origine et absence d’écriture pour une entrée invalide réussis avec un client Supabase simulé. L’enregistrement réel avec un compte connecté reste à vérifier dans le navigateur : modifier la règle, recharger la page, puis rétablir les valeurs initiales.
