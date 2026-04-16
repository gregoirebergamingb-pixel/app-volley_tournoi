import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './styles/App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import CreateTournament from './pages/CreateTournament';
import TournamentDetail from './pages/TournamentDetail';
import NosTournois from './pages/NosTournois';
import TournamentSearch from './pages/TournamentSearch';
import JoinGroup from './pages/JoinGroup';
import Profile from './pages/Profile';
import Navigation from './components/Navigation';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const token    = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsLoggedIn(true);
      setUser(JSON.parse(userData));
      // Refresh profile to get up-to-date fields (firstName, lastName, level…)
      axios.get(`${API_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          localStorage.setItem('user', JSON.stringify(res.data));
          setUser(res.data);
        })
        .catch(() => { /* keep cached data if offline */ });
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsLoggedIn(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
  };

  if (loading) return <div className="loading">Chargement…</div>;

  return (
    <Router>
      <div className="App">
        <Routes>
          {!isLoggedIn ? (
            <>
              <Route path="/login"              element={<Login    onLogin={handleLogin} />} />
              <Route path="/register"           element={<Register onLogin={handleLogin} />} />
              <Route path="/rejoindre/:code"    element={<JoinGroup user={null} />} />
              <Route path="*"                   element={<Navigate to="/login" />} />
            </>
          ) : (
            <>
              <Route path="/dashboard"          element={<Dashboard        user={user} onLogout={handleLogout} />} />
              <Route path="/groups"             element={<Groups           user={user} onLogout={handleLogout} />} />
              <Route path="/groups/:groupId"    element={<GroupDetail      user={user} />} />
              <Route path="/groups/:groupId/tournament/create" element={<CreateTournament user={user} />} />
              <Route path="/tournaments/:tournamentId"         element={<TournamentDetail user={user} />} />
              <Route path="/nos-tournois"       element={<NosTournois      user={user} onLogout={handleLogout} />} />
              <Route path="/recherche"          element={<TournamentSearch user={user} onLogout={handleLogout} />} />
              <Route path="/profile"            element={<Profile          user={user} onLogout={handleLogout} />} />
              <Route path="/rejoindre/:code"    element={<JoinGroup        user={user} />} />
              <Route path="/"                   element={<Navigate to="/dashboard" />} />
              <Route path="*"                   element={<Navigate to="/dashboard" />} />
            </>
          )}
        </Routes>

        {isLoggedIn && <Navigation />}
      </div>
    </Router>
  );
}

export default App;
