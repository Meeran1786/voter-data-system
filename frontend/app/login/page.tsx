'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setError(null)

    try {
      // Hit the FastAPI backend directly — works because CORS allows localhost:3001
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      let data: any = {}
      try {
        data = await res.json()
      } catch {
        throw new Error('Server returned an unexpected response — is the backend running?')
      }

      if (!res.ok) {
        // FastAPI validation errors come as an array; HTTP exceptions as a string.
        const detail = data.detail
        if (Array.isArray(detail)) {
          // Pydantic v2 format: [{msg: "...", type: "...", loc: [...]}]
          const msgs = detail.map((e: any) => e.msg ?? String(e)).join('; ')
          throw new Error(msgs || 'Validation error')
        }
        throw new Error(typeof detail === 'string' ? detail : 'Login failed')
      }

      // Store in both localStorage (for API calls) and cookie (for middleware)
      localStorage.setItem('voter_token', data.access_token)
      localStorage.setItem('voter_user', data.username)
      document.cookie = `voter_token=${data.access_token}; path=/; max-age=${60 * 60 * 24}`
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2460] to-[#1a3a8f] flex flex-col items-center justify-center p-4">

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#0f2460] px-8 py-8 text-center">
          <img
            src="https://maqsusi.com/wp-content/uploads/2025/10/cropped-Maqsusi-no-bg.png"
            alt="Maqsusi"
            className="h-10 mx-auto mb-4 brightness-200 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <h1 className="text-white font-bold text-xl leading-tight">
            Voter Data System
          </h1>
          <p className="text-blue-200 text-xs mt-1">
            Maqsusi Digital Industries Software
          </p>
        </div>

        {/* ECI tricolor strip */}
        <div className="h-1 flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white border-y border-slate-200" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="px-8 py-8 space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-slate-800 font-semibold text-lg">Sign in to continue</h2>
            <p className="text-slate-400 text-xs mt-0.5">Indian Electoral Roll Management</p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-[#0f2460] focus:border-transparent
                         bg-slate-50 placeholder:text-slate-300"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-[#0f2460] focus:border-transparent
                           bg-slate-50 placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full py-2.5 bg-[#0f2460] hover:bg-[#1a3a8f] text-white text-sm font-semibold
                       rounded-lg transition-colors disabled:opacity-50
                       flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              : <><LogIn className="w-4 h-4" /> Sign In</>
            }
          </button>

          {/* Default credentials hint */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500">
              Default credentials:&nbsp;
              <span className="font-mono font-semibold text-slate-700">admin</span>
              &nbsp;/&nbsp;
              <span className="font-mono font-semibold text-slate-700">admin@123</span>
            </p>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-blue-200 text-xs space-y-1">
        <p>© {new Date().getFullYear()} Labyrinth Global Solutions India Private Limited</p>
        <p className="flex items-center justify-center gap-2">
          <span className="px-2 py-0.5 bg-white/10 rounded text-[10px]">CMMI Level 5</span>
          <span className="px-2 py-0.5 bg-white/10 rounded text-[10px]">ISO 9001:2015</span>
          <span className="px-2 py-0.5 bg-white/10 rounded text-[10px]">Siemens Partner</span>
        </p>
      </div>
    </div>
  )
}
