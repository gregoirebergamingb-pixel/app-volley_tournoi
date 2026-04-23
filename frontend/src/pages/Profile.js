import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import CropModal from '../components/CropModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const LEVEL_LABELS = {
  loisir:        { label: 'Loisir',        color: '#2E7D32', bg: '#E8F5E9' },
  departemental: { label: 'Départemental', color: '#1565C0', bg: '#E3F2FD' },
  regional:      { label: 'Régional',      color: '#7B1FA2', bg: '#F3E5F5' },
  national:      { label: 'National',      color: '#E65100', bg: '#FFF3E0' },
  pro:           { label: 'Pro',           color: '#C62828', bg: '#FFEBEE' },
};

function Profile({ user, onLogout, onUserUpdate }) {
  const token = localStorage.getItem('token');

  const [firstName, setFirstName]   = useState(user?.firstName || '');
  const [lastName, setLastName]     = useState(user?.lastName  || '');
  const [phone, setPhone]           = useState(user?.phone     || '');
  const [email, setEmail]           = useState(user?.email     || '');
  const [gender, setGender]         = useState(user?.gender    || '');
  const [level, setLevel]           = useState(user?.level     || '');
  const [avatar, setAvatar]         = useState(user?.avatarUrl || null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [cropSrc, setCropSrc]       = useState(null);

  const [showPassword, setShowPassword]   = useState(false);
  const [currentPwd, setCurrentPwd]       = useState('');
  const [newPwd, setNewPwd]               = useState('');
  const [confirmPwd, setConfirmPwd]       = useState('');

  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!gender) { setError('Veuillez sélectionner votre genre'); return; }
    if (!level)  { setError('Veuillez sélectionner votre niveau'); return; }

    if (showPassword && newPwd) {
      if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas'); return; }
      if (newPwd.length < 6)    { setError('Le nouveau mot de passe doit contenir au moins 6 caractères'); return; }
      if (!currentPwd)          { setError('Veuillez entrer votre mot de passe actuel'); return; }
    }

    setSaving(true);
    try {
      const fn = firstName.trim();
      const ln = lastName.trim();
      const body = {
        firstName: fn.charAt(0).toUpperCase() + fn.slice(1).toLowerCase(),
        lastName: ln.toUpperCase(),
        phone, email, gender, level
      };
      if (avatarChanged)        body.avatarUrl = avatar;
      if (showPassword && newPwd) { body.currentPassword = currentPwd; body.newPassword = newPwd; }

      const res = await axios.put(`${API_URL}/api/auth/profile`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Profil mis à jour avec succès !');
      onUserUpdate?.(res.data.user);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setShowPassword(false);
      setAvatarChanged(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const initials = (() => {
    const f = firstName.trim(); const l = lastName.trim();
    if (f && l) return (f[0] + l[0]).toUpperCase();
    return f ? f.slice(0, 2).toUpperCase() : '?';
  })();

  const levelInfo = LEVEL_LABELS[level];

  return (
    <>
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={(b64) => { setAvatar(b64); setAvatarChanged(true); URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        />
      )}
      {/* Header */}
      <div className="app-header">
        <div className="header-inner">
          <Link to="/dashboard" className="back-btn">← Retour</Link>
          <div className="header-row">
            <div className="header-title">Mon Profil</div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error   && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <form onSubmit={handleSubmit}>

          {/* Avatar */}
          <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
            <label style={{ cursor: 'pointer', display: 'inline-block' }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%', margin: '0 auto 8px',
                background: avatar ? 'transparent' : '#E3F2FD',
                border: '3px solid #42A5F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {avatar
                  ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28, fontWeight: 700, color: '#1565C0' }}>{initials}</span>
                }
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.38)', padding: '4px 0',
                  fontSize: 11, color: 'white', textAlign: 'center',
                }}>📷</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                Changer la photo
              </div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </label>
          </div>

          {/* Informations personnelles */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              Informations personnelles
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="p-firstName">Prénom</label>
                <input id="p-firstName" type="text" value={firstName}
                  onChange={e => setFirstName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="p-lastName">Nom</label>
                <input id="p-lastName" type="text" value={lastName}
                  onChange={e => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="p-phone">Téléphone</label>
              <input id="p-phone" type="tel" value={phone}
                onChange={e => setPhone(e.target.value)} placeholder="ex: 06 12 34 56 78" />
            </div>

            <div className="form-group">
              <label htmlFor="p-email">Email</label>
              <input id="p-email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Genre</label>
              <div className="gender-selector">
                <label className={`gender-option ${gender === 'masculin' ? 'selected' : ''}`}>
                  <input type="radio" name="p-gender" value="masculin"
                    checked={gender === 'masculin'} onChange={e => setGender(e.target.value)} />
                  Homme
                </label>
                <label className={`gender-option ${gender === 'feminin' ? 'selected' : ''}`}>
                  <input type="radio" name="p-gender" value="feminin"
                    checked={gender === 'feminin'} onChange={e => setGender(e.target.value)} />
                  Femme
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="p-level">
                Niveau de jeu
                {levelInfo && (
                  <span style={{
                    marginLeft: 8, padding: '2px 9px', borderRadius: 10,
                    fontSize: 11, fontWeight: 700,
                    background: levelInfo.bg, color: levelInfo.color
                  }}>
                    {levelInfo.label}
                  </span>
                )}
              </label>
              <select id="p-level" value={level} onChange={e => setLevel(e.target.value)} required>
                <option value="">-- Choisir --</option>
                <option value="loisir">Loisir</option>
                <option value="departemental">Départemental</option>
                <option value="regional">Régional</option>
                <option value="national">National</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>

          {/* Changer le mot de passe */}
          <div className="card">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowPassword(v => !v)}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                🔒 Changer le mot de passe
              </div>
              <span style={{ fontSize: 16, color: '#90A0B0', lineHeight: 1 }}>{showPassword ? '▲' : '▼'}</span>
            </div>

            {showPassword && (
              <div style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label>Mot de passe actuel</label>
                  <input type="password" value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label>Nouveau mot de passe</label>
                  <input type="password" value={newPwd}
                    onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Confirmer le nouveau mot de passe</label>
                  <input type="password" value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} style={{ width: '100%', marginTop: 4, padding: '13px' }}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder les modifications'}
          </button>

        </form>

        {/* Déconnexion */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button
            className="button-danger"
            style={{ width: '100%' }}
            onClick={() => { onLogout(); }}
          >
            🚪 Se déconnecter
          </button>
        </div>

      </div>
    </>
  );
}

export default Profile;
