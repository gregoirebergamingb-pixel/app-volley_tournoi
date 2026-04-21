import React from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { path: '/dashboard', icon: '🏠', label: 'Accueil'  },
  { path: '/creer',     icon: '➕', label: 'Créer'    },
  { path: '/recherche', icon: '🔍', label: 'Explorer' },
];

function Navigation() {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default Navigation;
