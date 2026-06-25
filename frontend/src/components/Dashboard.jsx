import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  Cake,
  TrendingUp,
  Activity,
  FolderKanban
} from 'lucide-react'

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  // Fetch employee list for the visual dropdown
  useEffect(() => {
    const fetchEmployeesList = async () => {
      try {
        const res = await api.get('/employees')
        setEmployees(res.data)
      } catch (e) {
        // Silent catch
      }
    }
    fetchEmployeesList()
  }, [])

  // Fetch dashboard metrics
  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (selectedEmployeeId) {
        params.employee_id = selectedEmployeeId
      }
      const response = await api.get('/dashboard', { params })
      setData(response.data)
      setLoading(false)
    } catch (err) {
      setError('Erro ao carregar dados do dashboard.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [selectedEmployeeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 border border-red-200 rounded-xl">
        {error}
      </div>
    )
  }

  const { kpis, birthdays, charts } = data

  // Define KPIs dynamically based on general vs individual view
  let kpiCards = []
  if (data?.is_individual) {
    kpiCards = [
      { label: 'Status Atual', value: data.employee.status_label, icon: Activity, color: 'border-l-4 border-l-blue-600' },
      { 
        label: 'Salário Base', 
        value: `R$ ${kpis.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
        icon: DollarSign, 
        color: 'border-l-4 border-l-amber-500' 
      },
      { label: 'Horas Extras', value: `${kpis.overtime_hours}h`, icon: Clock, color: 'border-l-4 border-l-purple-500' },
      { label: 'Advertências', value: kpis.warnings_count, icon: AlertTriangle, color: 'border-l-4 border-l-yellow-500' },
      { label: 'Suspensões', value: kpis.suspensions_count, icon: AlertTriangle, color: 'border-l-4 border-l-rose-600' },
      { label: 'Total Afastamentos', value: kpis.leaves_count, icon: Activity, color: 'border-l-4 border-l-orange-500' }
    ]
  } else {
    kpiCards = [
      { label: 'Colaboradores Ativos', value: kpis.active_employees, icon: Users, color: 'border-l-4 border-l-blue-600' },
      { label: 'Colaboradores Afastados', value: kpis.on_leave_employees, icon: Activity, color: 'border-l-4 border-l-orange-500' },
      { label: 'Admissões (Ano)', value: kpis.admissions_this_year, icon: UserPlus, color: 'border-l-4 border-l-emerald-500' },
      { label: 'Desligados (Histórico)', value: kpis.terminated_employees, icon: UserMinus, color: 'border-l-4 border-l-red-500' },
      { 
        label: 'Média Salarial', 
        value: `R$ ${kpis.average_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
        icon: DollarSign, 
        color: 'border-l-4 border-l-amber-500' 
      },
      { label: 'Horas Extras (Total)', value: `${kpis.overtime_hours}h`, icon: Clock, color: 'border-l-4 border-l-purple-500' },
      { label: 'Advertências Aplicadas', value: kpis.warnings_count, icon: AlertTriangle, color: 'border-l-4 border-l-yellow-500' },
      { label: 'Suspensões Aplicadas', value: kpis.suspensions_count, icon: AlertTriangle, color: 'border-l-4 border-l-rose-600' }
    ]
  }

  const getMaxCount = (arr) => {
    if (!arr || arr.length === 0) return 1
    return Math.max(...arr.map(item => item.count))
  }

  const maxDeptCount = charts ? getMaxCount(charts.by_department) : 1
  const maxRoleCount = charts ? getMaxCount(charts.by_role) : 1

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header and Search Filter */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {data?.is_individual ? `Dashboard Individual: ${data.employee.name}` : 'Dashboard Executivo'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.is_individual 
              ? 'Visualizando métricas e histórico profissional individual deste colaborador.' 
              : 'Métricas gerais e indicadores de pessoal do MeuRestô.'}
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 w-full md:w-80">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Visualização:</span>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">Visão Geral (Todos)</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.registration_number})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <div 
              key={idx} 
              className={`bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between ${kpi.color}`}
            >
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                <h3 className="text-xl font-bold text-slate-800">{kpi.value}</h3>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Individual Details Section */}
      {data?.is_individual && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="text-amber-500 w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Ficha Profissional Reduzida</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Colaborador</span>
              <span className="text-slate-800 font-bold text-base">{data.employee.name}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Matrícula</span>
              <span className="text-slate-800 font-bold text-base">{data.employee.registration_number}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Cargo / Função</span>
              <span className="text-slate-800 font-semibold text-base">{data.employee.role}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Setor / Departamento</span>
              <span className="text-slate-800 font-semibold text-base">{data.employee.department}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Data de Admissão</span>
              <span className="text-slate-800 font-semibold text-base">{data.employee.admission_date}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Jornada Contratual</span>
              <span className="text-slate-800 font-semibold text-base">Escala {data.employee.scale_type}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Aniversário</span>
              <span className="text-slate-800 font-semibold text-base">{data.employee.dob}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Aniversariante do Mês</span>
              <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                data.employee.is_birthday_this_month 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {data.employee.is_birthday_this_month ? 'Sim (🎂)' : 'Não'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Charts & Birthdays (only shown on General View) */}
      {!data?.is_individual && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Chart 1: Departamentos */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm xl:col-span-1">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
              <FolderKanban className="text-amber-500 w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Colaboradores por Departamento</h3>
            </div>
            
            <div className="space-y-4">
              {charts.by_department.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Nenhum colaborador alocado.</p>
              ) : (
                charts.by_department.map((dept, idx) => {
                  const pct = (dept.count / maxDeptCount) * 100
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700 truncate max-w-[180px]">{dept.name}</span>
                        <span className="text-slate-500">{dept.count} colab.</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-amber-600 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Chart 2: Cargos */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm xl:col-span-1">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
              <TrendingUp className="text-amber-500 w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Distribuição por Cargo</h3>
            </div>
            
            <div className="space-y-4">
              {charts.by_role.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Nenhum cargo ativo.</p>
              ) : (
                charts.by_role.map((role, idx) => {
                  const pct = (role.count / maxRoleCount) * 100
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700 truncate max-w-[180px]">{role.name}</span>
                        <span className="text-slate-500">{role.count} colab.</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-slate-800 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Birthdays Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm xl:col-span-1">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
              <Cake className="text-amber-500 w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Aniversariantes do Mês</h3>
            </div>
            
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {birthdays.length === 0 ? (
                <div className="text-center py-8">
                  <Cake className="text-slate-300 w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhum aniversariante neste mês.</p>
                </div>
              ) : (
                birthdays.map((birth, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-xs">
                        {birth.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">{birth.name}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{birth.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700 rounded-full">
                        {birth.dob}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
