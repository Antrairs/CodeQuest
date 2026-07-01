import { useEffect, useState } from 'react'

import { ApiError, api } from '../api/client'
import type { Activity, User } from '../api/types'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader } from '../components/ui/card'

type ActivityDetailPageProps = {
  activityId: number
  user: User | null
  navigate: (path: string) => void
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export function ActivityDetailPage({ activityId, user, navigate }: ActivityDetailPageProps) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadActivity() {
      setLoading(true)
      setError('')
      try {
        const response = await api.activity(activityId)
        if (!cancelled) setActivity(response.activity)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : '活动加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadActivity()
    return () => {
      cancelled = true
    }
  }, [activityId])

  async function handleClaim() {
    if (!user) {
      navigate('/login')
      return
    }
    setClaiming(true)
    setError('')
    try {
      const response = await api.claimActivity(activityId)
      setActivity(response.activity)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '领取失败')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return <div className="rounded-xl bg-white p-6 text-slate-600">正在加载活动...</div>
  if (error && !activity) return <div className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</div>
  if (!activity) return null

  const hasCode = Boolean(activity.checkin_code || activity.checkin_qr_image_url)

  return (
    <section className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{activity.status_label}</Badge>
                <Badge tone={activity.progress.is_completed ? 'success' : 'warning'}>
                  已完成 {activity.progress.completed_count} / {activity.progress.required_count}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-slate-950">{activity.name}</h1>
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-slate-600">
                {activity.description || '暂无活动说明'}
              </p>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>开始：{formatDateTime(activity.start_at)}</div>
                <div>结束：{formatDateTime(activity.end_at)}</div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 lg:min-w-64">
              <div className="font-semibold text-slate-950">完成条件</div>
              <div className="mt-2">通过任意 {activity.required_problem_count} 道活动题目。</div>
              {!user ? <div className="mt-2 text-amber-700">登录后可记录进度和领取签到码。</div> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">活动题目</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activity.problems?.map((problem) => (
              <article key={problem.id} className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-950">{problem.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{problem.category || '未分类'}</Badge>
                  <Badge>{problem.difficulty_label}</Badge>
                  <Badge tone={problem.is_passed_in_activity ? 'success' : 'muted'}>
                    {problem.is_passed_in_activity ? '已通过' : '未通过'}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{problem.description}</p>
                <Button className="mt-4" variant="outline" onClick={() => navigate(`/problems/${problem.id}`)}>
                  开始练习
                </Button>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">签到码领取</h2>
        </CardHeader>
        <CardContent>
          {hasCode ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm font-semibold text-emerald-800">签到码</div>
              <div className="mt-2 break-all text-2xl font-bold text-emerald-900">
                {activity.checkin_code || '请使用下方二维码内容签到'}
              </div>
              {activity.checkin_qr_image_url ? (
                <img
                  src={activity.checkin_qr_image_url}
                  alt="签到二维码"
                  className="mt-3 max-h-72 rounded-xl border border-emerald-200 bg-white p-2"
                />
              ) : null}
              <div className="mt-3 text-sm text-emerald-800">
                已领取，查看次数：{activity.progress.view_count}
              </div>
            </div>
          ) : activity.progress.is_completed ? (
            <Button onClick={handleClaim} disabled={claiming}>
              {claiming ? '领取中...' : activity.progress.has_claimed ? '查看签到码' : '领取签到码'}
            </Button>
          ) : (
            <div className="text-slate-600">完成活动要求后可以领取签到码。</div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
