import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { avatarColor, initials } from '../components/TournamentCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const LEVEL_LABELS = {
  loisir:        { label: 'Loisir',        color: '#2E7D32', bg: '#E8F5E9' },
  departemental: { label: 'Départemental', color: '#1565C0', bg: '#E3F2FD' },
  regional:      { label: 'Régional',      color: '#7B1FA2', bg: '#F3E5F5' },
  national:      { label: 'National',      color: '#E65100', bg: '#FFF3E0' },
  pro:           { label: 'Pro',           color: '#C62828', bg: '#FFEBEE' },
};

const SURFACE_LABELS = {
  beach:   { label: 'Beach',   icon: '🏖️', color: '#E65100', bar: '#E65100' },
  green:   { label: 'Green',   icon: '🌿', color: '#2E7D32', bar: '#2E7D32' },
  gymnase: { label: 'Gymnase', icon: '🏛️', color: '#7B1FA2', bar: '#7B1FA2' },
};

function placementIcon(placement) {
  if (!placement) return { icon: '🏐', bg: '#F5F8FF' };
  if (placement === '1') return { icon: '🥇', bg: '#FFF8E1' };
  if (placement === '2') return { icon: '🥈', bg: '#ECEFF1' };
  if (placement === '3') return { icon: '🥉', bg: '#FBE9E7' };
  return { icon: '🏐', bg: '#F5F8FF' };
}

function placementLabel(placement) {
  if (!placement) return '—';
  if (placement.includes('-')) {
    const [a, b] = placement.split('-');
    return `${a}e – ${b}e`;
  }
  const n = parseInt(placement);
  if (n === 1) return '1ère';
  return `${n}ème`;
}

function WinBar({ wins, losses, tournaments, color }) {
  const total = wins + losses;
  const pct = total > 0 ? Math.round(wins / total * 100) : null;
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, marginBottom:4 }}>
        <span style={{ color:'var(--sub)' }}>{tournaments} tournoi{tournaments !== 1 ? 's' : ''}</span>
        <span style={{ color:'var(--text)' }}>
          {pct !== null ? `${pct}%` : '—'} · {wins}V {losses}D
        </span>
      </div>
      <div style={{ height:7, background:'#EEF2F8', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:4, background: color || 'var(--primary)',
          width: pct !== null ? `${pct}%` : '0%', transition:'width .3s' }} />
      </div>
    </div>
  );
}

export default function PublicProfile({ user }) {
  const { userId } = useParams();
  const navigate   = useNavigate();
  const token      = localStorage.getItem('token');
  const isOwnProfile = userId === user?.id;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/${userId}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId, token]);

  if (loading) return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor:'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
        </div>
      </div>
      <div className="page-content">
        <div style={{ textAlign:'center', padding:'3rem', color:'#90A0B0' }}>Chargement…</div>
      </div>
    </>
  );

  if (error) return (
    <>
      <div className="app-header">
        <div className="header-inner">
          <span className="back-btn" style={{ cursor:'pointer' }} onClick={() => navigate(-1)}>← Retour</span>
        </div>
      </div>
      <div className="page-content">
        <div className="message error">{error}</div>
      </div>
    </>
  );

  const { stats, formatStats, surfaceStats, history, partners } = profile;
  const levelInfo   = LEVEL_LABELS[profile.level];
  const POSITION_LABELS = { passeur: { label: 'Passeur', color: '#1565C0', bg: '#E3F2FD' }, attaquant: { label: 'Attaquant', color: '#E65100', bg: '#FFF3E0' } };
  const positionInfo = POSITION_LABELS[profile.position];
  const totalMatches = stats.wins + stats.losses;
  const winPct = totalMatches > 0 ? Math.round(stats.wins / totalMatches * 100) : null;

  const formatOrder = ['2x2', '3x3', '4x4', '6x6'];
  const formats = formatOrder.filter(f => formatStats[f]);
  const surfaces = ['beach', 'green', 'gymnase'].filter(s => surfaceStats[s]);

  return (
    <>
      {/* Hero header */}
      <div style={{ background:'var(--primary)', padding:'0 16px 20px' }}>
        <div style={{ position:'relative', paddingTop:23, minHeight:80 }}>
          <span className="back-btn" style={{ cursor:'pointer' }} onClick={() => navigate(-1)}>← Retour</span>

          {/* Avatar */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginTop:18, gap:10 }}>
            <div className={`av-circle ${profile.avatarUrl ? '' : avatarColor(profile.id)}`}
              style={{ width:72, height:72, fontSize:26, fontWeight:800, flexShrink:0,
                border:'3px solid rgba(255,255,255,0.4)' }}>
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                : initials(profile.firstName, profile.lastName)
              }
            </div>

            {/* Name + optional edit */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:20, fontWeight:800, color:'white' }}>
                {profile.firstName} {profile.lastName}
              </div>
              {isOwnProfile && (
                <Link to="/profile"
                  style={{ background:'rgba(255,255,255,0.18)', color:'white',
                    border:'1px solid rgba(255,255,255,0.4)', borderRadius:20,
                    padding:'4px 12px', fontSize:12, fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                  ✏️ Modifier
                </Link>
              )}
            </div>

            {/* Level + position badges */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
              {levelInfo && (
                <div style={{ background:'rgba(255,255,255,0.18)', color:'white',
                  borderRadius:20, padding:'4px 14px', fontSize:12, fontWeight:700 }}>
                  {levelInfo.label}
                </div>
              )}
              {positionInfo && (
                <div style={{ background:'rgba(255,255,255,0.18)', color:'white',
                  borderRadius:20, padding:'4px 14px', fontSize:12, fontWeight:700 }}>
                  {positionInfo.label}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom:80 }}>

        {/* Stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
          background:'white', borderRadius:16, border:'1px solid var(--border)',
          overflow:'hidden', marginBottom:12 }}>
          {[
            { val: stats.tournaments, label: 'Tournois' },
            { val: winPct !== null ? `${winPct}%` : '—', label: '% Victoires matchs' },
            { val: stats.titles, label: 'Titres' },
            { val: stats.podiums, label: 'Top 3' },
          ].map((s, i, arr) => (
            <div key={i} style={{ padding:'13px 6px', display:'flex', flexDirection:'column',
              alignItems:'center', gap:3, borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="stat-num" style={{ fontSize:22, color: i === 0 ? 'var(--primary)' : 'var(--text)', lineHeight:1 }}>
                {s.val}
              </div>
              <div style={{ fontSize:9, fontWeight:600, color:'var(--sub)', textAlign:'center', lineHeight:1.3 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Performance par format */}
        {formats.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:4 }}>Performance par format</div>
            <div style={{ fontSize:10, color:'var(--sub)', marginBottom:10 }}>
              % de matchs gagnés dans ce format
            </div>
            {formats.map(f => (
              <div key={f} style={{ marginBottom:10 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--sub)', marginBottom:3 }}>{f}</div>
                <WinBar {...formatStats[f]} color="var(--primary)" />
              </div>
            ))}
          </div>
        )}

        {/* Performance par surface */}
        {surfaces.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:4 }}>Performance par surface</div>
            <div style={{ fontSize:10, color:'var(--sub)', marginBottom:10 }}>
              % de matchs gagnés sur cette surface
            </div>
            {surfaces.map(s => {
              const info = SURFACE_LABELS[s];
              return (
                <div key={s} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--sub)', marginBottom:3 }}>
                    {info.icon} {info.label}
                  </div>
                  <WinBar {...surfaceStats[s]} color={info.bar} />
                </div>
              );
            })}
          </div>
        )}

        {/* Derniers tournois */}
        {history.length > 0 && (
          <div className="card">
            <div className="card-title">Derniers tournois</div>
            {history.map((h, i) => {
              const { icon, bg } = placementIcon(h.placement);
              const label = placementLabel(h.placement);
              const dateStr = h.date
                ? new Date(h.date + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' })
                : '';
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0',
                  borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor:'pointer' }}
                  onClick={() => navigate(`/tournaments/${h.id}`)}>
                  <div style={{ width:34, height:34, borderRadius:10, background:bg,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.name}</div>
                    <div style={{ fontSize:11, color:'var(--sub)', marginTop:1 }}>
                      {dateStr}{h.playerFormat ? ` · ${h.playerFormat}` : ''}{h.surface ? ` · ${SURFACE_LABELS[h.surface]?.label || h.surface}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:800,
                      color: h.wins > h.losses ? '#2E7D32' : h.losses > h.wins ? '#C62828' : 'var(--sub)' }}>
                      {h.wins}V – {h.losses}D
                    </div>
                    <div style={{ fontSize:11, color:'var(--sub)' }}>{label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Partenaires fréquents */}
        {partners.length > 0 && (
          <div className="card">
            <div className="card-title">Partenaires fréquents</div>
            <div style={{ fontSize:10, color:'var(--sub)', marginBottom:10 }}>
              Membres inscrits dans l'application uniquement
            </div>
            {partners.map((p, i) => (
              <div key={p.id}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0',
                  borderBottom: i < partners.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor:'pointer' }}
                onClick={() => navigate(`/profil/${p.id}`)}>
                <div className={`av-circle av-sm ${p.avatarUrl ? '' : avatarColor(p.id)}`}
                  style={{ flexShrink:0 }}>
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                    : initials(p.firstName, p.lastName)
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                    {p.firstName} {p.lastName}
                  </div>
                  <div style={{ fontSize:11, color:'var(--sub)', marginTop:1 }}>
                    {p.tournaments} tournoi{p.tournaments !== 1 ? 's' : ''} ensemble
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#2E7D32' }}>{p.wins}V</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#C62828' }}>{p.losses}D</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {stats.tournaments === 0 && (
          <div style={{ textAlign:'center', padding:'2rem 1rem', color:'#90A0B0', fontSize:13 }}>
            Aucun tournoi enregistré pour l'instant.
          </div>
        )}

      </div>
    </>
  );
}
