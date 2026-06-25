import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Search, Plus, Filter, User, Building, Landmark, ChevronRight, Edit2, Trash2 } from 'lucide-react'

const EmployeeList = ({ onSelectEmployee, onAddNew, onEditEmployee, onDeleteEmployee }) => {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status_filter = statusFilter
      if (deptFilter) params.department = deptFilter
      
      const response = await api.get('/employees', { params })
      setEmployees(response.data)
      setLoading(false)
    } catch (err) {
      setError('Erro ao carregar a lista de colaboradores.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [searchTerm, statusFilter, deptFilter])

  const handleDeleteEmployee = async (emp) => {
    if (window.confirm(`Tem certeza absoluta de que deseja EXCLUIR PERMANENTEMENTE o cadastro de "${emp.name}"? Esta ação é irreversível e apagará todos os dados de histórico, jornada, documentos, dependentes e ocorrências.`)) {
      try {
        await api.delete(`/employees/${emp.id}`)
        alert("Cadastro do colaborador excluído com sucesso!")
        fetchEmployees() // Refresh the list
      } catch (err) {
        alert(err.response?.data?.detail || "Erro ao excluir colaborador.")
      }
    }
  }

  const canEdit = user?.role === 'rh'

  const getStatusBadgeClass = (status) => {
    const classes = {
      active: 'bg-blue-50 border-blue-200 text-blue-700',
      on_leave: 'bg-orange-50 border-orange-200 text-orange-700',
      terminated: 'bg-red-50 border-red-200 text-red-700'
    }
    return classes[status] || 'bg-slate-50 border-slate-200 text-slate-700'
  }

  const getStatusLabel = (status) => {
    const labels = {
      active: 'Ativo',
      on_leave: 'Afastado',
      terminated: 'Desligado'
    }
    return labels[status] || status
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Colaboradores</h1>
          <p className="text-sm text-slate-500">Gestão e cadastro de colaboradores do escritório.</p>
        </div>
        {canEdit && (
          <button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-900/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Admitir Colaborador
          </button>
        )}
      </div>

      {/* Filter and Search Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, matrícula ou CPF..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Status Dropdown */}
        <div className="relative w-full md:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none cursor-pointer"
          >
            <option value="">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="on_leave">Afastados</option>
            <option value="terminated">Desligados</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Department Dropdown */}
        <div className="relative w-full md:w-56">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none cursor-pointer"
          >
            <option value="">Todos os Setores</option>
            <option value="Cozinha">Cozinha</option>
            <option value="Salão">Salão</option>
            <option value="Copa / Bar">Copa / Bar</option>
            <option value="Delivery">Delivery</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Serviços Gerais">Serviços Gerais</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Employees Grid/Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-sm">Nenhum colaborador encontrado</h3>
            <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de busca ou cadastre um novo registro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-28 text-center">Matrícula</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome Completo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">CPF</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cargo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Departamento</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr 
                    key={emp.id}
                    onClick={() => onSelectEmployee(emp.id)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 text-center bg-slate-50/20">{emp.registration_number}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 text-sm group-hover:text-amber-600 transition-colors">{emp.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{emp.cpf}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{emp.role || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{emp.department || 'N/A'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 border text-xs font-bold rounded-full ${getStatusBadgeClass(emp.status)}`}>
                        {getStatusLabel(emp.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          title="Visualizar Ficha"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEmployee(emp.id)
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            title="Editar Ficha"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditEmployee(emp.id)
                            }}
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {user?.role === 'rh' && (
                          <button
                            title="Excluir Cadastro Permanentemente"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteEmployee(emp)
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeList
