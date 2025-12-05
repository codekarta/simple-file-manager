import { AnimatePresence } from 'framer-motion';
import { AppProvider, useAuth, useUI } from './store';
import LoginPage from './components/LoginPage';
import AppShell from './components/AppShell';
import { LoadingScreen } from './components/Spinner';
import { ToastContainer } from './components/Toast';
import './index.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast, showToast } = useUI();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {isAuthenticated ? (
          <AppShell key="app" />
        ) : (
          <LoginPage key="login" />
        )}
      </AnimatePresence>
      <ToastContainer toast={toast} onClose={() => showToast('', 'info')} />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
