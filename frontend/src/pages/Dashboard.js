import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };
const AV_COLORS = ['av-blue','av-pink','av-green','av-orange','av-purple','av-teal','av-red','av-indigo'];

function avatarColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(firstName, lastName) {
  const f = (firstName || '').trim(); const l = (lastName || '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  return f ? f.slice(0, 2).toUpperCase() : '?';
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((new Date(dateStr) - today) / 86400000);
  if (diff < 0)  return null;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  return `Dans ${diff}j`;
}

function Dashboard({ user, onLogout }) {
  const [myTeams, setMyTeams]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('all'); // all | upcoming | weekend | past
  const token = localStorage.getItem('token');

  useEffect(() => { fetchMyTeams(); }, []); // eslint-disable-line

  const fetchMyTeams = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyTeams(res.data);
    } catch {
      setError('Erreur lors du chargement de vos équipes');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];

  // Weekend range
  const dow = today.getDay();
  const satOffset = (6 - dow + 7) % 7;
  const sunOffset = satOffset + 1;
  const satStr = new Date(today.getTime() + satOffset * 86400000).toISOString().split('T')[0];
  const sunStr = new Date(today.getTime() + sunOffset * 86400000).toISOString().split('T')[0];

  const filtered = myTeams.filter(e => {
    const d = e.tournament.date;
    if (filter === 'upcoming') return d >= todayStr;
    if (filter === 'weekend')  return d === satStr || d === sunStr;
    if (filter === 'past')     return d < todayStr;
    return true;
  });

  const upcoming = filtered.filter(e => e.tournament.date >= todayStr);
  const past     = filtered.filter(e => e.tournament.date < todayStr);

  const firstNameOrPseudo = user.firstName || user.pseudo?.split(' ')[0] || '';

  return (
    <>
      {/* Header */}
      <div className="app-header">
        <div className="header-row">
          <div>
            <div className="header-title">Bonjour, {firstNameOrPseudo} 👋</div>
            <div className="header-subtitle">
              {myTeams.length > 0
                ? `${myTeams.filter(e => e.tournament.date >= todayStr).length} tournoi(s) à venir`
                : 'Vos prochains tournois'}
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

      {/* Content */}
      <div className="page-content">
        {loading && <p style={{ textAlign:'center', color:'#90A0B0', padding:'2rem' }}>Chargement…</p>}
        {error   && <div className="message error">{error}</div>}

        {!loading && myTeams.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏐</div>
            <p className="empty-text">Vous n'êtes inscrit dans aucune équipe</p>
            <p style={{ fontSize:13, color:'#B0C0D0', margin:'8px 0 20px' }}>
              Rejoignez un tournoi depuis votre groupe.
            </p>
            <Link to="/groups"><button>Voir mes groupes</button></Link>
          </div>
        )}

        {!loading && myTeams.length > 0 && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p className="empty-text">Aucun tournoi dans ce filtre</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="section-label">À venir</div>
            {upcoming.map((entry, i) => (
              <TournamentCard key={i} entry={entry} userId={user.id} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-label">Passés</div>
            {past.map((entry, i) => (
              <TournamentCard key={i} entry={entry} userId={user.id} past />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function TournamentCard({ entry, userId, past }) {
  const { team, tournament, group } = entry;
  const filled   = team.members.length;
  const maxSize  = team.maxSize;
  const pct      = Math.round((filled / maxSize) * 100);
  const complete = filled >= maxSize;

  const dateStr = tournament.date
    ? new Date(tournament.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const formatLabel  = tournament.playerFormat || tournament.format || '';
  const genderLabel  = GENDER_LABELS[tournament.gender]  || '';
  const genderBadge  = GENDER_BADGE[tournament.gender]   || 'badge-grey';
  const surfaceLabel = SURFACE_LABELS[tournament.surface] || '';
  const surfaceBadge = SURFACE_BADGE[tournament.surface]  || '';
  const countdown    = daysUntil(tournament.date);

  // Show up to 4 member avatars + overflow
  const MAX_VISIBLE = 4;
  const visible  = team.memberDetails.slice(0, MAX_VISIBLE);
  const overflow = team.memberDetails.length - MAX_VISIBLE;

  return (
    <Link to={`/tournaments/${tournament.id}`} className="team-entry-link">
      <div className="t-card" style={ past ? { opacity: 0.6 } : {} }>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-card-name">{tournament.name}</div>
            <div className="t-card-meta">📅 {dateStr} · {tournament.time}</div>
            <div className="t-card-meta">📍 {tournament.location}</div>
            <div className="t-card-badges">
              {formatLabel  && <span className="badge badge-blue">{formatLabel}</span>}
              {genderLabel  && <span className={`badge ${genderBadge}`}>{genderLabel}</span>}
              {surfaceLabel && <span className={`badge ${surfaceBadge}`}>{surfaceLabel}</span>}
              {tournament.price > 0
                ? <span className="badge badge-yellow">{tournament.price}€</span>
                : <span className="badge badge-green">Gratuit</span>}
            </div>
          </div>
          {past
            ? <span className="badge badge-grey" style={{ flexShrink:0 }}>Terminé</span>
            : countdown && (
              <span className={`countdown ${countdown.startsWith('Dans') && parseInt(countdown.split(' ')[1]) > 7 ? 'soon' : ''}`}>
                {countdown}
              </span>
            )
          }
        </div>

        {/* Team section */}
        <div className="team-section">
          <div className="team-section-name">Équipe : {team.name}</div>
          <div className="team-section-row">
            <div className="av-stack">
              {visible.map(m => (
                <div key={m.id} className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`}>
                  {m.avatarUrl
                    ? <img src={m.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : initials(m.firstName, m.lastName)
                  }
                </div>
              ))}
              {overflow > 0 && (
                <div className="av-circle av-sm av-more">+{overflow}</div>
              )}
              {/* Empty slots */}
              {Array.from({ length: maxSize - filled }).slice(0, 3).map((_, i) => (
                <div key={`e${i}`} className="av-circle av-sm"
                  style={{ background:'#E8EEF8', border:'1.5px dashed #C0D0E0' }}></div>
              ))}
            </div>
            <div>
              <div className="spots-row" style={{ justifyContent:'flex-end' }}>
                {Array.from({ length: maxSize }).map((_, i) => (
                  <div key={i} className={`spot ${i < filled ? 'filled' : 'empty'}`}></div>
                ))}
              </div>
              <div className="spots-label">
                {complete ? 'Complet ✓' : `${filled}/${maxSize} joueurs`}
              </div>
            </div>
          </div>
          <div className="progress-bar">
            <div className={`progress-fill ${complete ? 'complete' : ''}`} style={{ width:`${pct}%` }}></div>
          </div>
        </div>

        <div className="t-card-footer" style={{ fontSize:11, color:'#90A0B0', marginTop:8, paddingTop:8, borderTop:'1px solid #EEF2F7' }}>
          <span>👥 {group.name}</span>
          <span>Voir l'équipe →</span>
        </div>
      </div>
    </Link>
  );
}

export default Dashboard;
