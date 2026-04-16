import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };

function getJoinBlockReason(user, tournament, team) {
  if (!user.gender) return 'Genre non défini sur votre profil';
  if (team.members.length >= team.maxSize) return 'Équipe complète';
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

function TournamentDetail({ user }) {
  const { tournamentId } = useParams();
  const token = localStorage.getItem('token');

  const [tournament, setTournament]   = useState(null);
  const [teams, setTeams]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [renamingTeamId, setRenamingTeamId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQ, setSearchQ]         = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

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

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setActionLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams`,
        { name: newTeamName }, { headers: { Authorization: `Bearer ${token}` } });
      setNewTeamName(''); setShowCreateTeam(false); fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally { setActionLoading(false); }
  };

  const handleJoinTeam = async (teamId) => {
    setActionLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}/join`, {},
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

  const handleRenameTeam = async (e, teamId) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_URL}/api/tournaments/${tournamentId}/teams/${teamId}`,
        { name: renameValue.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setRenamingTeamId(null); fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setActionLoading(false); }
  };

  if (loading) return (
    <>
      <div className="app-header">
        <Link to="/nos-tournois" className="back-btn">← Tournois</Link>
        <div className="header-row"><div className="header-title">Chargement…</div></div>
      </div>
      <div className="page-content"></div>
    </>
  );
  if (!tournament) return (
    <>
      <div className="app-header">
        <Link to="/nos-tournois" className="back-btn">← Tournois</Link>
        <div className="header-row"><div className="header-title">Tournoi introuvable</div></div>
      </div>
    </>
  );

  const myTeam = teams.find(t => t.members.includes(user.id));

  const dateStr = tournament.date
    ? new Date(tournament.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  const LEVEL_LABELS = { loisir:'Loisir', departemental:'Départemental', regional:'Régional', national:'National', pro:'Pro' };
  const LEVEL_FILTERS = ['all','loisir','departemental','regional','national','pro'];
  const LEVEL_NAMES   = ['Tous', 'Loisir', 'Départ.', 'Régional', 'National', 'Pro'];

  // Filter teams
  const filteredTeams = teams.filter(t => {
    const nameMatch = !searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase());
    const levelMatch = levelFilter === 'all' || (t.averageLevelLabel || '').toLowerCase() === (LEVEL_LABELS[levelFilter] || '').toLowerCase();
    return nameMatch && levelMatch;
  });

  const myFilteredTeam  = filteredTeams.find(t => t.members.includes(user.id));
  const otherTeams = filteredTeams.filter(t => !t.members.includes(user.id));

  return (
    <>
      {/* Header */}
      <div className="app-header">
        <Link to="/nos-tournois" className="back-btn">← Tournois</Link>
        <div className="header-row">
          <div style={{ minWidth:0 }}>
            <div className="header-title">{tournament.name}</div>
            <div className="header-subtitle">{teams.length} équipe{teams.length !== 1 ? 's' : ''} inscrite{teams.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Tournament info (non-scrolling) */}
      <div style={{ flexShrink: 0, padding: '8px 12px 0' }}>
        <div className="tournament-info-grid" style={{ marginBottom: 8 }}>
          <div className="info-cell">
            <span className="info-label">📅 Date</span>
            <span className="info-value">{dateStr}</span>
          </div>
          <div className="info-cell">
            <span className="info-label">🕐 Heure</span>
            <span className="info-value">{tournament.time}</span>
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
      </div>

      {/* Search bar */}
      <div style={{ flexShrink: 0, padding: '0 12px' }}>
        <div className="search-bar">
          <span className="search-bar-icon">🔍</span>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Rechercher une équipe…"
          />
          {searchQ && (
            <button className="search-clear" onClick={() => setSearchQ('')}>✕</button>
          )}
        </div>
      </div>

      {/* Level filter chips */}
      <div className="chips-row">
        {LEVEL_FILTERS.map((lv, i) => (
          <div
            key={lv}
            className={`chip ${levelFilter === lv ? 'active' : ''}`}
            onClick={() => setLevelFilter(lv)}
          >
            {LEVEL_NAMES[i]}
          </div>
        ))}
      </div>

      {/* Scrollable teams */}
      <div className="page-content">
        {error && <div className="message error">{error}</div>}
        {!user.gender && (
          <div className="message info">
            Genre non défini sur votre profil — vous ne pouvez pas rejoindre d'équipe.
          </div>
        )}

        {/* Create team button / form */}
        {!myTeam && !showCreateTeam && user.gender && (
          <button style={{ width:'100%', marginBottom:12 }}
            onClick={() => setShowCreateTeam(true)}
          >
            + Créer une équipe
          </button>
        )}

        {showCreateTeam && (
          <div className="create-team-form">
            <form onSubmit={handleCreateTeam}>
              <div className="form-group">
                <label>Nom de votre équipe</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="ex: Les Volcans"
                  required
                  autoFocus
                />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button type="submit" disabled={actionLoading}>
                  {actionLoading ? 'Création…' : 'Créer et rejoindre'}
                </button>
                <button type="button" className="button-secondary"
                  onClick={() => { setShowCreateTeam(false); setNewTeamName(''); }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My team */}
        {myFilteredTeam && (
          <>
            <div className="section-label" style={{ color:'var(--primary)' }}>Mon équipe</div>
            <TeamCard
              team={myFilteredTeam}
              isMyTeam={true}
              user={user}
              tournament={tournament}
              renamingTeamId={renamingTeamId}
              renameValue={renameValue}
              setRenamingTeamId={setRenamingTeamId}
              setRenameValue={setRenameValue}
              onJoin={handleJoinTeam}
              onLeave={handleLeaveTeam}
              onDelete={handleDeleteTeam}
              onRename={handleRenameTeam}
              actionLoading={actionLoading}
              myTeam={myTeam}
            />
          </>
        )}

        {/* Other teams */}
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
                renamingTeamId={renamingTeamId}
                renameValue={renameValue}
                setRenamingTeamId={setRenamingTeamId}
                setRenameValue={setRenameValue}
                onJoin={handleJoinTeam}
                onLeave={handleLeaveTeam}
                onDelete={handleDeleteTeam}
                onRename={handleRenameTeam}
                actionLoading={actionLoading}
                myTeam={myTeam}
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

      {/* FAB — create team */}
      {!myTeam && !showCreateTeam && user.gender && (
        <button className="fab" onClick={() => setShowCreateTeam(true)}>+</button>
      )}
    </>
  );
}

function TeamCard({ team, isMyTeam, user, tournament, renamingTeamId, renameValue,
  setRenamingTeamId, setRenameValue, onJoin, onLeave, onDelete, onRename, actionLoading, myTeam }) {

  const isCreator   = team.creator === user.id;
  const isFull      = team.members.length >= team.maxSize;
  const spotsLeft   = team.maxSize - team.members.length;
  const blockReason = !isMyTeam && !myTeam ? getJoinBlockReason(user, tournament, team) : null;
  const canJoin     = !myTeam && !blockReason;

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

  return (
    <div className={`team-card ${isMyTeam ? 'team-card-mine' : ''}`}>
      {/* Rename form */}
      {renamingTeamId === team.id ? (
        <form onSubmit={(e) => onRename(e, team.id)} style={{ marginBottom:'10px' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
              required autoFocus style={{ flex:1, padding:'6px 10px', fontSize:14 }} />
            <button type="submit" disabled={actionLoading} className="btn-sm">OK</button>
            <button type="button" className="button-secondary btn-sm"
              onClick={() => setRenamingTeamId(null)}>✕</button>
          </div>
        </form>
      ) : (
        <div className="team-header">
          <h3>{team.name}</h3>
          <span className={`team-spots ${isFull ? 'full' : ''}`}>
            {isFull ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* Members with avatars */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
        {team.memberDetails.map(member => (
          <div key={member.id} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <div className={`av-circle av-sm ${!member.avatarUrl ? avatarColor(member.id) : ''}`}>
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
        {Array.from({ length: spotsLeft }).map((_, i) => (
          <div key={`e${i}`} className="member-chip empty">Place libre</div>
        ))}
      </div>

      {/* Level badge */}
      {team.averageLevelLabel && (
        <div style={{ marginBottom:'6px' }}>
          <span className={`badge level-${(team.averageLevelLabel || '').toLowerCase().replace('é','e').replace('é','e')}`}
            style={{ fontSize:11 }}>
            Niveau moy. : {team.averageLevelLabel}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="team-actions">
        {isMyTeam ? (
          <>
            {isCreator && (
              <>
                <button className="button-secondary btn-sm"
                  onClick={() => { setRenamingTeamId(team.id); setRenameValue(team.name); }}>
                  Renommer
                </button>
                <button className="button-danger btn-sm" disabled={actionLoading}
                  onClick={() => onDelete(team)}>
                  Supprimer
                </button>
              </>
            )}
            {!isCreator && (
              <button className="button-danger btn-sm" disabled={actionLoading}
                onClick={() => onLeave(team.id)}>
                Quitter
              </button>
            )}
          </>
        ) : canJoin ? (
          <button disabled={actionLoading} onClick={() => onJoin(team.id)}>Rejoindre</button>
        ) : !myTeam && blockReason ? (
          <p className="join-blocked-reason">{blockReason}</p>
        ) : null}
      </div>
    </div>
  );
}

export default TournamentDetail;
