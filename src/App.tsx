
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginPage } from './features/auth/LoginPage';
import { ProjectSetup } from './features/auth/ProjectSetup';
import { AppShell } from './components/AppShell';
import { TimelineView } from './features/timeline/TimelineView';
import { TreeView } from './features/tree/TreeView';
import { CalendarView } from './features/calendar/CalendarView';
import { InventoryView } from './features/inventory/InventoryView';
import { LibraryView } from './features/library/LibraryView';

function AppContent() {
  const { currentUser } = useAuth();
  const { currentProject, loading, appState } = useData();

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

  return <AppShell>{renderTab()}</AppShell>;
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
