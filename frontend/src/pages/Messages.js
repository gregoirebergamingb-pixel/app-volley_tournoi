import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';
import { avatarColor, initials } from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function timeLabel(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7)  return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Messages({ user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    axios.get(`${API_URL}/api/messages/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setConversations(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0);

  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>← Accueil</span>
          <div className="header-row">
            <div>
              <div className="header-title">Messages</div>
              <div className="header-subtitle">
                {totalUnread > 0 ? `${totalUnread} non lu${totalUnread > 1 ? 's' : ''}` : `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <AvatarMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </div>

      <div className="page-content">
        {loading && (
          <>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="sk-badge" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="sk-line" style={{ width: '50%', height: 12, marginBottom: 6 }} />
                  <div className="sk-line" style={{ width: '70%', height: 10 }} />
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && conversations.length === 0 && (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <p className="empty-text">Aucune conversation</p>
            <p style={{ fontSize: 13, color: '#B0C0D0', marginTop: 6 }}>
              Ouvre le profil d'un joueur pour lui envoyer un message.
            </p>
          </div>
        )}

        {conversations.map(conv => {
          if (conv.type === 'team') {
            return (
              <div key={conv.id} className="conv-item" onClick={() => navigate(`/messages/${conv.id}`)}>
                <div className="av-circle" style={{ width: 44, height: 44, background: '#E3F2FD', flexShrink: 0, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🏐
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: conv.unread > 0 ? 800 : 700, fontSize: 14, color: conv.unread > 0 ? 'var(--primary)' : 'var(--text)', marginBottom: 2 }}>
                    {conv.teamName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.tournamentName}
                  </div>
                  <div style={{ fontSize: 12, color: conv.unread > 0 ? '#445' : 'var(--sub)', fontWeight: conv.unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.lastMessage ? conv.lastMessage.text : 'Chat d\'équipe'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: '#B0C0D0' }}>{timeLabel(conv.updatedAt)}</div>
                  {conv.unread > 0 && (
                    <div style={{ width: 18, height: 18, background: 'var(--primary)', borderRadius: '50%', fontSize: 10, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {conv.unread}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          const other = conv.otherUser;
          if (!other) return null;
          return (
            <div key={conv.id} className="conv-item" onClick={() => navigate(`/messages/${conv.id}`)}>
              <div className={`av-circle ${other.avatarUrl ? '' : avatarColor(other.id)}`}
                style={{ width: 44, height: 44, flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
                {other.avatarUrl
                  ? <img src={other.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : initials(other.firstName, other.lastName)
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: conv.unread > 0 ? 800 : 600, fontSize: 14, color: conv.unread > 0 ? 'var(--primary)' : 'var(--text)', marginBottom: 2 }}>
                  {other.firstName} {other.lastName}
                </div>
                <div style={{ fontSize: 12, color: conv.unread > 0 ? '#445' : 'var(--sub)', fontWeight: conv.unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conv.lastMessage
                    ? (conv.lastMessage.senderId === user.id ? 'Vous : ' : '') + conv.lastMessage.text
                    : 'Nouvelle conversation'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#B0C0D0' }}>{timeLabel(conv.updatedAt)}</div>
                {conv.unread > 0 && (
                  <div style={{ width: 18, height: 18, background: 'var(--primary)', borderRadius: '50%', fontSize: 10, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default Messages;
