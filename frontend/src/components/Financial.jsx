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
  Users,
  Briefcase,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Truck,
  FileText
} from 'lucide-react'
import SearchableSelect from './SearchableSelect'

const Financial = ({ forceSubTab }) => {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-indexed

  // Filters and Sub-Tabs
  const [subTab, setSubTab] = useState('dashboard') // dashboard, revenues, payments, suppliers, reports
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth) // null means full year

  // Data State
  const [summary, setSummary] = useState(null)
  const [revenues, setRevenues] = useState([])
  const [expenses, setExpenses] = useState([])
  const [suppliers, setSuppliers] = useState([])

  // Loading & App States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isOfflineState, setIsOfflineState] = useState(!isOnline())
  const [syncQueueCount, setSyncQueueCount] = useState(getSyncQueue().length)
  const [syncing, setSyncing] = useState(false)

  // Modals
  const [showRevModal, setShowRevModal] = useState(false)
  const [showExpModal, setShowExpModal] = useState(false)
  const [showSuppModal, setShowSuppModal] = useState(false)
  
  // Edit items
  const [editingItem, setEditingItem] = useState(null) // { type: 'revenue'|'expense'|'supplier', id, ... }

  // Clients states
  const [clients, setClients] = useState([])
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientForm, setClientForm] = useState({
    corporate_name: '',
    trade_name: '',
    cnpj: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    is_active: true
  })

  // Salary adjustments states
  const [employees, setEmployees] = useState([])
  const [salaryAdjustments, setSalaryAdjustments] = useState([])
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [salaryForm, setSalaryForm] = useState({
    employee_id: '',
    year: currentYear,
    month: currentMonth,
    vacation_payment: '',
    discount: '',
    notes: ''
  })

  // Revenue Form
  const [revForm, setRevForm] = useState({
    description: '',
    amount: '',
    category: 'Vendas',
    date: new Date().toISOString().split('T')[0],
    expected_date: new Date().toISOString().split('T')[0],
    received_date: '',
    payment_method: 'PIX',
    status: 'A Receber',
    client: '',
    observations: ''
  })

  // Expense Form
  const [expForm, setExpForm] = useState({
    description: '',
    amount: '',
    category: 'Compras: Carnes',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    payment_date: '',
    payment_method: 'PIX',
    status: 'Pendente',
    supplier_id: '',
    observations: '',
    is_recurring: false,
    recurrence_period: 'mensal'
  })

  // Supplier Form
  const [suppForm, setSuppForm] = useState({
    corporate_name: '',
    trade_name: '',
    cnpj: '',
    state_inscription: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    category: 'Carnes',
    preferred_payment_method: 'PIX',
    bank: '',
    agency: '',
    account: '',
    pix_key: '',
    payment_terms: '30 dias',
    delivery_days: 'Segunda-feira',
    notes: '',
    is_active: true
  })

  // Reports Form
  const [reportFilters, setReportFilters] = useState({
    start_date: '',
    end_date: '',
    category: '',
    supplier_id: '',
    payment_method: '',
    status: ''
  })

  // Grouped Categories for Expense Dropdown
  const expenseCategoriesGrouped = {
    "Compras": ["Compras: Carnes", "Compras: Hortifruti", "Compras: Bebidas", "Compras: Congelados", "Compras: Laticínios", "Compras: Embalagens", "Compras: Produtos de Limpeza", "Compras: Descartáveis"],
    "Estrutura": ["Estrutura: Aluguel", "Estrutura: Condomínio", "Estrutura: IPTU", "Estrutura: Energia", "Estrutura: Água", "Estrutura: Gás", "Estrutura: Internet", "Estrutura: Telefonia"],
    "Pessoas": ["Pessoas: Salários", "Pessoas: Vale Transporte", "Pessoas: Vale Alimentação", "Pessoas: Benefícios"],
    "Financeiro": ["Financeiro: Impostos", "Financeiro: Taxas Bancárias", "Financeiro: Taxas de Cartão", "Financeiro: Aluguel de Maquininhas", "Financeiro: Juros", "Financeiro: Multas"],
    "Tecnologia": ["Tecnologia: Sistema ERP", "Tecnologia: Licenças", "Tecnologia: Hospedagem", "Tecnologia: Domínio", "Tecnologia: Equipamentos"],
    "Manutenção": ["Manutenção: Equipamentos", "Manutenção: Ar Condicionado", "Manutenção: Freezers", "Manutenção: Geladeiras", "Manutenção: Informática", "Manutenção: Manutenção Predial"],
    "Marketing": ["Marketing: Redes Sociais", "Marketing: Publicidade", "Marketing: Campanhas"],
    "Outros": ["Outros"]
  }

  // Flattened category arrays
  const expenseCategoriesFlat = Object.values(expenseCategoriesGrouped).flat()
  const supplierCategories = [
    'Carnes', 'Hortifruti', 'Bebidas', 'Congelados', 'Laticínios', 'Limpeza', 
    'Embalagens', 'Descartáveis', 'Equipamentos', 'Tecnologia', 'Marketing', 
    'Manutenção', 'Outros'
  ]

  const revenueCategories = [
    'Vendas', 'Delivery', 'Eventos', 'iFood', 'Uber Eats', 'Outros'
  ]

  const paymentMethods = [
    'PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 
    'Transferência Bancária', 'TED', 'DOC', 'Boleto', 'Cheque', 'Débito Automático'
  ]

  // Setup connection monitoring
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

  // Fetch Financial Data
  const fetchFinancialData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch Summary
      let summaryUrl = `/financial/summary?year=${year}`
      if (month !== null) {
        summaryUrl += `&month=${month}`
      }
      const summaryRes = await api.get(summaryUrl)
      setSummary(summaryRes.data)

      // 2. Fetch Revenues, Expenses, Suppliers
      const revsRes = await api.get(`/financial/revenues${month !== null ? `?year=${year}&month=${month}` : `?year=${year}`}`)
      setRevenues(revsRes.data)

      const expsRes = await api.get(`/financial/expenses${month !== null ? `?year=${year}&month=${month}` : `?year=${year}`}`)
      setExpenses(expsRes.data)

      const suppRes = await api.get('/suppliers')
      setSuppliers(suppRes.data)

      // Fetch clients, employees and salary adjustments
      try {
        const clientsRes = await api.get('/clients')
        setClients(clientsRes.data)
      } catch (cErr) {
        console.warn('Failed to load clients:', cErr)
      }

      try {
        const empRes = await api.get('/employees')
        setEmployees(empRes.data)
      } catch (eErr) {
        console.warn('Failed to load employees:', eErr)
      }

      try {
        const targetMonth = month !== null ? month : currentMonth
        const adjRes = await api.get(`/financial/salary-adjustments?year=${year}&month=${targetMonth}`)
        setSalaryAdjustments(adjRes.data)
      } catch (aErr) {
        console.warn('Failed to load salary adjustments:', aErr)
      }

      // Set default supplier in form if empty
      if (suppRes.data.length > 0 && !expForm.supplier_id) {
        setExpForm(prev => ({ ...prev, supplier_id: suppRes.data[0].id }))
      }
      setLoading(false)
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar dados financeiros. Exibindo dados em cache.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinancialData()
  }, [year, month])

  useEffect(() => {
    if (forceSubTab) {
      setSubTab(forceSubTab)
    } else {
      setSubTab('dashboard')
    }
  }, [forceSubTab])

  // Helpers
  const formatCurrency = (val) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  const getStatusBadgeClass = (status) => {
    const s = status?.toLowerCase()
    if (s === 'recebido' || s === 'pago') return 'bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold'
    if (s === 'a receber' || s === 'pendente') return 'bg-amber-100 border border-amber-300 text-amber-800 font-bold'
    return 'bg-rose-100 border border-rose-300 text-rose-800 font-bold'
  }

  // Open Add/Edit Modals
  const openRevModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setRevForm({
        description: item.description,
        amount: item.amount.toString(),
        category: item.category,
        date: item.date,
        expected_date: item.expected_date || item.date,
        received_date: item.received_date || '',
        payment_method: item.payment_method || 'PIX',
        status: item.status,
        client: item.client || '',
        client_id: item.client_id || '',
        observations: item.observations || ''
      })
    } else {
      setEditingItem(null)
      setRevForm({
        description: '',
        amount: '',
        category: 'Vendas',
        date: new Date().toISOString().split('T')[0],
        expected_date: new Date().toISOString().split('T')[0],
        received_date: '',
        payment_method: 'PIX',
        status: 'A Receber',
        client: '',
        client_id: '',
        observations: ''
      })
    }
    setShowRevModal(true)
  }

  const openExpModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setExpForm({
        description: item.description,
        amount: item.amount.toString(),
        category: item.category,
        date: item.date,
        due_date: item.due_date || item.date,
        payment_date: item.payment_date || '',
        payment_method: item.payment_method || 'PIX',
        status: item.status,
        supplier_id: item.supplier_id || (suppliers[0]?.id || ''),
        observations: item.observations || '',
        is_recurring: item.is_recurring,
        recurrence_period: item.recurrence_period || 'mensal'
      })
    } else {
      setEditingItem(null)
      setExpForm({
        description: '',
        amount: '',
        category: 'Compras: Carnes',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        payment_date: '',
        payment_method: 'PIX',
        status: 'Pendente',
        supplier_id: suppliers[0]?.id || '',
        observations: '',
        is_recurring: false,
        recurrence_period: 'mensal'
      })
    }
    setShowExpModal(true)
  }

  const openSuppModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setSuppForm({
        corporate_name: item.corporate_name,
        trade_name: item.trade_name,
        cnpj: item.cnpj,
        state_inscription: item.state_inscription || '',
        contact_person: item.contact_person || '',
        phone: item.phone || '',
        whatsapp: item.whatsapp || '',
        email: item.email || '',
        address: item.address || '',
        category: item.category,
        preferred_payment_method: item.preferred_payment_method || 'PIX',
        bank: item.bank || '',
        agency: item.agency || '',
        account: item.account || '',
        pix_key: item.pix_key || '',
        payment_terms: item.payment_terms || '30 dias',
        delivery_days: item.delivery_days || '',
        notes: item.notes || '',
        is_active: item.is_active
      })
    } else {
      setEditingItem(null)
      setSuppForm({
        corporate_name: '',
        trade_name: '',
        cnpj: '',
        state_inscription: '',
        contact_person: '',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        category: 'Carnes',
        preferred_payment_method: 'PIX',
        bank: '',
        agency: '',
        account: '',
        pix_key: '',
        payment_terms: '30 dias',
        delivery_days: '',
        notes: '',
        is_active: true
      })
    }
    setShowSuppModal(true)
  }

  // Save Handlers
  const handleSaveRevenue = async (e) => {
    e.preventDefault()
    const payload = {
      ...revForm,
      amount: parseFloat(revForm.amount),
      received_date: revForm.status === 'Recebido' ? (revForm.received_date || revForm.date) : null
    }
    try {
      if (editingItem) {
        await api.put(`/financial/revenues/${editingItem.id}`, payload)
        setSuccess('Lançamento de recebimento atualizado com sucesso!')
      } else {
        await api.post('/financial/revenues', payload)
        setSuccess('Lançamento de recebimento adicionado com sucesso!')
      }
      setShowRevModal(false)
      fetchFinancialData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar recebimento.')
    }
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault()
    const payload = {
      ...expForm,
      amount: parseFloat(expForm.amount),
      payment_date: expForm.status === 'Pago' ? (expForm.payment_date || expForm.date) : null,
      recurrence_period: expForm.is_recurring ? expForm.recurrence_period : null
    }
    try {
      if (editingItem) {
        await api.put(`/financial/expenses/${editingItem.id}`, payload)
        setSuccess('Lançamento de pagamento atualizado com sucesso!')
      } else {
        await api.post('/financial/expenses', payload)
        setSuccess('Lançamento de pagamento adicionado com sucesso!')
      }
      setShowExpModal(false)
      fetchFinancialData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar pagamento.')
    }
  }

  const handleSaveSupplier = async (e) => {
    e.preventDefault()
    try {
      if (editingItem) {
        await api.put(`/suppliers/${editingItem.id}`, suppForm)
        setSuccess('Fornecedor atualizado com sucesso!')
      } else {
        await api.post('/suppliers', suppForm)
        setSuccess('Fornecedor cadastrado com sucesso!')
      }
      setShowSuppModal(false)
      fetchFinancialData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Erro ao salvar fornecedor.')
    }
  }

  const handleSaveClient = async (e) => {
    e.preventDefault()
    try {
      if (editingItem && editingItem.type === 'client') {
        await api.put(`/clients/${editingItem.id}`, clientForm)
        setSuccess('Cliente parceiro atualizado com sucesso!')
      } else {
        await api.post('/clients', clientForm)
        setSuccess('Cliente parceiro cadastrado com sucesso!')
      }
      setShowClientModal(false)
      const clis = await api.get('/clients')
      setClients(clis.data)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Erro ao salvar cliente parceiro.')
    }
  }

  const handleSaveSalaryAdjustment = async (e) => {
    e.preventDefault()
    const payload = {
      ...salaryForm,
      vacation_payment: parseFloat(salaryForm.vacation_payment || '0'),
      discount: parseFloat(salaryForm.discount || '0')
    }
    try {
      await api.post('/financial/salary-adjustments', payload)
      setSuccess('Lançamento de folha de pagamento atualizado com sucesso!')
      setShowSalaryModal(false)
      const targetMonth = month !== null ? month : currentMonth
      const adjRes = await api.get(`/financial/salary-adjustments?year=${year}&month=${targetMonth}`)
      setSalaryAdjustments(adjRes.data)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Erro ao salvar lançamentos do salário.')
    }
  }

  // Deletion / Cancellation Handlers
  const handleDeleteItem = async (type, item) => {
    if (!confirm(`Tem certeza de que deseja excluir permanentemente o lançamento "${item.description}"?`)) return
    try {
      if (type === 'revenue') {
        await api.delete(`/financial/revenues/${item.id}`)
      } else {
        await api.delete(`/financial/expenses/${item.id}`)
      }
      setSuccess('Lançamento excluído com sucesso!')
      fetchFinancialData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError('Erro ao excluir lançamento.')
    }
  }

  const handleDeleteSupplier = async (id) => {
    if (!confirm('Deseja realmente excluir este fornecedor? Todos os lançamentos vinculados ficarão sem fornecedor associado.')) return
    try {
      await api.delete(`/suppliers/${id}`)
      setSuccess('Fornecedor excluído com sucesso!')
      fetchFinancialData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Erro ao excluir fornecedor.')
    }
  }

  // Reports Generator Calls
  const downloadReport = async (format) => {
    let params = []
    Object.entries(reportFilters).forEach(([k, v]) => {
      if (v) params.push(`${k}=${v}`)
    })
    const queryStr = params.length > 0 ? `?${params.join('&')}` : ''
    
    try {
      setSuccess('Processando relatório...')
      const response = await api.get(`/reports/financial/${format}${queryStr}`, {
        responseType: 'blob'
      })
      
      const blobType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
      const blob = new Blob([response.data], { type: blobType })
      const url = window.URL.createObjectURL(blob)
      
      if (format === 'pdf') {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `relatorio_financeiro_${new Date().toISOString().slice(0,10)}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      
      window.URL.revokeObjectURL(url)
      setSuccess('Relatório exportado com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setError('Erro ao baixar relatório.')
      setTimeout(() => setError(null), 3000)
    }
  }

  // Conic gradients calculation for Donuts
  const renderDonutChart = (data, isExpenses = true) => {
    const total = Object.values(data).reduce((a, b) => a + b, 0)
    if (total === 0) {
      return (
        <div className="w-[180px] h-[180px] rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
          <p className="text-xs text-slate-400 font-bold">Sem dados</p>
        </div>
      )
    }

    let accum = 0
    const palette = [
      "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", 
      "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"
    ]
    
    const slices = Object.entries(data).map(([cat, val], idx) => {
      const percentage = (val / total) * 100
      const start = accum
      accum += percentage
      return `${palette[idx % palette.length]} ${start}% ${accum}%`
    })

    const donutStyle = {
      background: `conic-gradient(${slices.join(', ')})`,
      borderRadius: '50%',
      width: '180px',
      height: '180px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }

    return (
      <div style={donutStyle} className="shadow-lg shadow-slate-900/10">
        <div className="w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total</span>
          <span className="text-xs font-black text-slate-800 mt-0.5">{formatCurrency(total)}</span>
        </div>
      </div>
    )
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Sync Alerts */}
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

      {!isOfflineState && syncQueueCount > 0 && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-emerald-950/20">
          <div className="flex items-center gap-3">
            <Wifi className="w-5 h-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-bold">Conexão restaurada! {syncQueueCount} alterações pendentes.</p>
              <p className="text-xs text-emerald-400/90 mt-0.5">Clique em Sincronizar para atualizar o banco de dados central.</p>
            </div>
          </div>
          <button 
            onClick={triggerManualSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white text-xs rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all animate-pulse"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}

      {/* Success/Error Alerts */}
      {success && (
        <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-rose-100 border border-rose-300 text-rose-800 p-4 rounded-xl flex items-center gap-3 shadow-md">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Internal Navigation Sub-tabs */}
      {subTab !== 'suppliers' && subTab !== 'clients' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
          <button 
            onClick={() => setSubTab('dashboard')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
              subTab === 'dashboard' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setSubTab('revenues')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
              subTab === 'revenues' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Recebimentos
          </button>
          <button 
            onClick={() => setSubTab('payments')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
              subTab === 'payments' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Pagamentos
          </button>
          <button 
            onClick={() => setSubTab('salaries')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
              subTab === 'salaries' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Salários
          </button>
          <button 
            onClick={() => setSubTab('reports')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
              subTab === 'reports' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Relatórios
          </button>
        </div>
      )}

      {/* Date controls for filtering (hidden for suppliers and clients) */}
      {subTab !== 'suppliers' && subTab !== 'clients' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              {subTab === 'dashboard' ? 'Demonstrativo Financeiro' : 
               subTab === 'revenues' ? 'Filtro de Recebimentos' : 
               subTab === 'payments' ? 'Filtro de Pagamentos' : 
               subTab === 'salaries' ? 'Salários e Folha de Pagamento' : 'Período de Referência'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {subTab === 'dashboard' ? 'Ano de referência e fechamento consolidado' : 
               subTab === 'revenues' ? 'Período de referência para visualização de entradas' : 
               subTab === 'payments' ? 'Período de referência para visualização de saídas' : 
               subTab === 'salaries' ? 'Lançamento mensal de férias, adicionais e descontos' : 'Selecione o ano e mês para filtragem'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold focus:outline-none focus:border-amber-500"
            >
              {Array.from({ length: 17 }, (_, i) => 2024 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={month === null ? 'all' : month}
              onChange={(e) => setMonth(e.target.value === 'all' ? null : parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="all">Ano Inteiro / Total</option>
              {monthsList.map(m => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* SUB-TAB: DASHBOARD */}
      {subTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Dashboard Executive Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {month === null ? "Saldo Inicial (Ano Anterior)" : "Saldo Inicial (Mês Anterior)"}
                </span>
                <h3 className={`text-2xl font-black ${summary?.previous_month_balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                  {formatCurrency(summary?.previous_month_balance)}
                </h3>
              </div>
              <div className="bg-slate-100 p-3.5 rounded-xl text-slate-800">
                <Calendar className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {month === null ? "Receitas do Ano" : "Receitas do Mês"}
                </span>
                <h3 className="text-2xl font-black text-emerald-600">{formatCurrency(summary?.total_revenues)}</h3>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {month === null ? "Despesas do Ano" : "Despesas do Mês"}
                </span>
                <h3 className="text-2xl font-black text-slate-800">
                  {formatCurrency((summary?.total_expenses || 0) + (summary?.total_salaries || 0))}
                </h3>
              </div>
              <div className="bg-slate-100 p-3.5 rounded-xl text-slate-800">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {month === null ? "Resultado do Ano" : "Resultado do Mês"}
                </span>
                <h3 className={`text-2xl font-black ${summary?.net_result >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(summary?.net_result)}
                </h3>
              </div>
              <div className={`p-3.5 rounded-xl ${summary?.net_result >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {summary?.net_result >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {month === null ? "Caixa Acumulado no Ano" : "Caixa Acumulado no Mês"}
                </span>
                <h3 className={`text-2xl font-black ${(summary?.previous_month_balance || 0) + (summary?.net_result || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency((summary?.previous_month_balance || 0) + (summary?.net_result || 0))}
                </h3>
              </div>
              <div className={`p-3.5 rounded-xl ${(summary?.previous_month_balance || 0) + (summary?.net_result || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Saldo Geral em Caixa</span>
                <h3 className={`text-2xl font-black ${summary?.cash_balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                  {formatCurrency(summary?.cash_balance)}
                </h3>
              </div>
              <div className="bg-slate-100 p-3.5 rounded-xl text-slate-800">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Gráfico Comparativo: Receitas x Despesas */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h4 className="text-md font-bold text-slate-800 tracking-tight">Histórico Financeiro Mensal ({year})</h4>
              <p className="text-xs text-slate-400 mt-0.5">Demonstrativo mensal consolidado de fluxo de caixa</p>
            </div>
            
            <div className="h-64 flex items-end gap-2 sm:gap-4 border-b border-slate-200 pb-2 relative">
              {summary?.monthly_breakdown?.map((m) => {
                const totalMonthExp = m.expenses + m.salaries
                const maxAmount = Math.max(
                  ...summary.monthly_breakdown.map(x => Math.max(x.revenues, x.expenses + x.salaries)),
                  1000
                )
                const revHeight = (m.revenues / maxAmount) * 100
                const expHeight = (totalMonthExp / maxAmount) * 100

                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex justify-center items-end gap-1 h-5/6">
                      {/* Revenue Bar */}
                      <div 
                        style={{ height: `${revHeight}%` }} 
                        className="w-3 sm:w-5 bg-emerald-500 rounded-t-sm relative transition-all group-hover:bg-emerald-400"
                        title={`Receitas: ${formatCurrency(m.revenues)}`}
                      />
                      {/* Expense Bar */}
                      <div 
                        style={{ height: `${expHeight}%` }} 
                        className="w-3 sm:w-5 bg-rose-500 rounded-t-sm relative transition-all group-hover:bg-rose-400"
                        title={`Despesas: ${formatCurrency(totalMonthExp)}`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold mt-2">{m.month_name}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                <span>Receitas Realizadas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-rose-500 rounded-sm" />
                <span>Despesas Quitas + Salários</span>
              </div>
            </div>
          </div>

          {/* Gráficos Rosquinha (Donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-around">
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-bold text-slate-800 tracking-tight">Despesas por Categoria</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Destinação dos recursos quites</p>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                  {Object.entries(summary?.category_expenses || {}).map(([cat, val], idx) => {
                    const total = Object.values(summary.category_expenses).reduce((a, b) => a + b, 0)
                    const percent = total > 0 ? ((val / total) * 100).toFixed(0) : 0
                    const palette = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"]
                    return (
                      <div key={cat} className="flex items-center justify-between text-xs gap-6">
                        <div className="flex items-center gap-2 text-slate-600">
                          <div style={{ backgroundColor: palette[idx % palette.length] }} className="w-2.5 h-2.5 rounded-full shrink-0" />
                          <span className="font-medium truncate max-w-[120px]">{cat}</span>
                        </div>
                        <span className="font-black text-slate-800">{percent}% ({formatCurrency(val)})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {summary?.category_expenses && renderDonutChart(summary.category_expenses)}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-around">
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-bold text-slate-800 tracking-tight">Receitas por Forma de Recebimento</h4>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">Canais de recebimento consolidados</p>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                  {Object.entries(summary?.payment_methods_revenues || {}).map(([method, val], idx) => {
                    const total = Object.values(summary.payment_methods_revenues).reduce((a, b) => a + b, 0)
                    const percent = total > 0 ? ((val / total) * 100).toFixed(0) : 0
                    const palette = ["#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"]
                    return (
                      <div key={method} className="flex items-center justify-between text-xs gap-6">
                        <div className="flex items-center gap-2 text-slate-600">
                          <div style={{ backgroundColor: palette[idx % palette.length] }} className="w-2.5 h-2.5 rounded-full shrink-0" />
                          <span className="font-medium">{method}</span>
                        </div>
                        <span className="font-black text-slate-800">{percent}% ({formatCurrency(val)})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {summary?.payment_methods_revenues && renderDonutChart(summary.payment_methods_revenues, false)}
            </div>
          </div>

          {/* Detailed Salary and Benefits Costs Breakdown */}
          {summary?.salaries_breakdown && Object.values(summary.salaries_breakdown).some(v => v > 0) && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h4 className="text-md font-bold text-slate-800 tracking-tight">Detalhamento de Custos de Salários e Benefícios</h4>
                <p className="text-xs text-slate-400 mt-0.5">Visão analítica de salários base e benefícios dos colaboradores ativos no período</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(summary.salaries_breakdown).map(([label, val]) => {
                  if (val === 0) return null
                  return (
                    <div key={label} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                      <h5 className="text-sm font-black text-slate-700">{formatCurrency(val)}</h5>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: RECEBIMENTOS */}
      {subTab === 'revenues' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Controle de Recebimentos</h3>
              <p className="text-xs text-slate-400">Entradas, fluxo operacional e previsões</p>
            </div>
            <button 
              onClick={() => openRevModal()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Lançar Recebimento
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest text-[9px] font-extrabold">
                <tr>
                  <th className="px-6 py-4">Data Prevista</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4">Forma</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revenues.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-400 text-xs font-medium">Nenhum recebimento registrado para este período.</td>
                  </tr>
                ) : (
                  revenues.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-700">{formatDate(r.expected_date || r.date)}</td>
                      <td className="px-6 py-4 text-slate-600">{r.description}</td>
                      <td className="px-6 py-4 text-slate-600">{r.client || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{r.category}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">{formatCurrency(r.amount)}</td>
                      <td className="px-6 py-4 text-slate-600">{r.payment_method || 'N/A'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${getStatusBadgeClass(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => openRevModal(r)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem('revenue', r)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                            title={r.status === 'Recebido' || r.status === 'Cancelado' ? 'Cancelar lançamento' : 'Excluir permanentemente'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: PAGAMENTOS */}
      {subTab === 'payments' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Controle de Pagamentos</h3>
              <p className="text-xs text-slate-400">Contas a pagar, obrigações e despesas recorrentes</p>
            </div>
            <button 
              onClick={() => openExpModal()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Lançar Pagamento
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest text-[9px] font-extrabold">
                <tr>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Fornecedor</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4">Forma</th>
                  <th className="px-6 py-4 text-center">Recorrência</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-400 text-xs font-medium">Nenhum pagamento registrado para este período.</td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-700">{formatDate(e.due_date || e.date)}</td>
                      <td className="px-6 py-4 text-slate-600">{e.description}</td>
                      <td className="px-6 py-4 text-slate-600">{e.supplier?.trade_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{e.category}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">{formatCurrency(e.amount)}</td>
                      <td className="px-6 py-4 text-slate-600">{e.payment_method || 'N/A'}</td>
                      <td className="px-6 py-4 text-center text-slate-500 font-bold">
                        {e.is_recurring ? (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 border border-amber-300/40 rounded-full font-bold uppercase">
                            {e.recurrence_period}
                          </span>
                        ) : 'Não'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${getStatusBadgeClass(e.status)}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => openExpModal(e)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem('expense', e)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                            title={e.status === 'Pago' || e.status === 'Cancelado' ? 'Cancelar lançamento' : 'Excluir permanentemente'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: FORNECEDORES */}
      {subTab === 'suppliers' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Cadastro de Fornecedores</h3>
              <p className="text-xs text-slate-400">Gerenciamento de parceiros comerciais e dados bancários</p>
            </div>
            <button 
              onClick={() => openSuppModal()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Fornecedor
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest text-[9px] font-extrabold">
                <tr>
                  <th className="px-6 py-4">Nome Fantasia</th>
                  <th className="px-6 py-4">CNPJ</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Telefone</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Forma Preferencial</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-400 text-xs font-medium">Nenhum fornecedor cadastrado.</td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-700">{s.trade_name}</td>
                      <td className="px-6 py-4 text-slate-600">{s.cnpj}</td>
                      <td className="px-6 py-4 text-slate-600">{s.contact_person || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{s.phone || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{s.category}</td>
                      <td className="px-6 py-4 text-slate-600">{s.preferred_payment_method || 'N/A'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${s.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500 border border-slate-300'}`}>
                          {s.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => openSuppModal(s)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSupplier(s.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: RELATÓRIOS */}
      {subTab === 'reports' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800">Exportação de Relatórios</h3>
            <p className="text-xs text-slate-400">Emissão consolidada em formatos PDF e Excel com filtros avançados</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/50 p-5 rounded-xl border border-slate-100">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data de Início</label>
              <input 
                type="date" 
                value={reportFilters.start_date}
                onChange={(e) => setReportFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data de Fim</label>
              <input 
                type="date" 
                value={reportFilters.end_date}
                onChange={(e) => setReportFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fornecedor</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Todos' },
                  ...suppliers.map(s => ({ value: s.id, label: s.trade_name }))
                ]}
                value={reportFilters.supplier_id}
                onChange={(val) => setReportFilters(prev => ({ ...prev, supplier_id: val }))}
                placeholder="Busque o fornecedor..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
              <select 
                value={reportFilters.category}
                onChange={(e) => setReportFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todas</option>
                <optgroup label="Despesas">
                  {expenseCategoriesFlat.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </optgroup>
                <optgroup label="Receitas">
                  {revenueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Forma de Pagamento</label>
              <select 
                value={reportFilters.payment_method}
                onChange={(e) => setReportFilters(prev => ({ ...prev, payment_method: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todas</option>
                {paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</label>
              <select 
                value={reportFilters.status}
                onChange={(e) => setReportFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos</option>
                <option value="Recebido">Recebidos / Quitados (Receitas)</option>
                <option value="A Receber">A Receber (Receitas)</option>
                <option value="Pago">Pagos / Quitados (Despesas)</option>
                <option value="Pendente">Pendentes (Despesas)</option>
                <option value="Cancelado">Cancelados</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => downloadReport('excel')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all flex-1"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Download Excel (.xlsx)
            </button>
            <button 
              onClick={() => downloadReport('pdf')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all flex-1"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              Download PDF (.pdf)
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB: CLIENTES */}
      {subTab === 'clients' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Cadastro de Clientes Parceiros</h3>
              <p className="text-xs text-slate-400">Gerenciamento de parcerias corporativas e faturamento</p>
            </div>
            <button 
              onClick={() => {
                setEditingItem(null)
                setClientForm({
                  corporate_name: '',
                  trade_name: '',
                  cnpj: '',
                  contact_person: '',
                  phone: '',
                  whatsapp: '',
                  email: '',
                  address: '',
                  is_active: true
                })
                setShowClientModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest text-[9px] font-extrabold">
                <tr>
                  <th className="px-6 py-3">Nome Fantasia</th>
                  <th className="px-6 py-3">CNPJ</th>
                  <th className="px-6 py-3">Contato</th>
                  <th className="px-6 py-3">Telefone</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                      Nenhum cliente parceiro cadastrado.
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-700">{c.trade_name}</td>
                      <td className="px-6 py-4 text-slate-600">{c.cnpj || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{c.contact_person || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{c.phone || 'N/A'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${c.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500 border border-slate-300'}`}>
                          {c.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingItem({ type: 'client', id: c.id })
                              setClientForm({ ...c })
                              setShowClientModal(true)
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`Deseja realmente excluir o cliente ${c.trade_name}?`)) {
                                try {
                                  await api.delete(`/clients/${c.id}`)
                                  setSuccess('Cliente excluído com sucesso!')
                                  const clis = await api.get('/clients')
                                  setClients(clis.data)
                                  setTimeout(() => setSuccess(null), 3000)
                                } catch (err) {
                                  console.error(err)
                                  setError('Erro ao excluir cliente.')
                                }
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: SALÁRIOS */}
      {subTab === 'salaries' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800">Lançamento de Férias e Descontos</h3>
            <p className="text-xs text-slate-400">Adicione pagamentos de férias ou descontos personalizados para o mês selecionado</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest text-[9px] font-extrabold">
                <tr>
                  <th className="px-6 py-3">Funcionário</th>
                  <th className="px-6 py-3">Cargo</th>
                  <th className="px-6 py-3 text-right">Salário Contratual</th>
                  <th className="px-6 py-3 text-right">Adicional Férias</th>
                  <th className="px-6 py-3 text-right">Descontos do Mês</th>
                  <th className="px-6 py-3 text-right font-black">Custo Líquido</th>
                  <th className="px-6 py-3">Observações</th>
                  <th className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                      Nenhum funcionário ativo cadastrado para este grupo.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const adj = salaryAdjustments.find(a => a.employee_id === emp.id) || { vacation_payment: 0, discount: 0, notes: '' }
                    const contractSalary = emp.base_salary || 0
                    const finalSalary = contractSalary + adj.vacation_payment - adj.discount

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-700">{emp.name}</td>
                        <td className="px-6 py-4 text-slate-600">{emp.role || 'N/A'}</td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {contractSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                          {adj.vacation_payment > 0 ? `+ ${adj.vacation_payment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-rose-600 font-bold">
                          {adj.discount > 0 ? `- ${adj.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-800 font-black">
                          {finalSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{adj.notes || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => {
                              setSalaryForm({
                                employee_id: emp.id,
                                year: year,
                                month: month || currentMonth,
                                vacation_payment: adj.vacation_payment ? adj.vacation_payment.toString() : '',
                                discount: adj.discount ? adj.discount.toString() : '',
                                notes: adj.notes || ''
                              })
                              setShowSalaryModal(true)
                            }}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Lançar
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVENUE MODAL */}
      {showRevModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">{editingItem ? 'Editar Recebimento' : 'Lançar Recebimento'}</h3>
              <button onClick={() => setShowRevModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveRevenue} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Descrição</label>
                <input 
                  type="text" 
                  required
                  value={revForm.description}
                  onChange={(e) => setRevForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Recebimento Delivery iFood"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={revForm.amount}
                    onChange={(e) => setRevForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
                  <select
                    value={revForm.category}
                    onChange={(e) => setRevForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {revenueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data Prevista</label>
                  <input 
                    type="date" 
                    required
                    value={revForm.expected_date}
                    onChange={(e) => setRevForm(prev => ({ ...prev, expected_date: e.target.value, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Forma de Recebimento</label>
                  <select
                    value={revForm.payment_method}
                    onChange={(e) => setRevForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {paymentMethods.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</label>
                  <select
                    value={revForm.status}
                    onChange={(e) => setRevForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="A Receber">A Receber</option>
                    <option value="Recebido">Recebido</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data de Recebimento</label>
                  <input 
                    type="date" 
                    disabled={revForm.status !== 'Recebido'}
                    value={revForm.received_date}
                    onChange={(e) => setRevForm(prev => ({ ...prev, received_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cliente Parceiro (Opcional)</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Nenhum / Cliente Avulso' },
                    ...clients.map(c => ({ value: c.id, label: c.trade_name }))
                  ]}
                  value={revForm.client_id || ''}
                  onChange={(val) => {
                    const selectedClient = clients.find(c => c.id === val)
                    setRevForm(prev => ({
                      ...prev,
                      client_id: val,
                      client: selectedClient ? selectedClient.trade_name : ''
                    }))
                  }}
                  placeholder="Selecione ou busque o cliente..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Observações</label>
                <textarea 
                  value={revForm.observations}
                  onChange={(e) => setRevForm(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Anotações gerais..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 h-20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowRevModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {showExpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">{editingItem ? 'Editar Pagamento' : 'Lançar Pagamento'}</h3>
              <button onClick={() => setShowExpModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Descrição</label>
                <input 
                  type="text" 
                  required
                  value={expForm.description}
                  onChange={(e) => setExpForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Compra de Carne Fornecedor X"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={expForm.amount}
                    onChange={(e) => setExpForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fornecedor</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Nenhum' },
                      ...suppliers.map(s => ({ value: s.id, label: s.trade_name }))
                    ]}
                    value={expForm.supplier_id}
                    onChange={(val) => setExpForm(prev => ({ ...prev, supplier_id: val }))}
                    placeholder="Selecione ou busque o fornecedor..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
                  <select
                    value={expForm.category}
                    onChange={(e) => setExpForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {Object.entries(expenseCategoriesGrouped).map(([grp, list]) => (
                      <optgroup key={grp} label={grp}>
                        {list.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Forma de Pagamento</label>
                  <select
                    value={expForm.payment_method}
                    onChange={(e) => setExpForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {paymentMethods.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data de Vencimento</label>
                  <input 
                    type="date" 
                    required
                    value={expForm.due_date}
                    onChange={(e) => setExpForm(prev => ({ ...prev, due_date: e.target.value, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data de Pagamento</label>
                  <input 
                    type="date" 
                    disabled={expForm.status !== 'Pago'}
                    value={expForm.payment_date}
                    onChange={(e) => setExpForm(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 flex items-center gap-3 pt-6">
                  <input 
                    type="checkbox" 
                    id="is_recurring_chk"
                    checked={expForm.is_recurring}
                    onChange={(e) => setExpForm(prev => ({ ...prev, is_recurring: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-350 cursor-pointer"
                  />
                  <label htmlFor="is_recurring_chk" className="text-xs text-slate-600 font-bold uppercase cursor-pointer select-none">Despesa Recorrente?</label>
                </div>
                {expForm.is_recurring && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Periodicidade</label>
                    <select
                      value={expForm.recurrence_period}
                      onChange={(e) => setExpForm(prev => ({ ...prev, recurrence_period: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</label>
                <select
                  value={expForm.status}
                  onChange={(e) => setExpForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Observações</label>
                <textarea 
                  value={expForm.observations}
                  onChange={(e) => setExpForm(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Detalhes adicionais..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 h-20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowExpModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {showSuppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">{editingItem ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h3>
              <button onClick={() => setShowSuppModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Razão Social</label>
                  <input 
                    type="text" 
                    required
                    value={suppForm.corporate_name}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, corporate_name: e.target.value }))}
                    placeholder="Ex: Fornecedor de Carnes LTDA"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nome Fantasia</label>
                  <input 
                    type="text" 
                    required
                    value={suppForm.trade_name}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, trade_name: e.target.value }))}
                    placeholder="Ex: Açougue do Boi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CNPJ</label>
                  <input 
                    type="text" 
                    required
                    value={suppForm.cnpj}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inscrição Estadual (Opcional)</label>
                  <input 
                    type="text" 
                    value={suppForm.state_inscription}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, state_inscription: e.target.value }))}
                    placeholder="Isento ou numeração"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Responsável</label>
                  <input 
                    type="text" 
                    value={suppForm.contact_person}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Nome do contato"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telefone</label>
                  <input 
                    type="text" 
                    value={suppForm.phone}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 0000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp</label>
                  <input 
                    type="text" 
                    value={suppForm.whatsapp}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">E-mail</label>
                  <input 
                    type="email" 
                    value={suppForm.email}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@fornecedor.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categoria de Insumo</label>
                  <select
                    value={suppForm.category}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {supplierCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Endereço Completo</label>
                <input 
                  type="text" 
                  value={suppForm.address}
                  onChange={(e) => setSuppForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, Número, Bairro, Cidade - Estado"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Informações Financeiras */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200/60 pb-1.5">Informações Financeiras</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Forma de Pgto Preferencial</label>
                    <select
                      value={suppForm.preferred_payment_method}
                      onChange={(e) => setSuppForm(prev => ({ ...prev, preferred_payment_method: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                    >
                      {paymentMethods.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chave PIX</label>
                    <input 
                      type="text" 
                      value={suppForm.pix_key}
                      onChange={(e) => setSuppForm(prev => ({ ...prev, pix_key: e.target.value }))}
                      placeholder="CNPJ, E-mail, Celular ou Aleatória"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Banco</label>
                    <input 
                      type="text" 
                      value={suppForm.bank}
                      onChange={(e) => setSuppForm(prev => ({ ...prev, bank: e.target.value }))}
                      placeholder="Nome do Banco"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Agência</label>
                    <input 
                      type="text" 
                      value={suppForm.agency}
                      onChange={(e) => setSuppForm(prev => ({ ...prev, agency: e.target.value }))}
                      placeholder="Agência"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conta</label>
                    <input 
                      type="text" 
                      value={suppForm.account}
                      onChange={(e) => setSuppForm(prev => ({ ...prev, account: e.target.value }))}
                      placeholder="Conta Corrente"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Informações Comerciais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Prazo de Pagamento</label>
                  <input 
                    type="text" 
                    value={suppForm.payment_terms}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, payment_terms: e.target.value }))}
                    placeholder="Ex: 30 dias, 15/30 dias, à vista"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dias de Entrega</label>
                  <input 
                    type="text" 
                    value={suppForm.delivery_days}
                    onChange={(e) => setSuppForm(prev => ({ ...prev, delivery_days: e.target.value }))}
                    placeholder="Ex: Segundas e Quintas"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Observações Comerciais</label>
                <textarea 
                  value={suppForm.notes}
                  onChange={(e) => setSuppForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Minutos de atraso tolerado, histórico de negociações, etc..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 h-20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSuppModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT MODAL */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">{editingItem ? 'Editar Cliente' : 'Cadastrar Cliente'}</h3>
              <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveClient} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Razão Social</label>
                  <input 
                    type="text" 
                    required
                    value={clientForm.corporate_name}
                    onChange={(e) => setClientForm(prev => ({ ...prev, corporate_name: e.target.value }))}
                    placeholder="Ex: Refeições Lira LTDA"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nome Fantasia</label>
                  <input 
                    type="text" 
                    required
                    value={clientForm.trade_name}
                    onChange={(e) => setClientForm(prev => ({ ...prev, trade_name: e.target.value }))}
                    placeholder="Ex: Parceria Almoço Lira"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CNPJ</label>
                  <input 
                    type="text" 
                    value={clientForm.cnpj}
                    onChange={(e) => setClientForm(prev => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pessoa de Contato</label>
                  <input 
                    type="text" 
                    value={clientForm.contact_person}
                    onChange={(e) => setClientForm(prev => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Nome do gestor parceiro"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telefone</label>
                  <input 
                    type="text" 
                    value={clientForm.phone}
                    onChange={(e) => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 0000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp</label>
                  <input 
                    type="text" 
                    value={clientForm.whatsapp}
                    onChange={(e) => setClientForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="(00) 90000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">E-mail</label>
                  <input 
                    type="email" 
                    value={clientForm.email}
                    onChange={(e) => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@parceiro.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Endereço</label>
                <input 
                  type="text" 
                  value={clientForm.address}
                  onChange={(e) => setClientForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, Número, Bairro, Cidade"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</label>
                <select 
                  value={clientForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setClientForm(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowClientModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALARY ADJUSTMENT MODAL */}
      {showSalaryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">Lançamento de Férias & Descontos</h3>
              <button onClick={() => setShowSalaryModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSalaryAdjustment} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Funcionário</label>
                <input 
                  type="text" 
                  disabled
                  value={employees.find(e => e.id === salaryForm.employee_id)?.name || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adicional Férias (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={salaryForm.vacation_payment}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, vacation_payment: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Descontos do Mês (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={salaryForm.discount}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, discount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Observações / Justificativa</label>
                <textarea 
                  value={salaryForm.notes}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Justifique as férias ou os descontos..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 h-20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSalaryModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md">Salvar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Financial
