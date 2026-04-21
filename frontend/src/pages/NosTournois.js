import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import TournamentCard from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function NosTournois({ user, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const today = new Date(); today.setHours(0, 0, 0, 0);
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
      <div className="app-header">
        <div className="header-inner">
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
      </div>

      <div className="chips-row">
        <div className={`chip ${filter === 'all'      ? 'active' : ''}`} onClick={() => setFilter('all')}>Tous</div>
        <div className={`chip ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>À venir</div>
        <div className={`chip ${filter === 'weekend'  ? 'active' : ''}`} onClick={() => setFilter('weekend')}>Ce week-end</div>
        <div className={`chip ${filter === 'past'     ? 'active' : ''}`} onClick={() => setFilter('past')}>Passés</div>
      </div>

      <div className="page-content">
        {loading && <p style={{ textAlign: 'center', color: '#90A0B0', padding: '2rem' }}>Chargement…</p>}

        {error && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
            <p style={{ color: '#90A0B0', fontSize: 14 }}>{error}</p>
            <p style={{ color: '#B0C0D0', fontSize: 12, marginTop: 8 }}>
              En attendant, retrouvez vos tournois depuis la page Groupes.
            </p>
            <Link to="/groups" style={{ marginTop: 16, display: 'inline-block' }}>
              <button>Voir mes groupes</button>
            </Link>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏆</div>
            <p className="empty-text">Aucun tournoi dans vos groupes</p>
            <p style={{ fontSize: 13, color: '#B0C0D0', marginTop: 8 }}>
              Créez ou rejoignez un groupe pour voir les tournois ici.
            </p>
            <Link to="/groups" style={{ marginTop: 16, display: 'inline-block' }}>
              <button>Mes groupes</button>
            </Link>
          </div>
        )}

        {!loading && !error && entries.length > 0 && filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <div className="empty-icon">🔍</div>
            <p className="empty-text">Aucun tournoi dans ce filtre</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="section-label">À venir</div>
            {upcoming.map((e, i) => (
              <TournamentCard key={i}
                tournament={e.tournament}
                group={e.group}
                myTeam={e.myTeam}
                showTeamStatus
                teamCount={e.tournament.teamCount}
              />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-label">Passés</div>
            {past.map((e, i) => (
              <TournamentCard key={i}
                tournament={e.tournament}
                group={e.group}
                myTeam={e.myTeam}
                showTeamStatus
                teamCount={e.tournament.teamCount}
                past
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

export default NosTournois;
