import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import WarnOnce from '../components/WarnOnce';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const WARN_MSG = "C'est une application communautaire donc les informations que vous allez ajouter dans ce tournoi seront accessibles par tout le monde. Nous vous invitons à prendre le temps de relire et vérifier vos informations. Ajouter le lien pour s'inscrire et les différents formats du tournoi facilitera le partage de ce tournoi à d'autres membres de la communauté.";

const FORMATS  = ['2x2', '3x3', '4x4', '6x6'];
const GENDERS  = [
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

function CreateTournament({ user }) {
  const { groupId } = useParams();
  const navigate    = useNavigate();
  const token       = localStorage.getItem('token');

  const [name, setName]         = useState('');
  const [date, setDate]         = useState('');
  const [time, setTime]         = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice]       = useState('');
  const [playerFormats, setPlayerFormats] = useState([]);
  const [genders, setGenders]   = useState([]);
  const [surface, setSurface]   = useState('');

  const [suggestions, setSuggestions]       = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingAddress, setLoadingAddress]   = useState(false);
  const searchTimeout  = useRef(null);
  const suggestionsRef = useRef(null);

  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const handleOut = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, []);

  const handleLocationInput = (e) => {
    const val = e.target.value;
    setLocation(val);
    setShowSuggestions(false);
    clearErr('location');
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

  const toggleFormat = (f) => {
    setPlayerFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
    clearErr('playerFormats');
  };

  const toggleGender = (g) => {
    setGenders(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
    clearErr('genders');
  };

  const fe = (key) => fieldErrors[key] ? 'form-group field-error' : 'form-group';
  const clearErr = (key) => fieldErrors[key] && setFieldErrors(p => { const n = {...p}; delete n[key]; return n; });

  const validate = () => {
    const errs = {};
    if (!name.trim())           errs.name         = true;
    if (!date)                  errs.date         = true;
    if (!time)                  errs.time         = true;
    if (!location.trim())       errs.location     = true;
    if (playerFormats.length === 0) errs.playerFormats = true;
    if (genders.length === 0)   errs.genders      = true;
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
        {
          groupId,
          name: name.trim(),
          date, time,
          location: location.trim(),
          price: parseFloat(price) || 0,
          playerFormats, playerFormat: playerFormats[0] || '',
          genders, gender: genders[0] || '',
          surface: surface || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du tournoi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <WarnOnce storageKey="warn_create_tournament" message={WARN_MSG} />

      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
          <div className="header-row">
            <div className="header-title">Créer un tournoi</div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="message error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>

          <div className={fe('name')}>
            <label>Nom du tournoi <span className="required-star">*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); clearErr('name'); }}
              placeholder="ex: Tournoi Open Nantes" />
          </div>

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

          <div className={fe('location')} ref={suggestionsRef} style={{ position: 'relative' }}>
            <label>
              Lieu / adresse <span className="required-star">*</span>
              {loadingAddress && <span className="address-searching"> Recherche…</span>}
            </label>
            <input value={location} onChange={handleLocationInput}
              placeholder="ex: Salle Beaulieu, Nantes" autoComplete="off" />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="address-suggestions">
                {suggestions.map(s => (
                  <li key={s.place_id} className="address-suggestion-item"
                    onMouseDown={() => { setLocation(s.display_name); setShowSuggestions(false); }}>
                    <span className="suggestion-icon">📍</span>{s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label>Prix d'inscription (€)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0 = gratuit" min="0" step="0.5" />
          </div>

          <div className={fe('playerFormats')}>
            <label>
              Format(s) <span className="required-star">*</span>
              <span style={{ fontSize: 11, color: '#90A0B0', fontWeight: 400, marginLeft: 6 }}>Plusieurs possibles</span>
            </label>
            <div className="format-picker">
              {FORMATS.map(f => (
                <button key={f} type="button"
                  className={`format-option ${playerFormats.includes(f) ? 'selected' : ''}`}
                  onClick={() => toggleFormat(f)}>
                  <span className="format-option-label">{f}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={fe('genders')}>
            <label>
              Catégorie(s) <span className="required-star">*</span>
              <span style={{ fontSize: 11, color: '#90A0B0', fontWeight: 400, marginLeft: 6 }}>Plusieurs possibles</span>
            </label>
            <div className="gender-picker">
              {GENDERS.map(g => (
                <button key={g.value} type="button"
                  className={`gender-option-pill ${genders.includes(g.value) ? 'selected' : ''}`}
                  onClick={() => toggleGender(g.value)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Surface</label>
            <select value={surface} onChange={e => setSurface(e.target.value)}>
              {SURFACES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <p style={{ fontSize: 12, color: '#B0C0D0', marginBottom: 16 }}>
            <span className="required-star">*</span> Champs obligatoires
          </p>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px' }}>
            {loading ? 'Création en cours…' : 'Créer le tournoi'}
          </button>
        </form>
      </div>
    </>
  );
}

export default CreateTournament;
