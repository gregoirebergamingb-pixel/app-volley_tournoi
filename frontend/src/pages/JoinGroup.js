import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function JoinGroup({ user }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | joining | success | already | error
  const [groupName, setGroupName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!user || !token) {
      // Pas connecté : afficher l'écran d'invitation sans rien faire
      setStatus('unauthenticated');
      return;
    }
    joinGroup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinGroup = async () => {
    setStatus('joining');
    try {
      const res = await axios.post(
        `${API_URL}/api/groups/join`,
        { inviteCode: code.toUpperCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGroupName(res.data?.name || '');
      setStatus('success');
      setTimeout(() => navigate('/groups'), 2000);
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('membre')) {
        setStatus('already');
        setTimeout(() => navigate('/groups'), 2000);
      } else {
        setErrorMsg(msg || 'Lien invalide ou expiré.');
        setStatus('error');
      }
    }
  };

  return (
    <div className="page-content" style={{ display:'flex', alignItems:'flex-start', justifyContent:'center' }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>

        {status === 'unauthenticated' && (
          <>
            <p style={{ fontSize: 48, marginBottom: '1rem' }}>🏐</p>
            <h2 style={{ marginBottom: '0.5rem' }}>Vous avez été invité !</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Connectez-vous ou créez un compte pour rejoindre ce groupe de volley.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link to={`/register?code=${code}`}>
                <button style={{ width: '100%' }}>Créer un compte</button>
              </Link>
              <Link to={`/login?code=${code}`}>
                <button className="button-secondary" style={{ width: '100%' }}>Se connecter</button>
              </Link>
            </div>
          </>
        )}

        {status === 'loading' || status === 'joining' ? (
          <>
            <p style={{ fontSize: 48, marginBottom: '1rem' }}>⏳</p>
            <h2>Rejoindre le groupe…</h2>
            <p style={{ color: '#666' }}>Connexion en cours, veuillez patienter.</p>
          </>
        ) : null}

        {status === 'success' && (
          <>
            <p style={{ fontSize: 48, marginBottom: '1rem' }}>🎉</p>
            <h2 style={{ color: '#2e7d32', marginBottom: '0.5rem' }}>Vous avez rejoint le groupe !</h2>
            {groupName && <p style={{ color: '#666' }}>Bienvenue dans <strong>{groupName}</strong>.</p>}
            <p style={{ color: '#999', fontSize: 13, marginTop: '1rem' }}>Redirection en cours…</p>
          </>
        )}

        {status === 'already' && (
          <>
            <p style={{ fontSize: 48, marginBottom: '1rem' }}>✅</p>
            <h2 style={{ marginBottom: '0.5rem' }}>Vous êtes déjà membre</h2>
            <p style={{ color: '#666' }}>Vous faites déjà partie de ce groupe.</p>
            <p style={{ color: '#999', fontSize: 13, marginTop: '1rem' }}>Redirection en cours…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <p style={{ fontSize: 48, marginBottom: '1rem' }}>❌</p>
            <h2 style={{ marginBottom: '0.5rem' }}>Lien invalide</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>{errorMsg}</p>
            <Link to="/groups">
              <button>Retour à mes groupes</button>
            </Link>
          </>
        )}

      </div>
    </div>
  );
}

export default JoinGroup;
