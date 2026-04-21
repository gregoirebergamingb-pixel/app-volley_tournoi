import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import TournamentCard from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const REGIONS = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  'Provence-Alpes-Côte d\'Azur',
  'Corse',
];

function TournamentSearch({ user, onLogout }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [formatFilter, setFormatFilter]   = useState('');
  const [genderFilter, setGenderFilter]   = useState('');
  const [dateFilter, setDateFilter]       = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState('');
  const [regionFilter, setRegionFilter]   = useState('');

  const token = localStorage.getItem('token');

  const hasActiveFilter = query || formatFilter || genderFilter || dateFilter || surfaceFilter || regionFilter;

  const search = useCallback(async () => {
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (query)         params.set('q', query);
      if (formatFilter)  params.set('format', formatFilter);
      if (genderFilter)  params.set('gender', genderFilter);
      if (dateFilter)    params.set('date', dateFilter);
      if (surfaceFilter) params.set('surface', surfaceFilter);
      if (regionFilter)  params.set('region', regionFilter);

      const res = await axios.get(`${API_URL}/api/tournaments/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(res.data);
    } catch (err) {
      setError('Erreur lors de la recherche.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, formatFilter, genderFilter, dateFilter, surfaceFilter, regionFilter, token]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (hasActiveFilter) {
        search();
      } else {
        setResults([]); setHasSearched(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, formatFilter, genderFilter, dateFilter, surfaceFilter, regionFilter]); // eslint-disable-line

  const clearQuery = () => { setQuery(''); };
  const toggle = (setter) => (val) => setter(v => v === val ? '' : val);

  const toggleFormat  = toggle(setFormatFilter);
  const toggleGender  = toggle(setGenderFilter);
  const toggleDate    = toggle(setDateFilter);
  const toggleSurface = toggle(setSurfaceFilter);

  const clearAll = () => {
    setQuery(''); setFormatFilter(''); setGenderFilter('');
    setDateFilter(''); setSurfaceFilter(''); setRegionFilter('');
  };

  const activeCount = [formatFilter, genderFilter, dateFilter, surfaceFilter, regionFilter]
    .filter(Boolean).length;

  return (
    <>
      {/* Blue header with embedded search */}
      <div className="app-header">
        <div className="header-inner">
          <div className="header-row">
            <div className="header-title">Explorer</div>
            <AvatarMenu user={user} onLogout={onLogout} />
          </div>
          <div className="search-input-wrapper" style={{ marginTop: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, color: 'var(--primary)' }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nom, lieu, club…"
            />
            {query && <button className="search-clear" onClick={clearQuery}>✕</button>}
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="filter-panel">

        <div className="filter-row">
          <span className="filter-label">Format</span>
          <div className="filter-seg">
            {['2x2','3x3','4x4','6x6'].map(f => (
              <button key={f}
                className={`seg-btn ${formatFilter === f ? 'seg-active' : ''}`}
                onClick={() => toggleFormat(f)}>{f}</button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Catégorie</span>
          <div className="filter-seg">
            <button className={`seg-btn ${genderFilter === 'mix'      ? 'seg-active' : ''}`} onClick={() => toggleGender('mix')}>Mixte</button>
            <button className={`seg-btn ${genderFilter === 'masculin' ? 'seg-active' : ''}`} onClick={() => toggleGender('masculin')}>Masculin</button>
            <button className={`seg-btn ${genderFilter === 'feminin'  ? 'seg-active' : ''}`} onClick={() => toggleGender('feminin')}>Féminin</button>
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Surface</span>
          <div className="filter-seg">
            <button className={`seg-btn ${surfaceFilter === 'beach'   ? 'seg-active' : ''}`} onClick={() => toggleSurface('beach')}>🏖️ Beach</button>
            <button className={`seg-btn ${surfaceFilter === 'green'   ? 'seg-active' : ''}`} onClick={() => toggleSurface('green')}>🌿 Green</button>
            <button className={`seg-btn ${surfaceFilter === 'gymnase' ? 'seg-active' : ''}`} onClick={() => toggleSurface('gymnase')}>🏛️ Gymnase</button>
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Date</span>
          <div className="filter-seg">
            <button className={`seg-btn ${dateFilter === 'weekend' ? 'seg-active' : ''}`} onClick={() => toggleDate('weekend')}>Ce week-end</button>
            <button className={`seg-btn ${dateFilter === 'month'   ? 'seg-active' : ''}`} onClick={() => toggleDate('month')}>Ce mois</button>
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Région</span>
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className={`filter-select ${regionFilter ? 'filter-select-active' : ''}`}
          >
            <option value="">Toutes</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {activeCount > 0 && (
          <button onClick={clearAll} className="filter-clear-btn">
            Effacer les filtres ({activeCount})
          </button>
        )}
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>
        {!hasSearched && !loading && (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏐</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#445', marginBottom: 6 }}>
              Trouvez un tournoi
            </p>
            <p style={{ fontSize: 13, color: '#B0C0D0' }}>
              Recherchez par nom, lieu ou utilisez les filtres ci-dessus.
            </p>
          </div>
        )}

        {loading && (
          <p style={{ textAlign: 'center', color: '#90A0B0', padding: '2rem' }}>Recherche…</p>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
            <p style={{ color: '#90A0B0', fontSize: 14 }}>{error}</p>
          </div>
        )}

        {!loading && !error && hasSearched && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 8px', fontSize: 12, color: '#90A0B0', fontWeight: 600 }}>
              <span>{results.length} résultat{results.length !== 1 ? 's' : ''}</span>
            </div>

            {results.length === 0 && (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">🔍</div>
                <p className="empty-text">Aucun tournoi trouvé</p>
                <p style={{ fontSize: 12, color: '#B0C0D0', marginTop: 6 }}>Essayez d'autres termes ou filtres.</p>
              </div>
            )}

            {results.map(item => (
              <TournamentCard key={item.tournament.id}
                tournament={item.tournament}
                group={item.groupName ? { id: item.groupName, name: item.groupName } : null}
                teamCount={item.teamCount}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

export default TournamentSearch;
