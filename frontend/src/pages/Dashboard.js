import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import TournamentCard from '../components/TournamentCard';
import { daysUntilNum, shortLocation } from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };

function HeroCard({ entry }) {
  const navigate = useNavigate();
  const t = entry.tournament;
  const days = daysUntilNum(t.date);

  const countdownLabel =
    days <= 0 ? "Aujourd'hui !" :
    days === 1 ? 'Demain' :
    `Dans ${days} jour${days > 1 ? 's' : ''}`;

  const memberCount = (entry.myTeam?.members?.length || 0) + (entry.myTeam?.externalMembers?.length || 0);
  const maxMembers  = entry.myTeam?.maxSize  || 0;

  const pillStyle = { background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#fff' };

  return (
    <div className="hero-card" onClick={() => navigate(`/tournaments/${t.id}`)}>
      <div className="hero-label">Prochain tournoi</div>
      <div className="hero-name">{t.name}</div>
      <div className="hero-meta">
        <div className="hero-meta-item">
          📅 {new Date(t.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {t.time ? ` · ${t.time}` : ''}
        </div>
        <div className="hero-meta-item">📍 {shortLocation(t.location)}</div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, marginBottom: 4 }}>
        {(t.playerFormat || t.format) && <span style={pillStyle}>{t.playerFormat || t.format}</span>}
        {t.gender && <span style={pillStyle}>{GENDER_LABELS[t.gender] || t.gender}</span>}
        {t.surface && <span style={pillStyle}>{SURFACE_LABELS[t.surface]}</span>}
        {t.price > 0 ? <span style={pillStyle}>{t.price}€</span> : <span style={pillStyle}>Gratuit</span>}
      </div>
      <div className="hero-footer">
        <div className="hero-countdown">{countdownLabel}</div>
        {entry.myTeam ? (
          <div className="hero-team-pill">👟 {entry.myTeam.name} · {memberCount}/{maxMembers}</div>
        ) : (
          <div className="hero-team-pill" style={{ background: 'rgba(255,255,255,0.1)' }}>Sans équipe</div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="t-card" style={{ pointerEvents:'none' }}>
      <div className="sk-line" style={{ width:'60%', height:15, marginBottom:10 }}></div>
      <div className="sk-line" style={{ width:'45%', height:11, marginBottom:6 }}></div>
      <div className="sk-line" style={{ width:'55%', height:11, marginBottom:12 }}></div>
      <div style={{ display:'flex', gap:6 }}>
        <div className="sk-badge"></div>
        <div className="sk-badge"></div>
        <div className="sk-badge"></div>
      </div>
    </div>
  );
}

const CACHE_KEY = 'dashboard_entries_v1';

function Dashboard({ user, onLogout }) {
  const [entries, setEntries] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    try { return !sessionStorage.getItem(CACHE_KEY); } catch { return true; }
  });
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');
  const token = localStorage.getItem('token');

  useEffect(() => { fetchTournaments(); }, []); // eslint-disable-line

  const fetchTournaments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me/tournaments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEntries(res.data);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(res.data)); } catch {}
    } catch (err) {
      if (err.response?.status === 404) setEntries([]);
      else setError('Erreur lors du chargement des tournois');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const dow = today.getDay();
  const satStr = new Date(today.getTime() + ((6 - dow + 7) % 7) * 86400000).toISOString().split('T')[0];
  const sunStr = new Date(today.getTime() + (((6 - dow + 7) % 7) + 1) * 86400000).toISOString().split('T')[0];

  const upcomingAll = entries
    .filter(e => e.tournament.date >= todayStr)
    .sort((a, b) => a.tournament.date.localeCompare(b.tournament.date));
  const nextEntry = upcomingAll[0] || null;

  const filtered = entries.filter(e => {
    const d = e.tournament.date;
    if (filter === 'upcoming') return d >= todayStr;
    if (filter === 'weekend')  return d === satStr || d === sunStr;
    if (filter === 'past')     return d < todayStr;
    if (filter === 'mine')     return !!e.myTeam;
    return true;
  });

  const upcoming = filtered.filter(e => e.tournament.date >= todayStr);
  const past     = filtered.filter(e => e.tournament.date < todayStr);

  const firstNameOrPseudo = user.firstName || user.pseudo?.split(' ')[0] || '';

  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <div className="header-row">
            <div>
              <div className="header-title">Bonjour, {firstNameOrPseudo} 👋</div>
              <div className="header-subtitle">
                {upcomingAll.length > 0
                  ? `${upcomingAll.length} tournoi${upcomingAll.length > 1 ? 's' : ''} à venir`
                  : 'Vos prochains tournois'}
              </div>
            </div>
            <AvatarMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </div>

      <div className="chips-row">
        <div className={`chip ${filter === 'all'      ? 'active' : ''}`} onClick={() => setFilter('all')}>Tous</div>
        <div className={`chip ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>À venir</div>
        <div className={`chip ${filter === 'mine'     ? 'active' : ''}`} onClick={() => setFilter('mine')}>Mes équipes</div>
        <div className={`chip ${filter === 'weekend'  ? 'active' : ''}`} onClick={() => setFilter('weekend')}>Ce week-end</div>
        <div className={`chip ${filter === 'past'     ? 'active' : ''}`} onClick={() => setFilter('past')}>Passés</div>
      </div>

      <div className="page-content">
        {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
        {error   && <div className="message error">{error}</div>}

        {!loading && entries.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏐</div>
            <p className="empty-text">Aucun tournoi dans vos groupes</p>
            <p style={{ fontSize: 13, color: '#B0C0D0', margin: '8px 0 20px' }}>
              Rejoignez un groupe ou créez un tournoi.
            </p>
            <Link to="/creer"><button>Créer un tournoi</button></Link>
          </div>
        )}

        {!loading && entries.length > 0 && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p className="empty-text">Aucun tournoi dans ce filtre</p>
          </div>
        )}

        {/* Hero : prochain tournoi à venir (filtre Tous ou À venir) */}
        {!loading && nextEntry && (filter === 'all' || filter === 'upcoming') && (
          <HeroCard entry={nextEntry} />
        )}

        {upcoming.length > 0 && (
          <>
            {(filter === 'all' || filter === 'upcoming') && nextEntry
              ? <div className="section-label">Autres tournois à venir</div>
              : <div className="section-label">À venir</div>
            }
            {upcoming
              .filter(e => !(filter !== 'weekend' && filter !== 'mine' && e === nextEntry))
              .map((entry, i) => (
                <TournamentCard key={i}
                  tournament={entry.tournament}
                  group={entry.group}
                  myTeam={entry.myTeam}
                  showTeamStatus
                />
              ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-label">Passés</div>
            {past.map((entry, i) => (
              <TournamentCard key={i}
                tournament={entry.tournament}
                group={entry.group}
                myTeam={entry.myTeam}
                showTeamStatus
                past
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

export default Dashboard;
