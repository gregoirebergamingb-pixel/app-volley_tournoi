import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AvatarMenu from '../components/AvatarMenu';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AV_COLORS = ['av-blue','av-pink','av-green','av-orange','av-purple','av-teal','av-red','av-indigo'];
function avatarColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(firstName, lastName) {
  const f = (firstName || '').trim(); const l = (lastName || '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  return f ? f.slice(0, 2).toUpperCase() : '?';
}

function Groups({ user, onLogout, chatUnread = 0 }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [openPanel, setOpenPanel] = useState(searchParams.get('panel') || null);
  const [createName, setCreateName]     = useState('');
  const [createResult, setCreateResult] = useState(null);
  const [joinCode, setJoinCode]         = useState('');
  const [editingId, setEditingId]       = useState(null);
  const [editName, setEditName]         = useState('');
  const [inviteGroup, setInviteGroup]   = useState(null);
  const [linkCopied, setLinkCopied]     = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage]           = useState('');
  const [expandedId, setExpandedId]     = useState(null);
  const [memberStats, setMemberStats]   = useState({});
  const [memberTab, setMemberTab]       = useState('tournaments');
  const [statsLoading, setStatsLoading] = useState(false);
  const inviteLinkRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => { fetchGroups(); }, []); // eslint-disable-line

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(res.data);
    } catch {
      setError('Erreur lors du chargement des groupes');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/groups`,
        { name: createName.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      setCreateResult(res.data);
      setCreateName('');
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally { setActionLoading(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/groups/join`,
        { inviteCode: joinCode.trim().toUpperCase() },
        { headers: { Authorization: `Bearer ${token}` } });
      setJoinCode(''); setOpenPanel(null);
      showMessage('Vous avez rejoint le groupe !');
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Code invalide');
    } finally { setActionLoading(false); }
  };

  const startEdit = (g) => { setEditingId(g.id); setEditName(g.name); };

  const handleSaveEdit = async (e, groupId) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_URL}/api/groups/${groupId}`,
        { name: editName.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null); fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleDelete = async (group) => {
    if (!window.confirm(`Supprimer "${group.name}" ? Tous les tournois et équipes seront supprimés.`)) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/groups/${group.id}`, { headers: { Authorization: `Bearer ${token}` } });
      showMessage('Groupe supprimé'); fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const getInviteUrl = (code) => `${window.location.origin}/rejoindre/${code}`;

  const handleCopyLink = async (code) => {
    try {
      await navigator.clipboard.writeText(getInviteUrl(code));
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      if (inviteLinkRef.current) { inviteLinkRef.current.select(); document.execCommand('copy'); }
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const handleShare = async (group) => {
    const url = getInviteUrl(group.inviteCode);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rejoins ${group.name} !`,
          text: `Je t'invite à rejoindre notre groupe de volley "${group.name}" sur l'appli. Clique pour nous rejoindre !`,
          url,
        });
      } catch { /* cancelled */ }
    } else {
      handleCopyLink(group.inviteCode);
    }
  };

  const toggleExpand = async (groupId) => {
    const isOpening = expandedId !== groupId;
    setExpandedId(isOpening ? groupId : null);
    if (isOpening && !memberStats[groupId]) {
      setStatsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/groups/${groupId}/member-stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMemberStats(prev => ({ ...prev, [groupId]: res.data }));
      } catch { /* ignore */ } finally {
        setStatsLoading(false);
      }
    }
  };

  const getSortedMembers = (group) => {
    const stats = memberStats[group.id] || [];
    const merged = (group.memberDetails || []).map(m => {
      const s = stats.find(s => s.id === m.id) || { tournaments: 0, wins: 0, losses: 0 };
      return { ...m, ...s };
    });
    if (memberTab === 'wins') return [...merged].sort((a,b) => b.wins - a.wins);
    if (memberTab === 'pct') return [...merged].sort((a,b) => {
      const pA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : -1;
      const pB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : -1;
      return pB - pA;
    });
    return [...merged].sort((a,b) => b.tournaments - a.tournaments);
  };

  const getStatDisplay = (m) => {
    if (memberTab === 'wins') return m.wins > 0 ? `${m.wins}` : '—';
    if (memberTab === 'pct') {
      const total = m.wins + m.losses;
      return total > 0 ? `${Math.round(m.wins / total * 100)}%` : '—';
    }
    return `${m.tournaments}`;
  };

  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
          <div className="header-row">
            <div>
              <div className="header-title">Mes Groupes</div>
              <div className="header-subtitle">{groups.length} groupe{groups.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="header-icon-btn" onClick={() => navigate('/messages')} aria-label="Messages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {chatUnread > 0 && <span className="header-icon-badge">{chatUnread > 9 ? '9+' : chatUnread}</span>}
              </button>
              <AvatarMenu user={user} onLogout={onLogout} />
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <button style={{ flex:1 }} onClick={() => setOpenPanel(openPanel === 'create' ? null : 'create')}>+ Créer</button>
          <button className="button-secondary" style={{ flex:1 }}
            onClick={() => setOpenPanel(openPanel === 'join' ? null : 'join')}>Rejoindre</button>
        </div>

        {error   && <div className="message error">{error}</div>}
        {message && <div className="message success">{message}</div>}

        {openPanel === 'create' && (
          <div className="card panel-form">
            <h2 style={{ fontSize:16, marginBottom:12 }}>Créer un groupe</h2>
            {createResult ? (
              <div className="message success">
                <strong>Groupe créé !</strong><br />
                Code d'invitation : <code style={{ background:'#d4edda', padding:'2px 6px', borderRadius:4 }}>{createResult.inviteCode}</code>
                <br /><span style={{ fontSize:12 }}>Partagez ce code pour inviter vos amis.</span>
                <br /><br />
                <button onClick={() => { setCreateResult(null); setOpenPanel(null); }}>Fermer</button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Nom du groupe <span className="required-star">*</span></label>
                  <input type="text" value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="ex: Neptune de Nantes" required />
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button type="submit" disabled={actionLoading}>{actionLoading ? 'Création…' : 'Créer'}</button>
                  <button type="button" className="button-secondary" onClick={() => setOpenPanel(null)}>Annuler</button>
                </div>
              </form>
            )}
          </div>
        )}

        {openPanel === 'join' && (
          <div className="card panel-form">
            <h2 style={{ fontSize:16, marginBottom:12 }}>Rejoindre un groupe</h2>
            <form onSubmit={handleJoin}>
              <div className="form-group">
                <label>Code d'invitation <span className="required-star">*</span></label>
                <input type="text" value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ex: AB12CD" required />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button type="submit" disabled={actionLoading}>{actionLoading ? 'Connexion…' : 'Rejoindre'}</button>
                <button type="button" className="button-secondary" onClick={() => setOpenPanel(null)}>Annuler</button>
              </div>
            </form>
          </div>
        )}

        {loading && <p style={{ textAlign:'center', color:'#90A0B0', padding:'2rem' }}>Chargement…</p>}

        {!loading && groups.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p className="empty-text">Vous n'avez pas encore de groupe</p>
            <p style={{ fontSize: 13, color: '#90A0B0', marginTop: 10, lineHeight: 1.6, maxWidth: 280, margin: '10px auto 0' }}>
              Les groupes vous permettent de partager des tournois avec vos coéquipiers et d'organiser vos équipes ensemble.
              Créez votre groupe ou rejoignez celui d'un ami avec son code d'invitation.
            </p>
          </div>
        )}

        <div className="groups-list">
          {groups.map(group => (
            <div key={group.id} className="group-card" style={{ cursor:'pointer' }}
              onClick={() => { if (editingId !== group.id) toggleExpand(group.id); }}>

              {editingId === group.id ? (
                <form onSubmit={(e) => handleSaveEdit(e, group.id)} className="edit-inline-form"
                  onClick={e => e.stopPropagation()}>
                  <div className="form-group">
                    <label>Nom du groupe</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button type="submit" disabled={actionLoading}>Sauvegarder</button>
                    <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Ligne 1 : nom + boutons + chevron */}
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <div className="group-name" style={{ flex:1, minWidth:0 }}>{group.name}</div>
                    <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}
                      onClick={e => e.stopPropagation()}>
                      {group.owner === user.id ? (
                        <>
                          <button className="button-secondary btn-sm" onClick={() => startEdit(group)}>Modifier</button>
                          <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => handleDelete(group)}>Supprimer</button>
                        </>
                      ) : (
                        <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => handleDelete(group)}>Quitter</button>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'#B0C0D0', flexShrink:0, transform: expandedId === group.id ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</div>
                  </div>

                  {/* Ligne 2 : badge Proprio */}
                  {group.owner === user.id && (
                    <div style={{ marginBottom:8 }}>
                      <span className="owner-badge" style={{ marginLeft:0 }}>Proprio</span>
                    </div>
                  )}

                  {/* Ligne 3 : stats + Inviter */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop: group.owner === user.id ? 0 : 8 }}>
                    <span className="member-col-label" style={{ margin:0 }}>
                      👥 {group.members.length} membre{group.members.length !== 1 ? 's' : ''}
                    </span>
                    <span className="member-col-label" style={{ margin:0 }}>
                      🏐 {group.tournaments?.length || 0} tournoi{(group.tournaments?.length || 0) !== 1 ? 's' : ''}
                    </span>
                    <div style={{ flex:1 }} />
                    <div onClick={e => e.stopPropagation()}>
                      <button className="button-invite btn-sm"
                        onClick={() => { setInviteGroup(group); setLinkCopied(false); }}>
                        📨 Inviter
                      </button>
                    </div>
                  </div>

                  {/* Expanded member list — below buttons */}
                  {expandedId === group.id && (
                    <div className="group-members-expanded" onClick={e => e.stopPropagation()}>
                      {/* Tab bar */}
                      <div className="member-rank-tabs">
                        {[['tournaments','Tournois'],['wins','Victoires'],['pct','% Victoires']].map(([key, label]) => (
                          <button key={key}
                            className={`member-rank-tab ${memberTab === key ? 'active' : ''}`}
                            onClick={() => setMemberTab(key)}>{label}</button>
                        ))}
                      </div>

                      {statsLoading ? (
                        <div style={{ textAlign:'center', padding:'14px', color:'#90A0B0', fontSize:13 }}>Chargement…</div>
                      ) : getSortedMembers(group).map((m, idx) => {
                        const rank = idx + 1;
                        const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-other';
                        return (
                          <div key={m.id} className="group-member-row">
                            <span className={`rank-badge ${rankClass}`}>{rank}</span>
                            <div className={`av-circle av-md ${!m.avatarUrl ? avatarColor(m.id) : ''}`}
                              style={{ flexShrink:0, border: m.id === user.id ? '2.5px solid var(--primary)' : undefined, cursor:'pointer' }}
                              onClick={() => navigate(`/profil/${m.id}`)}>
                              {m.avatarUrl
                                ? <img src={m.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                                : initials(m.firstName, m.lastName)
                              }
                            </div>
                            <span className="group-member-name">
                              {m.firstName} {m.lastName}
                              {m.id === user.id && <span style={{ fontSize:10, color:'var(--primary)', fontWeight:700, marginLeft:5 }}>Moi</span>}
                            </span>
                            <span className="member-rank-stat">{getStatDisplay(m)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Invite sheet ── */}
      {inviteGroup && (
        <div className="invite-overlay" onClick={() => setInviteGroup(null)}>
          <div className="invite-sheet" onClick={e => e.stopPropagation()}>
            <div className="invite-sheet-handle"></div>
            <div className="invite-sheet-header">
              <div className="invite-sheet-icon">👥</div>
              <h3 className="invite-sheet-title">Inviter dans<br />"{inviteGroup.name}"</h3>
              <p className="invite-sheet-subtitle">Partagez le lien — vos amis pourront rejoindre directement.</p>
            </div>
            <div style={{ textAlign:'center', margin:'12px 0 8px' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getInviteUrl(inviteGroup.inviteCode))}&bgcolor=ffffff&color=1565C0&margin=6`}
                alt="QR code d'invitation"
                style={{ borderRadius:12, border:'1px solid #E0E8F4', width:160, height:160 }}
              />
              <div style={{ fontSize:11, color:'#90A0B0', marginTop:6 }}>Scanner pour rejoindre directement</div>
            </div>
            <div className="invite-link-box" style={{ justifyContent:'center', padding:'14px 12px', position:'relative' }}>
              <span style={{ fontSize:22 }}>🔗</span>
              <span style={{ fontSize:22, fontWeight:800, letterSpacing:4, color:'var(--primary)', fontFamily:'monospace' }}>{inviteGroup.inviteCode}</span>
              <input ref={inviteLinkRef} type="text" readOnly value={getInviteUrl(inviteGroup.inviteCode)}
                style={{ position:'absolute', opacity:0, pointerEvents:'none', width:0, height:0, overflow:'hidden' }} />
            </div>
            <div className="invite-actions">
              <button className={`invite-btn invite-btn-copy ${linkCopied ? 'copied' : ''}`}
                onClick={() => handleCopyLink(inviteGroup.inviteCode)}>
                <span className="invite-btn-icon">{linkCopied ? '✓' : '📋'}</span>
                <span>{linkCopied ? 'Lien copié !' : 'Copier le lien'}</span>
              </button>
              <button className="invite-btn invite-btn-share" onClick={() => handleShare(inviteGroup)}>
                <span className="invite-btn-icon">📤</span>
                <span>Partager via…</span>
                <span className="invite-btn-apps">WhatsApp · Messenger · Instagram…</span>
              </button>
            </div>
            <button className="invite-close" onClick={() => setInviteGroup(null)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}

export default Groups;
