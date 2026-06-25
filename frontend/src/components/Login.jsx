import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { UtensilsCrossed, Lock, User, AlertCircle } from 'lucide-react'

const Login = () => {
  const { login, error, setError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localLoading, setLocalLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.')
      return
    }
    
    setLocalLoading(true)
    const success = await login(username.trim(), password)
    setLocalLoading(false)
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
          <p className="text-xs text-slate-400 mt-1">Gestão de Restaurante - Painel Administrativo</p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
              Usuário
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

          {/* Spacer */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={localLoading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800/50 text-white font-bold rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-amber-600/10 active:scale-[0.98] cursor-pointer"
            >
              {localLoading ? 'Autenticando...' : 'Acessar o Sistema'}
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="text-center mt-8 text-[11px] text-slate-500 font-medium border-t border-slate-800/80 pt-6">
          <p>© 2026 MeuRestô.</p>
          <p className="mt-1 text-slate-600">Acesso restrito a colaboradores autorizados.</p>
        </div>

      </div>
    </div>
  )
}

export default Login
