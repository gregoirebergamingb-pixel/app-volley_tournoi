import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ResultsModal({ tournament, team, token, onClose }) {
  const [placement, setPlacement]     = useState('');
  const [isRange, setIsRange]         = useState(false);
  const [placementEnd, setPlacementEnd] = useState('');
  const [wins, setWins]               = useState(0);
  const [losses, setLosses]           = useState(0);
  const [saving, setSaving]           = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const finalPlacement = isRange && placementEnd.trim()
        ? `${placement.trim()}-${placementEnd.trim()}`
        : placement.trim() || null;
      await axios.put(
        `${API_URL}/api/tournaments/${tournament.id}/teams/${team.id}/results`,
        { placement: finalPlacement, wins, losses },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onClose(true);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    try {
      const skipped = JSON.parse(sessionStorage.getItem('skipped_results') || '[]');
      sessionStorage.setItem('skipped_results', JSON.stringify([...skipped, tournament.id]));
    } catch {}
    onClose(false);
  };

  const counter = (val, set, color, bg, label) => (
    <div style={{ flex:1, background:'#F5F8FF', borderRadius:12, padding:12,
      display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={() => set(v => Math.max(0, v - 1))}
          style={{ width:34, height:34, borderRadius:'50%', border:'1.5px solid #E0E8F4',
            background:'white', fontSize:20, fontWeight:700, color:'#90A0B0', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>−</button>
        <span style={{ fontSize:30, fontWeight:900, color, minWidth:34, textAlign:'center' }}>{val}</span>
        <button onClick={() => set(v => v + 1)}
          style={{ width:34, height:34, borderRadius:'50%', border:`1.5px solid ${color}`,
            background:bg, fontSize:20, fontWeight:700, color, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>+</button>
      </div>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,18,40,0.6)', zIndex:300,
      display:'flex', alignItems:'flex-end' }}
      onClick={handleSkip}>
      <div style={{ background:'white', borderRadius:'24px 24px 0 0', width:'100%', paddingBottom:32 }}
        onClick={e => e.stopPropagation()}>

        <div style={{ width:36, height:4, background:'#DDE5EF', borderRadius:2, margin:'12px auto 4px' }} />

        {/* Header */}
        <div style={{ padding:'10px 20px 14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:12, color:'var(--sub)', marginBottom:3 }}>
            Le tournoi <strong>{tournament.name}</strong> est terminé
          </div>
          <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>Comment ça s'est passé ?</div>
          <div style={{ fontSize:12, color:'var(--sub)', marginTop:3 }}>
            Équipe : <strong>{team.name}</strong>
          </div>
        </div>

        <div style={{ padding:'14px 20px 0' }}>

          {/* Placement */}
          <div style={{ fontSize:11, fontWeight:700, color:'var(--primary)',
            textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Classement final
          </div>
          <div style={{ background:'#F5F8FF', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <input
                type="text"
                inputMode="numeric"
                value={placement}
                onChange={e => setPlacement(e.target.value)}
                placeholder={isRange ? 'De' : 'ex: 2'}
                style={{ flex:1, background:'white', border:'1.5px solid var(--border)', borderRadius:10,
                  padding:'8px 10px', fontSize:16, fontWeight:700, color:'var(--text)', textAlign:'center' }}
              />
              {isRange ? (
                <>
                  <span style={{ fontSize:13, color:'var(--sub)', fontWeight:600, flexShrink:0 }}>à</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={placementEnd}
                    onChange={e => setPlacementEnd(e.target.value)}
                    placeholder="ex: 8"
                    style={{ width:70, background:'white', border:'1.5px solid var(--primary)', borderRadius:10,
                      padding:'8px 8px', fontSize:16, fontWeight:700, color:'var(--primary)', textAlign:'center' }}
                  />
                  <span style={{ fontSize:13, color:'var(--sub)', fontWeight:600, flexShrink:0 }}>ème</span>
                </>
              ) : (
                <span style={{ fontSize:13, color:'var(--sub)', fontWeight:600, flexShrink:0 }}>ème place</span>
              )}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <input type="checkbox" checked={isRange} onChange={e => setIsRange(e.target.checked)}
                style={{ width:16, height:16, accentColor:'var(--primary)', cursor:'pointer' }} />
              <span style={{ fontSize:12, fontWeight:600, color:'var(--sub)' }}>
                C'est une plage de classement
              </span>
            </label>
            {isRange && (
              <div style={{ fontSize:11, color:'#90A0B0', marginTop:4 }}>
                ex : classés entre la 5e et la 8e place
              </div>
            )}
          </div>

          {/* Wins / Losses */}
          <div style={{ fontSize:11, fontWeight:700, color:'var(--primary)',
            textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Matchs joués
          </div>
          <div style={{ display:'flex', gap:12, marginBottom:16 }}>
            {counter(wins, setWins, '#2E7D32', '#F1F8E9', 'Victoires')}
            {counter(losses, setLosses, '#C62828', '#FFEBEE', 'Défaites')}
          </div>

          <button onClick={handleConfirm} disabled={saving}
            style={{ width:'100%', background:'var(--primary)', color:'white', border:'none',
              borderRadius:14, padding:13, fontSize:15, fontWeight:800, cursor:'pointer' }}>
            {saving ? 'Enregistrement…' : '✅ Enregistrer les résultats'}
          </button>
          <button onClick={handleSkip}
            style={{ width:'100%', background:'none', border:'none', color:'var(--sub)',
              fontSize:13, fontWeight:600, padding:9, cursor:'pointer', marginTop:2 }}>
            Passer pour l'instant
          </button>
        </div>
      </div>
    </div>
  );
}
