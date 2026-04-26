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
import CreateTournamentWizard from './pages/CreateTournamentWizard';
import TournamentDetail from './pages/TournamentDetail';
import TournamentSearch from './pages/TournamentSearch';
import JoinGroup from './pages/JoinGroup';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Messages from './pages/Messages';
import Chat from './pages/Chat';
import Navigation from './components/Navigation';
import OnboardingTour from './components/OnboardingTour';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !!localStorage.getItem('token') && !localStorage.getItem('onboarding_done')
  );
  const [chatUnread, setChatUnread] = useState(0);

  const fetchChatUnread = async () => {
    const t = localStorage.getItem('token');
    if (!t) return;
    try {
      const res = await axios.get(`${API_URL}/api/messages/unread-count`, { headers: { Authorization: `Bearer ${t}` } });
      setChatUnread(res.data.count || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const token    = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsLoggedIn(true);
      setUser(JSON.parse(userData));
      axios.get(`${API_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          localStorage.setItem('user', JSON.stringify(res.data));
          setUser(res.data);
        })
        .catch(() => { /* keep cached data if offline */ });
      fetchChatUnread();
    }
    setLoading(false);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(fetchChatUnread, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn]); // eslint-disable-line

  // Scroll focused input above the virtual keyboard on mobile
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handle = () => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      }
    };
    vv.addEventListener('resize', handle);
    return () => vv.removeEventListener('resize', handle);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsLoggedIn(true);
    setUser(userData);
    if (!localStorage.getItem('onboarding_done')) setShowOnboarding(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
  };

  const handleUserUpdate = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
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
              <Route path="/dashboard"          element={<Dashboard        user={user} onLogout={handleLogout} chatUnread={chatUnread} />} />
              <Route path="/groups"             element={<Groups           user={user} onLogout={handleLogout} chatUnread={chatUnread} />} />
              <Route path="/groups/:groupId"    element={<GroupDetail      user={user} />} />
              <Route path="/groups/:groupId/tournament/create" element={<CreateTournament user={user} />} />
              <Route path="/tournaments/:tournamentId"         element={<TournamentDetail user={user} />} />
              <Route path="/creer"              element={<CreateTournamentWizard user={user} />} />
              <Route path="/recherche"          element={<TournamentSearch user={user} onLogout={handleLogout} chatUnread={chatUnread} />} />
              <Route path="/profile"            element={<Profile          user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />} />
              <Route path="/profil/:userId"    element={<PublicProfile    user={user} />} />
              <Route path="/messages"           element={<Messages         user={user} onLogout={handleLogout} />} />
              <Route path="/messages/:convId"   element={<Chat             user={user} onChatRead={fetchChatUnread} />} />
              <Route path="/rejoindre/:code"    element={<JoinGroup        user={user} />} />
              <Route path="/"                   element={<Navigate to="/dashboard" />} />
              <Route path="*"                   element={<Navigate to="/dashboard" />} />
            </>
          )}
        </Routes>

        {isLoggedIn && <Navigation />}
        {isLoggedIn && showOnboarding && (
          <OnboardingTour onDone={() => setShowOnboarding(false)} />
        )}
      </div>
    </Router>
  );
}

export default App;
