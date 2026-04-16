import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function resizeImage(file, size) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const s = Math.min(img.width, img.height);
      const ox = (img.width - s) / 2;
      const oy = (img.height - s) / 2;
      ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = url;
  });
}

function Register({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [level, setLevel] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await resizeImage(file, 120);
      setAvatarBase64(compressed);
    } catch {
      // ignore
    }
  };

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
        phone,
        avatarUrl: avatarBase64 || null
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

      {/* Avatar picker */}
      <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
        <label style={{ cursor:'pointer', display:'inline-block' }}>
          <div style={{
            width: 80, height: 80, borderRadius:'50%',
            background: avatarBase64 ? 'transparent' : '#E3F2FD',
            border: '2.5px solid #90CAF9',
            display:'flex', alignItems:'center', justifyContent:'center',
            overflow:'hidden', margin:'0 auto 6px'
          }}>
            {avatarBase64
              ? <img src={avatarBase64} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ fontSize:30 }}>📷</span>
            }
          </div>
          <div style={{ fontSize:12, color:'var(--primary)', fontWeight:600 }}>
            {avatarBase64 ? 'Changer la photo' : 'Ajouter une photo (optionnel)'}
          </div>
          <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
        </label>
      </div>

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
