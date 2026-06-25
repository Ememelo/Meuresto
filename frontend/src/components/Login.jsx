import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { UtensilsCrossed, Lock, User, AlertCircle, Mail, Shield, CheckCircle } from 'lucide-react'
import api from '../utils/api'

const Login = () => {
  const { login, error, setError } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('socio')
  const [localLoading, setLocalLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSignupSuccess('')
    
    if (isSignUp) {
      if (!username.trim() || !email.trim() || !password.trim()) {
        setError('Por favor, preencha todos os campos.')
        return
      }
      setLocalLoading(true)
      try {
        await api.post('/auth/signup', {
          username: username.trim(),
          email: email.trim(),
          password,
          role
        })
        setSignupSuccess('Cadastro realizado com sucesso! Faça login abaixo.')
        setIsSignUp(false)
      } catch (err) {
        const message = err.response?.data?.detail || 'Erro ao realizar cadastro.'
        setError(message)
      } finally {
        setLocalLoading(false)
      }
    } else {
      if (!username.trim() || !password.trim()) {
        setError('Por favor, preencha todos os campos.')
        return
      }
      setLocalLoading(true)
      const success = await login(username.trim(), password)
      setLocalLoading(false)
    }
  }

  const handleToggleMode = () => {
    setError(null)
    setSignupSuccess('')
    setIsSignUp(!isSignUp)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 px-4">
      <div className="max-w-md w-full bg-slate-900/40 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-2xl shadow-black/80">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 mb-4 shadow-lg shadow-amber-500/10">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 tracking-wider">MEURESTÔ</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp ? 'Criar Nova Conta Local' : 'Gestão de Restaurante - Painel Administrativo'}
          </p>
        </div>

        {/* Success Alert Box */}
        {signupSuccess && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-lg text-emerald-400 text-sm">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{signupSuccess}</span>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
              Nome de Usuário
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Insira seu usuário"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm transition-all shadow-inner"
                required
              />
            </div>
          </div>

          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm transition-all shadow-inner"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                  Perfil de Acesso
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Shield className="w-4 h-4" />
                  </span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm transition-all cursor-pointer"
                  >
                    <option value="socio">Sócio-Diretor (Acesso Total + Financeiro)</option>
                    <option value="admin">Administrador (Master)</option>
                    <option value="rh">Recursos Humanos (RH)</option>
                    <option value="gestor">Gestor de Equipe</option>
                    <option value="consulta">Somente Leitura</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Insira sua senha"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm transition-all shadow-inner"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={localLoading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800/50 text-white font-bold rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-amber-600/10 active:scale-[0.98] cursor-pointer"
            >
              {localLoading 
                ? (isSignUp ? 'Cadastrando...' : 'Autenticando...') 
                : (isSignUp ? 'Criar Nova Conta' : 'Acessar o Sistema')}
            </button>
          </div>
        </form>

        {/* Toggle Mode Link */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={handleToggleMode}
            className="text-xs text-amber-500 hover:text-amber-400 font-bold transition-all cursor-pointer"
          >
            {isSignUp 
              ? 'Já possui uma conta? Faça login' 
              : 'Não tem uma conta? Cadastre-se localmente'}
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center mt-8 text-[11px] text-slate-500 font-medium border-t border-slate-800/80 pt-6">
          <p>© 2026 MeuRestô.</p>
          <p className="mt-1 text-slate-600">
            {isSignUp 
              ? 'Os dados serão armazenados de forma 100% segura na sua máquina.' 
              : 'Acesso restrito a colaboradores autorizados.'}
          </p>
        </div>

      </div>
    </div>
  )
}

export default Login

