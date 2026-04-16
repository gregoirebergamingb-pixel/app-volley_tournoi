# 🏐 Volleyball Tournament Manager

Application web pour gérer vos tournois de volleyball en groupe.

## 📋 Fonctionnalités

- ✅ Authentification (inscription/connexion)
- ✅ Création et gestion de groupes
- ✅ Création de tournois
- ✅ Inscription aux tournois
- ✅ Calendrier des tournois
- 🔜 Intégration Google Calendar
- 🔜 Rappels SMS

## 🚀 Installation rapide (5 min)

### Prérequis

- Node.js (v16+) - https://nodejs.org/
- Git - https://git-scm.com/
- Un compte Firebase gratuit - https://firebase.google.com/

### Étape 1 : Configuration Firebase

1. Allez sur https://console.firebase.google.com/
2. Créez un nouveau projet
3. Activez Firestore Database
4. Allez dans les paramètres du projet → Comptes de service
5. Cliquez "Générer une nouvelle clé privée" (JSON)
6. Téléchargez le fichier JSON

### Étape 2 : Configuration du Backend

```bash
# Allez dans le dossier backend
cd backend

# Installez les dépendances
npm install

# Créez le fichier .env
cp .env.example .env

# Éditez le fichier .env avec vos données Firebase
# Copiez les informations du fichier JSON téléchargé
```

Voici comment remplir `.env` :

```
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=votre-project-id (du JSON)
FIREBASE_PRIVATE_KEY_ID=votre-key-id (du JSON)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVOTRE_KEY_ICI\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=votre-email@project.iam.gserviceaccount.com (du JSON)
FIREBASE_CLIENT_ID=votre-client-id (du JSON)
FIREBASE_DATABASE_URL=https://votre-project.firebaseio.com
JWT_SECRET=votre-secret-super-secret-changez-ca
PORT=5000
NODE_ENV=development
```

### Étape 3 : Démarrage du Backend

```bash
# Depuis le dossier backend
npm start

# Vous devriez voir:
# 🚀 Serveur démarré sur http://localhost:5000
```

### Étape 4 : Configuration du Frontend

```bash
# Allez dans le dossier frontend
cd ../frontend

# Installez les dépendances
npm install
```

### Étape 5 : Démarrage du Frontend

```bash
# Depuis le dossier frontend
npm start

# Cela ouvrira automatiquement http://localhost:3000 dans votre navigateur
```

## 🧪 Test de l'application

1. **S'inscrire** : Cliquez sur "Créer un compte"
   - Email : test@example.com
   - Pseudo : Test
   - Mot de passe : test123

2. **Créer un groupe** :
   - Allez dans "Groupes"
   - Cliquez "Créer un groupe"
   - Notez le code d'invitation

3. **Créer un tournoi** :
   - Cliquez sur votre groupe
   - Cliquez "+ Créer un tournoi"
   - Remplissez les informations

4. **Inviter des amis** :
   - Partagez le code d'invitation
   - Ils cliquent "Rejoindre un groupe" et entrent le code

## 📱 Accès mobile

L'application est responsive. Ouvrez simplement http://localhost:3000 sur votre téléphone (depuis le même WiFi):

```
http://votre-ip:3000
```

Pour trouver votre IP locale:
- Windows: `ipconfig` dans Terminal
- Mac/Linux: `ifconfig` dans Terminal

## 🔧 Architecture

```
Frontend (React)
    ↓ Requêtes HTTP
Backend (Node.js + Express)
    ↓ Queries
Firestore (Google)
```

## 📚 Structure du projet

```
volleyball-tournament-app/
├── backend/
│   ├── server.js          # Serveur Express principal
│   ├── package.json       # Dépendances backend
│   └── .env              # Configuration (à créer)
│
├── frontend/
│   ├── src/
│   │   ├── pages/        # Pages React
│   │   ├── components/   # Composants React
│   │   ├── styles/       # CSS
│   │   └── App.js        # Composant principal
│   ├── public/index.html # HTML principal
│   └── package.json      # Dépendances frontend
│
└── README.md
```

## 🐛 Résolution des problèmes

### "Cannot find module 'express'"
```bash
cd backend
npm install
```

### "Error: ENOENT: no such file or directory"
Assurez-vous d'être dans le bon dossier (backend ou frontend)

### Port déjà utilisé
```bash
# Si le port 5000 est utilisé, changez PORT dans .env
PORT=5001

# Si le port 3000 est utilisé, changez avec:
PORT=3001 npm start
```

### Erreur Firebase
Vérifiez que vos identifiants `.env` sont corrects, surtout la `FIREBASE_PRIVATE_KEY` (doit contenir les sauts de ligne)

## 🎯 Prochaines étapes

Une fois que ça fonctionne:

1. **Google Calendar** : Intégration pour exporter les tournois
2. **SMS** : Rappels automatiques avec Twilio
3. **Notifications** : Pushs quand quelqu'un rejoint
4. **App Mobile** : Convertir en app Android/iOS native

## 📖 Où trouver de l'aide

- Erreurs Node.js : https://nodejs.org/en/docs/
- React : https://react.dev/
- Firebase : https://firebase.google.com/docs
- Axios : https://axios-http.com/docs/intro

## 💡 Tips

- **Développement** : Gardez les 2 terminals ouverts (backend et frontend)
- **Debugging** : Ouvrez les DevTools (F12) pour voir les erreurs
- **Console** : Regardez les logs du backend pour voir les requêtes

---

**Bon développement! 🚀**

Des questions? N'hésitez pas!
