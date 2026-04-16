import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((new Date(dateStr) - today) / 86400000);
  if (diff < 0)   return null;
  if (diff === 0)  return "Aujourd'hui";
  if (diff === 1)  return 'Demain';
  if (diff <= 7)   return `${diff}j`;
  return null;
}

function TournamentSearch({ user, onLogout }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [formatFilter, setFormatFilter] = useState('');  // '' | '2x2' | '3x3' | '4x4'
  const [genderFilter, setGenderFilter] = useState('');  // '' | 'mix' | 'masculin' | 'feminin'
  const [dateFilter, setDateFilter]     = useState('');  // '' | 'weekend' | 'month'

  const token = localStorage.getItem('token');

  const search = useCallback(async () => {
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (query)        params.set('q', query);
      if (formatFilter) params.set('format', formatFilter);
      if (genderFilter) params.set('gender', genderFilter);
      if (dateFilter)   params.set('date', dateFilter);

      const res = await axios.get(`${API_URL}/api/tournaments/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('La recherche publique sera disponible prochainement.');
        setResults([]);
      } else {
        setError('Erreur lors de la recherche.');
      }
    } finally {
      setLoading(false); }
  }, [query, formatFilter, genderFilter, dateFilter, token]);

  // Debounce search on filter/query change
  useEffect(() => {
    const t = setTimeout(() => {
      if (query || formatFilter || genderFilter || dateFilter) {
        search();
      } else {
        setResults([]); setHasSearched(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, formatFilter, genderFilter, dateFilter]); // eslint-disable-line

  const clearQuery = () => { setQuery(''); setResults([]); setHasSearched(false); };

  const toggleFormat = (f) => setFormatFilter(v => v === f ? '' : f);
  const toggleGender = (g) => setGenderFilter(v => v === g ? '' : g);
  const toggleDate   = (d) => setDateFilter  (v => v === d ? '' : d);

  return (
    <>
      {/* Search header */}
      <div className="search-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div className="header-title">Rechercher</div>
          <AvatarMenu user={user} onLogout={onLogout} />
        </div>
        <div className="search-input-wrapper">
          <span style={{ fontSize:18, color:'var(--primary)' }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nom, lieu, club…"
            autoFocus
          />
          {query && <button className="search-clear" onClick={clearQuery}>✕</button>}
        </div>
      </div>

      {/* Format chips */}
      <div className="chips-row">
        {['2x2','3x3','4x4'].map(f => (
          <div key={f} className={`chip ${formatFilter === f ? 'active' : ''}`}
            onClick={() => toggleFormat(f)}>{f}</div>
        ))}
        <div className={`chip ${genderFilter === 'mix'      ? 'active-light' : ''}`} onClick={() => toggleGender('mix')}>Mixte</div>
        <div className={`chip ${genderFilter === 'masculin' ? 'active-light' : ''}`} onClick={() => toggleGender('masculin')}>Masculin</div>
        <div className={`chip ${genderFilter === 'feminin'  ? 'active-light' : ''}`} onClick={() => toggleGender('feminin')}>Féminin</div>
      </div>

      {/* Date chips */}
      <div className="chips-row" style={{ borderBottom:'none', paddingTop:4 }}>
        <div className={`chip ${dateFilter === 'weekend' ? 'active-light' : ''}`}
          onClick={() => toggleDate('weekend')}>📅 Ce week-end</div>
        <div className={`chip ${dateFilter === 'month' ? 'active-light' : ''}`}
          onClick={() => toggleDate('month')}>📅 Ce mois</div>
      </div>

      <div className="page-content" style={{ paddingTop:8 }}>
        {/* Initial state */}
        {!hasSearched && !loading && (
          <div className="empty-state" style={{ padding:'40px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏐</div>
            <p style={{ fontSize:15, fontWeight:600, color:'#445', marginBottom:6 }}>
              Trouvez un tournoi
            </p>
            <p style={{ fontSize:13, color:'#B0C0D0' }}>
              Recherchez par nom, lieu ou utilisez les filtres ci-dessus.
            </p>
          </div>
        )}

        {loading && (
          <p style={{ textAlign:'center', color:'#90A0B0', padding:'2rem' }}>Recherche…</p>
        )}

        {error && (
          <div style={{ textAlign:'center', padding:'2rem 1rem' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🚧</div>
            <p style={{ color:'#90A0B0', fontSize:14 }}>{error}</p>
          </div>
        )}

        {!loading && !error && hasSearched && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 4px 8px', fontSize:12, color:'#90A0B0', fontWeight:600 }}>
              <span>{results.length} résultat{results.length !== 1 ? 's' : ''}</span>
            </div>

            {results.length === 0 && (
              <div className="empty-state" style={{ padding:'30px 0' }}>
                <div className="empty-icon">🔍</div>
                <p className="empty-text">Aucun tournoi trouvé</p>
                <p style={{ fontSize:12, color:'#B0C0D0', marginTop:6 }}>Essayez d'autres termes ou filtres.</p>
              </div>
            )}

            {results.map(item => (
              <SearchResultCard key={item.tournament.id} item={item} />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function SearchResultCard({ item }) {
  const { tournament, groupName, teamCount } = item;
  const countdown    = daysUntil(tournament.date);
  const genderBadge  = GENDER_BADGE[tournament.gender]   || 'badge-grey';
  const surfaceLabel = SURFACE_LABELS[tournament.surface] || '';
  const surfaceBadge = SURFACE_BADGE[tournament.surface]  || '';
  const dateStr = tournament.date
    ? new Date(tournament.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  return (
    <Link to={`/tournaments/${tournament.id}`} className="team-entry-link">
      <div className="t-card">
        {groupName && (
          <div style={{ fontSize:11, color:'#90A0B0', fontWeight:600, marginBottom:4 }}>
            🏐 {groupName}
          </div>
        )}
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
          {countdown && (
            <span className="countdown" style={{ flexShrink:0 }}>{countdown}</span>
          )}
        </div>

        <div className="t-card-footer">
          <span style={{ fontSize:11, color:'#90A0B0' }}>
            🏐 {teamCount ?? '?'} équipe{(teamCount ?? 0) !== 1 ? 's' : ''}
          </span>
          <button style={{ padding:'5px 12px', fontSize:12 }}>Voir →</button>
        </div>
      </div>
    </Link>
  );
}

export default TournamentSearch;
