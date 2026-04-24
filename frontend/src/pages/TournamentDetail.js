import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ResultsModal from '../components/ResultsModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };
const FORMATS  = ['2x2','3x3','4x4','6x6'];
const GENDERS  = [{ value:'mix', label:'Mixte' },{ value:'masculin', label:'Masculin' },{ value:'feminin', label:'Féminin' }];
const SURFACES = [{ value:'', label:'Non précisé' },{ value:'beach', label:'🏖️ Beach' },{ value:'green', label:'🌿 Green' },{ value:'gymnase', label:'🏛️ Gymnase' }];

const AV_COLORS = ['av-blue','av-pink','av-green','av-orange','av-purple','av-teal','av-red','av-indigo'];
function avatarColor(id) {
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(firstName, lastName) {
  const f = (firstName || '').trim(); const l = (lastName || '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  return f ? f.slice(0, 2).toUpperCase() : '?';
}

function getJoinBlockReason(user, tournament, team) {
  const totalOccupied = team.members.length + (team.externalMembers?.length || 0);
  if (!user.gender) return 'Genre non défini sur votre profil';
  if (totalOccupied >= team.maxSize) return 'Équipe complète';
  if (tournament.gender === 'masculin' && user.gender !== 'masculin') return 'Tournoi masculin uniquement';
  if (tournament.gender === 'feminin'  && user.gender !== 'feminin')  return 'Tournoi féminin uniquement';
  if (tournament.gender === 'mix') {
    const newSize = team.members.length + 1;
    if (newSize === team.maxSize) {
      const hasFemale = team.memberDetails.some(m => m.gender === 'feminin') || user.gender === 'feminin';
      if (!hasFemale) return 'Dernière place réservée à une femme (équipe mixte)';
    }
  }
  return null;
}

function ExternalMembersEditor({ slots, onChange, maxSlots, label }) {
  const addSlot = () => onChange([...slots, { name: '' }]);
  const removeSlot = (i) => onChange(slots.filter((_, j) => j !== i));
  const updateName = (i, name) => {
    const copy = [...slots]; copy[i] = { name }; onChange(copy);
  };
  return (
    <div style={{ marginBottom: 8 }}>
      {slots.map((slot, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <div className="av-circle av-sm" style={{ background: '#E8EEF8', border: '1.5px dashed #AAB8CC', flexShrink: 0, fontSize: 14 }}>👤</div>
          <input
            value={slot.name}
            onChange={e => updateName(i, e.target.value)}
            placeholder={`Nom (optionnel)`}
            style={{ flex: 1, padding: '5px 10px', fontSize: 13 }}
          />
          <button type="button" className="button-danger btn-sm" style={{ flexShrink: 0 }}
            onClick={() => removeSlot(i)}>✕</button>
        </div>
      ))}
      {slots.length < maxSlots && (
        <button type="button" className="button-secondary btn-sm"
          onClick={addSlot} style={{ marginTop: 2 }}>
          + {label || 'Ajouter un joueur externe'}
        </button>
      )}
    </div>
  );
}

function calDate(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-');
  const [h, min]  = (timeStr || '10:00').split(':');
  return `${y}${m}${d}T${h.padStart(2,'0')}${(min||'00').padStart(2,'0')}00`;
}
function googleCalUrl(t) {
  const start = calDate(t.date, t.time);
  const endMs  = new Date(`${t.date}T${t.time||'10:00'}:00`).getTime() + 8*3600000;
  const endD   = new Date(endMs);
  const end    = calDate(endD.toISOString().split('T')[0], endD.toTimeString().slice(0,5));
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: t.name,
    dates: `${start}/${end}`,
    location: t.location || '',
    details: [t.playerFormat, GENDER_LABELS[t.gender], SURFACE_LABELS[t.surface]].filter(Boolean).join(' · ')
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
function buildICS(t) {
  const start = calDate(t.date, t.time);
  const endMs  = new Date(`${t.date}T${t.time||'10:00'}:00`).getTime() + 8*3600000;
  const endD   = new Date(endMs);
  const end    = calDate(endD.toISOString().split('T')[0], endD.toTimeString().slice(0,5));
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tournoi Volley//FR',
    'BEGIN:VEVENT',`DTSTART:${start}`,`DTEND:${end}`,
    `SUMMARY:${t.name}`,`LOCATION:${(t.location||'').replace(/\n/g,'\\n')}`,
    `DESCRIPTION:${[t.playerFormat,GENDER_LABELS[t.gender]].filter(Boolean).join(' - ')}`,
    'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
function downloadICS(t) {
  const blob = new Blob([buildICS(t)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t.name.replace(/\s+/g,'-')}.ics`;
  a.click(); URL.revokeObjectURL(a.href);
}

function TournamentDetail({ user }) {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [tournament, setTournament]   = useState(null);
  const [teams, setTeams]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamExternals, setNewTeamExternals] = useState([]);
  const [newTeamVisibility, setNewTeamVisibility] = useState('open');
  const [pendingMembers, setPendingMembers] = useState([]); // users to add after creation
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  // Edit team modal
  const [editingTeam, setEditingTeam]         = useState(null);
  const [editTeamName, setEditTeamName]       = useState('');
  const [editTeamVis, setEditTeamVis]         = useState('open');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQ, setSearchQ]           = useState('');
  const [levelFilters, setLevelFilters] = useState(new Set());
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [resultsModalTeam, setResultsModalTeam] = useState(null);

  // Edit tournament
  const [editingTournament, setEditingTournament] = useState(false);
  const [editName, setEditName]         = useState('');
  const [editDate, setEditDate]         = useState('');
  const [editTime, setEditTime]         = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editFormat, setEditFormat]     = useState('');
  const [editGender, setEditGender]     = useState('');
  const [editSurface, setEditSurface]   = useState('');
  const [editPrice, setEditPrice]       = useState('');
  const [editSuggestions, setEditSuggestions]   = useState([]);
  const [editShowSugg, setEditShowSugg]         = useState(false);
  const [editLoadingAddr, setEditLoadingAddr]   = useState(false);
  const editSearchTimeout = useRef(null);
  const editSuggRef       = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, teamsRes] = await Promise.all([
        axios.get(`${API_URL}/api/tournaments/${tournamentId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/tournaments/${tournamentId}/teams`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTournament(tRes.data);
      setTeams(teamsRes.data);
    } catch {
      setError('Erreur lors du chargement du tournoi');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { containerRef: pageRef, onTouchStart: ptrStart, onTouchEnd: ptrEnd, refreshing: ptrRefreshing } = usePullToRefresh(fetchData);

  // Sync edit modal with latest team data after fetchData
  useEffect(() => {
    if (editingTeam) {
      const updated = teams.find(t => t.id === editingTeam.id);
      if (updated) setEditingTeam(updated);
    }
  }, [teams]); // eslint-disable-line

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setActionLoading(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams`,
        { name: newTeamName, externalMembers: newTeamExternals, visibility: newTeamVisibility },
        { headers: { Authorization: `Bearer ${token}` } });
      // Add pending members one by one
      for (const m of pendingMembers) {
        try {
          await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${res.data.teamId}/add-member`,
            { userId: m.id }, { headers: { Authorization: `Bearer ${token}` } });
        } catch { /* ignore individual errors */ }
      }
      setNewTeamName(''); setNewTeamExternals([]); setNewTeamVisibility('open'); setPendingMembers([]); setShowCreateTeam(false); fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally { setActionLoading(false); }
  };

  const handleJoinTeam = async (teamId, externalMembers = []) => {
    setActionLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/join`,
        { externalMembers },
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleRequestJoin = async (teamId) => {
    setActionLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/request-join`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleLeaveTeam = async (teamId) => {
    setActionLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/leave`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`Supprimer l'équipe "${team.name}" ?`)) return;
    setActionLoading(true); setError('');
    try {
      await axios.delete(`${API_URL}/api/tournaments/${tournamentId}/teams/${team.id}`,
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const openEditTeam = (team) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamVis(team.visibility || 'open');
  };

  const handleSaveEditTeam = async () => {
    if (!editTeamName.trim() || !editingTeam) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_URL}/api/tournaments/${tournamentId}/teams/${editingTeam.id}`,
        { name: editTeamName.trim(), visibility: editTeamVis },
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      setEditingTeam(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleAddMember = async (teamId, userId) => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/add-member`,
        { userId }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleKickMember = async (teamId, userId) => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/members/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleAddExternal = async (teamId, name) => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/add-external`,
        { name }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const handleRemoveExternal = async (teamId, extId) => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/external/${extId}`,
        { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  const startEditTournament = (t) => {
    setEditName(t.name); setEditDate(t.date); setEditTime(t.time || '');
    setEditLocation(t.location); setEditFormat(t.playerFormat || t.format || '');
    setEditGender(t.gender || ''); setEditSurface(t.surface || '');
    setEditPrice(t.price || '');
    setEditSuggestions([]); setEditShowSugg(false);
    setEditingTournament(true);
  };

  const handleEditLocationInput = (val) => {
    setEditLocation(val); setEditShowSugg(false);
    if (editSearchTimeout.current) clearTimeout(editSearchTimeout.current);
    if (val.length < 3) { setEditSuggestions([]); setEditLoadingAddr(false); return; }
    setEditLoadingAddr(true);
    editSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'fr' } }
        );
        const data = await res.json();
        setEditSuggestions(data); setEditShowSugg(data.length > 0);
      } catch { setEditSuggestions([]); } finally { setEditLoadingAddr(false); }
    }, 500);
  };

  const handleSaveTournament = async (e) => {
    e.preventDefault();
    setActionLoading(true); setError('');
    try {
      await axios.put(`${API_URL}/api/tournaments/${tournamentId}`,
        { name: editName.trim(), date: editDate, time: editTime, location: editLocation.trim(),
          price: editPrice, playerFormat: editFormat, gender: editGender, surface: editSurface || null },
        { headers: { Authorization: `Bearer ${token}` } });
      setEditingTournament(false); fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la modification');
    } finally { setActionLoading(false); }
  };

  if (loading) return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
          <div className="header-row"><div className="header-title">Chargement…</div></div>
        </div>
      </div>
      <div className="page-content"></div>
    </>
  );
  if (!tournament) return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
          <div className="header-row"><div className="header-title">Tournoi introuvable</div></div>
        </div>
      </div>
    </>
  );

  const myTeam = teams.find(t => t.members.includes(user.id));
  const isCreator = tournament.creator === user.id;
  const isPast = tournament.date < new Date().toISOString().split('T')[0];

  const dateStr = tournament.date
    ? new Date(tournament.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  const LEVEL_KEYS  = ['loisir','departemental','regional','national','pro'];
  const LEVEL_MAP   = { loisir:'Loisir', departemental:'Départemental', regional:'Régional', national:'National', pro:'Pro' };
  const LEVEL_CHIPS = ['Loisir','Départ.','Régional','National','Pro'];

  const toggleLevel = (lv) => setLevelFilters(prev => {
    const next = new Set(prev);
    if (next.has(lv)) next.delete(lv); else next.add(lv);
    return next;
  });

  const filteredTeams = teams.filter(t => {
    const q = searchQ.toLowerCase();
    const nameMatch = !searchQ ||
      t.name.toLowerCase().includes(q) ||
      (t.memberDetails || []).some(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q));
    const levelMatch = levelFilters.size === 0 || Array.from(levelFilters).some(
      lv => (t.averageLevelLabel || '').toLowerCase() === (LEVEL_MAP[lv] || '').toLowerCase()
    );
    return nameMatch && levelMatch;
  });

  const myFilteredTeam = filteredTeams.find(t => t.members.includes(user.id));
  const otherTeams = filteredTeams.filter(t => !t.members.includes(user.id));

  const maxExternalsCreate = Math.max(0, (tournament.teamSize || 4) - 1);

  return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
          <div className="header-row">
            <div style={{ minWidth:0 }}>
              <div className="header-title">{tournament.name}</div>
              <div className="header-subtitle">{teams.length} équipe{teams.length !== 1 ? 's' : ''} inscrite{teams.length !== 1 ? 's' : ''}</div>
            </div>
            {isCreator && !editingTournament && (
              <button style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:8, padding:'6px 12px', fontSize:13, fontWeight:600, flexShrink:0 }}
                onClick={() => startEditTournament(tournament)}>
                ✏️ Modifier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editingTournament ? (
        <div style={{ flexShrink:0, padding:'8px 12px 0' }}>
          <form onSubmit={handleSaveTournament}>
            <div className="form-group">
              <label>Nom du tournoi</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Horaire</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} required />
              </div>
            </div>
            <div className="form-group" ref={editSuggRef} style={{ position:'relative' }}>
              <label>Lieu{editLoadingAddr && <span style={{ fontSize:11, color:'#90A0B0', marginLeft:6 }}>Recherche…</span>}</label>
              <input value={editLocation} onChange={e => handleEditLocationInput(e.target.value)} autoComplete="off" required />
              {editShowSugg && editSuggestions.length > 0 && (
                <ul className="address-suggestions">
                  {editSuggestions.map(s => (
                    <li key={s.place_id} className="address-suggestion-item"
                      onMouseDown={() => { setEditLocation(s.display_name); setEditShowSugg(false); }}>
                      <span className="suggestion-icon">📍</span>{s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-group">
              <label>Format</label>
              <div className="format-picker">
                {FORMATS.map(f => (
                  <button key={f} type="button"
                    className={`format-option ${editFormat === f ? 'selected' : ''}`}
                    onClick={() => setEditFormat(f)}>
                    <span className="format-option-label">{f}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Catégorie</label>
              <div className="gender-picker">
                {GENDERS.map(g => (
                  <button key={g.value} type="button"
                    className={`gender-option-pill ${editGender === g.value ? 'selected' : ''}`}
                    onClick={() => setEditGender(g.value)}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group">
                <label>Surface</label>
                <select value={editSurface} onChange={e => setEditSurface(e.target.value)}>
                  {SURFACES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Prix (€)</label>
                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  placeholder="0 = gratuit" min="0" step="0.5" />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <button type="submit" disabled={actionLoading}>{actionLoading ? 'Sauvegarde…' : 'Sauvegarder'}</button>
              <button type="button" className="button-secondary" onClick={() => setEditingTournament(false)}>Annuler</button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: '8px 12px 0' }}>
          <div className="tournament-info-grid" style={{ marginBottom: 8, gridTemplateColumns: '1fr 1fr auto' }}>
            <div className="info-cell">
              <span className="info-label">📅 Date</span>
              <span className="info-value">{dateStr}</span>
            </div>
            <div className="info-cell">
              <span className="info-label">🕐 Heure</span>
              <span className="info-value">{tournament.time}</span>
            </div>
            <div className="info-cell" style={{ position:'relative', overflow:'visible' }}>
              <span className="info-label">📅 Calendrier</span>
              <button className="button-secondary btn-sm" onClick={() => setShowCalendar(v => !v)} style={{ fontSize:11 }}>
                + Ajouter
              </button>
              {showCalendar && (
                <div style={{ position:'absolute', top:'100%', right:0, marginTop:4, background:'#fff',
                  border:'1px solid #E0E8F4', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)',
                  zIndex:100, minWidth:180, overflow:'hidden' }}>
                  <a href={googleCalUrl(tournament)} target="_blank" rel="noreferrer"
                    style={{ display:'block', padding:'10px 14px', fontSize:13, color:'#1565C0', textDecoration:'none', borderBottom:'1px solid #F0F4FF' }}
                    onClick={() => setShowCalendar(false)}>
                    🗓 Google Calendar
                  </a>
                  <button style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', fontSize:13, color:'#445', background:'none', border:'none', cursor:'pointer' }}
                    onClick={() => { downloadICS(tournament); setShowCalendar(false); }}>
                    📥 Apple / Outlook (.ics)
                  </button>
                </div>
              )}
            </div>
            <div className="info-cell" style={{ gridColumn: '1/-1' }}>
              <span className="info-label">📍 Lieu</span>
              <span className="info-value">{tournament.location}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:'6px', marginBottom: 8, flexWrap:'wrap' }}>
            <span className="badge badge-blue">{tournament.playerFormat || tournament.format}</span>
            <span className={`badge ${GENDER_BADGE[tournament.gender] || 'badge-grey'}`}>
              {GENDER_LABELS[tournament.gender] || tournament.gender}
            </span>
            {tournament.surface && (
              <span className={`badge ${SURFACE_BADGE[tournament.surface] || 'badge-grey'}`}>
                {SURFACE_LABELS[tournament.surface]}
              </span>
            )}
            {tournament.price > 0
              ? <span className="badge badge-yellow">{tournament.price}€</span>
              : <span className="badge badge-green">Gratuit</span>}
          </div>
          {tournament.externalUrl && (
            <a href={tournament.externalUrl} target="_blank" rel="noreferrer"
              className="button-secondary btn-sm"
              style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:8, textDecoration:'none' }}>
              🔗 S'inscrire sur le site du tournoi
            </a>
          )}
        </div>
      )}

      <div style={{ flexShrink: 0, padding: '0 12px 8px' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div className="search-bar" style={{ flex:1, margin:0 }}>
            <span className="search-bar-icon">🔍</span>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Équipe ou joueur…" />
            {searchQ && <button className="search-clear" onClick={() => setSearchQ('')}>✕</button>}
          </div>
          <button className={`filter-pill${levelFilters.size > 0 ? ' filter-pill-active' : ''}`}
            onClick={() => setFiltersOpen(v => !v)} style={{ flexShrink:0 }}>
            🎚 Filtres
            {levelFilters.size > 0 && <span className="filter-pill-badge">{levelFilters.size}</span>}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="filter-drawer-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="filter-drawer" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:12 }}>Niveau de jeu</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              <button className={`chip${levelFilters.size === 0 ? ' active' : ''}`}
                onClick={() => { setLevelFilters(new Set()); setFiltersOpen(false); }}>
                Tous
              </button>
              {LEVEL_KEYS.map((lv, i) => (
                <button key={lv} className={`chip${levelFilters.has(lv) ? ' active' : ''}`}
                  onClick={() => toggleLevel(lv)}>
                  {LEVEL_CHIPS[i]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="page-content" ref={pageRef} onTouchStart={ptrStart} onTouchEnd={ptrEnd}>
        {ptrRefreshing && (
          <div className="ptr-indicator"><div className="ptr-spinner" /><span>Actualisation…</span></div>
        )}
        {error && <div className="message error">{error}</div>}
        {!user.gender && (
          <div className="message info">
            Genre non défini sur votre profil — vous ne pouvez pas rejoindre d'équipe.
          </div>
        )}

        {/* Create team button / form */}
        {!myTeam && !showCreateTeam && user.gender && (
          <button style={{ width:'100%', marginBottom:12 }} onClick={() => setShowCreateTeam(true)}>
            + Créer une équipe
          </button>
        )}

        {showCreateTeam && (
          <div className="create-team-form">
            <form onSubmit={handleCreateTeam}>
              <div className="form-group">
                <label>Nom de votre équipe</label>
                <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                  placeholder="ex: Les Volcans" required autoFocus />
              </div>

              <div className="form-group">
                <label>Qui peut rejoindre ?</label>
                <div className="vis-toggle">
                  <button type="button"
                    className={`vis-pill${newTeamVisibility === 'open' ? ' vis-active' : ''}`}
                    onClick={() => setNewTeamVisibility('open')}>
                    🌍 Ouvert à tous
                  </button>
                  <button type="button"
                    className={`vis-pill${newTeamVisibility === 'group_only' ? ' vis-active' : ''}`}
                    onClick={() => setNewTeamVisibility('group_only')}>
                    👥 Mes groupes uniquement
                  </button>
                </div>
              </div>

              {/* Player search — add app members directly */}
              <div className="form-group">
                <label>Ajouter des joueurs</label>
                {pendingMembers.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {pendingMembers.map(m => (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', gap:5, background:'#EEF4FF', borderRadius:20, padding:'3px 10px 3px 5px' }}>
                        <div className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`} style={{ width:22, height:22, fontSize:10 }}>
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials(m.firstName, m.lastName)}
                        </div>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--primary)' }}>{m.firstName}</span>
                        <button type="button" style={{ background:'none', border:'none', cursor:'pointer', color:'#90A0B0', fontSize:13, padding:0, lineHeight:1, marginLeft:2 }}
                          onClick={() => setPendingMembers(prev => prev.filter(x => x.id !== m.id))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <PlayerSearch
                  token={token}
                  excludeIds={[user.id, ...pendingMembers.map(m => m.id)]}
                  onSelect={(u) => setPendingMembers(prev => [...prev, u])}
                  placeholder="Rechercher par prénom ou nom…"
                />
              </div>

              {maxExternalsCreate > 0 && (
                <div className="form-group">
                  <label>Joueurs externes (sans compte)</label>
                  <p style={{ fontSize: 12, color: '#90A0B0', margin: '0 0 8px' }}>
                    Réservez des places pour des joueurs sans compte. Ils pourront les réclamer plus tard.
                  </p>
                  <ExternalMembersEditor
                    slots={newTeamExternals}
                    onChange={setNewTeamExternals}
                    maxSlots={maxExternalsCreate}
                    label="Ajouter un joueur externe"
                  />
                </div>
              )}

              <div style={{ display:'flex', gap:'8px' }}>
                <button type="submit" disabled={actionLoading}>
                  {actionLoading ? 'Création…' : `Créer (${1 + newTeamExternals.length} place${1+newTeamExternals.length>1?'s':''})`}
                </button>
                <button type="button" className="button-secondary"
                  onClick={() => { setShowCreateTeam(false); setNewTeamName(''); setNewTeamExternals([]); setNewTeamVisibility('open'); setPendingMembers([]); }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {myFilteredTeam && (
          <>
            <div className="section-label" style={{ color:'var(--primary)' }}>Mon équipe</div>
            <TeamCard
              team={myFilteredTeam}
              isMyTeam={true}
              user={user}
              tournament={tournament}
              onJoin={handleJoinTeam}
              onRequestJoin={handleRequestJoin}
              onLeave={handleLeaveTeam}
              onDelete={handleDeleteTeam}
              onEdit={openEditTeam}
              onRemoveExternal={handleRemoveExternal}
              actionLoading={actionLoading}
              myTeam={myTeam}
              isPast={isPast}
              onResultsClick={() => setResultsModalTeam(myFilteredTeam)}
              onNavigateProfile={(id) => navigate(`/profil/${id}`)}
            />
          </>
        )}

        {otherTeams.length > 0 && (
          <>
            <div className="section-label">Autres équipes ({otherTeams.length})</div>
            {otherTeams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                isMyTeam={false}
                user={user}
                tournament={tournament}
                onJoin={handleJoinTeam}
                onRequestJoin={handleRequestJoin}
                onLeave={handleLeaveTeam}
                onDelete={handleDeleteTeam}
                onEdit={openEditTeam}
                onRemoveExternal={handleRemoveExternal}
                actionLoading={actionLoading}
                myTeam={myTeam}
                isPast={isPast}
                onNavigateProfile={(id) => navigate(`/profil/${id}`)}
              />
            ))}
          </>
        )}

        {filteredTeams.length === 0 && teams.length > 0 && (
          <div className="empty-state" style={{ padding:'30px 0' }}>
            <div className="empty-icon">🔍</div>
            <p className="empty-text">Aucune équipe correspondante</p>
          </div>
        )}

        {teams.length === 0 && (
          <div className="empty-state" style={{ padding:'30px 0' }}>
            <div className="empty-icon">🏐</div>
            <p className="empty-text">Aucune équipe pour le moment</p>
            <p style={{ fontSize:12, color:'#B0C0D0', marginTop:6 }}>Soyez le premier !</p>
          </div>
        )}
      </div>

      {/* ── Results modal ── */}
      {resultsModalTeam && tournament && (
        <ResultsModal
          tournament={tournament}
          team={resultsModalTeam}
          token={token}
          onClose={(saved) => { setResultsModalTeam(null); if (saved) fetchData(); }}
        />
      )}

      {/* ── Edit team modal ── */}
      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          name={editTeamName}
          setName={setEditTeamName}
          visibility={editTeamVis}
          setVisibility={setEditTeamVis}
          onSave={handleSaveEditTeam}
          onClose={() => setEditingTeam(null)}
          onAddMember={(userId) => handleAddMember(editingTeam.id, userId)}
          onAddExternal={(name) => handleAddExternal(editingTeam.id, name)}
          onKickMember={(userId) => handleKickMember(editingTeam.id, userId)}
          onRemoveExternal={(extId) => handleRemoveExternal(editingTeam.id, extId)}
          actionLoading={actionLoading}
          user={user}
          token={token}
        />
      )}
    </>
  );
}

function PlayerSearch({ token, onSelect, excludeIds = [], placeholder }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const search = (val) => {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/users/search?q=${encodeURIComponent(val.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } });
        setResults(res.data.filter(u => !excludeIds.includes(u.id)));
      } catch { setResults([]); } finally { setLoading(false); }
    }, 300);
  };

  const handleSelect = (u) => { onSelect(u); setQ(''); setResults([]); };

  return (
    <div>
      <div className="player-search-wrap">
        <span style={{ fontSize:14, marginLeft:2, color:'#90A0B0' }}>🔍</span>
        <input value={q} onChange={e => search(e.target.value)}
          placeholder={placeholder || 'Prénom ou nom…'}
          style={{ flex:1, border:'none', outline:'none', fontSize:13, background:'transparent' }} />
        {q && <button className="search-clear" style={{ position:'static' }}
          onClick={() => { setQ(''); setResults([]); }}>✕</button>}
      </div>
      {loading && <div style={{ fontSize:12, color:'#90A0B0', padding:'4px 0' }}>Recherche…</div>}
      {results.length > 0 && (
        <div className="player-search-results">
          {results.map(u => (
            <div key={u.id} className="player-search-item" onClick={() => handleSelect(u)}>
              <div className={`av-circle av-sm ${!u.avatarUrl ? avatarColor(u.id) : ''}`} style={{ flexShrink:0 }}>
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : initials(u.firstName, u.lastName)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#334' }}>
                  {u.firstName} {u.lastName}
                  {u.isGroupMember && <span style={{ fontSize:10, color:'var(--primary)', fontWeight:700, marginLeft:4 }}>· Groupe</span>}
                </div>
                {u.level && <div style={{ fontSize:11, color:'#90A0B0' }}>{u.level}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditTeamModal({ team, name, setName, visibility, setVisibility, onSave, onClose,
  onAddMember, onAddExternal, onKickMember, onRemoveExternal, actionLoading, user, token }) {

  const [replacingExtId, setReplacingExtId] = useState(null);
  const [extName, setExtName]               = useState('');
  const externals   = team.externalMembers || [];
  const totalOccupied = team.members.length + externals.length;
  const spotsLeft   = team.maxSize - totalOccupied;

  const handleReplaceExternal = async (extId, newUserId) => {
    await onRemoveExternal(extId);
    await onAddMember(newUserId);
    setReplacingExtId(null);
  };

  return (
    <div className="team-edit-overlay" onClick={onClose}>
      <div className="team-edit-sheet" onClick={e => e.stopPropagation()}>
        <div className="team-edit-handle" />
        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', marginBottom:16 }}>Modifier l'équipe</div>

        {/* Name */}
        <div className="form-group">
          <label>Nom de l'équipe</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Visibility */}
        <div className="form-group">
          <label>Qui peut rejoindre ?</label>
          <div className="vis-toggle">
            <button type="button" className={`vis-pill${visibility === 'open' ? ' vis-active' : ''}`}
              onClick={() => setVisibility('open')}>🌍 Ouvert à tous</button>
            <button type="button" className={`vis-pill${visibility === 'group_only' ? ' vis-active' : ''}`}
              onClick={() => setVisibility('group_only')}>👥 Mes groupes uniquement</button>
          </div>
        </div>

        {/* Current members */}
        <div className="form-group">
          <label>Membres ({totalOccupied}/{team.maxSize})</label>
          {team.memberDetails.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`} style={{ flexShrink:0 }}>
                {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials(m.firstName, m.lastName)}
              </div>
              <span style={{ flex:1, fontSize:13, fontWeight:600 }}>
                {m.firstName} {m.lastName}
                {m.id === user.id && <span style={{ fontSize:10, color:'var(--primary)', marginLeft:4 }}>Moi</span>}
                {m.id === team.creator && <span style={{ fontSize:10, color:'#90A0B0', marginLeft:4 }}>Créateur</span>}
              </span>
              {m.id !== user.id && m.id !== team.creator && (
                <button className="button-danger btn-sm" style={{ padding:'2px 8px' }}
                  disabled={actionLoading} onClick={() => onKickMember(m.id)}>✕</button>
              )}
            </div>
          ))}

          {/* External members */}
          {externals.map(ext => (
            <div key={ext.id} style={{ marginBottom:6 }}>
              {replacingExtId === ext.id ? (
                <div>
                  <div style={{ fontSize:12, color:'#607080', marginBottom:6 }}>
                    Remplacer <em>{ext.name || 'joueur externe'}</em> par :
                  </div>
                  <PlayerSearch
                    token={token}
                    excludeIds={team.members}
                    onSelect={(u) => handleReplaceExternal(ext.id, u.id)}
                    placeholder="Rechercher un joueur…"
                  />
                  <button type="button" className="button-secondary btn-sm" style={{ marginTop:4 }}
                    onClick={() => setReplacingExtId(null)}>Annuler</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div className="av-circle av-sm" style={{ background:'#E8EEF8', border:'1.5px dashed #AAB8CC', fontSize:14, flexShrink:0 }}>👤</div>
                  <span style={{ flex:1, fontSize:13, color:'#90A0B0', fontStyle:'italic' }}>{ext.name || 'Joueur externe'}</span>
                  <button className="button-secondary btn-sm" style={{ fontSize:11 }}
                    onClick={() => setReplacingExtId(ext.id)}>Remplacer</button>
                  <button className="button-danger btn-sm" style={{ padding:'2px 8px' }}
                    disabled={actionLoading} onClick={() => onRemoveExternal(ext.id)}>✕</button>
                </div>
              )}
            </div>
          ))}

          {/* Add member search */}
          {spotsLeft > 0 && !replacingExtId && (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#90A0B0', textTransform:'uppercase', marginBottom:6 }}>
                Ajouter un joueur ({spotsLeft} place{spotsLeft > 1 ? 's' : ''})
              </div>
              <PlayerSearch
                token={token}
                excludeIds={team.members}
                onSelect={(u) => onAddMember(u.id)}
                placeholder="Rechercher par prénom ou nom…"
              />
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
                <div className="av-circle av-sm" style={{ background:'#E8EEF8', border:'1.5px dashed #AAB8CC', fontSize:14, flexShrink:0 }}>👤</div>
                <input
                  value={extName}
                  onChange={e => setExtName(e.target.value)}
                  placeholder="Joueur sans compte (prénom nom)"
                  style={{ flex:1, fontSize:13, padding:'6px 10px' }}
                  onKeyDown={e => { if (e.key === 'Enter' && extName.trim()) { onAddExternal(extName.trim()); setExtName(''); } }}
                />
                <button type="button" className="button-secondary btn-sm"
                  disabled={!extName.trim() || actionLoading}
                  onClick={() => { onAddExternal(extName.trim()); setExtName(''); }}>
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button disabled={actionLoading} onClick={onSave} style={{ flex:1 }}>
            {actionLoading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button className="button-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, isMyTeam, user, tournament, onJoin, onRequestJoin, onLeave, onDelete, onEdit,
  onRemoveExternal, actionLoading, myTeam, isPast, onResultsClick, onNavigateProfile }) {

  const [showJoinForm, setShowJoinForm] = useState(false);

  const isCreator     = team.creator === user.id;
  const externals     = team.externalMembers || [];
  const totalOccupied = team.members.length + externals.length;
  const isFull        = totalOccupied >= team.maxSize;
  const spotsLeft   = team.maxSize - totalOccupied;
  const blockReason = !isMyTeam && !myTeam ? getJoinBlockReason(user, tournament, team) : null;
  const canJoin     = !myTeam && !blockReason && !isPast;
  const hasRequested = !isMyTeam && (team.joinRequests || []).some(r => r.userId === user.id);

  const cancelJoin = () => { setShowJoinForm(false); };

  return (
    <div className={`team-card ${isMyTeam ? 'team-card-mine' : ''}`}>
      <div className="team-header">
        <h3>{team.name}</h3>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {team.visibility === 'group_only' && (
            <span className="vis-badge">👥 Groupes</span>
          )}
          <span className={`team-spots ${isFull ? 'full' : ''}`}>
            {isFull ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Members */}
      <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'8px' }}>
        {/* Real members */}
        {team.memberDetails.map(member => (
          <div key={member.id} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <div className={`av-circle av-sm ${!member.avatarUrl ? avatarColor(member.id) : ''}`}
              style={{ cursor:'pointer' }}
              onClick={() => onNavigateProfile?.(member.id)}>
              {member.avatarUrl
                ? <img src={member.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : initials(member.firstName, member.lastName)
              }
            </div>
            <span style={{ fontSize:12, color:'#445' }}>
              {member.firstName} {member.lastName}{member.id === user.id ? ' (moi)' : ''}
            </span>
          </div>
        ))}

        {/* External members */}
        {externals.map(ext => (
          <div key={ext.id} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <div className="av-circle av-sm" style={{ background:'#E8EEF8', border:'1.5px dashed #AAB8CC', fontSize:14, flexShrink:0 }}>👤</div>
            <span style={{ fontSize:12, color:'#90A0B0', fontStyle:'italic', flex:1 }}>
              {ext.name || 'Joueur externe'}
              {ext.reservedBy === user.id ? <span style={{ color:'#B0B8C8', fontSize:11 }}> (réservé par vous)</span> : ''}
            </span>
            {(ext.reservedBy === user.id || isCreator) && (
              <button className="button-danger btn-sm" disabled={actionLoading}
                style={{ padding:'2px 6px', fontSize:11, flexShrink:0 }}
                onClick={() => onRemoveExternal(team.id, ext.id)}>✕</button>
            )}
          </div>
        ))}

        {/* Empty spots */}
        {Array.from({ length: spotsLeft }).map((_, i) => (
          <div key={`e${i}`} className="member-chip empty">Place libre</div>
        ))}
      </div>

      {/* Level badge */}
      {team.averageLevelLabel && (
        <div style={{ marginBottom:'8px' }}>
          <span className={`badge level-${(team.averageLevelLabel || '').toLowerCase().replace(/é/g,'e')}`}
            style={{ fontSize:11 }}>
            Niveau moy. : {team.averageLevelLabel}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="team-actions" style={{ justifyContent:'flex-end' }}>
        {isMyTeam ? (
          <>
            {isPast && !team.results && (
              <button className="button-secondary btn-sm" onClick={onResultsClick}>
                📊 Résultats
              </button>
            )}
            <button className="button-secondary btn-sm" onClick={() => onEdit(team)}>Modifier</button>
            {isCreator
              ? <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => onDelete(team)}>Supprimer</button>
              : <button className="button-danger btn-sm" disabled={actionLoading} onClick={() => onLeave(team.id)}>Quitter</button>
            }
          </>
        ) : hasRequested ? (
          <button disabled style={{ opacity:0.6, cursor:'default', background:'#EEF2FB', color:'var(--primary)', border:'1px solid var(--border)', borderRadius:10, padding:'7px 14px', fontSize:13, fontWeight:700 }}>
            ✓ Demande envoyée
          </button>
        ) : canJoin ? (
          showJoinForm ? (
            <div style={{ width:'100%' }}>
              <p style={{ fontSize:12, color:'#445', fontWeight:600, marginBottom:8 }}>
                Envoyer une demande pour <strong>{team.name}</strong>
              </p>
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button disabled={actionLoading} onClick={() => { onRequestJoin(team.id); setShowJoinForm(false); }}>
                  Envoyer la demande
                </button>
                <button className="button-secondary" onClick={cancelJoin}>Annuler</button>
              </div>
            </div>
          ) : (
            <button disabled={actionLoading} onClick={() => setShowJoinForm(true)}>Rejoindre</button>
          )
        ) : !myTeam && blockReason ? (
          <p className="join-blocked-reason">{blockReason}</p>
        ) : null}
      </div>
    </div>
  );
}

export default TournamentDetail;
