import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { 
  isOnline, 
  getSyncQueue, 
  syncPendingRequests 
} from '../utils/offlineSync'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Calendar,
  X,
  Users
} from 'lucide-react'

const Financial = () => {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-indexed

  // Filters
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth) // null means full year
  
  // Data
  const [summary, setSummary] = useState(null)
  const [revenues, setRevenues] = useState([])
  const [expenses, setExpenses] = useState([])
  
  // App States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOfflineState, setIsOfflineState] = useState(!isOnline())
  const [syncQueueCount, setSyncQueueCount] = useState(getSyncQueue().length)
  const [syncing, setSyncing] = useState(false)

  // Modals
  const [showRevModal, setShowRevModal] = useState(false)
  const [showExpModal, setShowExpModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null) // { type: 'revenue'|'expense', id, description, amount, category, date }
  
  // Form states
  const [formDesc, setFormDesc] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])

  // Syncing status
  useEffect(() => {
    const handleConnectionChange = () => {
      const online = isOnline()
      setIsOfflineState(!online)
      if (online) {
        handleAutoSync()
      }
    }

    const handleQueueChange = () => {
      setSyncQueueCount(getSyncQueue().length)
    }

    window.addEventListener('online', handleConnectionChange)
    window.addEventListener('offline', handleConnectionChange)
    window.addEventListener('sync-queue-changed', handleQueueChange)

    return () => {
      window.removeEventListener('online', handleConnectionChange)
      window.removeEventListener('offline', handleConnectionChange)
      window.removeEventListener('sync-queue-changed', handleQueueChange)
    }
  }, [])

  // Auto-sync when coming online
  const handleAutoSync = async () => {
    if (getSyncQueue().length > 0) {
      setSyncing(true)
      const res = await syncPendingRequests(api)
      setSyncing(false)
      if (res.success) {
        fetchFinancialData()
      }
    }
  }

  // Manual Sync Button
  const triggerManualSync = async () => {
    if (syncing) return
    setSyncing(true)
    const res = await syncPendingRequests(api)
    setSyncing(false)
    if (res.success) {
      fetchFinancialData()
    } else {
      alert('Algumas operações falharam ao sincronizar. O MeuRestô continuará tentando em segundo plano.')
    }
  }

  // Load data
  const fetchFinancialData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Get summary
      let summaryUrl = `/financial/summary?year=${year}`
      if (month !== null) {
        summaryUrl += `&month=${month}`
      }
      const summaryRes = await api.get(summaryUrl)
      setSummary(summaryRes.data)

      // 2. Get list of records for monthly view
      if (month !== null) {
        const revsRes = await api.get(`/financial/revenues?year=${year}&month=${month}`)
        setRevenues(revsRes.data)

        const expsRes = await api.get(`/financial/expenses?year=${year}&month=${month}`)
        setExpenses(expsRes.data)
      } else {
        setRevenues([])
        setExpenses([])
      }
      setLoading(false)
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar dados financeiros. Carregando do cache se disponível.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinancialData()
  }, [year, month])

  // Open Add/Edit Modal
  const openModal = (type, item = null) => {
    if (item) {
      setEditingItem({ ...item, type })
      setFormDesc(item.description)
      setFormAmount(item.amount.toString())
      setFormCategory(item.category)
      setFormDate(item.date)
    } else {
      setEditingItem(null)
      setFormDesc('')
      setFormAmount('')
      setFormCategory(type === 'revenue' ? 'Vendas' : 'Compras/Insumos')
      setFormDate(new Date().toISOString().split('T')[0])
    }

    if (type === 'revenue') {
      setShowRevModal(true)
    } else {
      setShowExpModal(true)
    }
  }

  // Save Revenue
  const handleSaveRevenue = async (e) => {
    e.preventDefault()
    const payload = {
      description: formDesc,
      amount: parseFloat(formAmount),
      category: formCategory,
      date: formDate
    }

    try {
      if (editingItem) {
        await api.put(`/financial/revenues/${editingItem.id}`, payload)
      } else {
        await api.post('/financial/revenues', payload)
      }
      setShowRevModal(false)
      fetchFinancialData()
    } catch (err) {
      console.error(err)
    }
  }

  // Save Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault()
    const payload = {
      description: formDesc,
      amount: parseFloat(formAmount),
      category: formCategory,
      date: formDate
    }

    try {
      if (editingItem) {
        await api.put(`/financial/expenses/${editingItem.id}`, payload)
      } else {
        await api.post('/financial/expenses', payload)
      }
      setShowExpModal(false)
      fetchFinancialData()
    } catch (err) {
      console.error(err)
    }
  }

  // Delete item
  const handleDeleteItem = async (type, id) => {
    if (!confirm('Tem certeza de que deseja excluir este lançamento?')) return
    try {
      if (type === 'revenue') {
        await api.delete(`/financial/revenues/${id}`)
      } else {
        await api.delete(`/financial/expenses/${id}`)
      }
      fetchFinancialData()
    } catch (err) {
      console.error(err)
    }
  }

  // Helpers
  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

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

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  const netResult = summary?.net_result || 0
  const isLoss = netResult < 0
  const marginPercentage = summary?.margin_percentage || 0

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Offline Alert Bar */}
      {isOfflineState && (
        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-300 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-bold">Você está operando offline</p>
              <p className="text-xs text-amber-400/90 mt-0.5">As alterações feitas serão armazenadas localmente e sincronizadas quando a conexão retornar.</p>
            </div>
          </div>
          {syncQueueCount > 0 && (
            <span className="bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">
              {syncQueueCount} pendentes
            </span>
          )}
        </div>
      )}

      {/* Online Sync Pending Alert */}
      {!isOfflineState && syncQueueCount > 0 && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-emerald-950/20">
          <div className="flex items-center gap-3">
            <Wifi className="w-5 h-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-bold">Conexão restaurada! {syncQueueCount} alterações pendentes.</p>
              <p className="text-xs text-emerald-400/90 mt-0.5">Clique em Sincronizar para atualizar o banco de dados em nuvem.</p>
            </div>
          </div>
          <button 
            onClick={triggerManualSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white text-xs rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Controle Financeiro
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão mensal e anual de entradas, saídas, salários e compras do MeuRestô.
          </p>
        </div>

        {/* Year & Month Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
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
              Ano Inteiro
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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Receitas */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Receitas totais</p>
            <h3 className="text-xl font-bold text-emerald-600">{formatCurrency(summary?.total_revenues)}</h3>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Despesas Manuais */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm border-l-4 border-l-orange-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Despesas Operacionais</p>
            <h3 className="text-xl font-bold text-orange-600">{formatCurrency(summary?.total_expenses)}</h3>
          </div>
          <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl text-orange-600">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Salários (Folha) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm border-l-4 border-l-purple-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Salários (Folha RH)</p>
            <h3 className="text-xl font-bold text-purple-600">{formatCurrency(summary?.total_salaries)}</h3>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-purple-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Resultado */}
        <div className={`bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm border-l-4 flex items-center justify-between ${
          isLoss ? 'border-l-red-500' : 'border-l-teal-600'
        }`}>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Resultado Líquido</p>
            <h3 className={`text-xl font-bold ${isLoss ? 'text-red-600' : 'text-teal-600'}`}>
              {formatCurrency(netResult)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Margem: {marginPercentage}%</p>
          </div>
          <div className={`p-3 rounded-xl border ${
            isLoss ? 'bg-red-50 border-red-100 text-red-600' : 'bg-teal-50 border-teal-100 text-teal-600'
          }`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      {month === null ? (
        // --- ANNUAL VIEW ---
        <div className="space-y-8 animate-fadeIn">
          {/* Bar Chart Receita x Despesa */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Histórico Mensal — {year}
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
              {summary?.monthly_breakdown.map((mb) => {
                const totalMonthExp = mb.expenses + mb.salaries
                const maxVal = Math.max(...(summary?.monthly_breakdown.map(x => Math.max(x.revenues, x.expenses + x.salaries))) || [1])
                const revHeight = (mb.revenues / maxVal) * 100
                const expHeight = (totalMonthExp / maxVal) * 100

                return (
                  <div key={mb.month} className="flex-1 flex flex-col items-center gap-2 min-w-[50px] group">
                    <div className="w-full flex items-end justify-center gap-1 h-44 relative">
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-10 whitespace-nowrap">
                        <p className="font-bold text-slate-300">{mb.month_name}</p>
                        <p className="text-emerald-400">Rec: {formatCurrency(mb.revenues)}</p>
                        <p className="text-rose-400">Des: {formatCurrency(totalMonthExp)}</p>
                        <p className={`font-semibold border-t border-slate-700 mt-1 pt-1 ${mb.net < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                          Líq: {formatCurrency(mb.net)}
                        </p>
                      </div>

                      {/* Revenue Bar */}
                      <div 
                        className="w-4 bg-emerald-500 hover:bg-emerald-600 rounded-t-sm transition-all duration-500 shadow-sm"
                        style={{ height: `${Math.max(revHeight, 2)}%` }}
                      ></div>
                      {/* Expense Bar */}
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

          {/* Detailed breakdown table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Relatório Detalhado Mensal</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Mês</th>
                    <th className="px-6 py-4 text-right">Receitas</th>
                    <th className="px-6 py-4 text-right">Despesas Operacionais</th>
                    <th className="px-6 py-4 text-right">Salários (RH)</th>
                    <th className="px-6 py-4 text-right">Despesa Total</th>
                    <th className="px-6 py-4 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {summary?.monthly_breakdown.map((mb) => {
                    const totalMonthExp = mb.expenses + mb.salaries
                    const isMonthLoss = mb.net < 0
                    return (
                      <tr key={mb.month} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{mb.month_name}</td>
                        <td className="px-6 py-4 text-right text-emerald-600">{formatCurrency(mb.revenues)}</td>
                        <td className="px-6 py-4 text-right text-orange-600">{formatCurrency(mb.expenses)}</td>
                        <td className="px-6 py-4 text-right text-purple-600">{formatCurrency(mb.salaries)}</td>
                        <td className="px-6 py-4 text-right text-rose-600">{formatCurrency(totalMonthExp)}</td>
                        <td className={`px-6 py-4 text-right font-bold ${isMonthLoss ? 'text-red-600' : 'text-teal-600'}`}>
                          {formatCurrency(mb.net)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // --- MONTHLY VIEW ---
        <div className="space-y-8 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Revenues (Receitas) section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-emerald-500 w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Receitas</h3>
                </div>
                <button
                  onClick={() => openModal('revenue')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm shadow-emerald-900/10 hover:shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lançar
                </button>
              </div>

              <div className="flex-1 overflow-x-auto">
                {revenues.length === 0 ? (
                  <p className="text-sm text-slate-400 py-12 text-center">Nenhuma receita lançada neste mês.</p>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                        <th className="py-2.5">Categoria</th>
                        <th className="py-2.5">Descrição</th>
                        <th className="py-2.5">Data</th>
                        <th className="py-2.5 text-right font-bold">Valor</th>
                        <th className="py-2.5 text-center w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                      {revenues.map((rev) => (
                        <tr key={rev.id} className="hover:bg-slate-50/50">
                          <td className="py-3">
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] rounded-full uppercase font-bold">
                              {rev.category}
                            </span>
                          </td>
                          <td className="py-3 truncate max-w-[120px]" title={rev.description}>{rev.description}</td>
                          <td className="py-3 text-slate-400">{new Date(rev.date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-3 text-right font-bold text-emerald-600">{formatCurrency(rev.amount)}</td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => openModal('revenue', rev)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                title="Editar"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteItem('revenue', rev.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Expenses (Despesas) section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <TrendingDown className="text-orange-500 w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Despesas Operacionais</h3>
                </div>
                <button
                  onClick={() => openModal('expense')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm shadow-orange-900/10 hover:shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lançar
                </button>
              </div>

              <div className="flex-1 overflow-x-auto">
                {expenses.length === 0 ? (
                  <p className="text-sm text-slate-400 py-12 text-center">Nenhuma despesa operacional lançada neste mês.</p>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                        <th className="py-2.5">Categoria</th>
                        <th className="py-2.5">Descrição</th>
                        <th className="py-2.5">Data</th>
                        <th className="py-2.5 text-right font-bold">Valor</th>
                        <th className="py-2.5 text-center w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/50">
                          <td className="py-3">
                            <span className="px-2 py-0.5 bg-orange-50 border border-orange-100 text-orange-700 text-[10px] rounded-full uppercase font-bold">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 truncate max-w-[120px]" title={exp.description}>{exp.description}</td>
                          <td className="py-3 text-slate-400">{new Date(exp.date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-3 text-right font-bold text-orange-600">{formatCurrency(exp.amount)}</td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => openModal('expense', exp)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                title="Editar"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteItem('expense', exp.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

          {/* Salários (Folha) Automático Details */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users className="text-purple-500 w-5 h-5" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Folha de Salários Integrada (RH)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Valores apurados de forma automática com base nos contratos ativos dos colaboradores.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-slate-600 text-xs font-semibold max-w-xl">
              💡 Os salários são gerados a partir do cadastro do colaborador no módulo de **Colaboradores**. Caso ocorra alguma alteração nos cargos ou admissões/demissões, este resumo financeiro atualizará a folha de pagamento do respectivo mês automaticamente.
            </div>
            
            {/* Note: In this local system, we don't fetch the list of employees explicitly for financial. But we can present the total salaries as verified. */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-slate-50 p-4 flex items-center justify-between text-xs font-bold text-slate-700 uppercase">
                <span>Resumo da Folha</span>
                <span className="text-purple-700 text-sm">{formatCurrency(summary?.total_salaries)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- REVENUE MODAL --- */}
      {showRevModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-scaleUp">
            <button 
              onClick={() => setShowRevModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-800 mb-6 uppercase tracking-wide border-b border-slate-100 pb-2">
              {editingItem ? 'Editar Receita' : 'Adicionar Receita'}
            </h3>

            <form onSubmit={handleSaveRevenue} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Categoria</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {['Vendas', 'Delivery', 'Eventos', 'Outros'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Descrição</label>
                <input 
                  type="text" 
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  required
                  placeholder="Ex: Vendas Delivery Almoço"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Data</label>
                  <input 
                    type="date" 
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 text-xs font-bold border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowRevModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EXPENSE MODAL --- */}
      {showExpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-scaleUp">
            <button 
              onClick={() => setShowExpModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-800 mb-6 uppercase tracking-wide border-b border-slate-100 pb-2">
              {editingItem ? 'Editar Despesa' : 'Adicionar Despesa'}
            </h3>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Categoria</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {['Compras/Insumos', 'Aluguel', 'Energia/Água', 'Equipamentos', 'Marketing', 'Outros'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Descrição</label>
                <input 
                  type="text" 
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  required
                  placeholder="Ex: Compra de Carnes e Hortifrúti"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Data</label>
                  <input 
                    type="date" 
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 text-xs font-bold border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowExpModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Financial
