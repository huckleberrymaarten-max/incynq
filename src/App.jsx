import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

// Screens
import OnboardingScreen  from './screens/OnboardingScreen';
import AuthScreen        from './screens/AuthScreen';
import PendingScreen     from './screens/PendingScreen';
import MainApp           from './screens/MainApp';
import Toast             from './components/Toast';

function AppRoutes() {
  const { loggedIn, showOnboarding, currentUser, setLoggedIn, setShowOnboarding, setCurrentUser, setLinkedProfiles, linkedProfiles, notif } = useApp();

  if (!loggedIn && showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (!loggedIn) {
    return (
      <AuthScreen
        onLogin={u => {
          setCurrentUser(u);
          setLinkedProfiles(prev => [{ ...prev[0], ...u, id: 1 }, ...prev.slice(1)]);
          setLoggedIn(true);
        }}
      />
    );
  }

  if (currentUser.activated === false) {
    return (
      <PendingScreen
        currentUser={currentUser}
        onActivate={() => setCurrentUser(u => ({ ...u, activated: true }))}
        onSignOut={() => setLoggedIn(false)}
      />
    );
  }

  return (
    <>
      <MainApp />
      {notif && <Toast msg={notif.msg} type={notif.type} />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
