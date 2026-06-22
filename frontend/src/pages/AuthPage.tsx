import { Building2, Code2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'

import { ApiError, api } from '../api/client'
import type { User } from '../api/types'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

type AuthPageProps = {
  mode: 'login' | 'register'
  onAuthed: (user: User) => void
  navigate: (path: string) => void
}

export function AuthPage({ mode, onAuthed, navigate }: AuthPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const isLogin = mode === 'login'

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const response = isLogin
        ? await api.login(username, password)
        : await api.register(username, password)
      onAuthed(response.user)
      navigate('/problems')
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : '请求失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  function showUnavailableLogin() {
    setMessage('第一版暂未接入第三方登录，请使用账号密码登录或注册。')
  }

  return (
    <section className="flex h-full min-h-0 w-full items-center justify-center">
      <Card className="w-full max-w-[520px] p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-7 lg:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
            {isLogin ? '欢迎回来' : '创建账号'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isLogin ? '登录账户继续你的学习之旅' : '注册后即可保存练习记录和错题'}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              isLogin ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              !isLogin ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            注册
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-bold text-slate-900">邮箱 / 学号</span>
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                placeholder="请输入邮箱地址或学号"
                autoComplete="username"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-900">密码</span>
            <span className="relative mt-2 block">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-950"
              />
              记住我
            </label>
            <button
              type="button"
              onClick={() => setMessage('请联系管理员重置密码。')}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              忘记密码？
            </button>
          </div>

          {message ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {message}
            </div>
          ) : null}

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          或
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-3">
          <Button type="button" variant="outline" onClick={showUnavailableLogin} className="h-11 w-full">
            <Code2 className="h-5 w-5" />
            使用 GitHub 登录
          </Button>
          <Button type="button" variant="ghost" onClick={showUnavailableLogin} className="h-10 w-full text-blue-600">
            <Building2 className="h-5 w-5" />
            使用学校 CAS 登录
          </Button>
        </div>
      </Card>
    </section>
  )
}
