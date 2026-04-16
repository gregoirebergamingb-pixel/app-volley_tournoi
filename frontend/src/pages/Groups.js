import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

function Groups({ user, onLogout }) {
  const navigate = useNavigate();
  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [openPanel, setOpenPanel] = useState(null); // 'create' | 'join' | null
  const [createName, setCreateName]           = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createResult, setCreateResult]       = useState(null);
  const [joinCode, setJoinCode]               = useState('');
  const [editingId, setEditingId]             = useState(null);
  const [editName, setEditName]               = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [inviteGroup, setInviteGroup]         = useState(null);
  const [linkCopied, setLinkCopied]           = useState(false);
  const [actionLoading, setActionLoading]     = useState(false);
  const [message, setMessage]                 = useState('');
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
        { name: createName.trim(), description: createDescription },
        { headers: { Authorization: `Bearer ${token}` } });
      setCreateResult(res.data);
      setCreateName(''); setCreateDescription('');
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

  const startEdit = (g) => { setEditingId(g.id); setEditName(g.name); setEditDescription(g.description || ''); };

  const handleSaveEdit = async (e, groupId) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_URL}/api/groups/${groupId}`,
        { name: editName.trim(), description: editDescription },
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

  // ── Invite ──
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

  return (
    <>
      {/* Header */}
      <div className="app-header">
        <div className="header-row">
          <div>
            <div className="header-title">Mes Groupes</div>
            <div className="header-subtitle">{groups.length} groupe{groups.length !== 1 ? 's' : ''}</div>
          </div>
          <AvatarMenu user={user} onLogout={onLogout} />
        </div>
      </div>

      {/* Content */}
      <div className="page-content">
        {/* Action buttons */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <button style={{ flex:1 }} onClick={() => setOpenPanel(openPanel === 'create' ? null : 'create')}>+ Créer</button>
          <button className="button-secondary" style={{ flex:1 }}
            onClick={() => setOpenPanel(openPanel === 'join' ? null : 'join')}>Rejoindre</button>
        </div>

        {error   && <div className="message error">{error}</div>}
        {message && <div className="message success">{message}</div>}

        {/* Créer panel */}
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
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={createDescription}
                    onChange={e => setCreateDescription(e.target.value)}
                    placeholder="Description optionnelle…" />
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button type="submit" disabled={actionLoading}>{actionLoading ? 'Création…' : 'Créer'}</button>
                  <button type="button" className="button-secondary" onClick={() => setOpenPanel(null)}>Annuler</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Rejoindre panel */}
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

        {/* Groups list */}
        {loading && <p style={{ textAlign:'center', color:'#90A0B0', padding:'2rem' }}>Chargement…</p>}

        {!loading && groups.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p className="empty-text">Aucun groupe pour l'instant</p>
          </div>
        )}

        <div className="groups-list">
          {groups.map(group => (
            <div key={group.id} className="group-card" style={{ cursor:'pointer' }}
              onClick={() => navigate(`/groups/${group.id}`)}>
              {editingId === group.id ? (
                <form onSubmit={(e) => handleSaveEdit(e, group.id)} className="edit-inline-form"
                onClick={e => e.stopPropagation()}>
                  <div className="form-group">
                    <label>Nom du groupe</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button type="submit" disabled={actionLoading}>Sauvegarder</button>
                    <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Group top row */}
                  <div className="group-card-top">
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="group-name">
                        {group.name}
                        {group.owner === user.id && <span className="owner-badge">Proprio</span>}
                      </div>
                      {group.description && <div className="group-desc">{group.description}</div>}
                    </div>
                  </div>

                  {/* Member circles */}
                  <div style={{ marginBottom:10 }}>
                    <div className="member-col-label">{group.members.length} membre{group.members.length !== 1 ? 's' : ''}</div>
                    <div className="av-stack" style={{ flexWrap:'nowrap', overflow:'hidden' }}>
                      {/* Current user first */}
                      <div className={`av-circle av-md ${avatarColor(user.id)}`}
                        style={{ border:'2.5px solid var(--primary)', flexShrink:0 }}>
                        {initials(user.firstName, user.lastName)}
                      </div>
                      {/* Other members */}
                      {group.members
                        .filter(id => id !== user.id)
                        .slice(0, 5)
                        .map(id => (
                          <div key={id} className={`av-circle av-md ${avatarColor(id)}`} style={{ flexShrink:0 }}>?</div>
                        ))
                      }
                      {group.members.length > 6 && (
                        <div className="av-circle av-md av-more">+{group.members.length - 6}</div>
                      )}
                    </div>
                  </div>

                  {/* Tournaments count + invite code */}
                  <div className="group-meta" style={{ marginBottom:10 }}>
                    <span>🏐 {group.tournaments?.length || 0} tournoi{(group.tournaments?.length || 0) !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span className="invite-code">🔗 {group.inviteCode}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', justifyContent:'flex-end' }}
                    onClick={e => e.stopPropagation()}>
                    <button className="button-invite btn-sm"
                      onClick={() => { setInviteGroup(group); setLinkCopied(false); }}>
                      📨 Inviter
                    </button>
                    {group.owner === user.id ? (
                      <>
                        <button className="button-secondary btn-sm" onClick={() => startEdit(group)}>Modifier</button>
                        <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => handleDelete(group)}>Supprimer</button>
                      </>
                    ) : (
                      <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => handleDelete(group)}>Quitter</button>
                    )}
                  </div>
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
            <div className="invite-link-box">
              <input ref={inviteLinkRef} type="text" readOnly
                value={getInviteUrl(inviteGroup.inviteCode)}
                className="invite-link-input"
                onFocus={e => e.target.select()} />
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
