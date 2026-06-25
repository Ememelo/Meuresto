import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
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
  FolderKanban,
  Calendar
} from 'lucide-react'

const Dashboard = () => {
  const { user } = useAuth()
  const isSocioOrAdmin = user?.role === 'admin' || user?.role === 'socio'

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(null) // null = Total (Ano Inteiro)

  const [data, setData] = useState(null)
  const [financialSummary, setFinancialSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  const monthsList = [
    { num: 1, name: 'Jan' },
    { num: 2, name: 'Fev' },
    { num: 3, name: 'Mar' },
    { num: 4, name: 'Abr' },
    { num: 5, name: 'Mai' },
    { num: 6, name: 'Jun' },
    { num: 7, name: 'Jul' },
    { num: 8, name: 'Ago' },
    { num: 9, name: 'Set' },
    { num: 10, name: 'Out' },
    { num: 11, name: 'Nov' },
    { num: 12, name: 'Dez' }
  ]

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
      const params = { year }
      if (selectedEmployeeId) {
        params.employee_id = selectedEmployeeId
      }
      if (month !== null) {
        params.month = month
      }
      
      // Fetch executive dashboard metrics
      const response = await api.get('/dashboard', { params })
      setData(response.data)

      // Fetch financial summary if user has permission and is in general view
      if (isSocioOrAdmin && !selectedEmployeeId) {
        let finUrl = `/financial/summary?year=${year}`
        if (month !== null) {
          finUrl += `&month=${month}`
        }
        const finRes = await api.get(finUrl)
        setFinancialSummary(finRes.data)
      } else {
        setFinancialSummary(null)
      }

      setLoading(false)
    } catch (err) {
      setError('Erro ao carregar dados do dashboard.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [selectedEmployeeId, year, month])


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
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {data?.is_individual ? `Dashboard Individual: ${data.employee.name}` : 'Dashboard Executivo'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.is_individual 
              ? 'Visualizando métricas e histórico profissional individual deste colaborador.' 
              : 'Métricas gerais, indicadores de pessoal e gráficos do MeuRestô.'}
          </p>
        </div>
        
        {/* Controls: Employee Picker, Year Picker, Month Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Colaborador:</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
            >
              <option value="">Visão Geral (Todos)</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.registration_number})
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
            >
              {Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>

          {/* Month selector Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center overflow-x-auto max-w-full gap-0.5 scrollbar-none">
            <button
              onClick={() => setMonth(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                month === null 
                  ? 'bg-white text-slate-800 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Total
            </button>
            {monthsList.map(m => (
              <button
                key={m.num}
                onClick={() => setMonth(m.num)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  month === m.num 
                    ? 'bg-white text-slate-800 shadow-sm font-bold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
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
        <div className="space-y-8 animate-fadeIn">
          {/* Monthly Financial Bar Chart (Only for Socio/Admin in Yearly View) */}
          {isSocioOrAdmin && month === null && financialSummary && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Histórico Mensal Financeiro — {year}
                </h3>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
                    <span className="text-slate-600">Receitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500"></span>
                    <span className="text-slate-600">Despesas Totais</span>
                  </div>
                </div>
              </div>

              {/* Pure HTML Bar Chart */}
              <div className="h-64 flex items-end justify-between gap-2 px-2 md:px-6 pt-6 overflow-x-auto scrollbar-none">
                {financialSummary.monthly_breakdown.map((mb) => {
                  const totalMonthExp = mb.expenses + mb.salaries
                  const maxVal = Math.max(...(financialSummary.monthly_breakdown.map(x => Math.max(x.revenues, x.expenses + x.salaries))) || [1])
                  const revHeight = (mb.revenues / maxVal) * 100
                  const expHeight = (totalMonthExp / maxVal) * 100

                  return (
                    <div key={mb.month} className="flex-1 flex flex-col items-center gap-2 min-w-[50px] group">
                      <div className="w-full flex items-end justify-center gap-1 h-44 relative">
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-10 whitespace-nowrap">
                          <p className="font-bold text-slate-300">{mb.month_name}</p>
                          <p className="text-emerald-400">Rec: R$ {mb.revenues.toLocaleString('pt-BR')}</p>
                          <p className="text-rose-400">Des: R$ {totalMonthExp.toLocaleString('pt-BR')}</p>
                          <p className={`font-semibold border-t border-slate-700 mt-1 pt-1 ${mb.net < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                            Líq: R$ {mb.net.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div 
                          className="w-4 bg-emerald-500 hover:bg-emerald-600 rounded-t-sm transition-all duration-500 shadow-sm"
                          style={{ height: `${Math.max(revHeight, 2)}%` }}
                        ></div>
                        <div 
                          className="w-4 bg-rose-500 hover:bg-rose-600 rounded-t-sm transition-all duration-500 shadow-sm"
                          style={{ height: `${Math.max(expHeight, 2)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{mb.month_name.substring(0,3)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Charts and Lists Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Chart 1: Departamentos */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                <FolderKanban className="text-amber-500 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Colaboradores por Setor</h3>
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
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
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

            {/* Chart 3: Receitas por Categoria (Only for Socio/Admin) */}
            {isSocioOrAdmin && financialSummary && (
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                  <TrendingUp className="text-emerald-500 w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Receitas por Categoria</h3>
                </div>
                <div className="space-y-4">
                  {(!financialSummary.category_revenues || Object.keys(financialSummary.category_revenues).length === 0) ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Nenhuma receita registrada.</p>
                  ) : (
                    (() => {
                      const maxVal = Math.max(...Object.values(financialSummary.category_revenues), 1)
                      return Object.entries(financialSummary.category_revenues)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, val]) => {
                          const pct = (val / maxVal) * 100
                          return (
                            <div key={cat} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-slate-700 font-bold">{cat}</span>
                                <span className="text-slate-500 font-mono">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          )
                        })
                    })()
                  )}
                </div>
              </div>
            )}

            {/* Chart 4: Despesas por Categoria (Only for Socio/Admin) */}
            {isSocioOrAdmin && financialSummary && (
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Activity className="text-rose-500 w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Despesas por Categoria</h3>
                </div>
                <div className="space-y-4">
                  {(!financialSummary.category_expenses || Object.keys(financialSummary.category_expenses).length === 0) ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Nenhuma despesa registrada.</p>
                  ) : (
                    (() => {
                      const maxVal = Math.max(...Object.values(financialSummary.category_expenses), 1)
                      return Object.entries(financialSummary.category_expenses)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, val]) => {
                          const pct = (val / maxVal) * 100
                          const isSalary = cat === 'Salários'
                          return (
                            <div key={cat} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-slate-700 font-bold">{cat}</span>
                                <span className="text-slate-500 font-mono">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all duration-500 ${isSalary ? 'bg-purple-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          )
                        })
                    })()
                  )}
                </div>
              </div>
            )}

            {/* Birthdays Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                <Cake className="text-amber-500 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Aniversariantes {month ? `de ${monthsList.find(m => m.num === month)?.name}` : 'do Mês'}
                </h3>
              </div>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {birthdays.length === 0 ? (
                  <div className="text-center py-8">
                    <Cake className="text-slate-300 w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Nenhum aniversariante neste período.</p>
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
        </div>
      )}
    </div>
  )
}

export default Dashboard

