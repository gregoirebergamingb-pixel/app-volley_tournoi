import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { avatarColor, initials } from './TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function NotificationPanel({ token, onClose, onCountChange }) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifs(res.data);
      onCountChange?.(res.data.length);
    } catch {}
    finally { setLoading(false); }
  }, [token, onCountChange]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const act = async (notifId, action) => {
    setActing(notifId);
    try {
      await axios.post(`${API_URL}/api/notifications/${notifId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNotifs();
    } catch {}
    finally { setActing(null); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,18,40,0.55)', zIndex:300, display:'flex', alignItems:'flex-end' }}
      onClick={onClose}>
      <div style={{ background:'white', borderRadius:'24px 24px 0 0', width:'100%', maxHeight:'80vh', overflowY:'auto', paddingBottom:32 }}
        onClick={e => e.stopPropagation()}>

        <div style={{ width:36, height:4, background:'#DDE5EF', borderRadius:2, margin:'12px auto 4px' }} />

        <div style={{ padding:'10px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>Notifications</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#90A0B0', cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:'8px 0' }}>
          {loading && (
            <div style={{ textAlign:'center', padding:'2rem', color:'#90A0B0', fontSize:13 }}>Chargement…</div>
          )}
          {!loading && notifs.length === 0 && (
            <div style={{ textAlign:'center', padding:'2.5rem 1rem', color:'#90A0B0', fontSize:13 }}>
              Aucune notification en attente
            </div>
          )}
          {notifs.map(n => (
            <div key={n.id} style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div className={`av-circle av-sm ${n.fromUser?.avatarUrl ? '' : avatarColor(n.fromUserId)}`}
                  style={{ flexShrink:0 }}>
                  {n.fromUser?.avatarUrl
                    ? <img src={n.fromUser.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                    : initials(n.fromUser?.firstName, n.fromUser?.lastName)
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                    {n.fromUser?.firstName} {n.fromUser?.lastName}
                  </div>
                  <div style={{ fontSize:11, color:'var(--sub)', marginTop:1 }}>
                    Veut rejoindre <strong>{n.teamName}</strong> · {n.tournamentName}
                  </div>
                </div>
                <button
                  onClick={() => { onClose(); navigate(`/profil/${n.fromUserId}`); }}
                  style={{ background:'#F0F4FA', border:'none', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:700, color:'var(--primary)', cursor:'pointer', flexShrink:0 }}>
                  Voir profil
                </button>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={() => act(n.id, 'approve')}
                  disabled={acting === n.id}
                  style={{ flex:1, background:'#1565C0', color:'white', border:'none', borderRadius:10, padding:'8px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {acting === n.id ? '…' : '✓ Accepter'}
                </button>
                <button
                  onClick={() => act(n.id, 'deny')}
                  disabled={acting === n.id}
                  style={{ flex:1, background:'#FFEBEE', color:'#C62828', border:'1px solid #FFCDD2', borderRadius:10, padding:'8px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {acting === n.id ? '…' : '✕ Refuser'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
