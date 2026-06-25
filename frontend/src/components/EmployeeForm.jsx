import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import { Save, X, User, Home, ShieldAlert, Users, Clock, AlertCircle } from 'lucide-react'

const EmployeeForm = ({ onCancel, onSuccess, employeeId }) => {
  const [activeTab, setActiveTab] = useState('personal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reasonForChange, setReasonForChange] = useState('')

  useEffect(() => {
    if (employeeId) {
      const fetchEmployee = async () => {
        setLoading(true)
        try {
          const res = await api.get(`/employees/${employeeId}`)
          const emp = res.data
          
          // Parse benefits list and values
          const activeBenefits = { vt: false, vr: false, va: false, health: false, dental: false, life: false }
          const benefitValues = { vt: '', vr: '', va: '', health: '', dental: '', life: '' }
          if (emp.contract && emp.contract.benefits) {
            try {
              const bData = JSON.parse(emp.contract.benefits)
              const labelsInverse = { 'VT': 'vt', 'VR': 'vr', 'VA': 'va', 'Plano Saúde': 'health', 'Odonto': 'dental', 'Seguro Vida': 'life' }
              if (Array.isArray(bData)) {
                bData.forEach(item => {
                  const key = labelsInverse[item]
                  if (key) activeBenefits[key] = true
                })
              } else if (typeof bData === 'object' && bData !== null) {
                Object.keys(bData).forEach(item => {
                  const key = labelsInverse[item]
                  if (key) {
                    activeBenefits[key] = true
                    benefitValues[key] = bData[item] !== null ? String(bData[item]) : ''
                  }
                })
              }
            } catch(e) {}
          }
          
          setFormData({
            registration_number: emp.registration_number,
            name: emp.name,
            cpf: emp.cpf,
            rg: emp.rg,
            dob: emp.dob,
            civil_status: emp.civil_status,
            nationality: emp.nationality,
            email: emp.email,
            phone: emp.phone,
            mother_name: emp.mother_name,
            father_name: emp.father_name || '',
            has_disability: emp.has_disability,
            disability_details: emp.disability_details || '',
            education: emp.education,
            ctps: emp.ctps || '',
            pis: emp.pis || '',
            reservista: emp.reservista || '',
            
            address_cep: emp.address_cep,
            address_street: emp.address_street,
            address_number: emp.address_number,
            address_complement: emp.address_complement || '',
            address_neighborhood: emp.address_neighborhood,
            address_city: emp.address_city,
            address_state: emp.address_state,
            
            admission_date: emp.contract?.admission_date || '',
            role: emp.contract?.role || '',
            department: emp.contract?.department || 'Cozinha',
            manager_name: emp.contract?.manager_name || '',
            base_salary: emp.contract?.base_salary || '',
            
            benefits: activeBenefits,
            benefitValues: benefitValues,
            
            scale_type: emp.shift?.scale_type || '5x2',
            entry_time: emp.shift?.entry_time || '09:00',
            exit_time: emp.shift?.exit_time || '18:00',
            interval_duration_minutes: emp.shift?.interval_duration_minutes || 60,
            bank_of_hours_minutes: emp.shift?.bank_of_hours_minutes || 0,
            
            dependents: emp.dependents || []
          })
          setLoading(false)
        } catch (err) {
          setError('Erro ao carregar os dados do colaborador.')
          setLoading(false)
        }
      }
      fetchEmployee()
    } else {
      const fetchNextReg = async () => {
        try {
          const res = await api.get('/employees/next-registration')
          setFormData(prev => ({
            ...prev,
            registration_number: res.data.registration_number
          }))
        } catch (e) {
          // silent fail
        }
      }
      fetchNextReg()
    }
  }, [employeeId])
  
  // Form State
  const [formData, setFormData] = useState({
    // Personal
    registration_number: '',
    name: '',
    cpf: '',
    rg: '',
    dob: '',
    civil_status: 'Solteiro(a)',
    nationality: 'Brasileira',
    email: '',
    phone: '',
    mother_name: '',
    father_name: '',
    has_disability: false,
    disability_details: '',
    education: 'Ensino Superior Completo',
    ctps: '',
    pis: '',
    reservista: '',
    
    // Address
    address_cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    
    // Contract
    admission_date: '',
    role: '',
    department: 'Cozinha',
    manager_name: '',
    base_salary: '',
    
    // Benefits
    benefits: {
      vt: false,
      vr: false,
      va: false,
      health: false,
      dental: false,
      life: false
    },
    benefitValues: {
      vt: '',
      vr: '',
      va: '',
      health: '',
      dental: '',
      life: ''
    },
    
    // Shift
    scale_type: '5x2',
    entry_time: '09:00',
    exit_time: '18:00',
    interval_duration_minutes: 60,
    bank_of_hours_minutes: 0,
    
    // Dependents
    dependents: []
  })

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  // Handle Nested Benefit Changes
  const handleBenefitChange = (e) => {
    const { name, checked } = e.target
    setFormData(prev => ({
      ...prev,
      benefits: {
        ...prev.benefits,
        [name]: checked
      }
    }))
  }

  // Handle Benefit Value Changes
  const handleBenefitValueChange = (benefitKey, val) => {
    setFormData(prev => ({
      ...prev,
      benefitValues: {
        ...prev.benefitValues,
        [benefitKey]: val
      }
    }))
  }

  // Handle Dynamic Dependent Changes
  const handleDependentChange = (index, field, value) => {
    const updated = [...formData.dependents]
    updated[index][field] = value
    setFormData(prev => ({ ...prev, dependents: updated }))
  }

  const addDependent = () => {
    setFormData(prev => ({
      ...prev,
      dependents: [...prev.dependents, { name: '', relationship: 'Filho(a)', dob: '' }]
    }))
  }

  const removeDependent = (index) => {
    const updated = [...formData.dependents]
    updated.splice(index, 1)
    setFormData(prev => ({ ...prev, dependents: updated }))
  }

  // CEP Auto-Fill (simulated or via viacep)
  const lookupCep = async () => {
    const cleanCep = formData.address_cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address_street: data.logradouro || '',
          address_neighborhood: data.bairro || '',
          address_city: data.localidade || '',
          address_state: data.uf || ''
        }))
      }
    } catch (e) {
      // ignore
    }
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Simple checks
    if (!formData.registration_number || !formData.name || !formData.cpf || !formData.base_salary) {
      setError('Por favor, preencha todos os campos obrigatórios na Ficha cadastral.')
      return
    }

    if (employeeId && !reasonForChange.trim()) {
      setError('Por favor, insira a justificativa para a alteração contratual.')
      return
    }

    setLoading(true)
    
    // Format payload
    const activeBenefits = {}
    Object.keys(formData.benefits).forEach(k => {
      if (formData.benefits[k]) {
        const labels = { vt: 'VT', vr: 'VR', va: 'VA', health: 'Plano Saúde', dental: 'Odonto', life: 'Seguro Vida' }
        const label = labels[k]
        activeBenefits[label] = parseFloat(formData.benefitValues[k]) || 0.0
      }
    })

    try {
      if (employeeId) {
        // Edit Mode: PUT /employees/{id}
        const updatePayload = {
          name: formData.name,
          rg: formData.rg,
          cpf: formData.cpf,
          dob: formData.dob,
          civil_status: formData.civil_status,
          nationality: formData.nationality,
          email: formData.email,
          phone: formData.phone,
          address_cep: formData.address_cep,
          address_street: formData.address_street,
          address_number: formData.address_number,
          address_complement: formData.address_complement || null,
          address_neighborhood: formData.address_neighborhood,
          address_city: formData.address_city,
          address_state: formData.address_state,
          mother_name: formData.mother_name,
          father_name: formData.father_name || null,
          has_disability: formData.has_disability,
          disability_details: formData.disability_details || null,
          education: formData.education,
          ctps: formData.ctps || null,
          pis: formData.pis || null,
          reservista: formData.reservista || null,
          status: 'active',
          
          role: formData.role,
          department: formData.department,
          manager_name: formData.manager_name || null,
          base_salary: parseFloat(formData.base_salary),
          benefits: JSON.stringify(activeBenefits),
          reason_for_change: reasonForChange || 'Alteração cadastral por formulário'
        }
        
        await api.put(`/employees/${employeeId}`, updatePayload)
        
        // Update Shift if changed
        const shiftPayload = {
          scale_type: formData.scale_type,
          entry_time: formData.entry_time,
          exit_time: formData.exit_time,
          interval_duration_minutes: parseInt(formData.interval_duration_minutes),
          bank_of_hours_minutes: parseInt(formData.bank_of_hours_minutes)
        }
        await api.put(`/shifts/employee/${employeeId}`, shiftPayload)
      } else {
        // Create Mode: POST /employees
        const payload = {
          registration_number: formData.registration_number,
          name: formData.name,
          cpf: formData.cpf,
          rg: formData.rg,
          dob: formData.dob,
          civil_status: formData.civil_status,
          nationality: formData.nationality,
          email: formData.email,
          phone: formData.phone,
          address_cep: formData.address_cep,
          address_street: formData.address_street,
          address_number: formData.address_number,
          address_complement: formData.address_complement || null,
          address_neighborhood: formData.address_neighborhood,
          address_city: formData.address_city,
          address_state: formData.address_state,
          mother_name: formData.mother_name,
          father_name: formData.father_name || null,
          has_disability: formData.has_disability,
          disability_details: formData.disability_details || null,
          education: formData.education,
          ctps: formData.ctps || null,
          pis: formData.pis || null,
          reservista: formData.reservista || null,
          status: 'active',
          
          contract: {
            admission_date: formData.admission_date,
            role: formData.role,
            department: formData.department,
            manager_name: formData.manager_name || null,
            base_salary: parseFloat(formData.base_salary),
            benefits: JSON.stringify(activeBenefits)
          },
          
          shift: {
            scale_type: formData.scale_type,
            entry_time: formData.entry_time,
            exit_time: formData.exit_time,
            interval_duration_minutes: parseInt(formData.interval_duration_minutes),
            bank_of_hours_minutes: parseInt(formData.bank_of_hours_minutes)
          },
          
          dependents: formData.dependents.map(d => ({
            name: d.name,
            relationship: d.relationship,
            dob: d.dob
          }))
        }
        await api.post('/employees', payload)
      }
      setLoading(false)
      onSuccess()
    } catch (err) {
      setLoading(false)
      setError(err.response?.data?.detail || 'Erro ao registrar colaborador no banco.')
    }
  }

  const tabs = [
    { id: 'personal', label: 'Dados Pessoais', icon: User },
    { id: 'address', label: 'Endereço', icon: Home },
    { id: 'contract', label: 'Contrato & Jornada', icon: Clock },
    { id: 'dependents', label: 'Dependentes', icon: Users }
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
      {/* Form Title Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{employeeId ? 'Editar Cadastro de Colaborador' : 'Admissão de Colaborador'}</h2>
          <p className="text-xs text-slate-500">{employeeId ? 'Atualize as informações cadastrais e contratuais.' : 'Cadastre uma nova ficha no banco de dados corporativo do escritório.'}</p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-slate-200/60 rounded-full text-slate-500 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="mx-6 mt-6 flex items-start gap-3 p-3 bg-red-900/10 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 px-6 pt-4 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
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

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* TAB 1: PERSONAL DETAILS */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="form-label">Nº Matrícula (Gerado Automaticamente)</label>
              <input
                type="text"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleInputChange}
                placeholder="Gerando matrícula..."
                className="form-input bg-slate-100 font-bold text-slate-500 cursor-not-allowed"
                disabled
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="form-label">Nome Completo (Obrigatório)</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Nome completo do colaborador"
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">CPF (Obrigatório)</label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleInputChange}
                placeholder="000.000.000-00"
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">RG (Obrigatório)</label>
              <input
                type="text"
                name="rg"
                value={formData.rg}
                onChange={handleInputChange}
                placeholder="RG do colaborador"
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Nº CTPS</label>
              <input
                type="text"
                name="ctps"
                value={formData.ctps}
                onChange={handleInputChange}
                placeholder="0000000 Série 000-XX"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Nº PIS</label>
              <input
                type="text"
                name="pis"
                value={formData.pis}
                onChange={handleInputChange}
                placeholder="000.00000.00-0"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Nº Reservista</label>
              <input
                type="text"
                name="reservista"
                value={formData.reservista}
                onChange={handleInputChange}
                placeholder="Nº de Reservista"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Data de Nascimento (Obrigatório)</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Estado Civil</label>
              <select
                name="civil_status"
                value={formData.civil_status}
                onChange={handleInputChange}
                className="form-input cursor-pointer"
              >
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
                <option value="União Estável">União Estável</option>
              </select>
            </div>

            <div>
              <label className="form-label">Nacionalidade</label>
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Grau de Escolaridade</label>
              <select
                name="education"
                value={formData.education}
                onChange={handleInputChange}
                className="form-input cursor-pointer"
              >
                <option value="Ensino Médio Completo">Ensino Médio Completo</option>
                <option value="Ensino Superior Incompleto">Ensino Superior Incompleto</option>
                <option value="Ensino Superior Completo">Ensino Superior Completo</option>
                <option value="Pós-Graduação / Especialização">Pós-Graduação / Especialização</option>
                <option value="Mestrado / Doutorado">Mestrado / Doutorado</option>
              </select>
            </div>

            <div>
              <label className="form-label">E-mail de Contato</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="exemplo@liramelo.com.br"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Telefone de Contato</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(00) 00000-0000"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Nome da Mãe</label>
              <input
                type="text"
                name="mother_name"
                value={formData.mother_name}
                onChange={handleInputChange}
                placeholder="Nome da mãe"
                className="form-input"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Nome do Pai</label>
              <input
                type="text"
                name="father_name"
                value={formData.father_name}
                onChange={handleInputChange}
                placeholder="Nome do pai (Opcional)"
                className="form-input"
              />
            </div>

            <div className="flex items-center gap-3 md:col-span-1 pt-6">
              <input
                type="checkbox"
                id="has_disability"
                name="has_disability"
                checked={formData.has_disability}
                onChange={handleInputChange}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="has_disability" className="text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer">
                Possui Deficiência (PCD)
              </label>
            </div>

            {formData.has_disability && (
              <div className="md:col-span-2 animate-fadeIn">
                <label className="form-label">Especificação da Deficiência</label>
                <input
                  type="text"
                  name="disability_details"
                  value={formData.disability_details}
                  onChange={handleInputChange}
                  placeholder="Descreva a deficiência..."
                  className="form-input"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADDRESS */}
        {activeTab === 'address' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="form-label">CEP (Obrigatório)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="address_cep"
                  value={formData.address_cep}
                  onChange={handleInputChange}
                  onBlur={lookupCep}
                  placeholder="00000-000"
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={lookupCep}
                  className="px-3 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Buscar
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Logradouro (Rua, Av. - Obrigatório)</label>
              <input
                type="text"
                name="address_street"
                value={formData.address_street}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Número (Obrigatório)</label>
              <input
                type="text"
                name="address_number"
                value={formData.address_number}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Complemento</label>
              <input
                type="text"
                name="address_complement"
                value={formData.address_complement}
                onChange={handleInputChange}
                placeholder="Apto, Bloco..."
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Bairro (Obrigatório)</label>
              <input
                type="text"
                name="address_neighborhood"
                value={formData.address_neighborhood}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Cidade (Obrigatório)</label>
              <input
                type="text"
                name="address_city"
                value={formData.address_city}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Estado (UF - Obrigatório)</label>
              <input
                type="text"
                name="address_state"
                value={formData.address_state}
                onChange={handleInputChange}
                placeholder="SP, RJ, DF..."
                maxLength={2}
                className="form-input"
                required
              />
            </div>
          </div>
        )}

        {/* TAB 3: CONTRACT & SHIFT */}
        {activeTab === 'contract' && (
          <div className="space-y-6">
            {/* Contract Section */}
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Dados Contratuais</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="form-label">Data de Admissão (Obrigatório)</label>
                  <input
                    type="date"
                    name="admission_date"
                    value={formData.admission_date}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Cargo / Função (Obrigatório)</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="Advogado Júnior, Analista..."
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Departamento</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="form-input cursor-pointer"
                  >
                    <option value="Cozinha">Cozinha</option>
                    <option value="Salão">Salão</option>
                    <option value="Copa / Bar">Copa / Bar</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Serviços Gerais">Serviços Gerais</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Gestor Responsável</label>
                  <input
                    type="text"
                    name="manager_name"
                    value={formData.manager_name}
                    onChange={handleInputChange}
                    placeholder="Nome do gestor da área"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Salário Base Mensal (R$ - Obrigatório)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="base_salary"
                    value={formData.base_salary}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="form-input"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Benefits Checklist */}
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Benefícios Contratados</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {[
                  { id: 'vt', label: 'V. Transporte' },
                  { id: 'vr', label: 'V. Refeição' },
                  { id: 'va', label: 'V. Alimentação' },
                  { id: 'health', label: 'Plano de Saúde' },
                  { id: 'dental', label: 'Plano Odonto' },
                  { id: 'life', label: 'Seguro de Vida' }
                ].map((b) => (
                  <div key={b.id} className={`flex items-center gap-2.5 p-3 border rounded-lg transition-colors cursor-pointer ${formData.benefits[b.id] ? 'border-amber-500 bg-amber-50/10' : 'border-slate-200 bg-slate-50/40 hover:bg-white'}`}>
                    <input
                      type="checkbox"
                      id={`benefit_${b.id}`}
                      name={b.id}
                      checked={formData.benefits[b.id]}
                      onChange={handleBenefitChange}
                      className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor={`benefit_${b.id}`} className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      {b.label}
                    </label>
                  </div>
                ))}
              </div>

              {/* Selected Benefits Cost Inputs */}
              {Object.values(formData.benefits).some(Boolean) && (
                <div className="mt-4 p-4 border border-slate-100 bg-slate-50/50 rounded-xl space-y-4 animate-fadeIn">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valores dos Benefícios (Custo Mensal - R$)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'vt', label: 'V. Transporte' },
                      { id: 'vr', label: 'V. Refeição' },
                      { id: 'va', label: 'V. Alimentação' },
                      { id: 'health', label: 'Plano de Saúde' },
                      { id: 'dental', label: 'Plano Odonto' },
                      { id: 'life', label: 'Seguro de Vida' }
                    ].map((b) => {
                      if (!formData.benefits[b.id]) return null
                      return (
                        <div key={b.id} className="animate-fadeIn">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 block">Valor {b.label}</label>
                          <input
                            type="number"
                            step="0.01"
                            name={`benefit_val_${b.id}`}
                            value={formData.benefitValues[b.id]}
                            onChange={(e) => handleBenefitValueChange(b.id, e.target.value)}
                            placeholder="0.00"
                            className="form-input"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Shift/Jornada Section */}
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Jornada de Trabalho</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="form-label">Escala / Tipo</label>
                  <select
                    name="scale_type"
                    value={formData.scale_type}
                    onChange={handleInputChange}
                    className="form-input cursor-pointer"
                  >
                    <option value="5x2">5x2 (Seg a Sex)</option>
                    <option value="6x1">6x1 (Seg a Sáb)</option>
                    <option value="12x36">12x36 (Dia Sim, Dia Não)</option>
                    <option value="Flexível">Flexível</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Horário de Entrada</label>
                  <input
                    type="text"
                    name="entry_time"
                    value={formData.entry_time}
                    onChange={handleInputChange}
                    placeholder="09:00"
                    maxLength={5}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Horário de Saída</label>
                  <input
                    type="text"
                    name="exit_time"
                    value={formData.exit_time}
                    onChange={handleInputChange}
                    placeholder="18:00"
                    maxLength={5}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Duração do Intervalo (Minutos)</label>
                  <input
                    type="number"
                    name="interval_duration_minutes"
                    value={formData.interval_duration_minutes}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DEPENDENTS */}
        {activeTab === 'dependents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Dependentes Associados</h3>
              <button
                type="button"
                onClick={addDependent}
                className="px-3 py-1.5 border border-amber-600 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                + Adicionar Dependente
              </button>
            </div>

            {formData.dependents.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 text-center rounded-xl">
                <p className="text-xs text-slate-400">Nenhum dependente cadastrado para este colaborador.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.dependents.map((dep, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/30 items-end animate-fadeIn">
                    <div>
                      <label className="form-label">Nome Completo</label>
                      <input
                        type="text"
                        value={dep.name}
                        onChange={(e) => handleDependentChange(idx, 'name', e.target.value)}
                        placeholder="Nome do dependente"
                        className="form-input"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Grau de Parentesco</label>
                      <select
                        value={dep.relationship}
                        onChange={(e) => handleDependentChange(idx, 'relationship', e.target.value)}
                        className="form-input cursor-pointer"
                      >
                        <option value="Filho(a)">Filho(a)</option>
                        <option value="Cônjuge">Cônjuge</option>
                        <option value="Mãe / Pai">Mãe / Pai</option>
                        <option value="Enteado(a)">Enteado(a)</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="form-label">Data de Nascimento</label>
                        <input
                          type="date"
                          value={dep.dob}
                          onChange={(e) => handleDependentChange(idx, 'dob', e.target.value)}
                          className="form-input"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDependent(idx)}
                        className="px-2.5 py-2 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 rounded-lg text-sm transition-colors cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {employeeId && (
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 animate-fadeIn">
            <label className="form-label text-amber-700 font-extrabold flex items-center gap-1.5">
              Justificativa da Alteração (Obrigatório)
            </label>
            <input
              type="text"
              value={reasonForChange}
              onChange={(e) => setReasonForChange(e.target.value)}
              placeholder="Descreva o motivo desta alteração (ex: Correção de dados, Promoção, Reajuste Salarial...)"
              className="form-input border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent font-medium bg-white"
              required
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t border-slate-200 pt-6 flex justify-end gap-3 bg-slate-50 -mx-6 -mb-6 p-6">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 btn-primary"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Admitindo...' : 'Salvar Registro'}
          </button>
        </div>

      </form>
    </div>
  )
}

export default EmployeeForm
