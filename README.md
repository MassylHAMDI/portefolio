# Portfolio — Massyl Yanis Hamdi, Ingénieur C/C++

Portfolio one-page à thème aquatique : intro animée, canvas d'ondes réactif au curseur,
cartes projets empilées avec ordinateurs 3D interactifs, thème sombre/clair.

## Structure

```
portfolio-projet/
├── index.html      # Structure de la page (hero, à propos, stack, projets, avis, contact)
├── css/
│   └── style.css   # Tous les styles : thèmes, glassmorphism, intro, rideaux de marée, cartes
└── js/
    └── main.js     # Intro, canvas d'eau, portables 3D, topbar, témoignages
```

## Lancer le projet

Aucune dépendance ni build : ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Contenu

Le contenu est basé sur le CV de Massyl Yanis Hamdi (ingénieur C/C++ — systèmes embarqués,
robotique, vision par ordinateur) : à propos, stack, projets, parcours (expériences + formation)
et contact (email, téléphone, LinkedIn, GitHub).

- **Couleurs** : variables CSS dans `:root` et `[data-theme="light"]` en tête de `style.css`
- **Projets** : cartes dans `index.html` ; mini-écran des ordinateurs 3D dans `js/main.js`

## Fonctionnalités

- Intro : mots animés, goutte d'eau, cercle uni, sortie en rideaux de marée à bord de vague
- Canvas d'ondes qui suit le curseur (sombre et clair), désactivable via le switch
- Ordinateurs cliquables dans les cartes projets (clic direct ou bouton, accessible clavier)
- Topbar en verre dépoli qui apparaît au scroll + barre de progression
- Thème sombre/clair persistant (localStorage) et `prefers-reduced-motion` respecté partout
