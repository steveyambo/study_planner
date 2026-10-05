# Guide de démarrage

Le parcours `/getting-started` accompagne l’utilisateur jusqu’à la configuration d’un planning. Il explique une étape à la fois et renvoie aux formulaires habituels ; il ne crée pas de données à la place de l’utilisateur.

## Parcours

1. **Comprendre le principe** : chaque séance de cours donne lieu à plusieurs révisions espacées, placées dans les disponibilités.
2. **Ajouter les matières** : au moins une matière active.
3. **Renseigner les horaires** : chaque matière active doit avoir un horaire hebdomadaire. Les périodes propres aux matières peuvent être différentes.
4. **Choisir les disponibilités** : au moins un créneau de travail. Aucun plafond quotidien supplémentaire n’est imposé.
5. **Ajouter les examens** : facultatif. Il est possible d’indiquer que les dates ne sont pas encore connues.
6. **Préparer et enregistrer le planning** : calculer l’aperçu, vérifier les séances et les révisions non placées, puis enregistrer. L’aperçu seul ne termine pas cette étape.

Le guide reconnaît les informations enregistrées et propose la première étape restante. Les étapes déjà renseignées peuvent être consultées. Un planning devenu obsolète après une modification doit être recalculé et enregistré pour que la dernière étape soit validée. Un planning enregistré sans aucune révision planifiée affiche cette situation explicitement.

## Pause et reprise

Un accueil est proposé sur le tableau de bord lorsqu’aucun planning n’a encore été enregistré. Il peut être masqué. Le lien **Guide de démarrage** reste disponible dans la navigation sur ordinateur et dans **Plus** sur téléphone. Un rappel discret accompagne les pages de configuration quand le guide est actif.

Le début du parcours, la pause, le masquage de l’accueil et la décision de passer les examens sont des préférences locales, sous une clé versionnée qui contient l’identifiant du compte. Elles ne contiennent aucune donnée de cours ni aucun jeton. Les données réellement enregistrées sont lues depuis Supabase avec le compte authentifié ; elles sont reconnues depuis tous les appareils. Si le stockage local est indisponible, les préférences restent utilisables pendant la session de la page.

Aucune table, migration, règle de calcul ou route de sauvegarde supplémentaire n’est nécessaire. Le guide n’enregistre ni ne modifie le planning lui-même.

## Vérifications

```bash
node --test tests/onboarding.test.mjs
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

Sur un compte de test, vérifier l’accueil, la création d’une matière sans horaire, l’ajout de son horaire et d’une disponibilité, le passage facultatif des examens, puis l’aperçu et la sauvegarde. Revenir au guide après chaque formulaire : cliquer sur un lien ne doit jamais valider une étape à lui seul. Vérifier aussi la pause/reprise, la navigation au clavier, une largeur mobile de 320 px et l’absence d’accès au guide sans connexion.
