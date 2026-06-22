import { useEffect, useState } from 'react'

import { ApiError, api } from '../api/client'
import type { PracticeStatsResponse, User } from '../api/types'

type MyPracticePageProps = {
  user: User | null
  navigate: (path: string) => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export function MyPracticePage({ user, navigate }: MyPracticePageProps) {
  const [data, setData] = useState<PracticeStatsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadPracticeStats() {
      setLoading(true)
      setError('')
      try {
        const response = await api.practiceStats()
        if (!cancelled) setData(response)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : '练习记录加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadPracticeStats()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-950">我的练习</h1>
        <p className="mt-2 text-slate-600">登录后可以查看提交记录和通过率。</p>
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
        <h1 className="text-3xl font-semibold text-slate-950">我的练习</h1>
        <p className="mt-2 text-slate-600">查看你的练习概览和最近提交。</p>
      </div>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-lg bg-white p-6 text-slate-600">正在加载...</div> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="已练习题数" value={data.stats.practiced_count} />
            <StatCard label="已通过题数" value={data.stats.passed_count} />
            <StatCard label="未通过题数" value={data.stats.failed_count} />
            <StatCard label="通过率" value={`${data.stats.pass_rate}%`} />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">最近提交记录</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3">题目</th>
                    <th className="px-5 py-3">结果</th>
                    <th className="px-5 py-3">通过数</th>
                    <th className="px-5 py-3">提交时间</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent_submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {submission.problem.title}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            submission.is_passed
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {submission.is_passed ? '通过' : '未通过'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {submission.passed_count} / {submission.total_count}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(submission.created_at)}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/problems/${submission.problem.id}`)}
                          className="text-sm font-medium text-blue-700 hover:text-blue-800"
                        >
                          重新进入
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.recent_submissions.length === 0 ? (
              <div className="p-6 text-center text-slate-600">暂无提交记录。</div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

type StatCardProps = {
  label: string
  value: number | string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  )
}
