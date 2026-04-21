# 🏐 Volley Tournois

Application mobile-first pour organiser et suivre des tournois de volleyball entre amis et coéquipiers.

## À quoi ça sert ?

L'idée de base : vous jouez à des tournois de beach/green volley, vous vous inscrivez via d'autres canaux (FFVolley, organisateurs locaux…), et cette application sert à **organiser votre groupe** — qui joue avec qui, dans quelle équipe, à quelle date.

À terme, elle permettra aussi de **découvrir des tournois** publiés par d'autres groupes et de former des équipes avec des joueurs extérieurs.

---

## Fonctionnalités actuelles

### Compte & Profil
- Inscription avec prénom, nom, genre, niveau de jeu (Loisir → Pro), téléphone, photo de profil
- Connexion sécurisée (JWT 30 jours)
- Modification du profil et changement de mot de passe

### Groupes
- Créer un groupe (club, équipe d'amis…)
- Inviter des membres via lien ou **QR code**
- Rejoindre un groupe avec un code d'invitation
- Gestion du groupe (renommer, supprimer, quitter)

### Tournois
- Créer un tournoi rattaché à un groupe (format, catégorie, surface, lieu, prix)
- Modifier ou supprimer un tournoi (créateur uniquement)
- Géolocalisation du lieu via autocomplétion OpenStreetMap
- **Ajouter au calendrier** : Google Calendar ou fichier `.ics` (Apple / Outlook)

### Équipes
- Créer une équipe dans un tournoi, la renommer, la supprimer
- Rejoindre / quitter une équipe
- **Joueurs externes** : réserver des places pour des joueurs sans compte
- Contrôle de parité mixte (dernière place réservée à une femme en mixte)
- Niveau moyen de l'équipe calculé automatiquement

### Tableau de bord
- Vue de tous les tournois de vos groupes
- Mise en avant du prochain tournoi
- Filtres : À venir · Mes équipes · Ce week-end · Passés

### Recherche
- Recherche textuelle sur nom et lieu
- Filtres : Format · Catégorie · Surface · Date
- **Localisation par GPS** avec rayon configurable (10 / 25 / 50 / 100 km)

---

## Stack technique

| Composant | Technologie |
|-----------|------------|
| Frontend | React 18, React Router, Axios |
| Backend | Node.js, Express |
| Base de données | Firebase Firestore |
| Auth | JWT (bcrypt) |
| Déploiement frontend | Netlify |
| Déploiement backend | Render |
| Géocodage | Nominatim (OpenStreetMap) |

### Sécurité
- Headers HTTP sécurisés (`helmet`)
- Rate limiting sur les routes sensibles (`express-rate-limit`)
- CORS restreint aux origines autorisées
- Codes d'invitation cryptographiquement aléatoires (`crypto.randomBytes`)
- Contrôle d'accès vérifié sur chaque route sensible

---

## Installation locale

### Prérequis

- Node.js v18+
- Un projet Firebase avec Firestore activé

### 1. Cloner le repo

```bash
git clone <url-du-repo>
cd volleyball-tournament-app
```

### 2. Configurer le backend

```bash
cd backend
npm install
cp .env.example .env
```

Remplir `.env` avec les credentials Firebase (compte de service) et un `JWT_SECRET` fort :

```
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=...
JWT_SECRET=votre-secret-fort-ici
PORT=5000
```

> Le fichier `.env` n'est pas dans le repo (`.gitignore`). Demandez-le à un membre de l'équipe.

### 3. Lancer le backend

```bash
# depuis /backend
node server.js
# → 🚀 Serveur démarré sur http://localhost:5000
```

### 4. Lancer le frontend

```bash
cd ../frontend
npm install
npm start
# → http://localhost:3000
```

Le frontend se connecte automatiquement à `localhost:5000` si `REACT_APP_API_URL` n'est pas défini.

---

## Structure du projet

```
volleyball-tournament-app/
├── backend/
│   ├── server.js          # API Express (auth, groupes, tournois, équipes)
│   ├── .env               # Variables d'environnement (à créer, non versionné)
│   └── .env.example       # Template des variables
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.js          # Accueil — mes tournois
        │   ├── Groups.js             # Mes groupes + invitation QR
        │   ├── GroupDetail.js        # Détail d'un groupe
        │   ├── TournamentDetail.js   # Détail tournoi + équipes
        │   ├── TournamentSearch.js   # Recherche publique + géoloc
        │   ├── CreateTournamentWizard.js
        │   ├── Profile.js
        │   ├── Register.js
        │   └── Login.js
        ├── components/
        │   ├── TournamentCard.js     # Carte tournoi réutilisable
        │   ├── Navigation.js         # Bottom nav bar
        │   └── AvatarMenu.js
        └── styles/App.css
```

---

## Dépannage courant

**"❌ ERREUR: JWT_SECRET non défini"**
→ Votre `.env` ne contient pas `JWT_SECRET`. Ajoutez-le.

**"❌ ERREUR: Les variables Firebase ne sont pas configurées"**
→ Vérifiez que `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY` et `FIREBASE_CLIENT_EMAIL` sont bien dans `.env`. La clé privée doit contenir les `\n` littéraux.

**Port déjà utilisé**
```bash
# Backend sur un autre port
PORT=5001 node server.js

# Frontend sur un autre port
PORT=3001 npm start
```

---

## Idées pour la suite

- **Chat par équipe** — messagerie temps réel via Firestore (évite d'échanger les numéros de téléphone)
- **Profil public** — voir le niveau et l'historique d'un joueur
- **Liste d'attente** — s'inscrire si une équipe est complète
- **Confirmation de présence** — RSVP à J-7 pour éviter les désistements
