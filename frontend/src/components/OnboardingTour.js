import React, { useState } from 'react';

// spotType: 'avatar' → spotlight circulaire en haut à droite (AvatarMenu)
//           'tab'    → spotlight rectangulaire sur l'onglet nav
//           null     → pas de spotlight (dernière étape)
const STEPS = [
  {
    spotType: 'avatar',
    icon: '👥',
    title: 'Tes groupes',
    text: 'Crée ou rejoins des groupes avec tes amis pour organiser vos tournois.',
  },
  {
    spotType: 'tab',
    tabIndex: 1,
    icon: '🔍',
    title: 'Explorer',
    text: 'Trouve des tournois près de chez toi et filtre par format pour les ajouter à ton groupe.',
  },
  {
    spotType: 'tab',
    tabIndex: 0,
    icon: '🏠',
    title: 'Accueil',
    text: 'Retrouve tous les tournois de tes groupes, crée tes équipes et ajoute tes propres tournois.',
  },
  {
    spotType: null,
    icon: '🏐',
    title: "C'est parti !",
    text: 'Tu es prêt. Rejoins un groupe, trouve un tournoi, forme ton équipe — bonne session !',
  },
];

function OnboardingTour({ onDone }) {
  const [step, setStep]       = useState(0);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    setLeaving(true);
    localStorage.setItem('onboarding_done', '1');
    setTimeout(onDone, 350);
  };

  const advance = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const s = STEPS[step];
  const isLast    = s.spotType === null;
  const isAvatar  = s.spotType === 'avatar';

  return (
    <div
      className={`ob-overlay${leaving ? ' ob-leave' : ''}`}
      onClick={advance}
    >
      {/* Spotlight : circulaire pour avatar, rectangulaire pour les onglets */}
      {isAvatar && <div className="ob-spot-avatar" />}
      {s.spotType === 'tab' && <div className={`ob-spot ob-spot-${s.tabIndex}`} />}

      {/* Menu ouvert simulé pour l'étape avatar */}
      {isAvatar && (
        <div className="avatar-menu ob-fake-menu">
          <div className="avatar-menu-item" style={{ fontWeight:700, cursor:'default', color:'#90A0B0', fontSize:12 }}>
            Mon compte
          </div>
          <div className="avatar-menu-item">👤 Mon profil</div>
          <div className="avatar-menu-item">🔔 Notifications</div>
          <div className="avatar-menu-sep" />
          <div className="avatar-menu-item" style={{ fontWeight:800, color:'var(--primary)' }}>
            👥 Mes groupes
          </div>
          <div className="avatar-menu-sep" />
          <div className="avatar-menu-item danger">🚪 Déconnexion</div>
        </div>
      )}

      {/* Bulle d'info */}
      <div
        key={step}
        className={`ob-bubble${isLast ? ' ob-bubble-center' : isAvatar ? ' ob-bubble-below-avatar' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="ob-bubble-icon">{s.icon}</div>
        <div className="ob-bubble-title">{s.title}</div>
        <p className="ob-bubble-text">{s.text}</p>
        <div className="ob-bubble-footer">
          <div className="ob-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`ob-dot${i === step ? ' ob-dot-active' : ''}`} />
            ))}
          </div>
          {isLast
            ? <button className="ob-cta" onClick={e => { e.stopPropagation(); finish(); }}>Commencer</button>
            : <span className="ob-hint">Appuie n'importe où →</span>
          }
        </div>
      </div>

      {/* Bouton passer */}
      {!isLast && (
        <button
          className="ob-skip"
          onClick={e => { e.stopPropagation(); finish(); }}
        >
          Passer
        </button>
      )}
    </div>
  );
}

export default OnboardingTour;
