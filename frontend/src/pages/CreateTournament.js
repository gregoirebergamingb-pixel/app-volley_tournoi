import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const REQUIRED_FIELDS = [
  { key: 'name',         label: 'Nom du tournoi' },
  { key: 'date',         label: 'Date' },
  { key: 'time',         label: 'Horaire' },
  { key: 'location',     label: 'Lieu / adresse' },
  { key: 'price',        label: "Prix d'inscription" },
  { key: 'playerFormat', label: 'Format' },
  { key: 'gender',       label: 'Catégorie' },
];

function CreateTournament({ user }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    price: '',
    playerFormat: '',
    gender: ''
  });

  // Autocomplete adresse (OpenStreetMap Nominatim — gratuit, sans clé API)
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const searchTimeout = useRef(null);
  const suggestionsRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState([]);

  // Fermer les suggestions si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Retirer le champ de la liste d'erreurs quand l'utilisateur le remplit
    if (missingFields.includes(name)) {
      setMissingFields(prev => prev.filter(f => f !== name));
    }
  };

  const handleLocationInput = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, location: value }));
    setShowSuggestions(false);

    if (missingFields.includes('location')) {
      setMissingFields(prev => prev.filter(f => f !== 'location'));
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 3) {
      setSuggestions([]);
      setLoadingAddress(false);
      return;
    }

    setLoadingAddress(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'fr' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingAddress(false);
      }
    }, 500);
  };

  const handleSelectSuggestion = (suggestion) => {
    setFormData(prev => ({ ...prev, location: suggestion.display_name }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const validate = () => {
    const missing = REQUIRED_FIELDS
      .filter(({ key }) => !formData[key] || formData[key].toString().trim() === '')
      .map(({ key }) => key);
    return missing;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const missing = validate();
    if (missing.length > 0) {
      setMissingFields(missing);
      const labels = REQUIRED_FIELDS
        .filter(({ key }) => missing.includes(key))
        .map(({ label }) => label);
      setError(`Veuillez remplir les champs obligatoires : ${labels.join(', ')}.`);
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/tournaments`,
        {
          groupId,
          name: formData.name.trim(),
          date: formData.date,
          time: formData.time,
          location: formData.location.trim(),
          price: parseFloat(formData.price) || 0,
          playerFormat: formData.playerFormat,
          gender: formData.gender
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

  const fieldClass = (key) =>
    missingFields.includes(key) ? 'form-group field-error' : 'form-group';

  return (
    <>
      <div className="app-header">
        <Link to={`/groups/${groupId}`} className="back-btn">← Retour au groupe</Link>
        <div className="header-row">
          <div className="header-title">Créer un tournoi</div>
        </div>
      </div>
    <div className="container">
      <div className="card" style={{ marginTop:8 }}>
        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <div className={fieldClass('name')}>
            <label htmlFor="name">Nom du tournoi <span className="required-star">*</span></label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="ex: Tournoi Open Nantes"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={fieldClass('date')}>
              <label htmlFor="date">Date <span className="required-star">*</span></label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
              />
            </div>
            <div className={fieldClass('time')}>
              <label htmlFor="time">Horaire <span className="required-star">*</span></label>
              <input
                id="time"
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={fieldClass('location')} ref={suggestionsRef} style={{ position: 'relative' }}>
            <label htmlFor="location">
              Lieu / adresse <span className="required-star">*</span>
              {loadingAddress && <span className="address-searching"> Recherche...</span>}
            </label>
            <input
              id="location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleLocationInput}
              placeholder="ex: Salle Beaulieu, 14 Rue Beaulieu, Nantes"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="address-suggestions">
                {suggestions.map((s) => (
                  <li
                    key={s.place_id}
                    className="address-suggestion-item"
                    onMouseDown={() => handleSelectSuggestion(s)}
                  >
                    <span className="suggestion-icon">📍</span>
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={fieldClass('price')}>
            <label htmlFor="price">Prix d'inscription (€) <span className="required-star">*</span></label>
            <input
              id="price"
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="ex: 15 (entrez 0 si gratuit)"
              min="0"
              step="0.5"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={fieldClass('playerFormat')}>
              <label htmlFor="playerFormat">Format <span className="required-star">*</span></label>
              <select
                id="playerFormat"
                name="playerFormat"
                value={formData.playerFormat}
                onChange={handleChange}
              >
                <option value="">-- Choisir --</option>
                <option value="2x2">2x2</option>
                <option value="3x3">3x3</option>
                <option value="4x4">4x4</option>
              </select>
            </div>

            <div className={fieldClass('gender')}>
              <label htmlFor="gender">Catégorie <span className="required-star">*</span></label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">-- Choisir --</option>
                <option value="mix">Mixte</option>
                <option value="masculin">Masculin</option>
                <option value="feminin">Féminin</option>
              </select>
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#999', marginBottom: '1rem' }}>
            <span className="required-star">*</span> Champs obligatoires
          </p>

          <button type="submit" disabled={loading}>
            {loading ? 'Création en cours...' : 'Créer le tournoi'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}

export default CreateTournament;
