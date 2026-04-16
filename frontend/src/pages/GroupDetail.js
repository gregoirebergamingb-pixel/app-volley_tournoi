import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const GENDER_LABELS = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE  = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };

function GroupDetail({ user }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup]           = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [editingGroup, setEditingGroup]     = useState(false);
  const [editGroupName, setEditGroupName]   = useState('');
  const [editGroupDesc, setEditGroupDesc]   = useState('');

  const [editingTournamentId, setEditingTournamentId] = useState(null);
  const [editTournament, setEditTournament]           = useState({});

  const token = localStorage.getItem('token');

  useEffect(() => { fetchAll(); }, [groupId]); // eslint-disable-line

  const fetchAll = async () => {
    try {
      const [groupRes, tournamentsRes] = await Promise.all([
        axios.get(`${API_URL}/api/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/tournaments/group/${groupId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setGroup(groupRes.data);
      setTournaments(tournamentsRes.data);
    } catch {
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const startEditGroup = () => {
    setEditGroupName(group.name);
    setEditGroupDesc(group.description || '');
    setEditingGroup(true);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await axios.put(`${API_URL}/api/groups/${groupId}`,
        { name: editGroupName.trim(), description: editGroupDesc },
        { headers: { Authorization: `Bearer ${token}` } });
      setEditingGroup(false); fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Supprimer le groupe "${group.name}" ?`)) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
      navigate('/groups');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
      setActionLoading(false);
    }
  };

  const startEditTournament = (t) => {
    setEditingTournamentId(t.id);
    setEditTournament({ name: t.name, date: t.date, time: t.time, location: t.location, price: t.price || 0 });
  };

  const handleSaveTournament = async (e, tournamentId) => {
    e.preventDefault();
    if (!editTournament.name || !editTournament.date || !editTournament.time || !editTournament.location) {
      setError('Tous les champs sont requis'); return;
    }
    setActionLoading(true);
    try {
      await axios.put(`${API_URL}/api/tournaments/${tournamentId}`, editTournament,
        { headers: { Authorization: `Bearer ${token}` } });
      setEditingTournamentId(null); fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleDeleteTournament = async (t) => {
    if (!window.confirm(`Supprimer le tournoi "${t.name}" ?`)) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/tournaments/${t.id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  if (loading) return (
    <>
      <div className="app-header">
        <Link to="/groups" className="back-btn">← Groupes</Link>
        <div className="header-row"><div className="header-title">Chargement…</div></div>
      </div>
      <div className="page-content"></div>
    </>
  );
  if (!group) return (
    <>
      <div className="app-header">
        <Link to="/groups" className="back-btn">← Groupes</Link>
        <div className="header-row"><div className="header-title">Groupe introuvable</div></div>
      </div>
    </>
  );

  const isOwner = group.owner === user.id;
  const today = new Date().toISOString().split('T')[0];
  const upcoming = tournaments.filter(t => t.date >= today);
  const past     = tournaments.filter(t => t.date < today);

  return (
    <>
      {/* Header */}
      <div className="app-header">
        <Link to="/groups" className="back-btn">← Groupes</Link>
        <div className="header-row">
          <div style={{ minWidth:0 }}>
            <div className="header-title">{group.name}</div>
            <div className="header-subtitle">
              {group.members.length} membre{group.members.length !== 1 ? 's' : ''} · {tournaments.length} tournoi{tournaments.length !== 1 ? 's' : ''}
            </div>
          </div>
          {isOwner && (
            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
              <button className="button-secondary btn-sm" style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'1px solid rgba(255,255,255,0.4)' }}
                onClick={startEditGroup}>Modifier</button>
            </div>
          )}
        </div>
      </div>

      <div className="page-content">
        {error && <div className="message error">{error}</div>}

        {/* Edit group form */}
        {editingGroup && (
          <div className="card">
            <h2 style={{ fontSize:16, marginBottom:12 }}>Modifier le groupe</h2>
            <form onSubmit={handleSaveGroup} className="edit-inline-form">
              <div className="form-group">
                <label>Nom</label>
                <input type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={editGroupDesc} onChange={e => setEditGroupDesc(e.target.value)} />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button type="submit" disabled={actionLoading}>Sauvegarder</button>
                <button type="button" className="button-secondary" onClick={() => setEditingGroup(false)}>Annuler</button>
                <button type="button" className="button-danger btn-sm" disabled={actionLoading} onClick={handleDeleteGroup}
                  style={{ marginLeft:'auto' }}>Supprimer le groupe</button>
              </div>
            </form>
          </div>
        )}

        {/* Group info */}
        {!editingGroup && (
          <div className="card">
            {group.description && <p style={{ color:'#666', fontSize:14, marginBottom:8 }}>{group.description}</p>}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', fontSize:13, color:'#90A0B0' }}>
              <span>👥 {group.members.length} membres</span>
              <span>·</span>
              <span className="invite-code">🔗 {group.inviteCode}</span>
            </div>
          </div>
        )}

        {/* Tournaments list */}
        <div className="card-header-row" style={{ marginTop:4 }}>
          <h2 style={{ margin:0, fontSize:16 }}>Tournois ({tournaments.length})</h2>
          <Link to={`/groups/${groupId}/tournament/create`}>
            <button className="btn-sm">+ Ajouter</button>
          </Link>
        </div>

        {tournaments.length === 0 && (
          <div className="empty-state" style={{ padding:'24px 0' }}>
            <p style={{ fontSize:13, color:'#B0C0D0' }}>Aucun tournoi pour le moment.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="section-label">À venir</div>
            <div className="tournament-list">
              {upcoming.map(t => <TournamentRow key={t.id} t={t} isCreator={t.creator === user.id}
                groupId={groupId} editingId={editingTournamentId} editData={editTournament}
                onEdit={startEditTournament} onSave={handleSaveTournament}
                onDelete={handleDeleteTournament} onCancelEdit={() => setEditingTournamentId(null)}
                onEditChange={v => setEditTournament(p => ({ ...p, ...v }))}
                actionLoading={actionLoading} />)}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-label">Passés</div>
            <div className="tournament-list" style={{ opacity:0.65 }}>
              {past.map(t => <TournamentRow key={t.id} t={t} isCreator={t.creator === user.id}
                groupId={groupId} editingId={editingTournamentId} editData={editTournament}
                onEdit={startEditTournament} onSave={handleSaveTournament}
                onDelete={handleDeleteTournament} onCancelEdit={() => setEditingTournamentId(null)}
                onEditChange={v => setEditTournament(p => ({ ...p, ...v }))}
                actionLoading={actionLoading} />)}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function TournamentRow({ t, isCreator, groupId, editingId, editData, onEdit, onSave, onDelete, onCancelEdit, onEditChange, actionLoading }) {
  const navigate = useNavigate();
  const genderBadge = GENDER_BADGE[t.gender] || 'badge-grey';
  const dateStr = t.date
    ? new Date(t.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  if (editingId === t.id) {
    return (
      <div className="card">
        <form onSubmit={(e) => onSave(e, t.id)} className="edit-tournament-form">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div className="form-group" style={{ gridColumn:'1 / -1' }}>
              <label>Nom</label>
              <input type="text" value={editData.name} onChange={e => onEditChange({ name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={editData.date} onChange={e => onEditChange({ date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Horaire</label>
              <input type="time" value={editData.time} onChange={e => onEditChange({ time: e.target.value })} required />
            </div>
            <div className="form-group" style={{ gridColumn:'1 / -1' }}>
              <label>Lieu</label>
              <input type="text" value={editData.location} onChange={e => onEditChange({ location: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Prix (€)</label>
              <input type="number" value={editData.price} onChange={e => onEditChange({ price: parseFloat(e.target.value) || 0 })} min="0" />
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', marginTop:'6px' }}>
            <button type="submit" disabled={actionLoading}>Sauvegarder</button>
            <button type="button" className="button-secondary" onClick={onCancelEdit}>Annuler</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="tournament-row" style={{ cursor:'pointer' }}
      onClick={() => navigate(`/tournaments/${t.id}`)}>
      <div className="tournament-row-info">
        <h3>{t.name}</h3>
        <p style={{ fontSize:12, color:'#90A0B0' }}>📅 {dateStr} · {t.time} · 📍 {t.location}</p>
        <div style={{ display:'flex', gap:'5px', marginTop:'4px', flexWrap:'wrap' }}>
          <span className="badge badge-blue">{t.playerFormat || t.format}</span>
          <span className={`badge ${genderBadge}`}>{GENDER_LABELS[t.gender] || t.gender}</span>
          {t.price > 0
            ? <span className="badge badge-yellow">{t.price}€</span>
            : <span className="badge badge-green">Gratuit</span>}
        </div>
      </div>
      {isCreator && (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px', alignItems:'flex-end', flexShrink:0 }}
          onClick={e => e.stopPropagation()}>
          <button className="button-secondary btn-sm" onClick={() => onEdit(t)}>Modifier</button>
          <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => onDelete(t)}>Supprimer</button>
        </div>
      )}
    </div>
  );
}

export default GroupDetail;
