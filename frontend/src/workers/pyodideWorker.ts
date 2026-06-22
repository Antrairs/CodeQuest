type Pyodide = {
  globals: {
    set: (name: string, value: string) => void
    get: (name: string) => string
  }
  runPythonAsync: (code: string) => Promise<unknown>
}

type PyodideModule = {
  loadPyodide: (options: { indexURL: string }) => Promise<Pyodide>
}

type WorkerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

type WorkerRequest =
  | {
      type: 'init'
      id: number
    }
  | {
      type: 'run'
      id: number
      code: string
      stdin: string
    }

const PYODIDE_BASE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.0/full/'
const INIT_ERROR_MESSAGE = 'Python 运行环境加载失败'

let status: WorkerStatus = 'idle'
let statusError = ''
let pyodide: Pyodide | null = null
let initPromise: Promise<Pyodide> | null = null

function setStatus(nextStatus: WorkerStatus, error = '') {
  status = nextStatus
  statusError = error
  self.postMessage({ type: 'status', status, error: statusError })
}

async function initPyodide() {
  if (pyodide) return pyodide
  if (initPromise) return initPromise

  setStatus('loading')
  initPromise = import(/* @vite-ignore */ `${PYODIDE_BASE_URL}pyodide.mjs`)
    .then((module) => (module as PyodideModule).loadPyodide({ indexURL: PYODIDE_BASE_URL }))
    .then((loadedPyodide) => {
      pyodide = loadedPyodide
      return loadedPyodide
    })
    .catch((error) => {
      initPromise = null
      const message = error instanceof Error ? error.message : String(error)
      setStatus('error', message || INIT_ERROR_MESSAGE)
      throw error
    })

  return initPromise
}

async function runPython(code: string, stdin: string) {
  if (!pyodide) {
    throw new Error('Python 运行环境尚未就绪')
  }

  setStatus('running')
  pyodide.globals.set('__codequest_code', code)
  pyodide.globals.set('__codequest_stdin', stdin)

  await pyodide.runPythonAsync(`
import io
import json
import sys
import traceback

_old_stdin = sys.stdin
_old_stdout = sys.stdout
_old_stderr = sys.stderr
_stdout = io.StringIO()
_stderr = io.StringIO()

sys.stdin = io.StringIO(__codequest_stdin)
sys.stdout = _stdout
sys.stderr = _stderr

try:
    exec(__codequest_code, {"__name__": "__main__"})
    _error = None
except BaseException:
    _error = traceback.format_exc()
finally:
    sys.stdin = _old_stdin
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
    __codequest_result_json = json.dumps({
        "stdout": _stdout.getvalue(),
        "stderr": _stderr.getvalue(),
        "error": _error,
    })
`)

  return JSON.parse(pyodide.globals.get('__codequest_result_json')) as {
    stdout: string
    stderr: string
    error: string | null
  }
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === 'init') {
    try {
      await initPyodide()
      self.postMessage({ type: 'init-result', id: event.data.id, ok: true })
      setStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      self.postMessage({
        type: 'init-result',
        id: event.data.id,
        ok: false,
        error: message || INIT_ERROR_MESSAGE,
      })
    }
    return
  }

  try {
    const result = await runPython(event.data.code, event.data.stdin)
    self.postMessage({ type: 'run-result', id: event.data.id, ...result })
    setStatus('ready')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(pyodide ? 'ready' : 'error', pyodide ? '' : message)
    self.postMessage({
      type: 'run-result',
      id: event.data.id,
      stdout: '',
      stderr: '',
      error: message,
    })
  }
})
