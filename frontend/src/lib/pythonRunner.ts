export type PythonRunnerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

export type PythonRunnerSnapshot = {
  status: PythonRunnerStatus
  error: string
}

export type PythonRunResult = {
  stdout: string
  stderr: string
  error: string | null
  timedOut?: boolean
}

type WorkerStatusResponse = {
  type: 'status'
  status: PythonRunnerStatus
  error?: string
}

type WorkerInitResponse = {
  type: 'init-result'
  id: number
  ok: boolean
  error?: string
}

type WorkerRunResponse = PythonRunResult & {
  type: 'run-result'
  id: number
}

type WorkerErrorResponse = {
  type: 'error'
  id?: number
  error: string
}

type WorkerResponse =
  | WorkerStatusResponse
  | WorkerInitResponse
  | WorkerRunResponse
  | WorkerErrorResponse

type PendingInit = {
  id: number
  resolve: () => void
  reject: (error: Error) => void
  timeoutId: number
}

type PendingRun = {
  id: number
  resolve: (result: PythonRunResult) => void
  timeoutId: number
}

type StatusListener = (snapshot: PythonRunnerSnapshot) => void

const INIT_TIMEOUT_MS = 30000
const RUN_TIMEOUT_MS = 3000
const INIT_ERROR_MESSAGE = 'Python 运行环境加载失败'
const RUN_TIMEOUT_MESSAGE = '代码运行时间过长，可能存在死循环'

export class PythonRunner {
  private worker: Worker
  private nextId = 1
  private pendingInit: PendingInit | null = null
  private pendingRun: PendingRun | null = null
  private initPromise: Promise<void> | null = null
  private status: PythonRunnerStatus = 'idle'
  private error = ''
  private disposed = false
  private listeners = new Set<StatusListener>()

  constructor() {
    this.worker = this.createWorker()
  }

  getSnapshot(): PythonRunnerSnapshot {
    return { status: this.status, error: this.error }
  }

  subscribe(listener: StatusListener) {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  init(timeoutMs = INIT_TIMEOUT_MS) {
    if (this.disposed) {
      this.disposed = false
      this.worker = this.createWorker()
      this.status = 'idle'
      this.error = ''
    }
    if (this.status === 'ready') {
      return Promise.resolve()
    }
    if (this.status === 'loading' && this.initPromise) {
      return this.initPromise
    }

    this.setStatus('loading')
    const id = this.nextId
    this.nextId += 1

    this.initPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (!this.pendingInit || this.pendingInit.id !== id) return
        this.pendingInit = null
        this.initPromise = null
        this.recreateWorker()
        this.setStatus('error', INIT_ERROR_MESSAGE)
        reject(new Error(INIT_ERROR_MESSAGE))
      }, timeoutMs)

      this.pendingInit = { id, resolve, reject, timeoutId }
      this.worker.postMessage({ type: 'init', id })
    })

    return this.initPromise
  }

  reload() {
    if (this.disposed) {
      this.disposed = false
    }
    this.clearPendingInit()
    this.clearPendingRun()
    this.recreateWorker()
    return this.init()
  }

  run(code: string, stdin: string, timeoutMs = RUN_TIMEOUT_MS) {
    if (this.status !== 'ready') {
      return Promise.resolve<PythonRunResult>({
        stdout: '',
        stderr: '',
        error: 'Python 运行环境尚未就绪',
      })
    }
    if (this.pendingRun) {
      return Promise.resolve<PythonRunResult>({
        stdout: '',
        stderr: '',
        error: '已有代码正在运行，请稍后再试',
      })
    }

    const id = this.nextId
    this.nextId += 1
    this.setStatus('running')

    return new Promise<PythonRunResult>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (!this.pendingRun || this.pendingRun.id !== id) return
        this.pendingRun = null
        this.recreateWorker()
        this.setStatus('loading')
        resolve({
          stdout: '',
          stderr: '',
          error: RUN_TIMEOUT_MESSAGE,
          timedOut: true,
        })
        void this.init().catch(() => undefined)
      }, timeoutMs)

      this.pendingRun = { id, resolve, timeoutId }
      this.worker.postMessage({ type: 'run', id, code, stdin })
    })
  }

  dispose() {
    this.disposed = true
    this.clearPendingInit()
    this.clearPendingRun()
    this.listeners.clear()
    this.worker.terminate()
    this.status = 'idle'
    this.error = ''
  }

  private createWorker() {
    const worker = new Worker(new URL('../workers/pyodideWorker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(event.data)
    }

    worker.onerror = (event) => {
      const message = event.message || INIT_ERROR_MESSAGE
      this.rejectPendingInit(message)
      this.resolvePendingRun({
        stdout: '',
        stderr: '',
        error: message,
      })
      this.setStatus('error', message)
    }

    worker.onmessageerror = () => {
      this.rejectPendingInit(INIT_ERROR_MESSAGE)
      this.resolvePendingRun({
        stdout: '',
        stderr: '',
        error: INIT_ERROR_MESSAGE,
      })
      this.setStatus('error', INIT_ERROR_MESSAGE)
    }

    return worker
  }

  private handleWorkerMessage(message: WorkerResponse) {
    if (this.disposed) return

    if (message.type === 'status') {
      this.setStatus(message.status, message.error ?? '')
      return
    }

    if (message.type === 'init-result') {
      if (!this.pendingInit || this.pendingInit.id !== message.id) return
      window.clearTimeout(this.pendingInit.timeoutId)
      const pending = this.pendingInit
      this.pendingInit = null
      this.initPromise = null

      if (message.ok) {
        this.setStatus('ready')
        pending.resolve()
      } else {
        const error = message.error || INIT_ERROR_MESSAGE
        this.setStatus('error', error)
        pending.reject(new Error(error))
      }
      return
    }

    if (message.type === 'run-result') {
      if (!this.pendingRun || this.pendingRun.id !== message.id) return
      window.clearTimeout(this.pendingRun.timeoutId)
      const pending = this.pendingRun
      this.pendingRun = null
      this.setStatus('ready')
      pending.resolve({
        stdout: message.stdout,
        stderr: message.stderr,
        error: message.error,
      })
      return
    }

    if (message.type === 'error') {
      if (this.pendingInit && this.pendingInit.id === message.id) {
        this.rejectPendingInit(message.error)
      }
      if (this.pendingRun && this.pendingRun.id === message.id) {
        this.resolvePendingRun({
          stdout: '',
          stderr: '',
          error: message.error,
        })
        this.setStatus('ready')
      }
    }
  }

  private recreateWorker() {
    this.worker.terminate()
    this.worker = this.createWorker()
  }

  private clearPendingInit() {
    if (!this.pendingInit) return
    window.clearTimeout(this.pendingInit.timeoutId)
    this.pendingInit = null
    this.initPromise = null
  }

  private clearPendingRun() {
    if (!this.pendingRun) return
    window.clearTimeout(this.pendingRun.timeoutId)
    this.pendingRun = null
  }

  private rejectPendingInit(message: string) {
    if (!this.pendingInit) return
    window.clearTimeout(this.pendingInit.timeoutId)
    const pending = this.pendingInit
    this.pendingInit = null
    this.initPromise = null
    pending.reject(new Error(message))
  }

  private resolvePendingRun(result: PythonRunResult) {
    if (!this.pendingRun) return
    window.clearTimeout(this.pendingRun.timeoutId)
    const pending = this.pendingRun
    this.pendingRun = null
    pending.resolve(result)
  }

  private setStatus(status: PythonRunnerStatus, error = '') {
    this.status = status
    this.error = error
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}
