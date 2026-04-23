const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

dotenv.config();
const app = express();

app.use(helmet());

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

// 10 tentatives / 15 min sur les routes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 100 requêtes / 15 min sur les routes générales
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/groups/join', authLimiter);
app.use('/api', apiLimiter);

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
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ ERREUR: JWT_SECRET non défini dans .env");
  process.exit(1);
}

// ============================================
// HELPER - Validation genre pour une équipe
// Règles :
//   - Tournoi masculin : seuls les hommes peuvent rejoindre
//   - Tournoi féminin : seules les femmes peuvent rejoindre
//   - Tournoi mix : au moins une femme dans l'équipe quand elle est complète
//     → la dernière place est bloquée si aucune femme (ni existante, ni la personne qui rejoint)
// ============================================
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

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
// HELPER - Vérifie si un user a accès à un tournoi
// (membre du groupe principal OU d'un groupe lié)
// ============================================
async function userHasTournamentAccess(userId, tournamentData) {
  const primaryGroup = await db.collection('groups').doc(tournamentData.groupId).get();
  if (primaryGroup.exists && primaryGroup.data().members.includes(userId)) return true;
  const linkedGroups = tournamentData.linkedGroups || [];
  for (const gId of linkedGroups) {
    const lgDoc = await db.collection('groups').doc(gId).get();
    if (lgDoc.exists && lgDoc.data().members.includes(userId)) return true;
  }
  return false;
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

// Mise à jour du profil
app.put('/api/auth/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, gender, level, avatarUrl, currentPassword, newPassword } = req.body;

    if (!firstName || !lastName || !email || !gender || !level) {
      return res.status(400).json({ error: 'Prénom, nom, email, genre et niveau sont requis' });
    }
    if (!['masculin', 'feminin'].includes(gender)) {
      return res.status(400).json({ error: 'Genre invalide' });
    }
    if (!Object.keys(LEVEL_NUM).includes(level)) {
      return res.status(400).json({ error: 'Niveau invalide' });
    }

    const userDoc = await db.collection('users').doc(req.userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const userData = userDoc.data();

    if (email !== userData.email) {
      const existing = await db.collection('users').where('email', '==', email).get();
      if (!existing.empty) return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const updates = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone || '',
      email,
      gender,
      level,
    };

    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Mot de passe actuel requis' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
      const match = await bcrypt.compare(currentPassword, userData.password);
      if (!match) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
      updates.password = await bcrypt.hash(newPassword, 10);
    }

    await db.collection('users').doc(req.userId).update(updates);

    res.json({
      message: 'Profil mis à jour',
      user: {
        id: req.userId,
        email: updates.email,
        firstName: updates.firstName,
        lastName: updates.lastName,
        gender: updates.gender,
        level: updates.level,
        phone: updates.phone,
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : (userData.avatarUrl || null),
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
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
// Inclut les tournois liés via linkedGroups
app.get('/api/users/me/tournaments', verifyToken, async (req, res) => {
  try {
    const groupsSnapshot = await db.collection('groups')
      .where('members', 'array-contains', req.userId).get();

    const result = [];
    const seenTournamentIds = new Set();

    for (const groupDoc of groupsSnapshot.docs) {
      const group = groupDoc.data();

      const [primarySnap, linkedSnap] = await Promise.all([
        db.collection('tournaments').where('groupId', '==', group.id).get(),
        db.collection('tournaments').where('linkedGroups', 'array-contains', group.id).get()
      ]);

      const allDocs = [...primarySnap.docs, ...linkedSnap.docs];

      for (const tDoc of allDocs) {
        if (seenTournamentIds.has(tDoc.id)) continue;
        seenTournamentIds.add(tDoc.id);

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
          myTeam: myTeam ? { id: myTeam.id, name: myTeam.name, members: myTeam.members, memberDetails: myTeam.memberDetails || [], externalMembers: myTeam.externalMembers || [], maxSize: myTeam.maxSize } : null,
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
    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();

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
    const allMemberIds = new Set();
    snapshot.forEach(doc => {
      const g = doc.data();
      groups.push(g);
      (g.members || []).forEach(id => allMemberIds.add(id));
    });

    const userMap = {};
    if (allMemberIds.size > 0) {
      const userDocs = await Promise.all([...allMemberIds].map(id => db.collection('users').doc(id).get()));
      userDocs.forEach(doc => {
        if (doc.exists) {
          const u = doc.data();
          userMap[u.id] = { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl || null };
        }
      });
    }

    const result = groups.map(g => ({
      ...g,
      memberDetails: (g.members || []).map(id => userMap[id]).filter(Boolean),
    }));

    res.json(result);
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
    if (!group.data().members.includes(req.userId)) return res.status(403).json({ error: 'Accès non autorisé' });
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

// Recherche publique de tournois
app.get('/api/tournaments/search', verifyToken, async (req, res) => {
  try {
    const { q, format, gender, date, surface, region, lat, lng, radius } = req.query;
    const searchLat    = lat    ? parseFloat(lat)    : null;
    const searchLng    = lng    ? parseFloat(lng)    : null;
    const searchRadius = radius ? parseFloat(radius) : 25;

    const snapshot = await db.collection('tournaments').get();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const dow = today.getDay();
    const satStr = new Date(today.getTime() + ((6 - dow + 7) % 7) * 86400000).toISOString().split('T')[0];
    const sunStr = new Date(today.getTime() + (((6 - dow + 7) % 7) + 1) * 86400000).toISOString().split('T')[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const results = [];

    for (const doc of snapshot.docs) {
      const t = doc.data();

      // Text search on name + location
      if (q) {
        const qLow = q.toLowerCase();
        const matches = (t.name || '').toLowerCase().includes(qLow)
          || (t.location || '').toLowerCase().includes(qLow);
        if (!matches) continue;
      }

      // Format filter
      if (format && t.playerFormat !== format) continue;

      // Gender filter
      if (gender && t.gender !== gender) continue;

      // Surface filter
      if (surface && t.surface !== surface) continue;

      // Region filter — partial match on location string
      if (region) {
        const regionLow = region.toLowerCase();
        if (!(t.location || '').toLowerCase().includes(regionLow)) continue;
      }

      // Distance filter
      if (searchLat && searchLng) {
        if (!t.lat || !t.lng) continue;
        if (haversineKm(searchLat, searchLng, t.lat, t.lng) > searchRadius) continue;
      }

      // Date filter
      if (date === 'weekend') {
        if (t.date !== satStr && t.date !== sunStr) continue;
      } else if (date === 'month') {
        if (t.date < todayStr || t.date > monthEnd) continue;
      } else {
        // By default only show upcoming + today
        if (t.date < todayStr) continue;
      }

      // Fetch group name and team count
      let groupName = '';
      let teamCount = 0;
      try {
        const groupDoc = await db.collection('groups').doc(t.groupId).get();
        if (groupDoc.exists) groupName = groupDoc.data().name || '';
        const teamsSnap = await db.collection('tournaments').doc(t.id).collection('teams').get();
        teamCount = teamsSnap.size;
      } catch (_) {}

      results.push({
        tournament: {
          id: t.id, name: t.name, date: t.date, time: t.time,
          location: t.location, playerFormat: t.playerFormat,
          gender: t.gender, surface: t.surface || null,
          price: t.price || 0
        },
        groupName,
        teamCount
      });
    }

    results.sort((a, b) => a.tournament.date.localeCompare(b.tournament.date));
    res.json(results);
  } catch (error) {
    console.error('Erreur recherche tournois:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un tournoi
app.post('/api/tournaments', verifyToken, async (req, res) => {
  try {
    const { groupId, name, date, time, location, price, playerFormat, gender, surface, lat, lng } = req.body;

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
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
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
    const groupDoc = await db.collection('groups').doc(req.params.groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: 'Groupe non trouvé' });
    if (!groupDoc.data().members.includes(req.userId)) return res.status(403).json({ error: 'Accès non autorisé' });
    const snapshot = await db.collection('tournaments')
      .where('groupId', '==', req.params.groupId)
      .get();
    const tournaments = [];
    snapshot.forEach(doc => tournaments.push(doc.data()));
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
    const { name, date, time, location, price, playerFormat, gender, surface } = req.body;
    const tDoc = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tDoc.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    if (tDoc.data().creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut modifier le tournoi' });
    if (!name || !date || !time || !location) return res.status(400).json({ error: 'Informations incomplètes' });
    await tDoc.ref.update({
      name: name.trim(), date, time, location: location.trim(),
      price: parseFloat(price) || 0,
      ...(playerFormat && { playerFormat }),
      ...(gender      && { gender }),
      surface: surface || null,
    });
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

// Ajouter un tournoi public à un groupe (depuis la recherche)
app.post('/api/tournaments/:tournamentId/add-to-group', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'groupId requis' });

    const [tDoc, groupDoc] = await Promise.all([
      db.collection('tournaments').doc(req.params.tournamentId).get(),
      db.collection('groups').doc(groupId).get()
    ]);

    if (!tDoc.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    if (!groupDoc.exists || !groupDoc.data().members.includes(req.userId)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const tournamentData = tDoc.data();
    if (tournamentData.groupId === groupId) {
      return res.status(400).json({ error: 'Ce tournoi appartient déjà à ce groupe' });
    }

    const linkedGroups = tournamentData.linkedGroups || [];
    if (linkedGroups.includes(groupId)) {
      return res.status(400).json({ error: 'Tournoi déjà ajouté à ce groupe' });
    }

    await tDoc.ref.update({ linkedGroups: [...linkedGroups, groupId] });
    res.json({ message: 'Tournoi ajouté au groupe' });
  } catch (error) {
    console.error('Erreur ajout tournoi au groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES - ÉQUIPES
// ============================================

// Créer une équipe dans un tournoi
app.post('/api/tournaments/:tournamentId/teams', verifyToken, async (req, res) => {
  try {
    const { name, externalMembers = [], visibility = 'open' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Le nom de l'équipe est requis" });
    }

    const tournament = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    const tournamentData = tournament.data();

    // Vérifier que l'utilisateur a accès au tournoi (groupe principal ou lié)
    if (!await userHasTournamentAccess(req.userId, tournamentData)) {
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

    const resolvedTeamSize = tournamentData.teamSize
      || parseInt((tournamentData.playerFormat || '').split('x')[0])
      || 4;

    // Vérifier l'éligibilité genre (créateur = premier membre, équipe de taille 1)
    const eligibility = checkGenderEligibility(userData.gender, tournamentData.gender, [], resolvedTeamSize);
    if (!eligibility.allowed) {
      return res.status(400).json({ error: eligibility.reason });
    }

    const newMemberDetails = [{ id: req.userId, firstName: userData.firstName, lastName: userData.lastName, gender: userData.gender, level: userData.level, avatarUrl: userData.avatarUrl || null }];
    const { averageLevel, averageLevelLabel } = computeAverageLevel(newMemberDetails);

    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc();
    const maxExternals = Math.max(0, resolvedTeamSize - 1);
    const extSlots = (externalMembers || []).slice(0, maxExternals).map((e, i) => ({
      id: `ext_${teamRef.id}_${i}_${Math.random().toString(36).substr(2,5)}`,
      name: (e.name || '').trim(),
      reservedBy: req.userId
    }));
    await teamRef.set({
      id: teamRef.id,
      tournamentId: req.params.tournamentId,
      name: name.trim(),
      creator: req.userId,
      members: [req.userId],
      memberDetails: newMemberDetails,
      externalMembers: extSlots,
      maxSize: resolvedTeamSize,
      averageLevel, averageLevelLabel,
      visibility: ['open', 'group_only'].includes(visibility) ? visibility : 'open'
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
    const { externalMembers = [] } = req.body;
    const tournament = await db.collection('tournaments').doc(req.params.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    const tournamentData = tournament.data();

    // Vérifier que l'utilisateur a accès au tournoi (groupe principal ou lié)
    if (!await userHasTournamentAccess(req.userId, tournamentData)) {
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

    // Vérifier la visibilité : group_only = doit partager un groupe avec le créateur
    if (teamData.visibility === 'group_only' && teamData.creator !== req.userId) {
      const creatorGroupsSnap = await db.collection('groups')
        .where('members', 'array-contains', teamData.creator).get();
      const creatorGroupIds = new Set(creatorGroupsSnap.docs.map(d => d.id));
      const userGroupsSnap = await db.collection('groups')
        .where('members', 'array-contains', req.userId).get();
      const sharesGroup = userGroupsSnap.docs.some(d => creatorGroupIds.has(d.id));
      if (!sharesGroup) {
        return res.status(403).json({ error: 'Cette équipe est réservée aux membres des groupes du créateur' });
      }
    }

    const currentExternals = teamData.externalMembers || [];
    const totalOccupied = teamData.members.length + currentExternals.length;
    if (totalOccupied >= teamData.maxSize) {
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

    const spotsLeft = teamData.maxSize - totalOccupied - 1; // -1 for the user joining
    const newExtSlots = (externalMembers || []).slice(0, spotsLeft).map((e, i) => ({
      id: `ext_${req.params.teamId}_${Date.now()}_${i}`,
      name: (e.name || '').trim(),
      reservedBy: req.userId
    }));

    await teamRef.update({
      members: [...teamData.members, req.userId],
      memberDetails: updatedDetails,
      externalMembers: [...currentExternals, ...newExtSlots],
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
    const updatedExternals = (teamData.externalMembers || []).filter(e => e.reservedBy !== req.userId);

    // Si l'équipe est vide après le départ, on la supprime
    if (updatedMembers.length === 0) {
      await teamRef.delete();
      return res.json({ message: "Équipe supprimée (plus aucun membre)" });
    }

    const { averageLevel, averageLevelLabel } = computeAverageLevel(updatedDetails);
    await teamRef.update({ members: updatedMembers, memberDetails: updatedDetails, externalMembers: updatedExternals, averageLevel, averageLevelLabel });
    res.json({ message: "Vous avez quitté l'équipe" });
  } catch (error) {
    console.error('Erreur quitter équipe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer un membre externe
app.delete('/api/tournaments/:tournamentId/teams/:teamId/external/:extId', verifyToken, async (req, res) => {
  try {
    const teamRef = db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    const teamData = team.data();

    const ext = (teamData.externalMembers || []).find(e => e.id === req.params.extId);
    if (!ext) return res.status(404).json({ error: 'Membre externe non trouvé' });
    if (ext.reservedBy !== req.userId && teamData.creator !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const updatedExternals = teamData.externalMembers.filter(e => e.id !== req.params.extId);
    await teamRef.update({ externalMembers: updatedExternals });
    res.json({ message: 'Membre externe retiré' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une équipe (nom + visibilité — créateur seulement)
app.put('/api/tournaments/:tournamentId/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { name, visibility } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    if (team.data().creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut modifier l\'équipe' });
    const update = { name: name.trim() };
    if (visibility && ['open', 'group_only'].includes(visibility)) update.visibility = visibility;
    await teamRef.update(update);
    res.json({ message: 'Équipe modifiée' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un membre directement (créateur seulement)
app.post('/api/tournaments/:tournamentId/teams/:teamId/add-member', verifyToken, async (req, res) => {
  try {
    const { userId: targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'userId requis' });

    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc(req.params.teamId);
    const [teamDoc, tournDoc] = await Promise.all([
      teamRef.get(),
      db.collection('tournaments').doc(req.params.tournamentId).get()
    ]);
    if (!teamDoc.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    if (!tournDoc.exists) return res.status(404).json({ error: 'Tournoi non trouvé' });
    const teamData = teamDoc.data();
    const tournamentData = tournDoc.data();

    if (teamData.creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut ajouter des membres' });
    if (teamData.members.includes(targetId)) return res.status(400).json({ error: 'Ce joueur est déjà dans l\'équipe' });

    const totalOccupied = teamData.members.length + (teamData.externalMembers || []).length;
    if (totalOccupied >= teamData.maxSize) return res.status(400).json({ error: 'Équipe complète' });

    const existingSnap = await db.collection('tournaments').doc(req.params.tournamentId)
      .collection('teams').where('members', 'array-contains', targetId).get();
    if (!existingSnap.empty) return res.status(400).json({ error: 'Ce joueur est déjà dans une équipe pour ce tournoi' });

    const userDoc = await db.collection('users').doc(targetId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Joueur non trouvé' });
    const userData = userDoc.data();

    const eligibility = checkGenderEligibility(userData.gender, tournamentData.gender, teamData.memberDetails, teamData.maxSize);
    if (!eligibility.allowed) return res.status(400).json({ error: eligibility.reason });

    const updatedDetails = [...teamData.memberDetails, { id: targetId, firstName: userData.firstName, lastName: userData.lastName, gender: userData.gender, level: userData.level, avatarUrl: userData.avatarUrl || null }];
    const { averageLevel, averageLevelLabel } = computeAverageLevel(updatedDetails);
    await teamRef.update({ members: [...teamData.members, targetId], memberDetails: updatedDetails, averageLevel, averageLevelLabel });
    res.json({ message: 'Membre ajouté' });
  } catch (error) {
    console.error('Erreur add-member:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer un membre (créateur seulement, sauf soi-même)
app.delete('/api/tournaments/:tournamentId/teams/:teamId/members/:userId', verifyToken, async (req, res) => {
  try {
    const teamRef = db.collection('tournaments').doc(req.params.tournamentId).collection('teams').doc(req.params.teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Équipe non trouvée' });
    const teamData = team.data();
    if (teamData.creator !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut retirer des membres' });
    if (req.params.userId === req.userId) return res.status(400).json({ error: 'Le créateur ne peut pas se retirer' });

    const updatedMembers = teamData.members.filter(id => id !== req.params.userId);
    const updatedDetails = (teamData.memberDetails || []).filter(m => m.id !== req.params.userId);
    const { averageLevel, averageLevelLabel } = computeAverageLevel(updatedDetails);
    await teamRef.update({ members: updatedMembers, memberDetails: updatedDetails, averageLevel, averageLevelLabel });
    res.json({ message: 'Membre retiré' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rechercher des utilisateurs
app.get('/api/users/search', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json([]);

    const myGroupsSnap = await db.collection('groups').where('members', 'array-contains', req.userId).get();
    const myGroupMemberIds = new Set();
    myGroupsSnap.docs.forEach(d => (d.data().members || []).forEach(id => myGroupMemberIds.add(id)));

    const usersSnap = await db.collection('users').get();
    const results = [];
    usersSnap.docs.forEach(doc => {
      const u = doc.data();
      if (u.id === req.userId) return;
      const fn = (u.firstName || '').toLowerCase();
      const ln = (u.lastName || '').toLowerCase();
      if (fn.includes(q) || ln.includes(q) || `${fn} ${ln}`.includes(q)) {
        results.push({ id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl || null, level: u.level, gender: u.gender, isGroupMember: myGroupMemberIds.has(u.id) });
      }
    });
    results.sort((a, b) => (b.isGroupMember ? 1 : 0) - (a.isGroupMember ? 1 : 0));
    res.json(results.slice(0, 20));
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
