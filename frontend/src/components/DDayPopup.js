import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import messagesData from '../data/dday-messages.json';

const SURFACE_LABELS = { beach: '🏖️ Beach', green: '🌿 Green', gymnase: '🏛️ Gymnase' };

function pickMessage(tournament) {
  const pool = messagesData.messages.filter(m => {
    if (!m.enabled) return false;
    const c = m.conditions;
    if (c.surface.length > 0 && !c.surface.includes(tournament.surface)) return false;
    if (c.gender.length > 0  && !c.gender.includes(tournament.gender))   return false;
    if (c.format.length > 0  && !c.format.includes(tournament.playerFormat || tournament.format)) return false;
    return true;
  });
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function DDayPopup({ tournament, onClose }) {
  const [visible,  setVisible]  = useState(false);
  const [leaving,  setLeaving]  = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onClose, 320);
  };

  const goToTournament = () => {
    dismiss();
    setTimeout(() => navigate(`/tournaments/${tournament.id}`), 320);
  };

  const msg = pickMessage(tournament);
  if (!msg || !visible) return null;

  const dateLabel = new Date(tournament.date + 'T12:00:00')
    .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div
      className={`dday-overlay${leaving ? ' dday-leave' : ''}`}
      onClick={dismiss}
    >
      <div className="dday-sheet" onClick={e => e.stopPropagation()}>
        <div className="dday-handle" />

        {/* Header */}
        <div className="dday-header">
          <span className="dday-fire">{msg.emoji || '🔥'}</span>
          <span className="dday-badge">JOUR DE TOURNOI</span>
        </div>

        {/* GIF ou illustration */}
        {msg.gifUrl ? (
          <div className="dday-media">
            <img src={msg.gifUrl} alt="" className="dday-gif" />
          </div>
        ) : (
          <div className="dday-media dday-media-emoji">
            🏐
          </div>
        )}

        {/* Phrase */}
        <p className="dday-text">« {msg.text} »</p>

        {/* Infos tournoi */}
        <div className="dday-tournament-row">
          <span className="dday-tournament-name">{tournament.name}</span>
          <div className="dday-tournament-meta">
            {dateLabel}
            {tournament.time && ` · ${tournament.time}`}
            {tournament.surface && ` · ${SURFACE_LABELS[tournament.surface] || tournament.surface}`}
          </div>
        </div>

        {/* Actions */}
        <button className="dday-cta" onClick={goToTournament}>
          Voir mon tournoi 🚀
        </button>
        <button className="dday-close-btn" onClick={dismiss}>
          Continuer vers l'accueil
        </button>
      </div>
    </div>
  );
}

export default DDayPopup;
