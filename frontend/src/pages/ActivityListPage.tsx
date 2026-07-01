import { useEffect, useState } from 'react'

import { ApiError, api } from '../api/client'
import type { ActivityListResponse, User } from '../api/types'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'

type ActivityListPageProps = {
  user: User | null
  navigate: (path: string) => void
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export function ActivityListPage({ user, navigate }: ActivityListPageProps) {
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadActivities() {
      setLoading(true)
      setError('')
      try {
        const response = await api.activities()
        if (!cancelled) setData(response)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : '活动加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadActivities()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">刷题活动</h1>
          <p className="mt-2 text-slate-600">在规定时间内完成活动题目，达标后领取签到码。</p>
        </div>
        {!user ? <Button onClick={() => navigate('/login')}>登录后参与</Button> : null}
      </div>

      {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-xl bg-white p-6 text-slate-600">正在加载活动...</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.activities.map((activity) => (
          <Card key={activity.id} as="article">
            <CardContent>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{activity.name}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {activity.description || '暂无活动说明'}
                  </p>
                </div>
                <Badge tone={activity.progress.is_completed ? 'success' : 'muted'}>
                  {activity.progress.completed_count} / {activity.progress.required_count}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>开始：{formatDateTime(activity.start_at)}</div>
                <div>结束：{formatDateTime(activity.end_at)}</div>
                <div>题目数：{activity.problem_count}</div>
                <div>状态：{activity.status_label}</div>
              </div>
              <Button className="mt-5" onClick={() => navigate(`/activities/${activity.id}`)}>
                查看活动
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && data?.activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          暂无正在发布的活动。
        </div>
      ) : null}
    </section>
  )
}
