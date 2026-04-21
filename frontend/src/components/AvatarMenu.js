import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function AvatarMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const f = (user?.firstName || '').trim();
  const l = (user?.lastName  || '').trim();
  const initials = f && l ? (f[0] + l[0]).toUpperCase()
                 : f       ? f.slice(0, 2).toUpperCase()
                 : '?';
  const displayName = f || l ? `${f} ${l}`.trim() : (user?.pseudo || '');

  const go = (path) => { setOpen(false); navigate(path); };
  const handleLogout = () => { setOpen(false); onLogout(); navigate('/login'); };

  return (
    <div ref={ref} className="header-avatar" onClick={() => setOpen(o => !o)}>
      {user?.avatarUrl
        ? <img src={user.avatarUrl} alt={initials} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
        : initials
      }
      {open && (
        <div className="avatar-menu">
          <div className="avatar-menu-item" style={{ fontWeight: 700, cursor: 'default', color: '#90A0B0', fontSize: 12 }}>
            {displayName}
          </div>
          <div className="avatar-menu-item" onClick={e => { e.stopPropagation(); go('/profile'); }}>
            ⚙️ Mon profil
          </div>

          <div className="avatar-menu-sep" />

          <div className="avatar-menu-item" onClick={e => { e.stopPropagation(); go('/groups'); }}>
            👥 Mes groupes
          </div>
          <div className="avatar-menu-item" onClick={e => { e.stopPropagation(); go('/groups?panel=create'); }}>
            ➕ Créer un groupe
          </div>
          <div className="avatar-menu-item" onClick={e => { e.stopPropagation(); go('/groups?panel=join'); }}>
            🔗 Rejoindre un groupe
          </div>

          <div className="avatar-menu-sep" />

          <div className="avatar-menu-item danger" onClick={handleLogout}>
            🚪 Déconnexion
          </div>
        </div>
      )}
    </div>
  );
}

export default AvatarMenu;
