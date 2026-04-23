import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import TournamentCard from '../components/TournamentCard';
import { groupColor } from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DATE_GROUPS = [
  { key: 'weekend', label: 'Ce week-end' },
  { key: 'week',    label: 'Cette semaine' },
  { key: 'month',   label: 'Ce mois' },
  { key: 'later',   label: 'Plus tard' },
];

function getDateGroup(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return null;
  const daysToSat = (6 - today.getDay() + 7) % 7;
  if (diff === daysToSat || diff === daysToSat + 1) return 'weekend';
  if (diff < 7) return 'week';
  if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) return 'month';
  return 'later';
}

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

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Géolocalisation (persistée en session)
  const [userLat, setUserLat]   = useState(() => { const v = sessionStorage.getItem('geo_lat');    return v ? parseFloat(v) : null; });
  const [userLng, setUserLng]   = useState(() => { const v = sessionStorage.getItem('geo_lng');    return v ? parseFloat(v) : null; });
  const [radius, setRadius]     = useState(() => { const v = sessionStorage.getItem('geo_radius'); return v ? parseInt(v, 10) : 25; });
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Recherches récentes
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('recent_searches') || '[]'); } catch { return []; }
  });

  // Toast de confirmation
  const [toast, setToast] = useState(null);

  // Groupes de l'utilisateur (pour la modal "Ajouter à mon groupe")
  const [groups, setGroups]       = useState([]);
  const [addModal, setAddModal]   = useState(null);
  const [addGroupId, setAddGroupId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState('');
  const [addedMap, setAddedMap]   = useState({});

  const token = localStorage.getItem('token');

  const hasActiveFilter = query || formatFilter || genderFilter || dateFilter || surfaceFilter || userLat;

  useEffect(() => {
    axios.get(`${API_URL}/api/groups`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setGroups(res.data))
      .catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    if (userLat && userLng) {
      sessionStorage.setItem('geo_lat', userLat);
      sessionStorage.setItem('geo_lng', userLng);
      sessionStorage.setItem('geo_radius', radius);
    }
  }, [userLat, userLng, radius]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return; }
    setGeoLoading(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setGeoLoading(false); },
      () => { setGeoError('Localisation refusée ou indisponible'); setGeoLoading(false); }
    );
  };

  const clearGeo = () => {
    setUserLat(null); setUserLng(null); setGeoError('');
    sessionStorage.removeItem('geo_lat');
    sessionStorage.removeItem('geo_lng');
    sessionStorage.removeItem('geo_radius');
  };

  const saveRecentSearch = useCallback((q) => {
    if (!q || q.trim().length < 2) return;
    setRecentSearches(prev => {
      const updated = [q.trim(), ...prev.filter(s => s !== q.trim())].slice(0, 4);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const search = useCallback(async () => {
    setLoading(true); setError(''); setHasSearched(true);
    if (query.trim().length >= 2) saveRecentSearch(query.trim());
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
  }, [query, formatFilter, genderFilter, dateFilter, surfaceFilter, userLat, userLng, radius, token, saveRecentSearch]);

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

  const activeChips = [
    formatFilter  && { key: 'format',  label: formatFilter,                                                                                      clear: () => setFormatFilter('') },
    genderFilter  && { key: 'gender',  label: genderFilter === 'mix' ? 'Mixte' : genderFilter === 'masculin' ? 'Masculin' : 'Féminin',           clear: () => setGenderFilter('') },
    surfaceFilter && { key: 'surface', label: surfaceFilter === 'beach' ? '🏖️ Beach' : surfaceFilter === 'green' ? '🌿 Green' : '🏛️ Gymnase',  clear: () => setSurfaceFilter('') },
    dateFilter    && { key: 'date',    label: dateFilter === 'weekend' ? 'Ce week-end' : 'Ce mois',                                              clear: () => setDateFilter('') },
    userLat       && { key: 'geo',     label: `📍 ${radius} km`,                                                                                  clear: clearGeo },
  ].filter(Boolean);

  const openAddModal = (tournament) => {
    setAddModal(tournament);
    setAddGroupId(groups.length === 1 ? groups[0].id : '');
    setAddError('');
  };

  const handleAddToGroup = async () => {
    if (!addModal || !addGroupId) return;
    setAddLoading(true); setAddError('');
    try {
      await axios.post(
        `${API_URL}/api/tournaments/${addModal.id}/add-to-group`,
        { groupId: addGroupId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const groupName = groups.find(g => g.id === addGroupId)?.name || 'votre groupe';
      setAddedMap(prev => ({ ...prev, [addModal.id]: true }));
      setAddModal(null);
      setToast(`Tournoi ajouté à ${groupName}`);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setAddError(err.response?.data?.error || "Erreur lors de l'ajout");
    } finally {
      setAddLoading(false);
    }
  };

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

      {/* Barre compacte : recherche + bouton filtres */}
      <div className="filter-bar">
        <div className="filter-bar-row">
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <span style={{ fontSize: 16, color: 'var(--primary)', flexShrink: 0 }}>🔍</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, lieu, club…" />
            {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
          </div>
          <button
            className={`filter-pill${activeCount > 0 ? ' filter-pill-active' : ''}`}
            onClick={() => setFiltersOpen(v => !v)}
            aria-label="Ouvrir les filtres"
          >
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
              <path d="M1 1.5h13M3.5 5.5h8M6 9.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span>Filtres</span>
            {activeCount > 0 && <span className="filter-pill-badge">{activeCount}</span>}
          </button>
        </div>

        {/* Chips des filtres actifs */}
        {activeChips.length > 0 && (
          <div className="active-chips-row">
            {activeChips.map(chip => (
              <div key={chip.key} className="active-chip">
                <span>{chip.label}</span>
                <button onClick={chip.clear} aria-label={`Retirer ${chip.label}`}>✕</button>
              </div>
            ))}
            <button className="chips-clear-all" onClick={clearAll}>Tout effacer</button>
          </div>
        )}
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>
        {!hasSearched && !loading && recentSearches.length > 0 && (
          <div className="recent-searches">
            <div className="recent-searches-title">Recherches récentes</div>
            {recentSearches.map(s => (
              <div key={s} className="recent-search-item" onClick={() => setQuery(s)}>
                <span className="recent-search-icon">🕐</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}

        {!hasSearched && !loading && recentSearches.length === 0 && (
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

        {!loading && !error && hasSearched && (() => {
          // Exclure les tournois déjà dans un groupe de l'utilisateur
          const publicResults = results.filter(item => !item.groupName);

          // Grouper par période
          const grouped = DATE_GROUPS
            .map(g => ({ ...g, items: publicResults.filter(item => getDateGroup(item.tournament.date) === g.key) }))
            .filter(g => g.items.length > 0);

          return (
            <>
              <div style={{ padding: '4px 4px 8px', fontSize: 12, color: '#90A0B0', fontWeight: 600 }}>
                {publicResults.length} résultat{publicResults.length !== 1 ? 's' : ''}
                {userLat && ` · dans un rayon de ${radius} km`}
              </div>

              {publicResults.length === 0 && (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div className="empty-icon">🔍</div>
                  <p className="empty-text">Aucun tournoi trouvé</p>
                  <p style={{ fontSize: 12, color: '#B0C0D0', marginTop: 6 }}>Essayez d'autres critères ou un rayon plus grand.</p>
                </div>
              )}

              {grouped.map(group => (
                <div key={group.key}>
                  <div className="date-group-header">
                    <div className="date-group-line" />
                    <span className="date-group-label">{group.label}</span>
                    <span className="date-group-count">{group.items.length}</span>
                    <div className="date-group-line" />
                  </div>
                  {group.items.map(item => (
                    <TournamentCard key={item.tournament.id}
                      tournament={item.tournament}
                      teamCount={item.teamCount}
                      onAddToGroup={addedMap[item.tournament.id] ? null : openAddModal}
                    />
                  ))}
                </div>
              ))}
            </>
          );
        })()}
      </div>

      {/* Tiroir de filtres (bottom sheet) */}
      {filtersOpen && (
        <div className="filter-drawer-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="filter-drawer" onClick={e => e.stopPropagation()}>
            <div className="filter-drawer-title">Filtres</div>

            <div className="filter-drawer-section">
              <div className="filter-drawer-label">Format</div>
              <div className="filter-seg">
                {['2x2','3x3','4x4','6x6'].map(f => (
                  <button key={f} className={`seg-btn ${formatFilter === f ? 'seg-active' : ''}`}
                    onClick={() => toggleFormat(f)}>{f}</button>
                ))}
              </div>
            </div>

            <div className="filter-drawer-section">
              <div className="filter-drawer-label">Catégorie</div>
              <div className="filter-seg">
                <button className={`seg-btn ${genderFilter === 'mix'      ? 'seg-active' : ''}`} onClick={() => toggleGender('mix')}>Mixte</button>
                <button className={`seg-btn ${genderFilter === 'masculin' ? 'seg-active' : ''}`} onClick={() => toggleGender('masculin')}>Masculin</button>
                <button className={`seg-btn ${genderFilter === 'feminin'  ? 'seg-active' : ''}`} onClick={() => toggleGender('feminin')}>Féminin</button>
              </div>
            </div>

            <div className="filter-drawer-section">
              <div className="filter-drawer-label">Surface</div>
              <div className="filter-seg">
                <button className={`seg-btn ${surfaceFilter === 'beach'   ? 'seg-active' : ''}`} onClick={() => toggleSurface('beach')}>🏖️ Beach</button>
                <button className={`seg-btn ${surfaceFilter === 'green'   ? 'seg-active' : ''}`} onClick={() => toggleSurface('green')}>🌿 Green</button>
                <button className={`seg-btn ${surfaceFilter === 'gymnase' ? 'seg-active' : ''}`} onClick={() => toggleSurface('gymnase')}>🏛️ Gymnase</button>
              </div>
            </div>

            <div className="filter-drawer-section">
              <div className="filter-drawer-label">Date</div>
              <div className="filter-seg">
                <button className={`seg-btn ${dateFilter === 'weekend' ? 'seg-active' : ''}`} onClick={() => toggleDate('weekend')}>Ce week-end</button>
                <button className={`seg-btn ${dateFilter === 'month'   ? 'seg-active' : ''}`} onClick={() => toggleDate('month')}>Ce mois</button>
              </div>
            </div>

            <div className="filter-drawer-section">
              <div className="filter-drawer-label">Localisation</div>
              {!userLat ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="seg-btn" onClick={handleGeolocate} disabled={geoLoading}
                    style={{ flex: 'none', padding: '7px 14px' }}>
                    {geoLoading ? '⏳ Localisation…' : '📍 Ma position'}
                  </button>
                  {geoError && <span style={{ fontSize: 11, color: '#E53935' }}>{geoError}</span>}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>📍 Position activée</span>
                    <button className="search-clear" onClick={clearGeo} style={{ position: 'static', fontSize: 11 }}>✕</button>
                  </div>
                  <div className="filter-seg">
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

            {activeCount > 0 && (
              <button onClick={() => { clearAll(); setFiltersOpen(false); }} className="filter-clear-btn"
                style={{ marginTop: 8 }}>
                Effacer tout
              </button>
            )}
            <div className="filter-drawer-handle" />
          </div>
        </div>
      )}

      {/* Modal — Ajouter à un groupe */}
      {addModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setAddModal(null)}>
          <div
            style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxHeight: '70vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ width: 40, height: 4, background: '#D0D8E8', borderRadius: 4, margin: '0 auto 20px' }} />

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A2440', marginBottom: 4 }}>
                Ajouter à mon groupe
              </div>
              <div style={{ fontSize: 13, color: '#90A0B0' }}>{addModal.name}</div>
            </div>

            {addError && <div className="message error" style={{ marginBottom: 12 }}>{addError}</div>}

            {groups.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <p style={{ fontSize: 13, color: '#90A0B0' }}>
                  Vous n'avez pas encore de groupe.{' '}
                  <span style={{ color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => { setAddModal(null); }}>
                    Créez-en un
                  </span> depuis la page Groupes.
                </p>
              </div>
            ) : (
              <>
                <div className="group-selector-list" style={{ marginBottom: 16 }}>
                  {groups.map(g => (
                    <button key={g.id} type="button"
                      className={`group-selector-item ${addGroupId === g.id ? 'selected' : ''}`}
                      onClick={() => setAddGroupId(g.id)}>
                      <div className="group-selector-dot" style={{ background: groupColor(g.id) }} />
                      <div>
                        <div className="group-selector-name">{g.name}</div>
                        <div className="group-selector-sub">{g.members?.length || 0} membre{g.members?.length !== 1 ? 's' : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  style={{ width: '100%', padding: '13px' }}
                  disabled={!addGroupId || addLoading}
                  onClick={handleAddToGroup}>
                  {addLoading ? 'Ajout en cours…' : '➕ Ajouter au groupe'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast-snack">{toast}</div>}
    </>
  );
}

export default TournamentSearch;
