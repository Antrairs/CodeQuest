import { Eye, EyeOff, Lock, Mail, QrCode, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode, SyntheticEvent } from 'react'

import { ApiError, api } from '../api/client'
import type { User } from '../api/types'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

type AuthPageProps = {
  mode: 'login' | 'register'
  onAuthed: (user: User) => void
  navigate: (path: string) => void
}

type SchoolIdentity = {
  student_id: string
}

export function AuthPage({ mode, onAuthed, navigate }: AuthPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrSessionId, setQrSessionId] = useState('')
  const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentity | null>(null)
  const isLogin = mode === 'login'

  useEffect(() => {
    if (isLogin) return
    void startSchoolRegistration()
  }, [isLogin])

  useEffect(() => {
    if (isLogin || !qrSessionId || schoolIdentity) return undefined

    let checking = false
    const timer = window.setInterval(async () => {
      if (checking) return
      checking = true
      try {
        const response = await api.schoolRegistrationStatus(qrSessionId)
        if (response.status === 'pending') return
        window.clearInterval(timer)
        setQrSessionId('')

        if (response.status === 'verified' && response.school_identity) {
          setSchoolIdentity(response.school_identity)
          setUsername('')
          setPassword('')
          setConfirmPassword('')
          setMessage('')
          return
        }

        if (response.status === 'authenticated' && response.user) {
          onAuthed(response.user)
          navigate('/problems')
          return
        }

        setMessage(response.error || '二维码已失效，请重新获取')
      } catch (caught) {
        if (caught instanceof ApiError) {
          window.clearInterval(timer)
          setQrSessionId('')
          setMessage(caught.message)
        }
      } finally {
        checking = false
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [isLogin, navigate, onAuthed, qrSessionId, schoolIdentity])

  async function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const response = await api.login(username, password)
      onAuthed(response.user)
      navigate('/problems')
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : '请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteRegistration(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (password !== confirmPassword) {
      setMessage('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const response = await api.completeSchoolRegistration(username, password)
      onAuthed(response.user)
      navigate('/problems')
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function startSchoolRegistration() {
    setSchoolIdentity(null)
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setMessage('')
    setQrLoading(true)
    setQrSessionId('')
    setQrImage('')
    try {
      const response = await api.startSchoolRegistration()
      setQrImage(response.qr_image_data)
      setQrSessionId(response.session_id)
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : '学校二维码获取失败，请稍后重试')
    } finally {
      setQrLoading(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 w-full items-center justify-center px-4">
      <Card className="w-full max-w-[520px] p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-7 lg:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
            {isLogin ? '欢迎回来' : schoolIdentity ? '完善账号信息' : '学校扫码注册'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isLogin
              ? '登录账户继续你的学习之旅'
              : schoolIdentity
                ? '学校身份已验证，请设置你的登录账号和密码'
                : '使用学校统一认证完成实名验证'}
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

        {isLogin ? (
          <LoginForm
            username={username}
            password={password}
            rememberMe={rememberMe}
            showPassword={showPassword}
            loading={loading}
            message={message}
            setUsername={setUsername}
            setPassword={setPassword}
            setRememberMe={setRememberMe}
            setShowPassword={setShowPassword}
            setMessage={setMessage}
            onSubmit={handleLogin}
          />
        ) : schoolIdentity ? (
          <form className="mt-5 space-y-4" onSubmit={handleCompleteRegistration}>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              已验证学号：{schoolIdentity.student_id}
            </div>

            <TextInput
              label="用户名"
              value={username}
              onChange={setUsername}
              icon={<Mail className="h-4 w-4" />}
              placeholder="请输入登录用户名"
              autoComplete="username"
            />
            <PasswordInput
              label="密码"
              value={password}
              onChange={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              autoComplete="new-password"
            />
            <PasswordInput
              label="确认密码"
              value={confirmPassword}
              onChange={setConfirmPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              autoComplete="new-password"
            />

            {message ? <Message>{message}</Message> : null}

            <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
              {loading ? '正在注册...' : '完成注册'}
            </Button>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={startSchoolRegistration}
              disabled={qrLoading}
              className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/40 disabled:cursor-wait"
              title="点击刷新二维码"
            >
              {qrImage ? (
                <img src={qrImage} alt="学校扫码注册二维码" className="mx-auto h-56 w-56 rounded-xl bg-white p-3" />
              ) : (
                <div className="mx-auto flex h-56 w-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-500">
                  {qrLoading ? <RefreshCw className="mb-3 h-10 w-10 animate-spin" /> : <QrCode className="mb-3 h-10 w-10" />}
                  {qrLoading ? '正在获取二维码' : '正在准备二维码'}
                </div>
              )}
              <p className="mt-4 text-sm text-slate-600">进入注册页会自动刷新二维码，点击二维码可重新获取。</p>
            </button>

            {message ? <Message>{message}</Message> : null}

          </div>
        )}
      </Card>
    </section>
  )
}

function LoginForm(props: {
  username: string
  password: string
  rememberMe: boolean
  showPassword: boolean
  loading: boolean
  message: string
  setUsername: (value: string) => void
  setPassword: (value: string) => void
  setRememberMe: (value: boolean) => void
  setShowPassword: (value: boolean) => void
  setMessage: (value: string) => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="mt-5 space-y-4" onSubmit={props.onSubmit}>
      <TextInput
        label="邮箱 / 学号"
        value={props.username}
        onChange={props.setUsername}
        icon={<Mail className="h-4 w-4" />}
        placeholder="请输入邮箱地址或学号"
        autoComplete="username"
      />
      <PasswordInput
        label="密码"
        value={props.password}
        onChange={props.setPassword}
        showPassword={props.showPassword}
        setShowPassword={props.setShowPassword}
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={props.rememberMe}
            onChange={(event) => props.setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-950"
          />
          记住我
        </label>
        <button
          type="button"
          onClick={() => props.setMessage('请联系管理员重置密码。')}
          className="font-semibold text-blue-600 hover:text-blue-700"
        >
          忘记密码？
        </button>
      </div>

      {props.message ? <Message>{props.message}</Message> : null}

      <Button type="submit" disabled={props.loading} className="h-11 w-full rounded-xl">
        {props.loading ? '处理中...' : '登录'}
      </Button>
    </form>
  )
}

function TextInput(props: {
  label: string
  value: string
  onChange: (value: string) => void
  icon: ReactNode
  placeholder: string
  autoComplete: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{props.label}</span>
      <span className="relative mt-2 block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{props.icon}</span>
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          minLength={3}
          maxLength={32}
          required
        />
      </span>
    </label>
  )
}

function PasswordInput(props: {
  label: string
  value: string
  onChange: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  autoComplete: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{props.label}</span>
      <span className="relative mt-2 block">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
          type={props.showPassword ? 'text' : 'password'}
          placeholder="请输入密码"
          autoComplete={props.autoComplete}
          minLength={8}
          maxLength={128}
          required
        />
        <button
          type="button"
          onClick={() => props.setShowPassword(!props.showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          aria-label={props.showPassword ? '隐藏密码' : '显示密码'}
        >
          {props.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  )
}

function Message({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{children}</div>
}
