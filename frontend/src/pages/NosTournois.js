import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };

// Deterministic color from group ID
const GROUP_COLORS = ['#1565C0','#E65100','#7B1FA2','#2E7D32','#C62828','#00695C','#283593','#AD1457'];
function groupColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((new Date(dateStr) - today) / 86400000);
  if (diff < 0)  return null;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff < 8)   return `Dans ${diff}j`;
  return null;
}

function NosTournois({ user, onLogout }) {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('all');
  const token = localStorage.getItem('token');

  useEffect(() => { fetchTournaments(); }, []); // eslint-disable-line

  const fetchTournaments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me/tournaments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEntries(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Cette fonctionnalité sera disponible prochainement.');
      } else {
        setError('Erreur lors du chargement des tournois.');
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];
  const dow = today.getDay();
  const satStr = new Date(today.getTime() + ((6 - dow + 7) % 7) * 86400000).toISOString().split('T')[0];
  const sunStr = new Date(today.getTime() + (((6 - dow + 7) % 7) + 1) * 86400000).toISOString().split('T')[0];

  const filtered = entries.filter(e => {
    const d = e.tournament.date;
    if (filter === 'upcoming') return d >= todayStr;
    if (filter === 'weekend')  return d === satStr || d === sunStr;
    if (filter === 'past')     return d < todayStr;
    return true;
  });

  const upcoming = filtered.filter(e => e.tournament.date >= todayStr);
  const past     = filtered.filter(e => e.tournament.date < todayStr);

  return (
    <>
      {/* Header */}
      <div className="app-header">
        <div className="header-row">
          <div>
            <div className="header-title">Nos Tournois</div>
            <div className="header-subtitle">
              {entries.length > 0
                ? `${entries.filter(e => e.tournament.date >= todayStr).length} à venir · tous mes groupes`
                : 'Tous mes groupes'}
            </div>
          </div>
          <AvatarMenu user={user} onLogout={onLogout} />
        </div>
      </div>

      {/* Filter chips */}
      <div className="chips-row">
        <div className={`chip ${filter === 'all'      ? 'active' : ''}`} onClick={() => setFilter('all')}>Tous</div>
        <div className={`chip ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>À venir</div>
        <div className={`chip ${filter === 'weekend'  ? 'active' : ''}`} onClick={() => setFilter('weekend')}>Ce week-end</div>
        <div className={`chip ${filter === 'past'     ? 'active' : ''}`} onClick={() => setFilter('past')}>Passés</div>
      </div>

      <div className="page-content">
        {loading && <p style={{ textAlign:'center', color:'#90A0B0', padding:'2rem' }}>Chargement…</p>}

        {error && (
          <div style={{ textAlign:'center', padding:'2rem 1rem' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🚧</div>
            <p style={{ color:'#90A0B0', fontSize:14 }}>{error}</p>
            <p style={{ color:'#B0C0D0', fontSize:12, marginTop:8 }}>
              En attendant, retrouvez vos tournois depuis la page Groupes.
            </p>
            <Link to="/groups" style={{ marginTop:16, display:'inline-block' }}>
              <button>Voir mes groupes</button>
            </Link>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏆</div>
            <p className="empty-text">Aucun tournoi dans vos groupes</p>
            <p style={{ fontSize:13, color:'#B0C0D0', marginTop:8 }}>
              Créez ou rejoignez un groupe pour voir les tournois ici.
            </p>
            <Link to="/groups" style={{ marginTop:16, display:'inline-block' }}>
              <button>Mes groupes</button>
            </Link>
          </div>
        )}

        {!loading && !error && entries.length > 0 && filtered.length === 0 && (
          <div className="empty-state" style={{ padding:'30px 0' }}>
            <div className="empty-icon">🔍</div>
            <p className="empty-text">Aucun tournoi dans ce filtre</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="section-label">À venir</div>
            {upcoming.map((e, i) => <TournamentCard key={i} entry={e} userId={user.id} />)}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-label">Passés</div>
            {past.map((e, i) => <TournamentCard key={i} entry={e} userId={user.id} past />)}
          </>
        )}
      </div>
    </>
  );
}

function TournamentCard({ entry, userId, past }) {
  const { tournament, group, myTeam } = entry;
  const countdown = daysUntil(tournament.date);
  const dateStr = tournament.date
    ? new Date(tournament.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const genderBadge  = GENDER_BADGE[tournament.gender]   || 'badge-grey';
  const surfaceLabel = SURFACE_LABELS[tournament.surface] || '';
  const surfaceBadge = SURFACE_BADGE[tournament.surface]  || '';

  return (
    <Link to={`/tournaments/${tournament.id}`} className="team-entry-link">
      <div className="t-card" style={ past ? { opacity:0.6 } : {} }>
        {/* Group source */}
        <div className="group-source">
          <div className="group-source-dot" style={{ background: groupColor(group.id) }}></div>
          {group.name}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="t-card-name">{tournament.name}</div>
            <div className="t-card-meta">📅 {dateStr} · {tournament.time}</div>
            <div className="t-card-meta">📍 {tournament.location}</div>
            <div className="t-card-badges">
              {tournament.playerFormat && <span className="badge badge-blue">{tournament.playerFormat}</span>}
              <span className={`badge ${genderBadge}`}>{GENDER_LABELS[tournament.gender] || ''}</span>
              {surfaceLabel && <span className={`badge ${surfaceBadge}`}>{surfaceLabel}</span>}
              {tournament.price > 0
                ? <span className="badge badge-yellow">{tournament.price}€</span>
                : <span className="badge badge-green">Gratuit</span>}
            </div>
          </div>
          {past
            ? <span className="badge badge-grey" style={{ flexShrink:0 }}>Terminé</span>
            : countdown && <span className="countdown">{countdown}</span>
          }
        </div>

        {/* My team indicator */}
        {myTeam ? (
          <div className="my-team-indicator">
            <span style={{ fontSize:12 }}>👟</span>
            <span className="my-team-indicator-label">
              {myTeam.name} · {myTeam.members.length}/{myTeam.maxSize}
            </span>
          </div>
        ) : !past && (
          <div className="my-team-indicator warn">
            <span style={{ fontSize:12 }}>⚠️</span>
            <span className="my-team-indicator-label">Pas encore inscrit dans une équipe</span>
          </div>
        )}

        <div className="t-card-footer">
          <span style={{ fontSize:11, color:'#90A0B0' }}>
            🏐 {tournament.teamCount ?? '?'} équipe{(tournament.teamCount ?? 0) !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize:11, color:'var(--primary)', fontWeight:600 }}>Voir →</span>
        </div>
      </div>
    </Link>
  );
}

export default NosTournois;
