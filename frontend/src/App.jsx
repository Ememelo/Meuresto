import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import { Menu } from 'lucide-react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import EmployeeList from './components/EmployeeList'
import EmployeeForm from './components/EmployeeForm'
import EmployeeDetails from './components/EmployeeDetails'
import Reports from './components/Reports'
import Financial from './components/Financial'
import AuditLogs from './components/AuditLogs'
import UserSettings from './components/UserSettings'
import HRDashboard from './components/HRDashboard'
import HRSectors from './components/HRSectors'
import HRJobPositions from './components/HRJobPositions'
import HRWorkScales from './components/HRWorkScales'
import HRDocuments from './components/HRDocuments'
import Inventory from './components/Inventory'
import api from './utils/api'
import { getSyncQueue, syncPendingRequests } from './utils/offlineSync'

const AppContent = () => {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Navigation states within Employee module
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [addingNewEmployee, setAddingNewEmployee] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)

  // Background Ping and Auto-Sync
  useEffect(() => {
    if (!user) return

    const checkServerAndSync = async () => {
      try {
        const res = await api.get('/')
        if (res.status === 200) {
          const queue = getSyncQueue()
          if (queue.length > 0) {
            console.log(`Auto-Sync: Found ${queue.length} pending items. Syncing...`)
            await syncPendingRequests(api)
          }
        }
      } catch (err) {
        // Silent catch
      }
    }

    checkServerAndSync()
    const interval = setInterval(checkServerAndSync, 15000)
    return () => clearInterval(interval)
  }, [user])


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  // Render Login page if not authenticated
  if (!user) {
    return <Login />
  }

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'employees':
        if (addingNewEmployee) {
          return (
            <EmployeeForm
              onCancel={() => setAddingNewEmployee(false)}
              onSuccess={() => {
                setAddingNewEmployee(false)
                setSelectedEmployeeId(null)
              }}
            />
          )
        }
        if (editingEmployeeId) {
          return (
            <EmployeeForm
              employeeId={editingEmployeeId}
              onCancel={() => setEditingEmployeeId(null)}
              onSuccess={() => {
                setEditingEmployeeId(null)
              }}
            />
          )
        }
        if (selectedEmployeeId) {
          return (
            <EmployeeDetails
              employeeId={selectedEmployeeId}
              onBack={() => setSelectedEmployeeId(null)}
              onEditEmployee={(id) => {
                setEditingEmployeeId(id)
              }}
            />
          )
        }
        return (
          <EmployeeList
            onSelectEmployee={(id) => {
              setSelectedEmployeeId(id)
              setAddingNewEmployee(false)
            }}
            onAddNew={() => {
              setAddingNewEmployee(true)
              setSelectedEmployeeId(null)
            }}
            onEditEmployee={(id) => {
              setEditingEmployeeId(id)
            }}
          />
        )
      case 'hr_dashboard':
        return <HRDashboard />
      case 'hr_sectors':
        return <HRSectors />
      case 'hr_job_positions':
        return <HRJobPositions />
      case 'hr_work_scales':
        return <HRWorkScales />
      case 'hr_documents':
        return <HRDocuments />
      case 'reports':
        return <Reports />
      case 'financial':
        return <Financial />
      case 'suppliers':
        return <Financial forceSubTab="suppliers" />
      case 'inventory':
        return <Inventory />
      case 'audit':
        return <AuditLogs />
      case 'settings':
        return <UserSettings />
      default:
        return <Dashboard />
    }
  }

  // Handle setting tabs (reset inner employee view states)
  const handleSetActiveTab = (tabId) => {
    setActiveTab(tabId)
    setSelectedEmployeeId(null)
    setAddingNewEmployee(false)
    setEditingEmployeeId(null)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-lira-bg flex relative">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleSetActiveTab} 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pl-0 min-h-screen flex flex-col w-full overflow-x-hidden">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-8 shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              title="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sistema Operacional Online
              </span>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-400 hidden sm:block">
            MeuRestô v1.0.0
          </div>
        </header>
        
        <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
          {renderActiveTabContent()}
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
