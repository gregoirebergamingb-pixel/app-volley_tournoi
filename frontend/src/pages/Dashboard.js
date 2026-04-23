import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import TournamentCard from '../components/TournamentCard';
import DDayPopup from '../components/DDayPopup';
import { daysUntilNum, shortLocation, avatarColor, initials, groupColor } from '../components/TournamentCard';

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

  const memberCount   = (entry.myTeam?.members?.length || 0) + (entry.myTeam?.externalMembers?.length || 0);
  const maxMembers    = entry.myTeam?.maxSize || 0;
  const memberDetails = entry.myTeam?.memberDetails || [];
  const hasTeamDetail = memberDetails.length > 0;

  const pillStyle = { background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#fff' };

  return (
    <div className="hero-card" onClick={() => navigate(`/tournaments/${t.id}`)}>
      {/* Source du groupe */}
      {entry.group && (
        <div className="hero-group-source">
          <div className="hero-group-dot" style={{ background: groupColor(entry.group.id) }} />
          Groupe : {entry.group.name}
        </div>
      )}
      {/* Label + countdown sur la même ligne */}
      <div className="hero-label">
        Prochain tournoi
        <span className="hero-label-countdown"> · {countdownLabel}</span>
      </div>
      <div className="hero-name">{t.name}</div>
      <div className="hero-meta">
        <div className="hero-meta-item">
          📅 {new Date(t.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {t.time ? ` · ${t.time}` : ''}
        </div>
        <div className="hero-meta-item">📍 {shortLocation(t.location)}</div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, marginBottom: 8 }}>
        {(t.playerFormat || t.format) && <span style={pillStyle}>{t.playerFormat || t.format}</span>}
        {t.gender && <span style={pillStyle}>{GENDER_LABELS[t.gender] || t.gender}</span>}
        {t.surface && <span style={pillStyle}>{SURFACE_LABELS[t.surface]}</span>}
        {t.price > 0 ? <span style={pillStyle}>{t.price}€</span> : <span style={pillStyle}>Gratuit</span>}
      </div>

      {/* Section équipe avec avatars + prénoms + statut */}
      {entry.myTeam && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 10 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {entry.myTeam.name}
            </span>
          </div>
          {hasTeamDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start', flex: 1 }}>
                {memberDetails.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`}
                      style={{ border: '2px solid rgba(255,255,255,0.45)' }}>
                      {m.avatarUrl
                        ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials(m.firstName, m.lastName)
                      }
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>
                      {m.firstName}
                    </span>
                  </div>
                ))}
                {(entry.myTeam.externalMembers || []).map((ext, i) => (
                  <div key={ext.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div className="av-circle av-sm"
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px dashed rgba(255,255,255,0.4)', fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>
                      +1
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>ext.</span>
                  </div>
                ))}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
                whiteSpace: 'nowrap', flexShrink: 0,
                background: memberCount >= maxMembers ? 'rgba(129,199,132,0.22)' : 'rgba(255,152,0,0.20)',
                color: memberCount >= maxMembers ? '#A5D6A7' : '#FFCC80',
              }}>
                {memberCount >= maxMembers
                  ? 'Équipe complète !'
                  : `Manque ${maxMembers - memberCount} joueur${maxMembers - memberCount > 1 ? 's' : ''}`}
              </span>
            </div>
          ) : (
            <div className="hero-team-pill" style={{ display: 'inline-flex' }}>
              {memberCount >= maxMembers
                ? 'Équipe complète !'
                : `Manque ${maxMembers - memberCount} joueur${maxMembers - memberCount > 1 ? 's' : ''}`}
            </div>
          )}
        </div>
      )}

      {!entry.myTeam && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 10 }}>
          <div className="hero-team-pill" style={{ background: 'rgba(255,255,255,0.1)', display: 'inline-flex' }}>Sans équipe</div>
        </div>
      )}

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
  const [error, setError]         = useState('');
  const [ddayTournament, setDdayTournament] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => { fetchTournaments(); }, []); // eslint-disable-line

  // Déclenche la DDayPopup une fois par jour si tournoi aujourd'hui
  useEffect(() => {
    if (!entries.length) return;
    const today = new Date().toISOString().split('T')[0];
    const key   = `dday_shown_${today}`;
    if (localStorage.getItem(key)) return;
    const todayEntry = entries.find(e => e.tournament.date === today);
    if (todayEntry) {
      setDdayTournament(todayEntry.tournament);
      localStorage.setItem(key, '1');
    }
  }, [entries]);

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

  const upcoming = entries
    .filter(e => e.tournament.date >= todayStr)
    .sort((a, b) => a.tournament.date.localeCompare(b.tournament.date));
  const past = entries
    .filter(e => e.tournament.date < todayStr)
    .sort((a, b) => b.tournament.date.localeCompare(a.tournament.date));
  const nextEntry = upcoming[0] || null;

  const firstNameOrPseudo = user.firstName || user.pseudo?.split(' ')[0] || '';

  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <div className="header-row">
            <div>
              <div className="header-title">Bonjour, {firstNameOrPseudo} 👋</div>
              <div className="header-subtitle">
                {upcoming.length > 0
                  ? `${upcoming.length} tournoi${upcoming.length > 1 ? 's' : ''} à venir`
                  : 'Vos prochains tournois'}
              </div>
            </div>
            <AvatarMenu user={user} onLogout={onLogout} />
          </div>
        </div>
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

        {!loading && nextEntry && <HeroCard entry={nextEntry} />}

        {upcoming.slice(1).length > 0 && (
          <>
            {nextEntry && <div className="section-label">Autres tournois à venir</div>}
            {upcoming.slice(1).map((entry, i) => (
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

      {ddayTournament && (
        <DDayPopup
          tournament={ddayTournament}
          onClose={() => setDdayTournament(null)}
        />
      )}
    </>
  );
}

export default Dashboard;
