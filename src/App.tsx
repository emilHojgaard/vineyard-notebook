
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginPage } from './features/auth/LoginPage';
import { ProjectSetup } from './features/auth/ProjectSetup';
import { AppShell } from './components/AppShell';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationCenter } from './components/NotificationCenter';
import { InvitationPrompt } from './components/InvitationPrompt';
import { DataState } from './components/DataState';

// Lazy load main feature views for better performance
const TimelineView = lazy(() => import('./features/timeline/TimelineView'));
const TreeView = lazy(() => import('./features/tree/TreeView'));
const CalendarView = lazy(() => import('./features/calendar/CalendarView'));
const InventoryView = lazy(() => import('./features/inventory/InventoryView'));
const LibraryView = lazy(() => import('./features/library/LibraryView'));

function InvitationNotifications() {
  const { invitationNotifications, dismissInvitationNotification } = useAuth();

  useEffect(() => {
    const timers = invitationNotifications.map((notification) =>
      window.setTimeout(() => dismissInvitationNotification(notification.id), 5000)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [invitationNotifications, dismissInvitationNotification]);

  if (invitationNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[80] space-y-2" role="status" aria-live="polite">
      {invitationNotifications.map((notification) => (
        <div
          key={notification.id}
          className="flex items-center gap-3 rounded-lg bg-burgundy px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => dismissInvitationNotification(notification.id)}
            className="text-white/80 hover:text-white"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function AppContent() {
  const { currentUser } = useAuth();
  const { currentProject, loading, appState, dataError, connectionStatus, retryData } = useData();

  if (!currentUser) {
    return <LoginPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="text-ink-soft">Loading...</div>
      </div>
    );
  }

  if (!currentProject) {
    if (dataError) {
      return <DataState loading={false} error={dataError} connectionStatus={connectionStatus} onRetry={retryData} label="projects" />;
    }
    return <ProjectSetup />;
  }

  const renderTab = () => {
    switch (appState.tab) {
      case 'timeline':
        return <TimelineView />;
      case 'tree':
        return <TreeView />;
      case 'calendar':
        return <CalendarView />;
      case 'inventory':
        return <InventoryView />;
      case 'library':
        return <LibraryView />;
      default:
        return <TimelineView />;
    }
  };

  return (
    <AppShell>
      <Suspense fallback={<LoadingSpinner />}>
        {renderTab()}
      </Suspense>
    </AppShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
      <DataProvider>
        <AppContent />
        <InvitationPrompt />
        <InvitationNotifications />
        <NotificationCenter />
      </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
