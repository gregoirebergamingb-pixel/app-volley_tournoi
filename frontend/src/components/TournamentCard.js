import React from 'react';
import { Link } from 'react-router-dom';

const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };
const AV_COLORS = ['av-blue','av-pink','av-green','av-orange','av-purple','av-teal','av-red','av-indigo'];
const GROUP_COLORS = ['#1565C0','#E65100','#7B1FA2','#2E7D32','#C62828','#00695C','#283593','#AD1457'];

export function avatarColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
export function initials(firstName, lastName) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  return f ? f.slice(0, 2).toUpperCase() : '?';
}
export function groupColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}
export function daysUntilNum(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T12:00:00') - today) / 86400000);
}
export function daysUntil(dateStr) {
  const diff = daysUntilNum(dateStr);
  if (diff < 0)  return null;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff < 8)  return `Dans ${diff}j`;
  return null;
}
export function shortLocation(loc) {
  if (!loc) return '';
  const parts = loc.split(',').map(p => p.trim()).filter(Boolean);
  const clean = parts.filter(p => !/^france/i.test(p));
  return clean.slice(0, 3).join(', ');
}

const MAX_VISIBLE = 5;

function TeamSection({ teamName, memberDetails, externalMembers, filled, maxSize, isComplete }) {
  const visible  = (memberDetails || []).slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, (memberDetails || []).length - MAX_VISIBLE);
  const missing  = maxSize - filled;

  return (
    <div className="team-in-card">
      <div className="team-in-card-header">
        <span className="team-in-card-name">{teamName}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="team-in-card-avatars" style={{ flex: 1, minWidth: 0 }}>
          {visible.map(m => (
            <div key={m.id} className="team-avatar-with-name">
              <div className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials(m.firstName, m.lastName)
                }
              </div>
              <span className="team-avatar-firstname">{(m.firstName || '?').split(' ')[0]}</span>
            </div>
          ))}
          {(externalMembers || []).map((ext, i) => (
            <div key={ext.id || i} className="team-avatar-with-name">
              <div className="av-circle av-sm"
                style={{ background: '#E8EEF8', border: '1.5px dashed #AAB8CC', fontSize: 10, color: '#90A0B0', fontWeight: 700 }}>
                +1
              </div>
              <span className="team-avatar-firstname" style={{ color: '#90A0B0' }}>ext.</span>
            </div>
          ))}
          {overflow > 0 && (
            <div className="team-avatar-with-name">
              <div className="av-circle av-sm" style={{ background: '#E0E8F4', color: '#445', fontWeight: 700, fontSize: 10 }}>
                +{overflow}
              </div>
              <span className="team-avatar-firstname" style={{ color: '#90A0B0' }}>+{overflow}</span>
            </div>
          )}
        </div>
        <span className={`team-status-pill ${isComplete ? 'team-status-complete' : 'team-status-incomplete'}`}>
          {isComplete
            ? 'Équipe complète !'
            : `Manque ${missing} joueur${missing > 1 ? 's' : ''}`}
        </span>
      </div>
    </div>
  );
}

// Props:
//   tournament     — required
//   group          — optional: { id, name }
//   team           — optional: full team { name, members, memberDetails, maxSize }
//   myTeam         — optional: { name, members, memberDetails, externalMembers, maxSize }
//   showTeamStatus — show team section or warning (Dashboard)
//   teamCount      — optional: number
//   past           — boolean
//   isCreator      — boolean
//   onEdit, onDelete, actionLoading, onAddToGroup
function TournamentCard({
  tournament,
  group,
  team,
  myTeam,
  showTeamStatus,
  teamCount,
  past,
  isCreator,
  onEdit,
  onDelete,
  actionLoading,
  onAddToGroup,
}) {
  const countdown    = daysUntil(tournament.date);
  const genderLabel  = GENDER_LABELS[tournament.gender]   || '';
  const genderBadge  = GENDER_BADGE[tournament.gender]    || 'badge-grey';
  const surfaceLabel = SURFACE_LABELS[tournament.surface] || '';
  const surfaceBadge = SURFACE_BADGE[tournament.surface]  || '';
  const formatLabel  = tournament.playerFormat || tournament.format || '';
  const dateStr = tournament.date
    ? new Date(tournament.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  const hasFullTeam  = !!(team && team.memberDetails);
  const fullFilled   = hasFullTeam ? team.members.length : 0;
  const fullMaxSize  = hasFullTeam ? team.maxSize : 0;
  const fullComplete = hasFullTeam && fullFilled >= fullMaxSize;

  const myTeamFilled   = (myTeam?.members?.length || 0) + (myTeam?.externalMembers?.length || 0);
  const myTeamComplete = !!(myTeam && myTeamFilled >= myTeam.maxSize);

  const showAddToGroup = !isCreator && !!onAddToGroup;
  const showTeamCount  = !isCreator && teamCount !== undefined;
  const hasFooter      = isCreator || showAddToGroup || showTeamCount;

  return (
    <Link to={`/tournaments/${tournament.id}`} className="team-entry-link">
      <div className="t-card" style={{
        ...(past ? { opacity: 0.6 } : {}),
        borderTopColor: group ? groupColor(group.id) : 'var(--primary)',
      }}>

        {/* Group source dot */}
        {group && (
          <div className="group-source">
            <div className="group-source-dot" style={{ background: groupColor(group.id) }}></div>
            {group.name}
          </div>
        )}

        {/* Main info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-card-name">{tournament.name}</div>
            <div className="t-card-meta">📅 {dateStr} · {tournament.time}</div>
            <div className="t-card-meta">📍 {shortLocation(tournament.location)}</div>
            <div className="t-card-badges">
              {formatLabel  && <span className="badge badge-blue">{formatLabel}</span>}
              {genderLabel  && <span className={`badge ${genderBadge}`}>{genderLabel}</span>}
              {surfaceLabel && <span className={`badge ${surfaceBadge}`}>{surfaceLabel}</span>}
              {tournament.price > 0
                ? <span className="badge badge-yellow">{tournament.price}€</span>
                : <span className="badge badge-green">Gratuit</span>}
            </div>
          </div>
          {past
            ? <span className="badge badge-grey" style={{ flexShrink: 0 }}>Terminé</span>
            : countdown && <span className="countdown">{countdown}</span>
          }
        </div>

        {/* Full team section (team prop avec memberDetails) */}
        {hasFullTeam && (
          <TeamSection
            teamName={team.name}
            memberDetails={team.memberDetails}
            externalMembers={[]}
            filled={fullFilled}
            maxSize={fullMaxSize}
            isComplete={fullComplete}
          />
        )}

        {/* Mon équipe section (myTeam prop) */}
        {showTeamStatus && !hasFullTeam && myTeam && (
          <TeamSection
            teamName={myTeam.name}
            memberDetails={myTeam.memberDetails}
            externalMembers={myTeam.externalMembers}
            filled={myTeamFilled}
            maxSize={myTeam.maxSize}
            isComplete={myTeamComplete}
          />
        )}

        {/* Avertissement : pas d'équipe */}
        {showTeamStatus && !hasFullTeam && !myTeam && !past && (
          <div className="my-team-indicator warn">
            <span style={{ fontSize: 12 }}>⚠️</span>
            <span className="my-team-indicator-label">Tu n'es pas encore inscrit dans une équipe</span>
          </div>
        )}

        {/* Footer */}
        {hasFooter && (
          <div className="t-card-footer">
            {isCreator ? (
              <div style={{ display: 'flex', gap: 6 }}
                onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                <button className="button-secondary btn-sm"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(tournament); }}>
                  Modifier
                </button>
                <button className="button-danger btn-sm" disabled={actionLoading}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(tournament); }}>
                  Supprimer
                </button>
              </div>
            ) : (
              <>
                {showAddToGroup && (
                  <button className="button-secondary btn-sm" style={{ fontSize: 11 }}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onAddToGroup(tournament); }}>
                    + Mon groupe
                  </button>
                )}
                {showTeamCount && (
                  <span style={{ fontSize: 11, color: '#90A0B0', marginLeft: 'auto' }}>
                    {teamCount} équipe{teamCount !== 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default TournamentCard;
