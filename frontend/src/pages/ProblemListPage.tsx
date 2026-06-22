import { useEffect, useState } from 'react'

import { ApiError, api } from '../api/client'
import type { Problem, ProblemListResponse } from '../api/types'

type ProblemListPageProps = {
  navigate: (path: string) => void
}

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'untouched', label: '未做' },
  { value: 'passed', label: '已通过' },
  { value: 'failed', label: '未通过' },
]

function problemStatus(problem: Problem) {
  if (problem.state.is_passed) return { text: '已通过', className: 'bg-emerald-50 text-emerald-700' }
  if (problem.state.has_failed && !problem.state.is_wrong_resolved) {
    return { text: '未通过', className: 'bg-red-50 text-red-700' }
  }
  if (problem.state.has_failed && problem.state.is_wrong_resolved) {
    return { text: '已掌握', className: 'bg-blue-50 text-blue-700' }
  }
  return { text: '未做', className: 'bg-slate-100 text-slate-700' }
}

export function ProblemListPage({ navigate }: ProblemListPageProps) {
  const [data, setData] = useState<ProblemListResponse | null>(null)
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadProblems() {
      setLoading(true)
      setError('')
      try {
        const response = await api.problems({ category, difficulty, status })
        if (!cancelled) setData(response)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : '题目加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadProblems()
    return () => {
      cancelled = true
    }
  }, [category, difficulty, status])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">题库</h1>
          <p className="mt-2 text-slate-600">选择一道题，在浏览器中编写并运行 Python 代码。</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label>
          <span className="text-sm font-medium text-slate-700">分类</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">全部分类</option>
            {data?.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700">难度</span>
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">全部难度</option>
            {data?.difficulties.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700">完成状态</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {statusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-md bg-white p-6 text-slate-600">正在加载题目...</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.problems.map((problem) => {
          const state = problemStatus(problem)
          return (
            <article key={problem.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{problem.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {problem.category?.name ?? '未分类'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {problem.difficulty_label}
                    </span>
                    <span className={`rounded-full px-2 py-1 ${state.className}`}>{state.text}</span>
                    <span
                      className={`rounded-full px-2 py-1 ${
                        problem.state.is_passed
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {problem.state.is_passed ? '已通过' : '未通过'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 ${
                        problem.state.has_failed ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {problem.state.has_failed ? '曾经失败' : '暂无失败'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                {problem.description}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/problems/${problem.id}`)}
                className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                进入练习
              </button>
            </article>
          )
        })}
      </div>

      {!loading && data?.problems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          暂无符合条件的题目。
        </div>
      ) : null}
    </section>
  )
}
