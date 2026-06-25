import React from 'react'
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
  X
} from 'lucide-react'

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useAuth()

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'admin_delegado', 'rh', 'socio', 'gestor', 'consulta'] },
    { id: 'employees', label: 'Colaboradores', icon: Users, roles: ['admin', 'admin_delegado', 'rh', 'socio', 'gestor', 'consulta'] },
    { id: 'financial', label: 'Financeiro', icon: TrendingUp, roles: ['admin', 'admin_delegado', 'socio'] },
    { id: 'reports', label: 'Relatórios', icon: FileSpreadsheet, roles: ['admin', 'admin_delegado', 'rh', 'socio'] },
    { id: 'settings', label: 'Acesso & Usuários', icon: Settings, roles: ['admin', 'admin_delegado', 'rh', 'socio', 'gestor', 'consulta'] }
  ]

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador Master',
      admin_delegado: 'Admin Delegado',
      rh: 'Recursos Humanos',
      socio: 'Sócio-Diretor',
      gestor: 'Gestor de Equipe',
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
        {menuItems.map((item) => {
          let hasAccess = item.roles.includes(user?.role)
          if (item.id === 'financial' && user?.has_financial_access) {
            hasAccess = true
          }
          if (!hasAccess) return null
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {item.label}
            </button>
          )
        })}
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
