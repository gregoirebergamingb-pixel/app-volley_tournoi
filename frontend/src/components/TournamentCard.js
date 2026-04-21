import React from 'react';
import { Link } from 'react-router-dom';

const GENDER_LABELS  = { mix: 'Mixte', masculin: 'Masculin', feminin: 'Féminin' };
const GENDER_BADGE   = { mix: 'badge-purple', masculin: 'badge-orange', feminin: 'badge-teal' };
const SURFACE_LABELS = { green: '🌿 Green', beach: '🏖️ Beach', gymnase: '🏛️ Gymnase' };
const SURFACE_BADGE  = { green: 'badge-green', beach: 'badge-yellow', gymnase: 'badge-purple' };
const AV_COLORS = ['av-blue','av-pink','av-green','av-orange','av-purple','av-teal','av-red','av-indigo'];
const GROUP_COLORS = ['#1565C0','#E65100','#7B1FA2','#2E7D32','#C62828','#00695C','#283593','#AD1457'];

function avatarColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(firstName, lastName) {
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

const MAX_VISIBLE = 4;

// Props:
//   tournament     — required: { id, name, date, time, location, playerFormat, format, gender, surface, price }
//   group          — optional: { id, name } — shows colored source dot
//   team           — optional: full team { name, members, memberDetails, maxSize } (Dashboard)
//   myTeam         — optional: basic team { name, members, maxSize } (NosTournois)
//   showTeamStatus — show my-team-indicator section (NosTournois context, shows warning if no myTeam)
//   teamCount      — optional: number shown in footer
//   past           — boolean
//   isCreator      — boolean: show edit/delete buttons
//   onEdit, onDelete, actionLoading — creator callbacks
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

  const hasFullTeam = !!(team && team.memberDetails);
  const filled   = hasFullTeam ? team.members.length : 0;
  const maxSize  = hasFullTeam ? team.maxSize : 0;
  const complete = hasFullTeam && filled >= maxSize;
  const visible  = hasFullTeam ? team.memberDetails.slice(0, MAX_VISIBLE) : [];
  const overflow = hasFullTeam ? Math.max(0, team.memberDetails.length - MAX_VISIBLE) : 0;

  const myTeamFilled   = (myTeam?.members?.length || 0) + (myTeam?.externalMembers?.length || 0);
  const myTeamComplete = !!(myTeam && myTeamFilled >= myTeam.maxSize);

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

        {/* Full team section (Dashboard) */}
        {hasFullTeam && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 4px', flexWrap: 'wrap' }}>
            {visible.map(m => (
              <div key={m.id} className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials(m.firstName, m.lastName)
                }
              </div>
            ))}
            {overflow > 0 && (
              <div className="av-circle av-sm" style={{ background: '#E0E8F4', color: '#445', fontWeight: 700, fontSize: 10 }}>
                +{overflow}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, marginLeft: 2 }}>
              <span style={{ fontSize: 12, color: '#445', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {team.name}
              </span>
              <span style={{ fontSize: 11, color: complete ? '#2E7D32' : '#90A0B0', fontWeight: 600, flexShrink: 0, marginLeft: 4 }}>
                {filled}/{maxSize}{complete ? ' ✓' : ''}
              </span>
            </div>
          </div>
        )}

        {/* My team indicator */}
        {showTeamStatus && !hasFullTeam && (
          myTeam ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 4px', flexWrap: 'wrap' }}>
              {(myTeam.memberDetails || []).slice(0, MAX_VISIBLE).map(m => (
                <div key={m.id} className={`av-circle av-sm ${!m.avatarUrl ? avatarColor(m.id) : ''}`}>
                  {m.avatarUrl
                    ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(m.firstName, m.lastName)
                  }
                </div>
              ))}
              {(myTeam.externalMembers || []).map((ext, i) => (
                <div key={ext.id || i} className="av-circle av-sm"
                  style={{ background: '#E8EEF8', border: '1.5px dashed #AAB8CC', fontSize: 10, color: '#90A0B0', fontWeight: 700 }}>
                  +1
                </div>
              ))}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, marginLeft: 2 }}>
                <span style={{ fontSize: 12, color: '#445', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {myTeam.name}
                </span>
                <span style={{ fontSize: 11, color: myTeamComplete ? '#2E7D32' : '#90A0B0', fontWeight: 600, flexShrink: 0, marginLeft: 4 }}>
                  {myTeamFilled}/{myTeam.maxSize}{myTeamComplete ? ' ✓' : ''}
                </span>
              </div>
            </div>
          ) : !past ? (
            <div className="my-team-indicator warn">
              <span style={{ fontSize: 12 }}>⚠️</span>
              <span className="my-team-indicator-label">Pas encore inscrit dans une équipe</span>
            </div>
          ) : null
        )}

        {/* Footer */}
        <div className="t-card-footer">
          {isCreator ? (
            <>
              <div style={{ display: 'flex', gap: '6px' }}
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
              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}
                onClick={e => e.stopPropagation()}>Voir →</span>
            </>
          ) : hasFullTeam ? (
            <>
              <span style={{ fontSize: 11, color: '#90A0B0' }}>👥 {group?.name}</span>
              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>Voir l'équipe →</span>
            </>
          ) : (
            <>
              {teamCount !== undefined
                ? <span style={{ fontSize: 11, color: '#90A0B0' }}>🏐 {teamCount} équipe{teamCount !== 1 ? 's' : ''}</span>
                : <span></span>
              }
              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>Voir →</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export default TournamentCard;
