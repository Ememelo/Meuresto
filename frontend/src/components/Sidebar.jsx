import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  ShieldAlert, 
  LogOut, 
  UtensilsCrossed,
  TrendingUp,
  Settings,
  X,
  Truck,
  Package,
  Briefcase,
  Clock,
  FolderKanban,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useAuth()
  const [hrExpanded, setHrExpanded] = useState(true)

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador Master',
      admin_delegado: 'Admin Delegado',
      rh: 'Recursos Humanos',
      socio: 'Sócio-Diretor',
      gestor: 'Gestor de Equipe',
      financeiro: 'Time Financeiro',
      consulta: 'Somente Leitura'
    }
    return labels[role] || role
  }

  return (
    <>
      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <aside className={`w-64 bg-lira-navy text-slate-100 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-50 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="text-amber-500 w-7 h-7" />
            <div>
              <h1 className="font-extrabold text-sm tracking-wider text-slate-100 m-0">MEURESTÔ</h1>
              <p className="text-[10px] text-amber-500 font-semibold tracking-widest uppercase m-0">Gestão de Restaurante</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
 
      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {/* Executive Dashboard */}
        {['admin', 'admin_delegado', 'rh', 'socio', 'gestor', 'consulta', 'financeiro'].includes(user?.role) && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
            Dashboard Executivo
          </button>
        )}

        {/* Recursos Humanos Collapsible Submenu */}
        {(['admin', 'admin_delegado', 'rh'].includes(user?.role) || user?.hr_access !== 'none' || user?.has_hr_access) && (
          <div className="space-y-1">
            <button
              onClick={() => setHrExpanded(!hrExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-400" />
                <span>Recursos Humanos</span>
              </div>
              {hrExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            
            {hrExpanded && (
              <div className="pl-6 border-l border-slate-800 ml-6 space-y-1.5 py-1">
                {[
                  { id: 'hr_dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'employees', label: 'Colaboradores', icon: Users },
                  { id: 'hr_job_positions', label: 'Cargos', icon: Briefcase },
                  { id: 'hr_sectors', label: 'Setores', icon: FolderKanban },
                  { id: 'hr_work_scales', label: 'Escalas', icon: Clock },
                  { id: 'hr_documents', label: 'Documentos', icon: FileText }
                ].map(sub => {
                  const SubIcon = sub.icon
                  const isActive = activeTab === sub.id
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveTab(sub.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-amber-600 text-white shadow shadow-amber-900/20' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                      }`}
                    >
                      <SubIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      {sub.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Fornecedores */}
        {((['admin', 'admin_delegado', 'socio', 'gestor', 'financeiro'].includes(user?.role)) || user?.suppliers_access !== 'none' || user?.has_suppliers_access || user?.financial_access !== 'none' || user?.has_financial_access) && (
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Truck className={`w-5 h-5 ${activeTab === 'suppliers' ? 'text-white' : 'text-slate-400'}`} />
            Fornecedores
          </button>
        )}

        {/* Controle de Estoque */}
        {['admin', 'admin_delegado', 'socio', 'gestor', 'financeiro'].includes(user?.role) && (
          <button
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Package className={`w-5 h-5 ${activeTab === 'inventory' ? 'text-white' : 'text-slate-400'}`} />
            Controle de Estoque
          </button>
        )}

        {/* Financeiro */}
        {((['admin', 'admin_delegado', 'socio', 'gestor', 'financeiro'].includes(user?.role)) || user?.financial_access !== 'none' || user?.has_financial_access) && (
          <button
            onClick={() => setActiveTab('financial')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'financial'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className={`w-5 h-5 ${activeTab === 'financial' ? 'text-white' : 'text-slate-400'}`} />
            Financeiro
          </button>
        )}

        {/* Relatórios */}
        {((['admin', 'admin_delegado', 'rh', 'socio'].includes(user?.role)) || user?.reports_access !== 'none' || user?.has_reports_access) && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet className={`w-5 h-5 ${activeTab === 'reports' ? 'text-white' : 'text-slate-400'}`} />
            Relatórios
          </button>
        )}

        {/* Acesso & Usuários (Settings) */}
        {['admin', 'admin_delegado', 'rh', 'socio', 'gestor', 'consulta', 'financeiro'].includes(user?.role) && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
            Acesso & Usuários
          </button>
        )}
      </nav>

      {/* User Info & Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="mb-4">
          <p className="text-xs text-slate-500 font-semibold">LOGADO COMO</p>
          <p className="text-sm font-bold text-slate-200 truncate">{user?.username}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-slate-800 border border-slate-700 text-[10px] font-medium rounded text-amber-500 uppercase">
            {getRoleLabel(user?.role)}
          </span>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-950/40 border border-slate-700 hover:border-red-900/50 hover:text-red-400 rounded-lg text-sm font-semibold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sair do Sistema
        </button>
      </div>
    </aside>
    </>
  )
}

export default Sidebar
