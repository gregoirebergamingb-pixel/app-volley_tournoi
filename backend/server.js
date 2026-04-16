const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();
const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://gestion-tournoi-volley.netlify.app'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// ============================================
// CONFIGURATION FIREBASE
// ============================================
const serviceAccount = {
  type: process.env.FIREBASE_TYPE || "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
  console.error("❌ ERREUR: Les variables Firebase ne sont pas configurées dans .env");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || ""
  });
  console.log("✅ Firebase initialisé avec succès");
} catch (error) {
  console.error("❌ Erreur Firebase:", error.message);
  process.exit(1);
}

const db = admin.firestore();
const JWT_SECRET = process.env.JWT_SECRET || "votre-secret-jwt-ultra-secret";

// ============================================
// HELPER - Validation genre pour une équipe
// Règles :
//   - Tournoi masculin : seuls les hommes peuvent rejoindre
//   - Tournoi féminin : seules les femmes peuvent rejoindre
//   - Tournoi mix : au moins une femme dans l'équipe quand elle est complète
//     → la dernière place est bloquée si aucune femme (ni existante, ni la personne qui rejoint)
// ============================================
function checkGenderEligibility(userGender, tournamentGender, currentMemberDetails, teamSize) {
  if (tournamentGender === 'masculin' && userGender !== 'masculin') {
    return { allowed: false, reason: 'Ce tournoi est réservé aux hommes' };
  }
  if (tournamentGender === 'feminin' && userGender !== 'feminin') {
    return { allowed: false, reason: 'Ce tournoi est réservé aux femmes' };
  }
  if (tournamentGender === 'mix') {
    // Si ce join complète l'équipe, vérifier qu'il y a au moins une femme
    const newSize = currentMemberDetails.length + 1;
    if (newSize === teamSize) {
      const hasFemale = currentMemberDetails.some(m => m.gender === 'feminin') || userGender === 'feminin';
      if (!hasFemale) {
        return {
          allowed: false,
          reason: 'Une équipe mixte doit avoir au moins une femme. La dernière place est réservée à une femme.'
        };
      }
    }
  }
  return { allowed: true };
}

// ============================================
// HELPER - Calcul du niveau moyen d'une équipe
// ============================================
const LEVEL_NUM   = { loisir:1, departemental:2, regional:3, national:4, pro:5 };
const LEVEL_LABEL = ['Loisir','Loisir','Départemental','Régional','National','Pro'];

function computeAverageLevel(memberDetails) {
  if (!memberDetails || memberDetails.length === 0) return { averageLevel: null, averageLevelLabel: null };
  const nums = memberDetails.map(m => LEVEL_NUM[m.level] || 1);
  const avg  = nums.reduce((s, v) => s + v, 0) / nums.length;
  return {
    averageLevel: Math.round(avg * 10) / 10,
    averageLevelLabel: LEVEL_LABEL[Math.round(avg)] || 'Loisir'
  };
}

// ============================================
// MIDDLEWARE - Vérification du token JWT
// ============================================
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ============================================
// ROUTES - AUTHENTIFICATION
// ============================================

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, gender, phone, level, avatarUrl } = req.body;

    if (!email || !password || !firstName || !lastName || !gender || !level) {
      return res.status(400).json({ error: 'Email, mot de passe, prénom, nom, genre et niveau requis' });
    }
    if (!['masculin', 'feminin'].includes(gender)) {
      return res.status(400).json({ error: 'Genre invalide (masculin ou feminin)' });
    }
    if (!Object.keys(LEVEL_NUM).includes(level)) {
      return res.status(400).json({ error: 'Niveau invalide' });
    }

    const userExists = await db.collection('users').where('email', '==', email).get();
    if (!userExists.empty) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = db.collection('users').doc().id;

    await db.collection('users').doc(userId).set({
      id: userId, email, password: hashedPassword, firstName, lastName, gender, level,
      phone: phone || '',
      avatarUrl: avatarUrl || null,
      createdAt: new Date(), groups: [], tournaments: []
    });

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      message: 'Inscription réussie!',
      token, userId,
      user: { id: userId, email, firstName, lastName, gender, level, phone: phone || '', avatarUrl: avatarUrl || null }
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const snapshot = await db.collection('users').where('email', '==', email).get();
    if (snapshot.empty) {
      return res.status(400).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = snapshot.docs[0].data();
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      message: 'Connexion réussie!',
      token, userId: user.id,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, gender: user.gender, level: user.level, avatarUrl: user.avatarUrl || null }
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Profil
app.get('/api/auth/profile', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const u = userDoc.data();
    res.json({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, gender: u.gender, level: u.level, phone: u.phone, avatarUrl: u.avatarUrl || null });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mes équipes (toutes les équipes où l'utilisateur est inscrit, enrichies avec infos tournoi/groupe)
app.get('/api/users/me/teams', verifyToken, async (req, res) => {
  try {
    const groupsSnapshot = await db.collection('groups')
      .where('members', 'array-contains', req.userId).get();

    const result = [];

    for (const groupDoc of groupsSnapshot.docs) {
      const group = groupDoc.data();
      const tournamentsSnapshot = await db.collection('tournaments')
        .where('groupId', '==', group.id).get();

      for (const tournamentDoc of tournamentsSnapshot.docs) {
        const tournament = tournamentDoc.data();
        const teamsSnapshot = await db.collection('tournaments')
          .doc(tournament.id).collection('teams')
          .where('members', 'array-contains', req.userId).get();

        teamsSnapshot.forEach(teamDoc => {
          result.push({
            team: teamDoc.data(),
            tournament: {
              id: tournament.id, name: tournament.name, date: tournament.date,
              time: tournament.time, location: tournament.location,
              playerFormat: tournament.playerFormat, gender: tournament.gender,
              groupId: tournament.groupId, surface: tournament.surface || null,
              price: tournament.price || 0
            },
            group: { id: group.id, name: group.name }
          });
        });
      }
    }

    result.sort((a, b) => (a.tournament.date > b.tournament.date ? 1 : -1));
    res.json(result);
  } catch (error) {
    console.error('Erreur mes équipes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Tous les tournois de tous mes groupes (onglet "Nos Tournois")
app.get('/api/users/me/tournaments', verifyToken, async (req, res) => {
  try {
    const groupsSnapshot = await db.collection('groups')
      .where('members', 'array-contains', req.userId).get();

    const result = [];

    for (const groupDoc of groupsSnapshot.docs) {
      const group = groupDoc.data();
      const tournamentsSnapshot = await db.collection('tournaments')
        .where('groupId', '==', group.id).get();

      for (const tDoc of tournamentsSnapshot.docs) {
        const tournament = tDoc.data();
        const teamsSnapshot = await db.collection('tournaments').doc(tournament.id).collection('teams').get();
        const teams = teamsSnapshot.docs.map(d => d.data());
        const myTeam = teams.find(t => t.members.includes(req.userId)) || null;

        result.push({
          tournament: {
            id: tournament.id, name: tournament.name, date: tournament.date,
            time: tournament.time, location: tournament.location,
            playerFormat: tournament.playerFormat, gender: tournament.gender,
            price: tournament.price || 0, surface: tournament.surface || null
          },
          group: { id: group.id, name: group.name },
          myTeam: myTeam ? { id: myTeam.id, name: myTeam.name, members: myTeam.members, maxSize: myTeam.maxSize } : null,
          teamCount: teams.length
        });
      }
    }

    result.sort((a, b) => (a.tournament.date > b.tournament.date ? 1 : -1));
    res.json(result);
  } catch (error) {
    console.error('Erreur nos tournois:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES - GROUPES
// ============================================

// Créer un groupe
app.post('/api/groups', verifyToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom du groupe est requis' });

    const groupId = db.collection('groups').doc().id;
    const inviteCode = Math.random().toString(36).substring(7).toUpperCase();

    await db.collection('groups').doc(groupId).set({
      id: groupId, name, description: description || '',
      owner: req.userId, members: [req.userId], inviteCode,
      createdAt: new Date(), tournaments: []
    });

    res.json({ message: 'Groupe créé!', groupId, inviteCode });
  } catch (error) {
    console.error('Erreur création groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les groupes de l'utilisateur
app.get('/api/groups', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('groups')
      .where('members', 'array-contains', req.userId).get();
    const groups = [];
    snapshot.forEach(doc => groups.push(doc.data()));
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre un groupe
app.post('/api/groups/join', verifyToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: "Code d'invitation requis" });

    const snapshot = await db.collection('groups').where('inviteCode', '==', inviteCode).get();
    if (snapshot.empty) return res.status(404).json({ error: "Code d'invitation invalide" });

    const group = snapshot.docs[0];
    const groupData = group.data();
    if (groupData.members.includes(req.userId)) {
      return res.status(400).json({ error: 'Vous êtes déjà dans ce groupe' });
    }

    await group.ref.update({ members: [...groupData.members, req.userId] });
    res.json({ message: 'Vous avez rejoint le groupe!', name: groupData.name });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détails d'un groupe
app.get('/api/groups/:groupId', verifyToken, async (req, res) => {
  try {
    const group = await db.collection('groups').doc(req.params.groupId).get();
    if (!group.exists) return res.status(404).json({ error: 'Groupe non trouvé' });
    res.json(group.data());
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un groupe (propriétaire seulement)
app.put('/api/groups/:groupId', verifyToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const groupDoc = await db.collection('groups').doc(req.params.groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: 'Groupe non trouvé' });
    if (groupDoc.data().owner !== req.userId) return res.status(403).json({ error: 'Seul le propriétaire peut modifier le groupe' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    await groupDoc.ref.update({ name: name.trim(), description: description || '' });
    res.json({ message: 'Groupe modifié' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un groupe (propriétaire seulement, supprime aussi les tournois et équipes)
app.delete('/api/groups/:groupId', verifyToken, async (req, res) => {
  try {
    const groupDoc = await db.collection('groups').doc(req.params.groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: 'Groupe non trouvé' });
    if (groupDoc.data().owner !== req.userId) return res.status(403).json({ error: 'Seul le propriétaire peut supprimer le groupe' });

    const tournamentsSnapshot = await db.collection('tournaments')
      .where('groupId', '==', req.params.groupId).get();
    for (const tDoc of tournamentsSnapshot.docs) {
      const teamsSnapshot = await db.collection('tournaments').doc(tDoc.id).collection('teams').get();
      for (const teamDoc of teamsSnapshot.docs) await teamDoc.ref.delete();
      await tDoc.ref.delete();
    }

    await groupDoc.ref.delete();
    res.json({ message: 'Groupe supprimé' });
  } catch (error) {
    console.error('Erreur suppression groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES - TOURNOIS
// ============================================

// Créer un tournoi
app.post('/api/tournaments', verifyToken, async (req, res) => {
  try {
    const { groupId, name, date, time, location, price, playerFormat, gender, surface } = req.body;

    if (!groupId || !name || !date || !location) {
      return res.status(400).json({ error: 'Informations incomplètes (groupId, name, date, location requis)' });
    }

    const validFormats = ['2x2', '3x3', '4x4', '6x6'];
    const validGenders = ['mix', 'masculin', 'feminin'];
    const validSurfaces = ['green', 'beach', 'gymnase'];

    if (!playerFormat || !validFormats.includes(playerFormat)) {
      return res.status(400).json({ error: 'Format invalide (2x2, 3x3, 4x4 ou 6x6)' });
    }
    if (!gender || !validGenders.includes(gender)) {
      return res.status(400).json({ error: 'Genre invalide (mix, masculin ou feminin)' });
    }

    const group = await db.collection('groups').doc(groupId).get();
    if (!group.exists || !group.data().members.includes(req.userId)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const teamSize = parseInt(playerFormat.split('x')[0]); // 2, 3 ou 4
    const tournamentId = db.collection('tournaments').doc().id;

    await db.collection('tournaments').doc(tournamentId).set({
      id: tournamentId, groupId, name, date,
      time: time || '10:00', location,
      price: price || 0, playerFormat, gender, teamSize,
      surface: validSurfaces.includes(surface) ? surface : null,
      creator: req.userId, createdAt: new Date()
    });

    await db.collection('groups').doc(groupId).update({
      tournaments: [...(group.data().tournaments || []), tournamentId]
    });

    res.json({ message: 'Tournoi créé!', tournamentId });
  } catch (error) {
    console.error('Erreur création tournoi:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les tournois d'un groupe
app.get('/api/tournaments/group/:groupId', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('tournaments')
      .where('groupId', '==', req.params.groupId)
      .get();
    const tournaments = [];
    snapshot.forEach(doc => tournaments.push(doc.data()));
    // Tri par date côté serveur (évite d'avoir besoin d'un index composite Firestore)
    tournaments.sort((a, b) => (a.date > b.date ? 1 : -1));
    res.json(tournaments);
  } catch (error) {
    console.error('Erreur chargement tournois:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détails d'un tournoi
app.get('/api/tournaments/:tournamentId', verifyToken, async (req, res) => {
  try {
    const tournament = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    res.json(tournament.data());
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un tournoi (créateur seulement — nom, date, heure, lieu, prix)
app.put('/api/tournaments/:tournamentId', verifyToken, async (req, res) => {
  try {
    const { name, date, time, location, price } = req.body;
    const tDoc = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tDoc.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    if (tDoc.data().creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut modifier le tournoi' });
    if (!name || !date || !time || !location) return res.status(400).json({ error: 'Informations incomplètes' });
    await tDoc.ref.update({ name: name.trim(), date, time, location: location.trim(), price: price || 0 });
    res.json({ message: 'Tournoi modifié' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un tournoi (créateur seulement, supprime aussi les équipes)
app.delete('/api/tournaments/:tournamentId', verifyToken, async (req, res) => {
  try {
    const tDoc = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tDoc.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    if (tDoc.data().creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut supprimer le tournoi' });

    const teamsSnapshot = await db.collection('tournaments').doc(req.params.tournamentId).collection('teams').get();
    for (const teamDoc of teamsSnapshot.docs) await teamDoc.ref.delete();

    const groupDoc = await db.collection('groups').doc(tDoc.data().groupId).get();
    if (groupDoc.exists) {
      await groupDoc.ref.update({
        tournaments: (groupDoc.data().tournaments || []).filter(id => id !== req.params.tournamentId)
      });
    }

    await tDoc.ref.delete();
    res.json({ message: 'Tournoi supprimé' });
  } catch (error) {
    console.error('Erreur suppression tournoi:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES - ÉQUIPES
// ============================================

// Créer une équipe dans un tournoi
app.post('/api/tournaments/:tournamentId/teams', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Le nom de l'équipe est requis" });
    }

    const tournament = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    const tournamentData = tournament.data();

    // Vérifier que l'utilisateur est membre du groupe
    const group = await db.collection('groups').doc(tournamentData.groupId).get();
    if (!group.exists || !group.data().members.includes(req.userId)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que l'utilisateur n'est pas déjà dans une équipe de ce tournoi
    const existingTeams = await db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').where('members', 'array-contains', req.userId).get();
    if (!existingTeams.empty) {
      return res.status(400).json({ error: 'Vous êtes déjà dans une équipe pour ce tournoi' });
    }

    const userDoc = await db.collection('users').doc(req.userId).get();
    const userData = userDoc.data();

    // Vérifier l'éligibilité genre (créateur = premier membre, équipe de taille 1)
    const eligibility = checkGenderEligibility(userData.gender, tournamentData.gender, [], tournamentData.teamSize);
    if (!eligibility.allowed) {
      return res.status(400).json({ error: eligibility.reason });
    }

    const newMemberDetails = [{ id: req.userId, firstName: userData.firstName, lastName: userData.lastName, gender: userData.gender, level: userData.level, avatarUrl: userData.avatarUrl || null }];
    const { averageLevel, averageLevelLabel } = computeAverageLevel(newMemberDetails);

    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc();
    await teamRef.set({
      id: teamRef.id,
      tournamentId: req.params.tournamentId,
      name: name.trim(),
      creator: req.userId,
      members: [req.userId],
      memberDetails: newMemberDetails,
      maxSize: tournamentData.teamSize,
      averageLevel, averageLevelLabel
    });

    res.json({ message: 'Équipe créée!', teamId: teamRef.id });
  } catch (error) {
    console.error('Erreur création équipe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les équipes d'un tournoi
app.get('/api/tournaments/:tournamentId/teams', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').get();
    const teams = [];
    snapshot.forEach(doc => teams.push(doc.data()));
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre une équipe
app.post('/api/tournaments/:tournamentId/teams/:teamId/join', verifyToken, async (req, res) => {
  try {
    const tournament = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    const tournamentData = tournament.data();

    // Vérifier que l'utilisateur est membre du groupe
    const group = await db.collection('groups').doc(tournamentData.groupId).get();
    if (!group.exists || !group.data().members.includes(req.userId)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que l'utilisateur n'est pas déjà dans une équipe de ce tournoi
    const existingTeams = await db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').where('members', 'array-contains', req.userId).get();
    if (!existingTeams.empty) {
      return res.status(400).json({ error: 'Vous êtes déjà dans une équipe pour ce tournoi' });
    }

    const teamRef = db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    const teamData = team.data();

    if (teamData.members.length >= teamData.maxSize) {
      return res.status(400).json({ error: 'Équipe complète' });
    }

    const userDoc = await db.collection('users').doc(req.userId).get();
    const userData = userDoc.data();

    const eligibility = checkGenderEligibility(
      userData.gender, tournamentData.gender, teamData.memberDetails, teamData.maxSize
    );
    if (!eligibility.allowed) {
      return res.status(400).json({ error: eligibility.reason });
    }

    const updatedDetails = [...teamData.memberDetails, { id: req.userId, firstName: userData.firstName, lastName: userData.lastName, gender: userData.gender, level: userData.level, avatarUrl: userData.avatarUrl || null }];
    const { averageLevel, averageLevelLabel } = computeAverageLevel(updatedDetails);
    await teamRef.update({
      members: [...teamData.members, req.userId],
      memberDetails: updatedDetails,
      averageLevel, averageLevelLabel
    });

    res.json({ message: "Vous avez rejoint l'équipe!" });
  } catch (error) {
    console.error('Erreur rejoindre équipe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Quitter une équipe
app.post('/api/tournaments/:tournamentId/teams/:teamId/leave', verifyToken, async (req, res) => {
  try {
    const teamRef = db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    const teamData = team.data();

    if (!teamData.members.includes(req.userId)) {
      return res.status(400).json({ error: "Vous n'êtes pas dans cette équipe" });
    }

    const updatedMembers = teamData.members.filter(id => id !== req.userId);
    const updatedDetails = teamData.memberDetails.filter(m => m.id !== req.userId);

    // Si l'équipe est vide après le départ, on la supprime
    if (updatedMembers.length === 0) {
      await teamRef.delete();
      return res.json({ message: "Équipe supprimée (plus aucun membre)" });
    }

    const { averageLevel, averageLevelLabel } = computeAverageLevel(updatedDetails);
    await teamRef.update({ members: updatedMembers, memberDetails: updatedDetails, averageLevel, averageLevelLabel });
    res.json({ message: "Vous avez quitté l'équipe" });
  } catch (error) {
    console.error('Erreur quitter équipe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Renommer une équipe (créateur seulement)
app.put('/api/tournaments/:tournamentId/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    if (team.data().creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut renommer l\'équipe' });
    await teamRef.update({ name: name.trim() });
    res.json({ message: 'Équipe renommée' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une équipe (créateur seulement)
app.delete('/api/tournaments/:tournamentId/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    if (team.data().creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut supprimer l\'équipe' });
    await teamRef.delete();
    res.json({ message: 'Équipe supprimée' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log('📝 API prête à recevoir des requêtes');
});
