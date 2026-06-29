import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  X, 
  CheckCircle2, 
  Info,
  ArrowUpDown
} from 'lucide-react'

const Inventory = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  
  // Selected items for edit or adjust
  const [selectedItem, setSelectedItem] = useState(null)
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'Ingredientes',
    quantity: 0,
    unit: 'unidades',
    min_quantity: 0,
    unit_cost: 0
  })

  const [adjustForm, setAdjustForm] = useState({
    type: 'entry', // entry (positive), exit (negative)
    quantity_change: '',
    reason: 'Compra de Mercadoria'
  })

  const categories = ['Ingredientes', 'Bebidas', 'Limpeza', 'Descartáveis', 'Outros']

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const res = await api.get('/inventory')
      setItems(res.data)
      setError(null)
    } catch (err) {
      setError('Falha ao carregar o estoque. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const handleOpenItemModal = (item = null) => {
    if (item) {
      setSelectedItem(item)
      setItemForm({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        min_quantity: item.min_quantity,
        unit_cost: item.unit_cost
      })
    } else {
      setSelectedItem(null)
      setItemForm({
        name: '',
        category: 'Ingredientes',
        quantity: 0,
        unit: 'unidades',
        min_quantity: 0,
        unit_cost: 0
      })
    }
    setError(null)
    setSuccess(null)
    setIsItemModalOpen(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    try {
      if (selectedItem) {
        // Update
        await api.put(`/inventory/${selectedItem.id}`, itemForm)
        setSuccess(`Item '${itemForm.name}' atualizado com sucesso!`)
      } else {
        // Create
        await api.post('/inventory', itemForm)
        setSuccess(`Item '${itemForm.name}' cadastrado com sucesso!`)
      }
      setIsItemModalOpen(false)
      fetchInventory()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao salvar o item.')
    }
  }

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir o item '${name}' do estoque?`)) return
    try {
      await api.delete(`/inventory/${id}`)
      setSuccess(`Item '${name}' excluído com sucesso.`)
      fetchInventory()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao excluir o item.')
    }
  }

  const handleOpenAdjustModal = (item) => {
    setSelectedItem(item)
    setAdjustForm({
      type: 'entry',
      quantity_change: '',
      reason: 'Compra de Mercadoria'
    })
    setError(null)
    setSuccess(null)
    setIsAdjustModalOpen(true)
  }

  const handleSaveAdjustment = async (e) => {
    e.preventDefault()
    const change = parseFloat(adjustForm.quantity_change)
    if (isNaN(change) || change <= 0) {
      setError('Por favor, informe uma quantidade válida maior que zero.')
      return
    }

    const quantity_change = adjustForm.type === 'entry' ? change : -change

    try {
      await api.post(`/inventory/${selectedItem.id}/adjust`, {
        quantity_change,
        reason: adjustForm.reason
      })
      setSuccess('Ajuste de estoque registrado com sucesso!')
      setIsAdjustModalOpen(false)
      fetchInventory()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao registrar ajuste.')
    }
  }

  // Calculated Summary Metrics
  const totalItems = items.length
  const criticalItems = items.filter(i => i.quantity < i.min_quantity).length
  const totalValue = items.reduce((acc, curr) => acc + (curr.quantity * curr.unit_cost), 0)

  // Filtered List
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Controle de Estoque</h1>
        <p className="text-xs text-slate-400 mt-1">
          Gerenciamento de insumos, bebidas, materiais de limpeza e descartáveis da unidade.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total de Itens</span>
            <h3 className="text-2xl font-black text-slate-800">{totalItems}</h3>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl text-slate-800">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Itens Críticos</span>
            <h3 className={`text-2xl font-black ${criticalItems > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {criticalItems}
            </h3>
          </div>
          <div className={`p-3.5 rounded-xl ${criticalItems > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-850'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Valor do Estoque</span>
            <h3 className="text-2xl font-black text-slate-800">{formatCurrency(totalValue)}</h3>
          </div>
          <div className="bg-emerald-50 p-3.5 rounded-xl text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Bar (Filters + Add Button) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-2 rounded-lg font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleOpenItemModal()}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Insumo
        </button>
      </div>

      {/* Main Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold">Carregando itens do estoque...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold">Nenhum item encontrado no estoque.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-widest text-[9px] font-extrabold">
                <tr>
                  <th className="px-6 py-4">Item / Nome</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4 text-center">Saldo Atual</th>
                  <th className="px-6 py-4 text-center">Mínimo Rec.</th>
                  <th className="px-6 py-4 text-right">Custo Unit.</th>
                  <th className="px-6 py-4 text-right">Total Estocado</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const isCritical = item.quantity < item.min_quantity
                  const itemTotalVal = item.quantity * item.unit_cost
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-black ${isCritical ? 'text-rose-600' : 'text-slate-700'}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-400 font-semibold">
                        {item.min_quantity} {item.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 font-bold">
                        {formatCurrency(item.unit_cost)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-800 font-black">
                        {formatCurrency(itemTotalVal)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isCritical 
                            ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-rose-600' : 'bg-emerald-500'}`}></span>
                          {isCritical ? 'Crítico' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenAdjustModal(item)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wider cursor-pointer transition-all"
                            title="Entrada / Saída de Estoque"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            Ajustar
                          </button>
                          <button
                            onClick={() => handleOpenItemModal(item)}
                            className="p-1 text-slate-400 hover:text-slate-850 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                            title="Editar Item"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all"
                            title="Excluir Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD/EDIT INVENTORY ITEM */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">
                {selectedItem ? 'Editar Item de Estoque' : 'Cadastrar Novo Insumo'}
              </h3>
              <button 
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome do Item</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="Ex: Filé Mignon, Cerveja IPA, Detergente"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Categoria</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-700"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Unidade de Medida</label>
                  <input
                    type="text"
                    required
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    placeholder="Ex: kg, litros, un, fardo"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Saldo Inicial</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    disabled={!!selectedItem} // Disable quantity on edit (must use Adjust instead!)
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-800 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Estoque Mínimo</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={itemForm.min_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, min_quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Custo Unit. (R$)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={itemForm.unit_cost}
                    onChange={(e) => setItemForm({ ...itemForm, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-800"
                  />
                </div>
              </div>

              {selectedItem && (
                <div className="bg-slate-50 p-3 rounded-lg text-[11px] text-slate-500 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Para ajustar o saldo de estoque atual deste produto, utilize o botão <b>Ajustar</b> na tabela.</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow"
                >
                  {selectedItem ? 'Salvar Alterações' : 'Cadastrar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST STOCK (ENTRY/EXIT) */}
      {isAdjustModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-800">Ajuste de Estoque</h3>
                <p className="text-xs text-slate-400 font-semibold">{selectedItem.name}</p>
              </div>
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
              {/* Type selector (Entry/Exit) */}
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: 'entry', reason: 'Compra de Mercadoria' })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    adjustForm.type === 'entry' 
                      ? 'bg-white text-emerald-650 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: 'exit', reason: 'Consumo Diário' })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    adjustForm.type === 'exit' 
                      ? 'bg-white text-rose-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  Saída / Perda
                </button>
              </div>

              {/* Quantity input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Quantidade da {adjustForm.type === 'entry' ? 'Entrada' : 'Saída'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    value={adjustForm.quantity_change}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
                    placeholder="0.0"
                    className="w-full bg-slate-50 border border-slate-200 pl-4 pr-12 py-2.5 rounded-lg text-sm font-bold focus:outline-none focus:border-amber-500 text-slate-800"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {selectedItem.unit}
                  </span>
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Motivo / Justificativa</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 text-slate-700"
                >
                  {adjustForm.type === 'entry' ? (
                    <>
                      <option value="Compra de Mercadoria">Compra de Mercadoria (Entrada com NF)</option>
                      <option value="Ajuste de Estoque">Ajuste de Estoque (Correção de inventário)</option>
                      <option value="Devolução de Cliente">Devolução de Cliente</option>
                      <option value="Outros">Outros</option>
                    </>
                  ) : (
                    <>
                      <option value="Consumo Diário">Consumo Diário (Uso na cozinha/bar)</option>
                      <option value="Desperdício / Perda">Desperdício / Quebra / Vencimento</option>
                      <option value="Ajuste de Estoque">Ajuste de Estoque (Correção de inventário)</option>
                      <option value="Furto / Extravio">Furto / Extravio</option>
                      <option value="Outros">Outros</option>
                    </>
                  )}
                </select>
              </div>

              {/* Live Preview Calculation */}
              {adjustForm.quantity_change && (
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cálculo Estimado de Saldo:</span>
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-650">
                    <span>Saldo Atual:</span>
                    <span className="font-bold">{selectedItem.quantity} {selectedItem.unit}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span>{adjustForm.type === 'entry' ? 'Adicionando:' : 'Subtraindo:'}</span>
                    <span className={`font-bold ${adjustForm.type === 'entry' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {adjustForm.type === 'entry' ? '+' : '-'}{adjustForm.quantity_change} {selectedItem.unit}
                    </span>
                  </div>
                  <div className="border-t border-dashed border-slate-200 my-2 pt-2 flex justify-between items-center text-sm font-black">
                    <span className="text-slate-800">Novo Saldo Estimado:</span>
                    <span className={(selectedItem.quantity + (adjustForm.type === 'entry' ? 1 : -1) * parseFloat(adjustForm.quantity_change)) < selectedItem.min_quantity ? 'text-rose-600' : 'text-slate-800'}>
                      {(selectedItem.quantity + (adjustForm.type === 'entry' ? 1 : -1) * parseFloat(adjustForm.quantity_change)).toFixed(2)} {selectedItem.unit}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow ${
                    adjustForm.type === 'entry' ? 'bg-emerald-600 hover:bg-emerald-550' : 'bg-rose-650 hover:bg-rose-600'
                  }`}
                >
                  Salvar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
