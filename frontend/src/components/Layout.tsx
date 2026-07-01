import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Code2,
  GraduationCap,
  Home,
  LogOut,
  Moon,
  NotebookTabs,
  Settings,
  SquarePen,
  Sun,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import type { User } from '../api/types'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

type LayoutProps = {
  children: ReactNode
  currentPath: string
  user: User | null
  navigate: (path: string) => void
  onLogout: () => void
}

type NavItemProps = {
  href: string
  currentPath: string
  navigate: (path: string) => void
  icon: LucideIcon
  label: string
}

type BreadcrumbItem = {
  label: string
  href?: string
  icon?: LucideIcon
}

const navItems = [
  { href: '/', icon: GraduationCap, label: '学习' },
  { href: '/problems', icon: NotebookTabs, label: '题库' },
  { href: '/activities', icon: CalendarDays, label: '活动' },
  { href: '/practice-log', icon: SquarePen, label: '练习' },
  { href: '/wrong-book', icon: TriangleAlert, label: '错题' },
]

function NavItem({ href, currentPath, navigate, icon: Icon, label }: NavItemProps) {
  const active = currentPath === href || (href !== '/' && currentPath.startsWith(href))
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        navigate(href)
      }}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold transition',
        active
          ? 'bg-slate-100 text-slate-950 shadow-sm'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950',
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </a>
  )
}

function breadcrumbsFor(currentPath: string): BreadcrumbItem[] {
  const root: BreadcrumbItem = { label: '学习路径', href: '/', icon: Home }

  if (currentPath.startsWith('/problems/')) {
    return [
      root,
      { label: 'Python 基础', href: '/problems', icon: BookOpen },
      { label: '题目练习' },
    ]
  }

  if (currentPath.startsWith('/problems')) {
    return [root, { label: '题库', href: '/problems', icon: NotebookTabs }]
  }

  if (currentPath.startsWith('/activities/')) {
    return [root, { label: '活动', href: '/activities', icon: CalendarDays }, { label: '活动详情' }]
  }

  if (currentPath.startsWith('/activities')) {
    return [root, { label: '活动', href: '/activities', icon: CalendarDays }]
  }

  if (currentPath.startsWith('/practice-log')) {
    return [root, { label: '练习', href: '/practice-log', icon: SquarePen }]
  }

  if (currentPath.startsWith('/wrong-book')) {
    return [root, { label: '错题', href: '/wrong-book', icon: TriangleAlert }]
  }

  return [root]
}

export function Layout({ children, currentPath, user, navigate, onLogout }: LayoutProps) {
  const [theme, setTheme] = useState<'light' | 'dim'>('light')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isPracticePage = currentPath.startsWith('/problems/')
  const isAuthPage = currentPath.startsWith('/login') || currentPath.startsWith('/register')
  const breadcrumbs = breadcrumbsFor(currentPath)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  function toggleTheme() {
    setTheme((value) => (value === 'light' ? 'dim' : 'light'))
  }

  if (isAuthPage) {
    return (
      <div className={cn('flex h-dvh flex-col overflow-hidden text-slate-950', theme === 'dim' ? 'bg-slate-100' : 'bg-[#fbfbfc]')}>
        <header className="shrink-0 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-left text-lg font-bold text-slate-950"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <Code2 className="h-5 w-5" />
              </span>
              <span>Python 学习平台</span>
            </button>

            <Button type="button" variant="ghost" size="icon" onClick={toggleTheme} aria-label="切换主题">
              {theme === 'dim' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 lg:py-6">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'text-slate-950',
        isPracticePage ? 'h-dvh overflow-hidden' : 'min-h-screen',
        theme === 'dim' ? 'bg-slate-100' : 'bg-[#fbfbfc]',
      )}
    >
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[88px] border-r border-slate-200 bg-white/90 px-3 py-5 backdrop-blur xl:flex xl:flex-col xl:items-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-10 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm"
          aria-label="CodeQuest 首页"
        >
          <Code2 className="h-6 w-6" />
        </button>
        <nav className="flex w-full flex-1 flex-col gap-3">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              currentPath={currentPath}
              navigate={navigate}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen((value) => !value)}
          className="mt-auto"
          aria-label="设置"
        >
          <Settings className="h-5 w-5" />
        </Button>
        {settingsOpen ? (
          <div className="absolute bottom-5 left-[96px] z-30 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
            <div className="font-semibold text-slate-950">快捷设置</div>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
            >
              护眼模式
              <span>{theme === 'dim' ? '开' : '关'}</span>
            </button>
          </div>
        ) : null}
      </aside>

      <div className={cn('xl:pl-[88px]', isPracticePage && 'flex h-full flex-col overflow-hidden')}>
        <header className={cn('z-10 border-b border-slate-200 bg-white/85 backdrop-blur', isPracticePage ? 'shrink-0' : 'sticky top-0')}>
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-9">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                {breadcrumbs.map((item, index) => {
                  const Icon = item.icon
                  const isLast = index === breadcrumbs.length - 1

                  return (
                    <div key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
                      {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
                      {item.href && !isLast ? (
                        <button
                          type="button"
                          onClick={() => navigate(item.href!)}
                          className="inline-flex min-w-0 items-center gap-2 text-slate-950 hover:text-blue-600"
                        >
                          {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                          <span className="truncate">{item.label}</span>
                        </button>
                      ) : (
                        <span className="inline-flex min-w-0 items-center gap-2 truncate text-slate-950">
                          {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                          <span className="truncate">{item.label}</span>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <nav className="relative hidden items-center gap-2 lg:flex">
              <Button type="button" variant="ghost" size="icon" onClick={toggleTheme} aria-label="主题">
                {theme === 'dim' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="通知"
              >
                <Bell className="h-5 w-5" />
              </Button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-30 w-80 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
                  <div className="font-semibold text-slate-950">通知</div>
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-slate-600">
                    Python 环境会在进入题目页后自动加载，运行和提交结果会显示在下方面板。
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="mt-3 text-sm font-semibold text-slate-950"
                  >
                    知道了
                  </button>
                </div>
              ) : null}
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/practice-log')}
                    className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 pr-3 text-sm font-medium shadow-sm"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                    {user.username}
                  </button>
                  <Button type="button" variant="outline" onClick={onLogout}>
                    <LogOut className="h-4 w-4" />
                    退出
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => navigate('/login')}>
                    登录
                  </Button>
                  <Button type="button" onClick={() => navigate('/register')}>
                    注册
                  </Button>
                </>
              )}
            </nav>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                  currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-700',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main
          className={
            isPracticePage
              ? 'min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-4 xl:px-5'
              : 'px-4 py-5 sm:px-6 xl:px-9'
          }
        >
          {children}
        </main>
      </div>
    </div>
  )
}
