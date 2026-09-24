import type {
  Activity,
  ActivityListResponse,
  PracticeStatsResponse,
  Problem,
  ProblemListResponse,
  Submission,
  User,
  WrongProblemListResponse,
} from './types'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

let csrfRequest: Promise<void> | null = null
let schoolRegistrationStartRequest: Promise<SchoolRegisterStartResponse> | null = null
const pendingGets = new Map<string, Promise<unknown>>()

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getCookie(name: string) {
  const prefix = `${name}=`
  const item = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : ''
}

async function ensureCsrfToken() {
  if (getCookie('csrftoken')) return
  if (!csrfRequest) {
    csrfRequest = fetch('/api/auth/me/', { credentials: 'include' })
      .then(() => undefined)
      .finally(() => {
        csrfRequest = null
      })
  }
  await csrfRequest
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET') return sendRequest<T>(path, options)

  const pending = pendingGets.get(path) as Promise<T> | undefined
  if (pending) return pending

  const promise = sendRequest<T>(path, options).finally(() => pendingGets.delete(path))
  pendingGets.set(path, promise)
  return promise
}

async function sendRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const method = (options.method ?? 'GET').toUpperCase()
  let body: BodyInit | undefined

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    await ensureCsrfToken()
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      headers.set('X-CSRFToken', csrfToken)
    }
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    body,
    headers,
    credentials: 'include',
  })
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const message =
      data && typeof data.error === 'string' ? data.error : `请求失败 (${response.status})`
    throw new ApiError(message, response.status)
  }

  return data as T
}

export type ProblemFilters = {
  category?: string
  difficulty?: string
  status?: string
  page?: number
}

export type SubmissionPayload = {
  problem_id: number
  code: string
  is_passed: boolean
  passed_count: number
  total_count: number
  error_message: string
}

export type SchoolRegisterStartResponse = {
  session_id: string
  qr_image_data: string
  expires_in: number
}

export type SchoolRegisterStatusResponse = {
  status: 'pending' | 'expired' | 'error' | 'verified' | 'authenticated'
  school_identity?: {
    student_id: string
  }
  user?: User
  error?: string
}

export const api = {
  me() {
    return request<{ user: User | null }>('/auth/me/')
  },
  register(username: string, password: string) {
    return request<{ user: User }>('/auth/register/', {
      method: 'POST',
      body: { username, password },
    })
  },
  startSchoolRegistration() {
    if (!schoolRegistrationStartRequest) {
      schoolRegistrationStartRequest = request<SchoolRegisterStartResponse>(
        '/auth/register/school/start/',
        { method: 'POST' },
      ).finally(() => {
        schoolRegistrationStartRequest = null
      })
    }
    return schoolRegistrationStartRequest
  },
  schoolRegistrationStatus(sessionId: string) {
    return request<SchoolRegisterStatusResponse>(`/auth/register/school/${sessionId}/status/`)
  },
  completeSchoolRegistration(username: string, password: string) {
    return request<{ user: User }>('/auth/register/school/complete/', {
      method: 'POST',
      body: { username, password },
    })
  },
  login(username: string, password: string) {
    return request<{ user: User }>('/auth/login/', {
      method: 'POST',
      body: { username, password },
    })
  },
  logout() {
    return request<{ ok: boolean }>('/auth/logout/', { method: 'POST' })
  },
  problems(filters: ProblemFilters) {
    const params = new URLSearchParams()
    if (filters.category) params.set('category', filters.category)
    if (filters.difficulty) params.set('difficulty', filters.difficulty)
    if (filters.status) params.set('status', filters.status)
    if (filters.page && filters.page > 1) params.set('page', String(filters.page))
    const query = params.toString()
    return request<ProblemListResponse>(`/problems/${query ? `?${query}` : ''}`)
  },
  problem(problemId: number) {
    return request<{ problem: Problem }>(`/problems/${problemId}/`)
  },
  submit(payload: SubmissionPayload) {
    return request<{ submission: Submission }>('/submissions/', {
      method: 'POST',
      body: payload,
    })
  },
  practiceStats() {
    return request<PracticeStatsResponse>('/submissions/stats/')
  },
  wrongProblems(page = 1) {
    return request<WrongProblemListResponse>(`/submissions/wrong-problems/?page=${page}`)
  },
  activities(page = 1) {
    return request<ActivityListResponse>(`/activities/?page=${page}`)
  },
  activity(activityId: number) {
    return request<{ activity: Activity }>(`/activities/${activityId}/`)
  },
  claimActivity(activityId: number) {
    return request<{ activity: Activity }>(`/activities/${activityId}/claim/`, { method: 'POST' })
  },
}
