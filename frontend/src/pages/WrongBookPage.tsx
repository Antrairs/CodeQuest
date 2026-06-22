import { useEffect, useState } from 'react'

import { ApiError, api } from '../api/client'
import type { User, WrongProblemListResponse } from '../api/types'

type WrongBookPageProps = {
  user: User | null
  navigate: (path: string) => void
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

export function WrongBookPage({ user, navigate }: WrongBookPageProps) {
  const [data, setData] = useState<WrongProblemListResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadWrongProblems() {
      setLoading(true)
      setError('')
      try {
        const response = await api.wrongProblems()
        if (!cancelled) setData(response)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : '错题本加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadWrongProblems()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-950">错题本</h1>
        <p className="mt-2 text-slate-600">登录后可以查看未通过题目和掌握状态。</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          去登录
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">错题本</h1>
        <p className="mt-2 text-slate-600">未通过题会进入错题本，再次提交通过后标记为已掌握。</p>
      </div>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-lg bg-white p-6 text-slate-600">正在加载...</div> : null}

      <div className="grid gap-4">
        {data?.wrong_problems.map((wrong) => (
          <article key={wrong.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{wrong.problem.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {wrong.problem.category || '未分类'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {wrong.problem.difficulty_label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      wrong.is_resolved
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {wrong.is_resolved ? '已掌握' : '待巩固'}
                  </span>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  错误次数：{wrong.wrong_count}，最近错误：{formatDate(wrong.last_wrong_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/problems/${wrong.problem.id}`)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                重新练习
              </button>
            </div>
          </article>
        ))}
      </div>

      {!loading && data?.wrong_problems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          暂无错题记录。
        </div>
      ) : null}
    </section>
  )
}
