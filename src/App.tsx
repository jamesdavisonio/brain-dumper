import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { TaskProvider } from '@/context/TaskContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Layout } from '@/components/layout/Layout'
import { Toaster } from '@/components/ui/toaster'
import { InputScreen } from '@/components/screens/InputScreen'
import { ApprovalScreen } from '@/components/screens/ApprovalScreen'
import { ListView } from '@/components/screens/ListView'
import { TimelineView } from '@/components/screens/TimelineView'
import { TodayView } from '@/components/screens/TodayView'
import { ArchiveView } from '@/components/screens/ArchiveView'
import { AnalyticsView } from '@/components/screens/AnalyticsView'
import { HistoryView } from '@/components/screens/HistoryView'
import { SettingsView } from '@/components/screens/SettingsView'
import { ChangelogView } from '@/components/screens/ChangelogView'
import { ChangelogModal } from '@/components/changelog/ChangelogModal'
import { useChangelog } from '@/hooks/useChangelog'

function AppRoutes() {
  const { showModal, dismissChangelog } = useChangelog()

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<InputScreen />} />
        <Route path="/approve" element={<ApprovalScreen />} />
        <Route path="/list" element={<ListView />} />
        <Route path="/today" element={<TodayView />} />
        <Route path="/timeline" element={<TimelineView />} />
        <Route path="/analytics" element={<AnalyticsView />} />
        <Route path="/archive" element={<ArchiveView />} />
        <Route path="/history" element={<HistoryView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/changelog" element={<ChangelogView />} />
      </Routes>
      <ChangelogModal open={showModal} onClose={dismissChangelog} />
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGuard>
          <TaskProvider>
            <AppRoutes />
            <Toaster />
          </TaskProvider>
        </AuthGuard>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
