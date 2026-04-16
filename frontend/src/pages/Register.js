import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Register({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [level, setLevel] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      if (!gender) {
        setError('Veuillez sélectionner votre genre');
        setLoading(false);
        return;
      }

      if (!level) {
        setError('Veuillez sélectionner votre niveau de jeu');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/api/auth/register`, {
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        level,
        phone
      });

      onLogin(response.data.token, response.data.user);
      navigate(inviteCode ? `/rejoindre/${inviteCode}` : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Inscription</h2>

      {error && <div className="message error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="firstName">Prénom</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Nom</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="phone">Téléphone</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="ex: 06 12 34 56 78"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label>Genre</label>
          <div className="gender-selector">
            <label className={`gender-option ${gender === 'masculin' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="masculin"
                checked={gender === 'masculin'}
                onChange={(e) => setGender(e.target.value)}
              />
              Homme
            </label>
            <label className={`gender-option ${gender === 'feminin' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="feminin"
                checked={gender === 'feminin'}
                onChange={(e) => setGender(e.target.value)}
              />
              Femme
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="level">Niveau de jeu <span className="required-star">*</span></label>
          <select id="level" value={level} onChange={e => setLevel(e.target.value)} required>
            <option value="">-- Choisir --</option>
            <option value="loisir">Loisir</option>
            <option value="departemental">Départemental</option>
            <option value="regional">Régional</option>
            <option value="national">National</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Inscription en cours...' : 'S\'inscrire'}
        </button>
      </form>

      <div className="form-link">
        <p>Déjà inscrit? <Link to="/login">Connexion</Link></p>
      </div>
    </div>
  );
}

export default Register;
