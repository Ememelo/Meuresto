import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Shield, Key, UserPlus, Users, AlertCircle, CheckCircle2, Power, Eye, EyeOff, Database, Download, Upload, Smartphone, Wifi, Trash2 } from 'lucide-react'

const UserSettings = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isSocioOrAdmin = user?.role === 'admin' || user?.role === 'socio'

  const [activeTab, setActiveTab] = useState('profile')
  const [localIp, setLocalIp] = useState('127.0.0.1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Password Change State
  const [pwdForm, setPwdForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [showPwd, setShowPwd] = useState({
    old: false,
    new: false,
    confirm: false
  })

  // User Registration State
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'consulta'
  })
  const [showRegisterPwd, setShowRegisterPwd] = useState(false)

  // User List State (Admin only)
  const [usersList, setUsersList] = useState([])
  const [fetchingUsers, setFetchingUsers] = useState(false)

  const fetchUsers = async () => {
    if (!isAdmin) return
    setFetchingUsers(true)
    try {
      const res = await api.get('/auth/users')
      setUsersList(res.data)
    } catch (err) {
      // silent fail
    } finally {
      setFetchingUsers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers()
    }
  }, [activeTab])

  const handlePwdChangeSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (pwdForm.new_password !== pwdForm.confirm_password) {
      setError('A nova senha e a confirmação de senha não coincidem.')
      return
    }

    if (pwdForm.new_password.length < 4) {
      setError('A nova senha deve conter no mínimo 4 caracteres.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        old_password: pwdForm.old_password,
        new_password: pwdForm.new_password
      })
      setSuccess('Sua senha foi alterada com sucesso!')
      setPwdForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao alterar a senha. Verifique se a senha atual está correta.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (registerForm.password.length < 4) {
      setError('A senha deve conter no mínimo 4 caracteres.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/register', registerForm)
      setSuccess(`Usuário "${registerForm.username}" registrado com sucesso!`)
      setRegisterForm({ username: '', email: '', password: '', role: 'consulta' })
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao registrar novo usuário.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchLocalIp = async () => {
      try {
        const res = await api.get('/backup/ip')
        setLocalIp(res.data.local_ip)
      } catch (e) {
        // silent fail
      }
    }
    if (activeTab === 'backup' && isSocioOrAdmin) {
      fetchLocalIp()
    }
  }, [activeTab])

  const handleExportBackup = async () => {
    setError(null)
    setSuccess(null)
    try {
      const response = await api.get('/backup/download', {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `meuresto_backup_${new Date().toISOString().split('T')[0]}.db`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setSuccess('Backup gerado e baixado com sucesso!')
    } catch (err) {
      setError('Falha ao gerar o arquivo de backup. Verifique se o servidor local está ativo.')
    }
  }

  const handleRestoreBackup = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!window.confirm('ATENÇÃO: Restaurar o backup substituirá TODOS os dados atuais do sistema! Deseja continuar?')) {
      e.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const res = await api.post('/backup/restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      setSuccess(res.data.message || 'Banco de dados restaurado com sucesso!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao restaurar o banco de dados. Certifique-se de que é um arquivo .db válido.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleResetUserPassword = async (targetUser) => {
    const newPassword = prompt(`Digite a nova senha para o usuário "${targetUser.username}":`)
    if (newPassword === null) return // canceled
    
    if (newPassword.trim().length < 4) {
      alert('A nova senha deve conter no mínimo 4 caracteres.')
      return
    }

    try {
      await api.post(`/auth/users/${targetUser.id}/reset-password`, {
        new_password: newPassword.trim()
      })
      alert(`Senha do usuário "${targetUser.username}" alterada com sucesso!`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao resetar senha do usuário.')
    }
  }

  const handleToggleActive = async (targetUser) => {
    if (targetUser.username === user.username) {
      alert('Você não pode desativar seu próprio usuário.')
      return
    }
    
    if (window.confirm(`Tem certeza que deseja alterar o status do usuário ${targetUser.username}?`)) {
      try {
        await api.put(`/auth/users/${targetUser.id}/toggle-active`)
        fetchUsers()
      } catch (err) {
        alert(err.response?.data?.detail || 'Erro ao alterar status do usuário.')
      }
    }
  }

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await api.put(`/auth/users/${userId}/role`, { role: newRole })
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao atualizar o perfil do usuário.')
    }
  }

  const handleToggleFinancialAccess = async (userId) => {
    try {
      await api.put(`/auth/users/${userId}/toggle-financial-access`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao alterar o acesso financeiro do usuário.')
    }
  }

  const handleDeleteUser = async (targetUser) => {
    if (window.confirm(`ATENÇÃO: Você tem certeza que deseja EXCLUIR DEFINITIVAMENTE o usuário "${targetUser.username}"? Esta ação não pode ser desfeita.`)) {
      try {
        await api.delete(`/auth/users/${targetUser.id}`)
        alert(`Usuário "${targetUser.username}" excluído com sucesso.`)
        fetchUsers()
      } catch (err) {
        alert(err.response?.data?.detail || 'Erro ao excluir o usuário.')
      }
    }
  }

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      rh: 'Recursos Humanos',
      socio: 'Sócio-Diretor',
      gestor: 'Gestor de Área',
      consulta: 'Leitura/Consulta'
    }
    return labels[role] || role
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Usuários & Acesso</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie suas credenciais de segurança e contas corporativas do Lira People Management.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Navigation Card */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm h-fit space-y-2">
          <button
            onClick={() => { setActiveTab('profile'); setError(null); setSuccess(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4" />
            Minha Senha
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => { setActiveTab('register'); setError(null); setSuccess(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Cadastrar Usuário
              </button>

              <button
                onClick={() => { setActiveTab('users'); setError(null); setSuccess(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                Gerenciar Usuários
              </button>
            </>
          )}

          {isSocioOrAdmin && (
            <button
              onClick={() => { setActiveTab('backup'); setError(null); setSuccess(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Database className="w-4 h-4" />
              Backup e Celular
            </button>
          )}

          <div className="border-t border-slate-100 pt-3 px-3 mt-4 text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            Nível: {getRoleLabel(user?.role)}
          </div>
        </div>

        {/* Right Form/Content Card */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
          
          {/* Alerts Box */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-3 bg-red-900/10 border border-red-200 rounded-lg text-red-700 text-sm animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 p-3 bg-emerald-900/10 border border-emerald-200 rounded-lg text-emerald-700 text-sm animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: CHANGE PASSWORD */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-800">Alterar Minha Senha</h2>
                <p className="text-xs text-slate-400 mt-0.5">Mantenha sua conta segura alterando sua senha periodicamente.</p>
              </div>

              <form onSubmit={handlePwdChangeSubmit} className="max-w-md space-y-4">
                <div className="relative">
                  <label className="form-label">Senha Atual</label>
                  <div className="relative">
                    <input
                      type={showPwd.old ? 'text' : 'password'}
                      value={pwdForm.old_password}
                      onChange={(e) => setPwdForm(prev => ({ ...prev, old_password: e.target.value }))}
                      className="form-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(prev => ({ ...prev, old: !prev.old }))}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="form-label">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showPwd.new ? 'text' : 'password'}
                      value={pwdForm.new_password}
                      onChange={(e) => setPwdForm(prev => ({ ...prev, new_password: e.target.value }))}
                      className="form-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="form-label">Confirmar Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showPwd.confirm ? 'text' : 'password'}
                      value={pwdForm.confirm_password}
                      onChange={(e) => setPwdForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                      className="form-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  {loading ? 'Salvando...' : 'Alterar Senha'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: REGISTER USER (Admin only) */}
          {activeTab === 'register' && isAdmin && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-800">Cadastrar Novo Usuário</h2>
                <p className="text-xs text-slate-400 mt-0.5">Adicione novos colaboradores com permissões adequadas ao sistema.</p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="max-w-md space-y-4">
                <div>
                  <label className="form-label">Nome de Usuário (Username)</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                    placeholder="Ex: emersonmelo, juliasilva"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">E-mail Corporativo</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="exemplo@liramelo.com.br"
                    className="form-input"
                    required
                  />
                </div>

                <div className="relative">
                  <label className="form-label">Senha Inicial</label>
                  <div className="relative">
                    <input
                      type={showRegisterPwd ? 'text' : 'password'}
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                      className="form-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPwd(!showRegisterPwd)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showRegisterPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Nível de Acesso (Perfil)</label>
                  <select
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, role: e.target.value }))}
                    className="form-input cursor-pointer"
                  >
                    <option value="consulta">Leitura/Consulta (Apenas visualização)</option>
                    <option value="gestor">Gestor de Área (Leitura + Lançamento de extras)</option>
                    <option value="socio">Sócio-Diretor (Leitura + Aprovações e Relatórios)</option>
                    <option value="rh">Recursos Humanos (Operação total, sem Auditoria)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Cadastrando...' : 'Cadastrar Usuário'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: MANAGE USERS (Admin only) */}
          {activeTab === 'users' && isAdmin && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Contas e Acessos Cadastrados</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Veja a listagem de credenciais ativas e modifique seus status.</p>
                </div>
                <button
                  onClick={fetchUsers}
                  className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer"
                >
                  Atualizar Lista
                </button>
              </div>

              {fetchingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600"></div>
                </div>
              ) : usersList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhum usuário carregado.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                        <th className="px-4 py-3">Usuário</th>
                        <th className="px-4 py-3">E-mail</th>
                        <th className="px-4 py-3">Perfil de Acesso</th>
                        <th className="px-4 py-3 text-center">Acesso Financeiro</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((u) => {
                        const isSelf = u.username === user.username
                        return (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                              {u.username}
                              {isSelf && (
                                <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
                                  Você
                                </span>
                              )}
                              {u.password_reset_requested && (
                                <span className="inline-block px-1.5 py-0.2 bg-red-105 border border-red-200 text-red-700 rounded text-[9px] font-bold animate-pulse">
                                  Solicitou Reset
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{u.email}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {isSelf || u.role === 'admin' ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-100' :
                                  u.role === 'rh' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                  u.role === 'socio' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                  u.role === 'gestor' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                  'bg-slate-50 text-slate-700 border border-slate-100'
                                }`}>
                                  {getRoleLabel(u.role)}
                                </span>
                              ) : (
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold cursor-pointer"
                                >
                                  <option value="socio">Sócio-Diretor</option>
                                  <option value="rh">Recursos Humanos</option>
                                  <option value="gestor">Gestor de Área</option>
                                  <option value="consulta">Leitura/Consulta</option>
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isSelf || u.role === 'admin' ? (
                                <span className="text-slate-400 font-semibold text-[10px]">-</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={u.has_financial_access || false}
                                  onChange={() => handleToggleFinancialAccess(u.id)}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                u.is_active 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-red-50 text-red-700 border border-red-100'
                              }`}>
                                {u.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleResetUserPassword(u)}
                                  className="p-1.5 rounded text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-all cursor-pointer"
                                  title="Resetar Senha"
                                >
                                  <Key className="w-4 h-4" />
                                </button>
                                {!isSelf && u.role !== 'admin' ? (
                                  <>
                                    <button
                                      onClick={() => handleToggleActive(u)}
                                      className={`p-1.5 rounded transition-all cursor-pointer ${
                                        u.is_active
                                          ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                          : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                      }`}
                                      title={u.is_active ? 'Desativar Conta' : 'Ativar Conta'}
                                    >
                                      <Power className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u)}
                                      className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-all cursor-pointer"
                                      title="Excluir Conta"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  !isSelf && <span className="w-7 text-center text-slate-300 font-semibold text-[10px]">-</span>
                                )}
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
          )}

          {/* TAB 4: BACKUP & MOBILE CONNECTION */}
          {activeTab === 'backup' && isSocioOrAdmin && (
            <div className="space-y-8 animate-fadeIn">
              {/* Backup Section */}
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-500" />
                    Cópia de Segurança (Backup Local)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Exporte ou restaure todos os dados do sistema. Os arquivos de backup são armazenados em sua máquina local.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Card */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/60 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Exportar Banco de Dados</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Faça o download do banco de dados completo (`lira_rh.db`). Salve este arquivo em um pendrive ou e-mail para segurança.
                      </p>
                    </div>
                    <button
                      onClick={handleExportBackup}
                      disabled={loading}
                      className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 font-bold cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Arquivo de Backup (.db)
                    </button>
                  </div>

                  {/* Import Card */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/60 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-850">Restaurar Banco de Dados</h3>
                      <p className="text-xs text-slate-550 mt-1 leading-relaxed">
                        Selecione um arquivo de backup (`.db`) anteriormente exportado para substituir todos os dados atuais.
                      </p>
                    </div>
                    <label className="w-full btn-secondary py-2.5 flex items-center justify-center gap-2 font-bold cursor-pointer text-slate-700 bg-white border border-slate-350 hover:bg-slate-50 rounded-xl transition-all">
                      <Upload className="w-4 h-4" />
                      Enviar Arquivo de Backup (.db)
                      <input
                        type="file"
                        accept=".db"
                        onChange={handleRestoreBackup}
                        disabled={loading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Mobile Access Section */}
              <div className="space-y-6 pt-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-amber-500" />
                    Acesso Móvel no Celular (Mesmo Wi-Fi)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Utilize o MeuRestô diretamente no seu celular ou tablet compartilhando a rede Wi-Fi local do seu computador.
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/60 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl">
                      <Wifi className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-slate-800">Conecte via Rede Wi-Fi Local</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        1. Certifique-se de que o seu celular e este computador estejam conectados na **mesma rede Wi-Fi**.<br />
                        2. No navegador do seu celular, digite o seguinte endereço IP:
                      </p>
                      <div className="inline-block bg-slate-800 text-amber-400 font-mono font-bold text-sm px-4 py-2 rounded-xl mt-2 select-all shadow-inner border border-slate-700">
                        http://{localIp}:5173
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl text-xs text-amber-800 leading-relaxed font-semibold">
                    💡 **Trabalho Off-line e Auto-Sincronismo:** Caso você precise sair do Wi-Fi com o celular, você poderá continuar cadastrando dados off-line (com 4G/5G ou sem internet). O celular guardará tudo em uma fila temporária local e, assim que você se conectar novamente ao Wi-Fi local deste computador, o celular enviará as alterações de forma automática!
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}

export default UserSettings

