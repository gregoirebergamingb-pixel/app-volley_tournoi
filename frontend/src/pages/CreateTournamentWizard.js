import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AV_COLORS = ['#1565C0','#AD1457','#2E7D32','#E65100','#6A1B9A','#00695C','#C62828','#283593'];
function groupColor(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

const FORMATS = ['2x2', '3x3', '4x4', '6x6'];
const GENDERS = [
  { value: 'mix',      label: 'Mixte'    },
  { value: 'masculin', label: 'Masculin' },
  { value: 'feminin',  label: 'Féminin'  },
];
const SURFACES = [
  { value: '',        label: 'Non précisé' },
  { value: 'beach',   label: '🏖️ Beach'   },
  { value: 'green',   label: '🌿 Green'   },
  { value: 'gymnase', label: '🏛️ Gymnase' },
];

function CreateTournamentWizard({ user }) {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [groups, setGroups]         = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupId, setGroupId]       = useState('');
  const [name, setName]             = useState('');
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [location, setLocation]     = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [playerFormat, setPlayerFormat] = useState('');
  const [gender, setGender]         = useState('');
  const [surface, setSurface]       = useState('');
  const [price, setPrice]           = useState('');

  const [suggestions, setSuggestions]       = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingAddress, setLoadingAddress]   = useState(false);
  const searchTimeout  = useRef(null);
  const suggestionsRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    axios.get(`${API_URL}/api/groups`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setGroups(res.data);
        if (res.data.length === 1) setGroupId(res.data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingGroups(false));
  }, []); // eslint-disable-line

  useEffect(() => {
    const handleOut = e => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, []);

  const handleLocationInput = (e) => {
    const val = e.target.value;
    setLocation(val);
    setLocationLat(null); setLocationLng(null);
    setShowSuggestions(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.length < 3) { setSuggestions([]); setLoadingAddress(false); return; }
    setLoadingAddress(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'fr' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch { setSuggestions([]); } finally { setLoadingAddress(false); }
    }, 500);
  };

  const validate = () => {
    const errs = {};
    if (!groupId)           errs.groupId = true;
    if (!name.trim())       errs.name    = true;
    if (!date)              errs.date    = true;
    if (!time)              errs.time    = true;
    if (!location.trim())   errs.location = true;
    if (!playerFormat)      errs.playerFormat = true;
    if (!gender)            errs.gender  = true;
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/tournaments`,
        { groupId, name: name.trim(), date, time, location: location.trim(),
          lat: locationLat, lng: locationLng,
          price: parseFloat(price) || 0, playerFormat, gender, surface: surface || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du tournoi');
    } finally {
      setLoading(false);
    }
  };

  const fe = (key) => fieldErrors[key] ? 'form-group field-error' : 'form-group';
  const clearErr = (key) => fieldErrors[key] && setFieldErrors(p => { const n = {...p}; delete n[key]; return n; });


  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <div className="header-row">
            <div className="header-title">Créer un tournoi</div>
            <button
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}
              onClick={() => navigate(-1)}>
              Annuler
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="message error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>

          {/* Groupe */}
          {!loadingGroups && groups.length === 0 ? (
            <div className="message info">
              Vous n'avez pas encore de groupe. Créez-en un depuis votre profil.
            </div>
          ) : (
            <div className={fe('groupId')} onClick={() => clearErr('groupId')}>
              <label>Groupe organisateur <span className="required-star">*</span></label>
              <div className="group-selector-list">
                {groups.map(g => (
                  <button key={g.id} type="button"
                    className={`group-selector-item ${groupId === g.id ? 'selected' : ''}`}
                    onClick={() => { setGroupId(g.id); clearErr('groupId'); }}>
                    <div className="group-selector-dot" style={{ background: groupColor(g.id) }} />
                    <div>
                      <div className="group-selector-name">{g.name}</div>
                      <div className="group-selector-sub">{g.members?.length || 0} membre{g.members?.length !== 1 ? 's' : ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nom */}
          <div className={fe('name')}>
            <label>Nom du tournoi <span className="required-star">*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); clearErr('name'); }}
              placeholder="ex: Open Beach Nantes" />
          </div>

          {/* Date + Horaire */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className={fe('date')}>
              <label>Date <span className="required-star">*</span></label>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); clearErr('date'); }} />
            </div>
            <div className={fe('time')}>
              <label>Horaire <span className="required-star">*</span></label>
              <input type="time" value={time} onChange={e => { setTime(e.target.value); clearErr('time'); }} />
            </div>
          </div>

          {/* Lieu */}
          <div className={fe('location')} ref={suggestionsRef} style={{ position: 'relative' }}>
            <label>
              Lieu / adresse <span className="required-star">*</span>
              {loadingAddress && <span className="address-searching"> Recherche…</span>}
            </label>
            <input value={location} onChange={e => { handleLocationInput(e); clearErr('location'); }}
              placeholder="ex: Salle Beaulieu, Nantes" autoComplete="off" />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="address-suggestions">
                {suggestions.map(s => (
                  <li key={s.place_id} className="address-suggestion-item"
                    onMouseDown={() => { setLocation(s.display_name); setLocationLat(parseFloat(s.lat)); setLocationLng(parseFloat(s.lon)); setShowSuggestions(false); }}>
                    <span className="suggestion-icon">📍</span>{s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Format */}
          <div className={fe('playerFormat')}>
            <label>Format <span className="required-star">*</span></label>
            <div className="format-picker">
              {FORMATS.map(f => (
                <button key={f} type="button"
                  className={`format-option ${playerFormat === f ? 'selected' : ''}`}
                  onClick={() => { setPlayerFormat(f); clearErr('playerFormat'); }}>
                  <span className="format-option-label">{f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Catégorie */}
          <div className={fe('gender')}>
            <label>Catégorie <span className="required-star">*</span></label>
            <div className="gender-picker">
              {GENDERS.map(g => (
                <button key={g.value} type="button"
                  className={`gender-option-pill ${gender === g.value ? 'selected' : ''}`}
                  onClick={() => { setGender(g.value); clearErr('gender'); }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Surface + Prix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Surface</label>
              <select value={surface} onChange={e => setSurface(e.target.value)}>
                {SURFACES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Prix (€)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="0 = gratuit" min="0" step="0.5" />
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#B0C0D0', marginBottom: 16 }}>
            <span className="required-star">*</span> Champs obligatoires
          </p>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px' }}>
            {loading ? 'Création en cours…' : '🎉 Créer le tournoi'}
          </button>
        </form>
      </div>
    </>
  );
}

export default CreateTournamentWizard;
