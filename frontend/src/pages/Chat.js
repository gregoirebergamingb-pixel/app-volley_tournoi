import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { avatarColor, initials } from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Chat({ user, onChatRead }) {
  const { convId } = useParams();
  const navigate   = useNavigate();
  const token      = localStorage.getItem('token');

  const [messages, setMessages]   = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [convType, setConvType]   = useState('direct');
  const [teamName, setTeamName]   = useState(null);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversations/${convId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data.messages);
        setOtherUser(res.data.otherUser);
        setConvType(res.data.type || 'direct');
        setTeamName(res.data.teamName || null);
        await axios.put(`${API_URL}/api/messages/conversations/${convId}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        onChatRead?.();
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [convId, token]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setText('');
    setSending(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/messages/conversations/${convId}/send`,
        { text: msg },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => [...prev, res.data]);
    } catch { setText(msg); }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  function groupByDate(msgs) {
    const groups = [];
    let lastDate = null;
    for (const m of msgs) {
      const d = new Date(m.timestamp).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (d !== lastDate) { groups.push({ type: 'date', label: d }); lastDate = d; }
      groups.push({ type: 'msg', ...m });
    }
    return groups;
  }

  return (
    <>
      <div className="app-header">
        <div className="header-inner" style={{ paddingTop: 22 }}>
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate('/messages')}>← Messages</span>
          <div className="header-row">
            {convType === 'team' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="av-circle av-sm" style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)', fontSize: 16 }}>
                  🏐
                </div>
                <div>
                  <div className="header-title" style={{ fontSize: 15 }}>{teamName || 'Chat équipe'}</div>
                  <div className="header-subtitle">Discussion d'équipe</div>
                </div>
              </div>
            ) : otherUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => navigate(`/profil/${otherUser.id}`)}>
                <div className={`av-circle av-sm ${otherUser.avatarUrl ? '' : avatarColor(otherUser.id)}`}
                  style={{ border: '2px solid rgba(255,255,255,0.3)' }}>
                  {otherUser.avatarUrl
                    ? <img src={otherUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(otherUser.firstName, otherUser.lastName)
                  }
                </div>
                <div>
                  <div className="header-title" style={{ fontSize: 15 }}>
                    {otherUser.firstName} {otherUser.lastName}
                  </div>
                  <div className="header-subtitle">Voir le profil →</div>
                </div>
              </div>
            ) : (
              <div className="header-title">Conversation</div>
            )}
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#90A0B0', fontSize: 13 }}>
            Chargement…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#B0C0D0', padding: 24 }}>
            <div style={{ fontSize: 40 }}>👋</div>
            <p style={{ fontSize: 13, textAlign: 'center' }}>
              Commencez la conversation avec {otherUser?.firstName} !
            </p>
          </div>
        )}

        {groupByDate(messages).map((item, i) => {
          if (item.type === 'date') return (
            <div key={`d-${i}`} style={{ textAlign: 'center', margin: '8px 0' }}>
              <span style={{ background: '#E8EEF4', color: '#788899', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                {item.label}
              </span>
            </div>
          );
          const isMe = item.senderId === user.id;
          return (
            <div key={item.id} className={`bubble-row${isMe ? ' me' : ''}`}>
              {!isMe && otherUser && (
                <div className={`bubble-av ${otherUser.avatarUrl ? '' : avatarColor(otherUser.id)}`}>
                  {otherUser.avatarUrl
                    ? <img src={otherUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : initials(otherUser.firstName, otherUser.lastName)
                  }
                </div>
              )}
              <div className="bubble-wrap">
                <div className={`bubble ${isMe ? 'me' : 'them'}`}>{item.text}</div>
                <div className="bubble-time">
                  {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input
          ref={inputRef}
          className="chat-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Message…"
          disabled={sending}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!text.trim() || sending} aria-label="Envoyer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </>
  );
}

export default Chat;
