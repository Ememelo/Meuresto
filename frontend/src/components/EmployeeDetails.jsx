import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { 
  ArrowLeft, 
  FileText, 
  Printer, 
  UserMinus, 
  Upload, 
  UserCheck, 
  Calendar, 
  Plus, 
  AlertCircle, 
  Clock, 
  ShieldAlert, 
  ShieldCheck,
  User,
  MapPin,
  Briefcase,
  Users2,
  FileBadge,
  Trash2,
  Edit2
} from 'lucide-react'

const EmployeeDetails = ({ employeeId, onBack, onEditEmployee }) => {
  const { user } = useAuth()
  const [emp, setEmp] = useState(null)
  const [activeTab, setActiveTab] = useState('ficha')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Historical Log States
  const [careerHistory, setCareerHistory] = useState([])
  const [disciplinary, setDisciplinary] = useState([])
  const [overtime, setOvertime] = useState([])
  const [leaves, setLeaves] = useState([])

  // Modal States
  const [activeModal, setActiveModal] = useState(null) // 'disciplinary', 'overtime', 'leave', 'terminate', 'dependent'
  const [editingDiscId, setEditingDiscId] = useState(null)
  const [editingOtId, setEditingOtId] = useState(null)
  const [editingLeaveId, setEditingLeaveId] = useState(null)
  const [editingDepId, setEditingDepId] = useState(null)
  
  // Modal Form States
  const [discForm, setDiscForm] = useState({ type: 'warning', action_date: '', reason: '', details: '', duration_days: '', manager_name: '' })
  const [otForm, setOtForm] = useState({ date: '', hours_50_minutes: 0, hours_100_minutes: 0, hours_night_minutes: 0 })
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [termForm, setTermForm] = useState({ reason: '' })
  const [depForm, setDepForm] = useState({ name: '', relationship: 'Filho(a)', dob: '' })

  const fetchEmployeeData = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/employees/${employeeId}`)
      setEmp(res.data)
      
      // Load historical data
      const [histRes, discRes, otRes, leaveRes] = await Promise.all([
        api.get(`/employees/${employeeId}/history`),
        api.get(`/disciplinary/employee/${employeeId}`),
        api.get(`/overtime/employee/${employeeId}`),
        api.get(`/leaves/employee/${employeeId}`)
      ]).catch(() => [[], [], [], []]) // Fallback if any fails

      setCareerHistory(histRes?.data || [])
      setDisciplinary(discRes?.data || [])
      setOvertime(otRes?.data || [])
      setLeaves(leaveRes?.data || [])
      
      setLoading(false)
    } catch (err) {
      setError('Erro ao carregar detalhes do colaborador.')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData()
    }
  }, [employeeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (error || !emp) {
    return (
      <div className="p-6 text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5" />
        <span>{error || 'Colaborador não encontrado.'}</span>
      </div>
    )
  }

  // Permissions checks
  const isRHOrAdmin = user?.role === 'rh'
  const isSocio = user?.role === 'socio'
  
  // Format currency
  const formatBRL = (val) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Print Ficha registration PDF
  const handlePrintPDF = () => {
    window.open(`/api/reports/employee/${employeeId}/pdf`, '_blank')
  }

  // Handle Profile Photo Upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const res = await api.post(`/employees/${employeeId}/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setEmp(prev => ({ ...prev, photo_path: res.data.photo_url }))
      alert('Foto de perfil carregada com sucesso!')
    } catch (err) {
      alert('Falha ao fazer upload da imagem.')
    }
  }

  // Handle Warning/Suspension Submission
  const handleAddDisciplinary = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        employee_id: employeeId,
        type: discForm.type,
        action_date: discForm.action_date,
        reason: discForm.reason,
        details: discForm.details,
        duration_days: discForm.type === 'suspension' ? parseInt(discForm.duration_days) : null,
        manager_name: discForm.manager_name || user.username
      }
      if (editingDiscId) {
        await api.put(`/disciplinary/${editingDiscId}`, payload)
        alert('Ocorrência atualizada com sucesso!')
      } else {
        await api.post('/disciplinary', payload)
        alert('Ocorrência registrada com sucesso!')
      }
      setActiveModal(null)
      setEditingDiscId(null)
      fetchEmployeeData()
    } catch (err) {
      alert('Erro ao salvar ocorrência.')
    }
  }

  // Handle Overtime Submission
  const handleAddOvertime = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        employee_id: employeeId,
        date: otForm.date,
        hours_50_minutes: parseInt(otForm.hours_50_minutes),
        hours_100_minutes: parseInt(otForm.hours_100_minutes),
        hours_night_minutes: parseInt(otForm.hours_night_minutes),
        status: editingOtId ? (overtime.find(o => o.id === editingOtId)?.status || 'pending') : 'pending'
      }
      if (editingOtId) {
        await api.put(`/overtime/${editingOtId}/edit`, payload)
        alert('Horas extras atualizadas com sucesso!')
      } else {
        await api.post('/overtime', payload)
        alert('Horas extras registradas com sucesso!')
      }
      setActiveModal(null)
      setEditingOtId(null)
      fetchEmployeeData()
    } catch (err) {
      alert('Erro ao registrar horas extras.')
    }
  }

  // Handle Leave Submission
  const handleAddLeave = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        employee_id: employeeId,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason
      }
      if (editingLeaveId) {
        await api.put(`/leaves/${editingLeaveId}`, payload)
        alert('Afastamento atualizado com sucesso!')
      } else {
        await api.post('/leaves', payload)
        alert('Afastamento registrado com sucesso!')
      }
      setActiveModal(null)
      setEditingLeaveId(null)
      fetchEmployeeData()
    } catch (err) {
      alert('Erro ao registrar afastamento.')
    }
  }

  // Handle Dependent Submission
  const handleAddDependent = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name: depForm.name,
        relationship: depForm.relationship,
        dob: depForm.dob
      }
      if (editingDepId) {
        await api.put(`/employees/dependent/${editingDepId}`, payload)
        alert('Dependente atualizado com sucesso!')
      } else {
        await api.post(`/employees/${employeeId}/dependent`, payload)
        alert('Dependente adicionado com sucesso!')
      }
      setActiveModal(null)
      setEditingDepId(null)
      fetchEmployeeData()
    } catch (err) {
      alert('Erro ao salvar dependente.')
    }
  }

  // Handle Resignation / Termination
  const handleTerminate = async (e) => {
    e.preventDefault()
    try {
      // Create a PUT request to update employee status to terminated
      await api.put(`/employees/${employeeId}`, {
        status: 'terminated',
        reason_for_change: termForm.reason
      })
      setActiveModal(null)
      fetchEmployeeData()
    } catch (err) {
      alert('Erro ao processar desligamento.')
    }
  }

  // Tabs structure
  const tabs = [
    { id: 'ficha', label: 'Ficha Cadastral', icon: User },
    { id: 'career', label: 'Evolução Funcional', icon: Briefcase },
    { id: 'dependents', label: 'Família / Docs', icon: Users2 },
    { id: 'disciplinary', label: 'Histórico Disciplinar', icon: ShieldAlert },
    { id: 'overtime', label: 'Jornada & Extras', icon: Clock },
    { id: 'leaves', label: 'Absenças & Licenças', icon: Calendar }
  ]

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Back Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista
        </button>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir PDF
          </button>
          
          {isRHOrAdmin && (
            <button
              onClick={() => onEditEmployee(emp.id)}
              className="flex items-center gap-2 px-3.5 py-2 border border-amber-200 hover:bg-amber-50 text-amber-700 hover:border-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              Editar Colaborador
            </button>
          )}
          
          {isRHOrAdmin && emp.status !== 'terminated' && (
            <button
              onClick={() => {
                setTermForm({ reason: '' })
                setActiveModal('terminate')
              }}
              className="flex items-center gap-2 px-3.5 py-2 border border-red-200 hover:bg-red-50 text-red-600 hover:border-red-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <UserMinus className="w-4 h-4" />
              Desligar Colaborador
            </button>
          )}
        </div>
      </div>

      {/* Profile summary card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        {/* Photo Container */}
        <div className="relative group shrink-0">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400 font-bold text-3xl shadow-inner">
            {emp.photo_path ? (
              <img src={emp.photo_path} alt={emp.name} className="w-full h-full object-cover" />
            ) : (
              emp.name.charAt(0)
            )}
          </div>
          {isRHOrAdmin && (
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center border-2 border-white shadow-md cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1 text-center md:text-left space-y-1.5">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <h1 className="text-xl font-extrabold text-slate-800 leading-tight">{emp.name}</h1>
            <span className={`self-center px-2.5 py-0.5 border text-[10px] font-bold rounded-full uppercase tracking-wider ${
              emp.status === 'active' ? 'bg-blue-50 border-blue-200 text-blue-700' :
              emp.status === 'on_leave' ? 'bg-orange-50 border-orange-200 text-orange-700' :
              'bg-red-50 border-red-200 text-red-700'
            }`}>
              {emp.status === 'active' ? 'Ativo' : emp.status === 'on_leave' ? 'Afastado' : 'Desligado'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-500 pt-1">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Matrícula</span>
              <span className="text-slate-800 font-bold">{emp.registration_number}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Cargo</span>
              <span className="text-slate-800">{emp.contract?.role || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Departamento</span>
              <span className="text-slate-800">{emp.contract?.department || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Salário Atual</span>
              <span className="text-slate-800 font-bold">{emp.contract ? formatBRL(emp.contract.base_salary) : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-3 gap-6 rounded-t-xl border-x border-t overflow-x-auto whitespace-nowrap scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
                isActive 
                  ? 'border-amber-600 text-amber-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tabs panels */}
      <div className="bg-white p-6 rounded-b-xl border-x border-b border-slate-200 shadow-sm min-h-[300px]">
        
        {/* TAB 1: FICHA COMPLETA */}
        {activeTab === 'ficha' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-3">Dados Cadastrais</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div><span className="font-bold text-slate-500 text-xs block">Nome Completo:</span> <span className="text-slate-800 font-medium">{emp.name}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">CPF:</span> <span className="text-slate-800">{emp.cpf}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">RG:</span> <span className="text-slate-800">{emp.rg}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Data de Nascimento:</span> <span className="text-slate-800">{new Date(emp.dob).toLocaleDateString('pt-BR')}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Estado Civil:</span> <span className="text-slate-800">{emp.civil_status}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Nacionalidade:</span> <span className="text-slate-800">{emp.nationality}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Escolaridade:</span> <span className="text-slate-800">{emp.education}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">E-mail:</span> <span className="text-slate-800">{emp.email}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Telefone:</span> <span className="text-slate-800">{emp.phone}</span></div>
                <div className="md:col-span-2"><span className="font-bold text-slate-500 text-xs block">Nome da Mãe:</span> <span className="text-slate-800">{emp.mother_name}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Nome do Pai:</span> <span className="text-slate-800">{emp.father_name || 'Não Declarado'}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Acessibilidade PCD:</span> <span className="text-slate-800">{emp.has_disability ? `Sim (${emp.disability_details})` : 'Não'}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-3">Endereço Residencial</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div><span className="font-bold text-slate-500 text-xs block">CEP:</span> <span className="text-slate-800">{emp.address_cep}</span></div>
                <div className="md:col-span-2"><span className="font-bold text-slate-500 text-xs block">Logradouro:</span> <span className="text-slate-800">{emp.address_street}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Número:</span> <span className="text-slate-800">{emp.address_number}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Complemento:</span> <span className="text-slate-800">{emp.address_complement || 'N/A'}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Bairro:</span> <span className="text-slate-800">{emp.address_neighborhood}</span></div>
                <div className="md:col-span-2"><span className="font-bold text-slate-500 text-xs block">Cidade/UF:</span> <span className="text-slate-800">{emp.address_city} - {emp.address_state}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-3">Contrato & Benefícios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div><span className="font-bold text-slate-500 text-xs block">Data de Admissão:</span> <span className="text-slate-800">{emp.contract?.admission_date ? new Date(emp.contract.admission_date).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Escala de Trabalho:</span> <span className="text-slate-800">{emp.shift?.scale_type || 'N/A'}</span></div>
                <div><span className="font-bold text-slate-500 text-xs block">Horário:</span> <span className="text-slate-800">{emp.shift ? `${emp.shift.entry_time} às ${emp.shift.exit_time}` : 'N/A'}</span></div>
                
                <div className="md:col-span-3">
                  <span className="font-bold text-slate-500 text-xs block mb-1.5">Benefícios Ativos (Custo Mensal):</span>
                  {(() => {
                    if (!emp.contract?.benefits) return <span className="text-slate-400 italic text-xs">Nenhum benefício cadastrado</span>
                    try {
                      const bData = JSON.parse(emp.contract.benefits)
                      if (Array.isArray(bData)) {
                        return (
                          <div className="flex flex-wrap gap-2">
                            {bData.map(b => (
                              <span key={b} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">{b}</span>
                            ))}
                          </div>
                        )
                      } else if (typeof bData === 'object' && bData !== null) {
                        const active = Object.entries(bData).filter(([_, v]) => v)
                        if (active.length === 0) return <span className="text-slate-400 italic text-xs">Nenhum benefício ativo</span>
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {active.map(([name, val]) => (
                              <div key={name} className="p-2 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-700">{name}</span>
                                <span className="font-bold text-amber-700">{formatBRL(parseFloat(val || 0))}</span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    } catch(e) {}
                    return <span className="text-slate-400 italic text-xs">Nenhum benefício cadastrado</span>
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EVOLUÇÃO FUNCIONAL */}
        {activeTab === 'career' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Histórico de Alterações Salariais & Promoções</h3>
            </div>
            
            {careerHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Nenhuma alteração registrada. Registros imutáveis de evolução contratual aparecerão aqui.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Campo</th>
                      <th className="px-4 py-3">Valor Anterior</th>
                      <th className="px-4 py-3">Novo Valor</th>
                      <th className="px-4 py-3">Alterado Por</th>
                      <th className="px-4 py-3">Motivo / Justificativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {careerHistory.map((hist) => (
                      <tr key={hist.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">{new Date(hist.change_date).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{hist.field_name.toUpperCase()}</td>
                        <td className="px-4 py-3 text-slate-500">{hist.field_name === 'salary' ? formatBRL(parseFloat(hist.old_value || 0)) : hist.old_value}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{hist.field_name === 'salary' ? formatBRL(parseFloat(hist.new_value || 0)) : hist.new_value}</td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">{hist.changed_by_username}</td>
                        <td className="px-4 py-3 text-slate-500 italic">{hist.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPENDENTS & FAMILY */}
        {activeTab === 'dependents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Dependents list */}
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-3">
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Dependentes</h3>
                {isRHOrAdmin && (
                  <button
                    onClick={() => {
                      setDepForm({ name: '', relationship: 'Filho(a)', dob: new Date().toISOString().split('T')[0] })
                      setEditingDepId(null)
                      setActiveModal('dependent')
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 border border-amber-600 text-amber-600 hover:bg-amber-50 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </button>
                )}
              </div>
              {emp.dependents.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum dependente declarado.</p>
              ) : (
                <div className="space-y-3">
                  {emp.dependents.map((dep) => (
                    <div key={dep.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{dep.name}</h4>
                        <span className="text-[10px] text-slate-500 block">{dep.relationship}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          Nasc.: {new Date(dep.dob).toLocaleDateString('pt-BR')}
                        </span>
                        {isRHOrAdmin && (
                          <div className="flex gap-1 ml-2">
                            <button
                              title="Editar Dependente"
                              onClick={() => {
                                setDepForm({
                                  name: dep.name,
                                  relationship: dep.relationship,
                                  dob: dep.dob
                                })
                                setEditingDepId(dep.id)
                                setActiveModal('dependent')
                              }}
                              className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Excluir Dependente"
                              onClick={async () => {
                                if (window.confirm(`Tem certeza que deseja excluir o dependente ${dep.name}?`)) {
                                  try {
                                    await api.delete(`/employees/dependent/${dep.id}`)
                                    alert("Dependente excluído com sucesso!")
                                    fetchEmployeeData()
                                  } catch (err) {
                                    alert(err.response?.data?.detail || "Erro ao excluir dependente.")
                                  }
                                }
                              }}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document details */}
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-3">Documentos & Registros</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">CPF:</span>
                  <span className="text-slate-800 font-semibold">{emp.cpf}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">RG:</span>
                  <span className="text-slate-800">{emp.rg}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">PIS / PASEP:</span>
                  <span className="text-slate-800">{emp.pis || 'Não cadastrado'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">CTPS & Série:</span>
                  <span className="text-slate-800">{emp.ctps || 'Não cadastrado'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">Nº Reservista:</span>
                  <span className="text-slate-800">{emp.reservista || 'Não cadastrado'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HISTÓRICO DISCIPLINAR */}
        {activeTab === 'disciplinary' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Registro de Ocorrências Disciplinares</h3>
              {isRHOrAdmin && emp.status !== 'terminated' && (
                <button
                  onClick={() => {
                    setDiscForm({ 
                      type: 'warning', 
                      action_date: new Date().toISOString().split('T')[0], 
                      reason: '', 
                      details: '', 
                      duration_days: '', 
                      manager_name: user?.username || '' 
                    })
                    setActiveModal('disciplinary')
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-600 text-amber-600 hover:bg-amber-50 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar Ocorrência
                </button>
              )}
            </div>

            {disciplinary.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Ficha Limpa</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Nenhuma ocorrência disciplinar registrada para este colaborador.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {disciplinary.map((act) => (
                  <div 
                    key={act.id} 
                    className={`p-4 border rounded-xl flex gap-4 ${
                      act.type === 'warning' ? 'border-yellow-200 bg-yellow-50/20' : 
                      act.type === 'suspension' ? 'border-orange-200 bg-orange-50/20' : 
                      'border-red-200 bg-red-50/20'
                    }`}
                  >
                    <div className="text-slate-700 shrink-0">
                      <ShieldAlert className={`w-6 h-6 ${
                        act.type === 'warning' ? 'text-yellow-600' : 
                        act.type === 'suspension' ? 'text-orange-600' : 
                        'text-red-600'
                      }`} />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-extrabold uppercase tracking-wide">
                          {act.type === 'warning' ? 'Advertência' : 
                           act.type === 'suspension' ? `Suspensão (${act.duration_days} dias)` : 
                           'Desligamento Disciplinar'}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-semibold">{new Date(act.action_date).toLocaleDateString('pt-BR')}</span>
                          {isRHOrAdmin && (
                            <div className="flex gap-1 ml-2">
                              <button
                                title="Editar Ocorrência"
                                onClick={() => {
                                  setDiscForm({
                                    type: act.type,
                                    action_date: act.action_date,
                                    reason: act.reason,
                                    details: act.details,
                                    duration_days: act.duration_days || '',
                                    manager_name: act.manager_name
                                  })
                                  setEditingDiscId(act.id)
                                  setActiveModal('disciplinary')
                                }}
                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50/50 rounded transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Excluir Ocorrência"
                                onClick={async () => {
                                  if (window.confirm("Tem certeza que deseja excluir esta ocorrência disciplinar?")) {
                                    try {
                                      await api.delete(`/disciplinary/${act.id}`)
                                      alert("Ocorrência excluída com sucesso!")
                                      fetchEmployeeData()
                                    } catch (err) {
                                      alert(err.response?.data?.detail || "Erro ao excluir ocorrência.")
                                    }
                                  }
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50/50 rounded transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-xs text-slate-800 font-semibold">{act.reason}</p>
                      <p className="text-xs text-slate-500 italic mt-1">{act.details}</p>
                      
                      <div className="pt-2 text-[10px] text-slate-400 font-semibold">
                        RESPONSÁVEL: {act.manager_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: JORNADA & HORAS EXTRAS */}
        {activeTab === 'overtime' && (
          <div className="space-y-6">
            {/* Shift definition summary */}
            <div className="p-4 border border-slate-200 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
              <div>
                <h4 className="font-bold text-slate-800">Jornada Contratual: Escala {emp.shift?.scale_type || '5x2'}</h4>
                <p className="text-slate-500 mt-0.5">
                  Horário: {emp.shift?.entry_time || '09:00'} às {emp.shift?.exit_time || '18:00'} | Intervalo: {emp.shift?.interval_duration_minutes || 60} minutos
                </p>
              </div>
              <span className="inline-block px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg">
                Banco: {emp.shift?.bank_of_hours_minutes || 0} min
              </span>
            </div>

            {/* Overtime List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Registros de Horas Extras</h3>
                {isRHOrAdmin && emp.status !== 'terminated' && (
                  <button
                    onClick={() => {
                      setOtForm({ 
                        date: new Date().toISOString().split('T')[0], 
                        hours_50_minutes: 0, 
                        hours_100_minutes: 0, 
                        hours_night_minutes: 0 
                      })
                      setActiveModal('overtime')
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-600 text-amber-600 hover:bg-amber-50 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar Hora Extra
                  </button>
                )}
              </div>

              {overtime.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhum lançamento de horas extras efetuado.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3 text-center">Horas 50%</th>
                        <th className="px-4 py-3 text-center">Horas 100%</th>
                        <th className="px-4 py-3 text-center">Noturnas</th>
                        <th className="px-4 py-3 text-right">Pagamento Previsto</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        {isRHOrAdmin && <th className="px-4 py-3 text-center w-28">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {overtime.map((ot) => {
                        const totalMin = ot.hours_50_minutes + ot.hours_100_minutes + ot.hours_night_minutes
                        return (
                          <tr key={ot.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-500 font-semibold">{new Date(ot.date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-4 py-3 text-center">{ot.hours_50_minutes} min</td>
                            <td className="px-4 py-3 text-center">{ot.hours_100_minutes} min</td>
                            <td className="px-4 py-3 text-center">{ot.hours_night_minutes} min</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatBRL(ot.calculated_payment)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                ot.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                ot.status === 'paid' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              }`}>
                                {ot.status === 'approved' ? 'Aprovado' : ot.status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            {isRHOrAdmin && (
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {ot.status === 'pending' && (
                                    <button
                                      title="Aprovar Hora Extra"
                                      onClick={async () => {
                                        try {
                                          await api.put(`/overtime/${ot.id}`, { status: 'approved' })
                                          fetchEmployeeData()
                                        } catch (err) {
                                          alert('Erro ao aprovar hora extra.')
                                        }
                                      }}
                                      className="px-2 py-1 bg-amber-600 text-white rounded text-[10px] font-bold hover:bg-amber-700 transition-colors cursor-pointer"
                                    >
                                      Aprovar
                                    </button>
                                  )}
                                  <button
                                    title="Editar Registro"
                                    onClick={() => {
                                      setOtForm({
                                        date: ot.date,
                                        hours_50_minutes: ot.hours_50_minutes,
                                        hours_100_minutes: ot.hours_100_minutes,
                                        hours_night_minutes: ot.hours_night_minutes
                                      })
                                      setEditingOtId(ot.id)
                                      setActiveModal('overtime')
                                    }}
                                    className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    title="Excluir Registro"
                                    onClick={async () => {
                                      if (window.confirm("Tem certeza que deseja excluir este lançamento de hora extra?")) {
                                        try {
                                          await api.delete(`/overtime/${ot.id}`)
                                          alert("Lançamento de hora extra excluído com sucesso!")
                                          fetchEmployeeData()
                                        } catch (err) {
                                          alert(err.response?.data?.detail || "Erro ao excluir lançamento.")
                                        }
                                      }
                                    }}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: AFASTAMENTOS & LICENÇAS */}
        {activeTab === 'leaves' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Controle de Afastamentos & Férias</h3>
              {isRHOrAdmin && emp.status !== 'terminated' && (
                <button
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0]
                    setLeaveForm({ 
                      start_date: todayStr, 
                      end_date: todayStr, 
                      reason: '' 
                    })
                    setActiveModal('leave')
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-600 text-amber-600 hover:bg-amber-50 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar Afastamento
                </button>
              )}
            </div>

            {leaves.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Nenhum afastamento ou licença médica registrada.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Início</th>
                      <th className="px-4 py-3">Fim</th>
                      <th className="px-4 py-3">Motivo / Tipo</th>
                      <th className="px-4 py-3">Anexo do Atestado</th>
                      {isRHOrAdmin && <th className="px-4 py-3 w-24 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-700">{new Date(leave.start_date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{new Date(leave.end_date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-slate-800 font-bold">{leave.reason}</td>
                        <td className="px-4 py-3 text-slate-500 italic">Sem anexo</td>
                        {isRHOrAdmin && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                title="Editar Afastamento"
                                onClick={() => {
                                  setLeaveForm({
                                    start_date: leave.start_date,
                                    end_date: leave.end_date,
                                    reason: leave.reason
                                  })
                                  setEditingLeaveId(leave.id)
                                  setActiveModal('leave')
                                }}
                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Excluir Afastamento"
                                onClick={async () => {
                                  if (window.confirm("Tem certeza que deseja excluir este afastamento?")) {
                                    try {
                                      await api.delete(`/leaves/${leave.id}`)
                                      alert("Afastamento excluído com sucesso!")
                                      fetchEmployeeData()
                                    } catch (err) {
                                      alert(err.response?.data?.detail || "Erro ao excluir afastamento.")
                                    }
                                  }
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Modulo Disciplinar Modal */}
      {activeModal === 'disciplinary' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span>{editingDiscId ? 'Editar Ocorrência Disciplinar' : 'Registrar Ocorrência'}</span>
              <button onClick={() => { setActiveModal(null); setEditingDiscId(null); }} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddDisciplinary} className="p-6 space-y-4">
              <div>
                <label className="form-label">Tipo de Ocorrência</label>
                <select
                  value={discForm.type}
                  onChange={(e) => setDiscForm(prev => ({ ...prev, type: e.target.value }))}
                  className="form-input cursor-pointer"
                >
                  <option value="warning">Advertência por Escrito</option>
                  <option value="suspension">Suspensão de Trabalho</option>
                  <option value="termination">Desligamento por Justa Causa</option>
                </select>
              </div>

              <div>
                <label className="form-label">Data da Ocorrência</label>
                <input
                  type="date"
                  value={discForm.action_date}
                  onChange={(e) => setDiscForm(prev => ({ ...prev, action_date: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              {discForm.type === 'suspension' && (
                <div className="animate-fadeIn">
                  <label className="form-label">Dias de Suspensão</label>
                  <input
                    type="number"
                    value={discForm.duration_days}
                    onChange={(e) => setDiscForm(prev => ({ ...prev, duration_days: e.target.value }))}
                    placeholder="1, 2, 3..."
                    className="form-input"
                    required
                  />
                </div>
              )}

              <div>
                <label className="form-label">Motivo Resumido (Título)</label>
                <input
                  type="text"
                  value={discForm.reason}
                  onChange={(e) => setDiscForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ex: Insubordinação, Atraso Recorrente..."
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Detalhes da Infração / Descrição</label>
                <textarea
                  value={discForm.details}
                  onChange={(e) => setDiscForm(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Descreva detalhadamente o ocorrido..."
                  rows={3}
                  className="form-input"
                  required
                ></textarea>
              </div>

              <div>
                <label className="form-label">Responsável pela Aplicação</label>
                <input
                  type="text"
                  value={discForm.manager_name}
                  onChange={(e) => setDiscForm(prev => ({ ...prev, manager_name: e.target.value }))}
                  placeholder="Nome do gestor / RH"
                  className="form-input"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setActiveModal(null); setEditingDiscId(null); }} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Registrar Ocorrência</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Overtime Launch Modal */}
      {activeModal === 'overtime' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span>{editingOtId ? 'Editar Horas Extras' : 'Lançamento de Horas Extras'}</span>
              <button onClick={() => { setActiveModal(null); setEditingOtId(null); }} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddOvertime} className="p-6 space-y-4">
              <div>
                <label className="form-label">Data da Jornada Extra</label>
                <input
                  type="date"
                  value={otForm.date}
                  onChange={(e) => setOtForm(prev => ({ ...prev, date: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Minutos 50%</label>
                  <input
                    type="number"
                    value={otForm.hours_50_minutes}
                    onChange={(e) => setOtForm(prev => ({ ...prev, hours_50_minutes: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Minutos 100%</label>
                  <input
                    type="number"
                    value={otForm.hours_100_minutes}
                    onChange={(e) => setOtForm(prev => ({ ...prev, hours_100_minutes: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Noturnos (Min)</label>
                  <input
                    type="number"
                    value={otForm.hours_night_minutes}
                    onChange={(e) => setOtForm(prev => ({ ...prev, hours_night_minutes: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">Insira a duração em minutos. Ex: 1 hora = 60, 2 horas = 120.</p>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setActiveModal(null); setEditingOtId(null); }} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Leave Register Modal */}
      {activeModal === 'leave' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span>{editingLeaveId ? 'Editar Afastamento / Licença' : 'Registrar Afastamento / Licença'}</span>
              <button onClick={() => { setActiveModal(null); setEditingLeaveId(null); }} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddLeave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Data de Início</label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Data de Término</label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Motivo do Afastamento</label>
                <select
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="form-input cursor-pointer"
                  required
                >
                  <option value="">Selecione o motivo...</option>
                  <option value="Licença Médica / Atestado">Licença Médica / Atestado</option>
                  <option value="Férias Programadas">Férias Programadas</option>
                  <option value="Licença Maternidade">Licença Maternidade</option>
                  <option value="Licença Paternidade">Licença Paternidade</option>
                  <option value="Afastamento pelo INSS">Afastamento pelo INSS</option>
                  <option value="Licença Casamento / Gala">Licença Casamento / Gala</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setActiveModal(null); setEditingLeaveId(null); }} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Registrar Licença</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Resignation/Termination Modal */}
      {activeModal === 'terminate' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span className="text-red-600 font-extrabold uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Confirmar Desligamento
              </span>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleTerminate} className="p-6 space-y-4">
              <div className="bg-red-50 text-red-700 p-3.5 border border-red-200 rounded-lg text-xs leading-relaxed font-semibold">
                Esta ação mudará o status do colaborador para "Desligado" (Terminated). 
                Todas as informações cadastrais permanecerão arquivadas e acessíveis em relatórios, mas o colaborador será removido do quadro ativo.
              </div>

              <div>
                <label className="form-label">Justificativa / Motivo do Desligamento</label>
                <textarea
                  value={termForm.reason}
                  onChange={(e) => setTermForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ex: Rescisão sem justa causa, Pedido de demissão voluntária..."
                  rows={3}
                  className="form-input"
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer">
                  Confirmar Rescisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Dependent Add/Edit Modal */}
      {activeModal === 'dependent' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span>{editingDepId ? 'Editar Dependente' : 'Adicionar Dependente'}</span>
              <button onClick={() => { setActiveModal(null); setEditingDepId(null); }} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddDependent} className="p-6 space-y-4">
              <div>
                <label className="form-label">Nome Completo</label>
                <input
                  type="text"
                  value={depForm.name}
                  onChange={(e) => setDepForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do dependente..."
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Parentesco</label>
                <select
                  value={depForm.relationship}
                  onChange={(e) => setDepForm(prev => ({ ...prev, relationship: e.target.value }))}
                  className="form-input cursor-pointer"
                  required
                >
                  <option value="Filho(a)">Filho(a)</option>
                  <option value="Cônjuge">Cônjuge / Companheiro(a)</option>
                  <option value="Pai/Mãe">Pai / Mãe</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="form-label">Data de Nascimento</label>
                <input
                  type="date"
                  value={depForm.dob}
                  onChange={(e) => setDepForm(prev => ({ ...prev, dob: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setActiveModal(null); setEditingDepId(null); }} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Dependente</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default EmployeeDetails
