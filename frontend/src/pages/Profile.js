import React from 'react';
import { Link } from 'react-router-dom';

function Profile({ user }) {
  return (
    <>
      <div className="app-header">
        <Link to="/dashboard" className="back-btn">← Retour</Link>
        <div className="header-row">
          <div className="header-title">Mon Profil</div>
        </div>
      </div>
      <div className="page-content">
        {/* À venir */}
      </div>
    </>
  );
}

export default Profile;
