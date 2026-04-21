import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import TournamentCard from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

  // Géolocalisation
  const [userLat, setUserLat]   = useState(null);
  const [userLng, setUserLng]   = useState(null);
  const [radius, setRadius]     = useState(25);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const token = localStorage.getItem('token');

  const hasActiveFilter = query || formatFilter || genderFilter || dateFilter || surfaceFilter || userLat;

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return; }
    setGeoLoading(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setGeoLoading(false); },
      () => { setGeoError('Localisation refusée ou indisponible'); setGeoLoading(false); }
    );
  };

  const clearGeo = () => { setUserLat(null); setUserLng(null); setGeoError(''); };

  const search = useCallback(async () => {
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (query)         params.set('q', query);
      if (formatFilter)  params.set('format', formatFilter);
      if (genderFilter)  params.set('gender', genderFilter);
      if (dateFilter)    params.set('date', dateFilter);
      if (surfaceFilter) params.set('surface', surfaceFilter);
      if (userLat && userLng) {
        params.set('lat', userLat);
        params.set('lng', userLng);
        params.set('radius', radius);
      }

      const res = await axios.get(`${API_URL}/api/tournaments/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(res.data);
    } catch {
      setError('Erreur lors de la recherche.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, formatFilter, genderFilter, dateFilter, surfaceFilter, userLat, userLng, radius, token]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (hasActiveFilter) search();
      else { setResults([]); setHasSearched(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query, formatFilter, genderFilter, dateFilter, surfaceFilter, userLat, userLng, radius]); // eslint-disable-line

  const toggle = (setter) => (val) => setter(v => v === val ? '' : val);
  const toggleFormat  = toggle(setFormatFilter);
  const toggleGender  = toggle(setGenderFilter);
  const toggleDate    = toggle(setDateFilter);
  const toggleSurface = toggle(setSurfaceFilter);

  const clearAll = () => {
    setQuery(''); setFormatFilter(''); setGenderFilter('');
    setDateFilter(''); setSurfaceFilter(''); clearGeo();
  };

  const activeCount = [formatFilter, genderFilter, dateFilter, surfaceFilter, userLat ? 'geo' : '']
    .filter(Boolean).length;

  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <div className="header-row">
            <div className="header-title">Explorer</div>
            <AvatarMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </div>

      <div className="filter-panel">

        {/* Search bar */}
        <div className="search-input-wrapper" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 18, color: 'var(--primary)' }}>🔍</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, lieu, club…" />
          {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>

        <div className="filter-row">
          <span className="filter-label">Format</span>
          <div className="filter-seg">
            {['2x2','3x3','4x4','6x6'].map(f => (
              <button key={f} className={`seg-btn ${formatFilter === f ? 'seg-active' : ''}`}
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

        {/* Géolocalisation */}
        <div className="filter-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <span className="filter-label">Localisation</span>
          {!userLat ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className={`seg-btn ${geoLoading ? '' : ''}`}
                onClick={handleGeolocate} disabled={geoLoading}
                style={{ fontSize: 12 }}>
                {geoLoading ? '⏳ Localisation…' : '📍 Ma position'}
              </button>
              {geoError && <span style={{ fontSize: 11, color: '#E53935' }}>{geoError}</span>}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#1565C0', fontWeight: 600 }}>📍 Position activée</span>
              <button className="search-clear" onClick={clearGeo} style={{ position:'static', fontSize:11 }}>✕</button>
              <div className="filter-seg" style={{ marginTop: 0 }}>
                {[10, 25, 50, 100].map(r => (
                  <button key={r} className={`seg-btn ${radius === r ? 'seg-active' : ''}`}
                    onClick={() => setRadius(r)} style={{ fontSize: 12 }}>
                    {r} km
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {(activeCount > 0 || query) && (
          <button onClick={clearAll} className="filter-clear-btn">
            Effacer tout
          </button>
        )}
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>
        {!hasSearched && !loading && (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏐</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#445', marginBottom: 6 }}>Trouvez un tournoi</p>
            <p style={{ fontSize: 13, color: '#B0C0D0' }}>Recherchez par nom, lieu ou activez votre position.</p>
          </div>
        )}

        {loading && <p style={{ textAlign: 'center', color: '#90A0B0', padding: '2rem' }}>Recherche…</p>}

        {error && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
            <p style={{ color: '#90A0B0', fontSize: 14 }}>{error}</p>
          </div>
        )}

        {!loading && !error && hasSearched && (
          <>
            <div style={{ padding: '4px 4px 8px', fontSize: 12, color: '#90A0B0', fontWeight: 600 }}>
              {results.length} résultat{results.length !== 1 ? 's' : ''}
              {userLat && ` · dans un rayon de ${radius} km`}
            </div>

            {results.length === 0 && (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">🔍</div>
                <p className="empty-text">Aucun tournoi trouvé</p>
                <p style={{ fontSize: 12, color: '#B0C0D0', marginTop: 6 }}>Essayez d'autres critères ou un rayon plus grand.</p>
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
