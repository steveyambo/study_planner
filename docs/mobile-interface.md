# Interface mobile

L’interface privilégie les actions courantes : consulter la journée, retrouver un cours et adapter le planning. Elle utilise des surfaces sobres, une seule couleur principale et des icônes fonctionnelles.

## Navigation et agenda

- Avant 1 024 px, la navigation reste en bas : Aujourd’hui, Agenda, Cours et Plus. Plus donne accès aux examens, disponibilités, paramètres et au compte.
- À partir de 1 024 px, une barre latérale présente les six pages. Le calendrier hebdomadaire conserve sa grille horaire.
- Sur mobile, la semaine propose sept boutons de jours et une liste des séances du jour sélectionné. Les révisions courtes restent lisibles.
- Le mois permet de sélectionner une date, puis de consulter toutes ses séances dans l’agenda. Les points indiquent les types d’événements présents.
- Les détails et formulaires d’ajout s’ouvrent dans des panneaux : en bas sur mobile, à droite sur ordinateur. Ils conservent le focus au clavier et le rendent au bouton d’ouverture à la fermeture.

## Formulaires et suivi

Les champs utilisent une taille de texte de 16 px et les actions principales offrent une hauteur d’au moins 44 px. Les dates et horaires passent sur plusieurs lignes sur les petits écrans. La navigation tient compte de la zone réservée aux gestes du téléphone, sans empêcher le zoom du navigateur.

Le tableau de bord montre d’abord les séances du jour, puis quatre prochaines révisions sur mobile. Le lien « Tout voir » ouvre l’agenda complet. Les statistiques utilisent des cartes sur mobile et un tableau sur ordinateur.

Le recalcul est replié lorsqu’un planning à jour est enregistré. Les options avancées sont accessibles séparément. Les créneaux d’un aperçu de plus de huit révisions sont dépliables ; les totaux, la sauvegarde et les motifs non placés restent accessibles. Les valeurs des formulaires, le calcul, les routes de sauvegarde et les migrations restent les mêmes.

## Composants et références

Les composants réutilisables sont dans `src/components/ui` : Button, Badge et Sheet. Ils suivent la composition de [shadcn/ui](https://ui.shadcn.com/docs/components) avec Radix UI, class-variance-authority et tailwind-merge. Les icônes proviennent de [Lucide](https://lucide.dev).

Les transitions discrètes de l’accueil et des panneaux s’inspirent des [listes animées React Bits](https://reactbits.dev/components/animated-list). Elles sont réalisées en CSS ; React Bits n’est pas ajouté comme dépendance. La préférence système de réduction des animations est respectée.

## Vérifier une modification

```bash
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
```

Les tests du calendrier couvrent notamment la sélection d’un jour, les révisions courtes, les états terminé/manqué et les jours adjacents au mois affiché. Les tests applicatifs vérifient les sauvegardes, le suivi et la replanification.

Pour la vérification visuelle, contrôler les pages à 320, 390, 768 et 1 440 px : absence de débordement de page, accès aux actions en bas, panneaux défilables, champs de date/heure lisibles et retour du focus après fermeture. Tester également sur un téléphone réel avec le guide [Test sur téléphone](mobile-testing.md). L’émulation de largeur ne reproduit pas le clavier et les sélecteurs natifs iOS/Android.
