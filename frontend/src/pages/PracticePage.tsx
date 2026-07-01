import {
  Code2,
  Maximize2,
  Minimize2,
  Play,
  RefreshCcw,
  Send,
  Terminal,
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, CSSProperties, PointerEvent } from 'react'

import { ApiError, api } from '../api/client'
import type { Problem, TestCase, User } from '../api/types'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardHeader } from '../components/ui/card'
import { PythonRunner } from '../lib/pythonRunner'
import type { PythonRunnerSnapshot, PythonRunResult } from '../lib/pythonRunner'

type PracticePageProps = {
  problemId: number
  user: User | null
  navigate: (path: string) => void
}

type JudgeCase = {
  testCase: TestCase
  passed: boolean
  stdout: string
  error: string | null
}

type JudgeSummary = {
  isPassed: boolean
  passedCount: number
  totalCount: number
  errorMessage: string
  cases: JudgeCase[]
}

function normalizeOutput(value: string) {
  return normalizeMultilineText(value)
}

function normalizeMultilineText(value: string) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')

  while (lines.length > 0 && lines[0].trim() === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0)
  const commonIndent = indents.length > 0 ? Math.min(...indents) : 0

  return lines.map((line) => line.slice(commonIndent).trimEnd()).join('\n')
}

function displayText(value: string, fallback: string) {
  const normalized = normalizeMultilineText(value)
  return normalized || fallback
}

function outputText(result: PythonRunResult | null) {
  if (!result) return ''
  if (result.error) return result.error
  return result.stdout || '（无输出）'
}

function firstFailureMessage(cases: JudgeCase[]) {
  const failed = cases.find((item) => !item.passed)
  if (!failed) return ''
  if (failed.error) return failed.error
  return `测试点 ${failed.testCase.order || failed.testCase.id} 输出不匹配`
}

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#0f172a',
    minHeight: '100%',
    padding: '1.25rem',
  },
  '.cm-gutters': {
    minHeight: '100%',
    borderRight: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: '#eef9ff',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#0f172a',
  },
  '.cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  '&:has(.cm-selectionBackground) .cm-activeLine, &:has(.cm-selectionBackground) .cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-content ::selection': {
    backgroundColor: 'transparent',
    color: 'inherit',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#dcfce766',
    outline: '1px solid #86efac',
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.string, color: '#15803d' },
  { tag: tags.number, color: '#c2410c' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#2563eb' },
  { tag: tags.variableName, color: '#0f172a' },
  { tag: tags.operator, color: '#475569' },
])

const codePreviewHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c4b5fd', fontWeight: '600' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.number, color: '#fdba74' },
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#93c5fd' },
  { tag: tags.variableName, color: '#e2e8f0' },
  { tag: tags.operator, color: '#cbd5e1' },
])

const editorExtensions = [
  EditorState.tabSize.of(4),
  indentUnit.of('    '),
  python(),
  editorTheme,
  syntaxHighlighting(pythonHighlightStyle),
]

const codePreviewTheme = EditorView.theme({
  '&': {
    borderRadius: '0 0 0.75rem 0.75rem',
    backgroundColor: '#020617',
    color: '#e2e8f0',
    fontSize: '0.875rem',
  },
  '.cm-scroller': {
    maxHeight: '13rem',
    overflow: 'auto',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    lineHeight: '1.7',
  },
  '.cm-content': {
    padding: '0.875rem 0',
  },
  '.cm-gutters': {
    borderRight: '1px solid rgba(148, 163, 184, 0.18)',
    backgroundColor: '#020617',
    color: '#64748b',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 0.75rem',
  },
  '.cm-line': {
    padding: '0 1rem',
  },
  '.cm-cursor': {
    display: 'none',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

const codePreviewExtensions = [
  EditorState.tabSize.of(4),
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  lineNumbers(),
  python(),
  codePreviewTheme,
  syntaxHighlighting(codePreviewHighlightStyle),
]

function CodePreview({
  code,
  copyPasteEnabled,
  onCopyBlocked,
}: {
  code: string
  copyPasteEnabled: boolean
  onCopyBlocked: () => void
}) {
  const hasCode = code.trim().length > 0
  const value = hasCode ? code : '暂无示例代码'

  function handleCopy(event: ClipboardEvent<HTMLDivElement>) {
    if (copyPasteEnabled) return
    event.preventDefault()
    onCopyBlocked()
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-900/80 bg-slate-950"
      onCopyCapture={handleCopy}
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400">
        <span className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-blue-400" />
          main.py
        </span>
        <span>Python</span>
      </div>
      <CodeMirror
        value={value}
        basicSetup={false}
        editable={false}
        readOnly
        theme="none"
        extensions={codePreviewExtensions}
        className="code-preview-editor"
      />
    </div>
  )
}

function ExampleBlock({ label, value }: { label: string; value: string }) {
  const content = displayText(value, '无')

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-500">{label}</div>
      <pre className="custom-scrollbar overflow-auto whitespace-pre font-mono text-sm leading-6 text-slate-900">{content}</pre>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function PracticePage({ problemId, user, navigate }: PracticePageProps) {
  const [runner] = useState(() => new PythonRunner())
  const [pythonState, setPythonState] = useState<PythonRunnerSnapshot>(() => runner.getSnapshot())
  const [problem, setProblem] = useState<Problem | null>(null)
  const [nextProblemId, setNextProblemId] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [runResult, setRunResult] = useState<PythonRunResult | null>(null)
  const [judge, setJudge] = useState<JudgeSummary | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lessonWidth, setLessonWidth] = useState(38)
  const [editorFullscreen, setEditorFullscreen] = useState(false)
  const [copyPasteEnabled, setCopyPasteEnabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('codequest-copy-paste-enabled') === '1',
  )
  const [copyPastePromptOpen, setCopyPastePromptOpen] = useState(false)
  const [copyPastePromptChecked, setCopyPastePromptChecked] = useState(false)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const editorCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = runner.subscribe(setPythonState)
    void runner.init().catch(() => undefined)
    return () => {
      unsubscribe()
      runner.dispose()
    }
  }, [runner])

  useEffect(() => {
    function handleFullscreenChange() {
      setEditorFullscreen(document.fullscreenElement === editorCardRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadProblem() {
      setLoading(true)
      setError('')
      setJudge(null)
      setRunResult(null)
      try {
        const response = await api.problem(problemId)
        if (cancelled) return
        setProblem(response.problem)
        setCode(response.problem.starter_code || '')
        setCustomInput(response.problem.public_test_cases?.[0]?.stdin ?? '')

        api
          .problems({})
          .then((list) => {
            if (cancelled) return
            const index = list.problems.findIndex((item) => item.id === problemId)
            const next = index >= 0 ? list.problems[index + 1] : null
            setNextProblemId(next?.id ?? null)
          })
          .catch(() => setNextProblemId(null))
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : '题目加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadProblem()
    return () => {
      cancelled = true
    }
  }, [problemId])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(
      () => setNotice(''),
      pythonState.status === 'error' ? 6500 : 3500,
    )
    return () => window.clearTimeout(timeout)
  }, [notice, pythonState.status])

  const pythonReady = pythonState.status === 'ready'
  const busy = running || submitting || pythonState.status === 'running'
  const actionLooksDisabled = !pythonReady || busy
  const publicCases = problem?.public_test_cases ?? []
  const progress = judge ? Math.round((judge.passedCount / Math.max(judge.totalCount, 1)) * 100) : 30
  const sampleInput = publicCases[0]?.stdin || ''
  const sampleOutput = publicCases[0]?.expected_stdout || ''
  const sampleCode = problem?.starter_code || ''

  const workspaceStyle = {
    '--lesson-width': `${lessonWidth}%`,
  } as CSSProperties

  function showPythonNotReadyNotice() {
    setNotice(
      pythonState.status === 'error'
        ? pythonState.error || 'Python 运行环境加载失败，请重新加载后再试。'
        : 'Python 运行环境正在加载，请稍后再试。',
    )
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (!workspaceRef.current) return
    const rect = workspaceRef.current.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100
      setLessonWidth(clamp(percent, 28, 56))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  async function handleReloadPython() {
    setNotice('')
    setRunResult(null)
    setJudge(null)
    await runner.reload().catch(() => undefined)
  }

  function closeCopyPastePrompt() {
    if (copyPastePromptChecked) {
      setCopyPasteEnabled(true)
      window.sessionStorage.setItem('codequest-copy-paste-enabled', '1')
    }
    setCopyPastePromptOpen(false)
    setCopyPastePromptChecked(false)
  }

  async function handleRun() {
    if (!pythonReady) {
      showPythonNotReadyNotice()
      return
    }

    setNotice('')
    setRunResult(null)
    setRunning(true)
    const result = await runner.run(code, customInput)
    setRunResult(result)
    setRunning(false)
  }

  async function handleSubmit() {
    if (!problem) return
    if (!user) {
      setNotice('请先登录后再提交代码。未登录时可以浏览题目和运行自定义输入。')
      return
    }
    if (!pythonReady) {
      showPythonNotReadyNotice()
      return
    }

    const testCases = problem.test_cases ?? []
    if (testCases.length === 0) {
      setNotice('该题还没有测试用例，请先在 Django Admin 中添加测试用例。')
      return
    }

    setNotice('')
    setJudge(null)
    setSubmitting(true)

    const cases: JudgeCase[] = []
    for (const testCase of testCases) {
      const result = await runner.run(code, testCase.stdin)
      const passed =
        !result.error && normalizeOutput(result.stdout) === normalizeOutput(testCase.expected_stdout)

      cases.push({
        testCase,
        passed,
        stdout: result.stdout,
        error: result.error,
      })

      if (result.timedOut) break
    }

    const passedCount = cases.filter((item) => item.passed).length
    const totalCount = testCases.length
    const isPassed = passedCount === totalCount
    const errorMessage = isPassed ? '' : firstFailureMessage(cases)

    try {
      await api.submit({
        problem_id: problem.id,
        code,
        is_passed: isPassed,
        passed_count: passedCount,
        total_count: totalCount,
        error_message: errorMessage,
      })
      setJudge({ isPassed, passedCount, totalCount, errorMessage, cases })
      setNotice(isPassed ? '提交已通过，并已保存记录。' : '提交未通过，已保存记录并更新错题本。')
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : '提交保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleEditorFullscreen() {
    const target = editorCardRef.current
    if (!target) return
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
    } else {
      await target.requestFullscreen().catch(() => undefined)
    }
  }

  function goNextProblem() {
    if (nextProblemId) {
      navigate(`/problems/${nextProblemId}`)
    } else {
      setNotice('当前已经是最后一道题，已返回题库。')
      navigate('/problems')
    }
  }

  if (loading) {
    return <Card className="p-6 text-slate-600">正在加载题目...</Card>
  }

  if (error || !problem) {
    return (
      <Card className="border-red-200 bg-red-50 p-6 text-red-700">
        {error || '题目不存在或未发布'}
      </Card>
    )
  }

  return (
    <section
      ref={workspaceRef}
      className="practice-workspace"
      style={workspaceStyle}
    >
      {copyPastePromptOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-paste-dialog-title"
        >
          <Card className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="copy-paste-dialog-title" className="text-2xl font-bold tracking-tight text-slate-950">
              复制和粘贴当前已禁用
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              建议手动输入代码完成练习，这样更有助于理解和记忆。你也可以为本次会话临时开启复制和粘贴。
            </p>
            <label className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={copyPastePromptChecked}
                onChange={(event) => setCopyPastePromptChecked(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-950"
              />
              本次会话允许复制和粘贴
            </label>
            <Button type="button" onClick={closeCopyPastePrompt} className="mt-5 min-w-28">
              OK
            </Button>
          </Card>
        </div>
      ) : null}

      {notice ? (
        <div className="pointer-events-none fixed left-1/2 top-6 z-40 w-[min(92vw,520px)] -translate-x-1/2">
          <Card
            role="status"
            className="pointer-events-auto rounded-2xl border-slate-200 bg-white/75 px-5 py-4 text-center text-sm text-slate-800 shadow-2xl shadow-slate-900/10 backdrop-blur-xl"
          >
            <div className="font-medium">{notice}</div>
            {pythonState.status === 'error' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReloadPython}
                className="mt-3"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                重新加载 Python 环境
              </Button>
            ) : null}
          </Card>
        </div>
      ) : null}

      <Card as="article" className="practice-left min-h-0 overflow-hidden">
        <div className="custom-scrollbar h-full overflow-y-auto p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success" className="text-sm">
              {problem.difficulty_label}
            </Badge>
            <div className="h-2 min-w-32 flex-1 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-slate-500">{progress}%</span>
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">
            {problem.title}
          </h1>
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">
            {problem.description}
          </p>

          <div className="my-6 h-px bg-slate-200" />

          <section className="mt-7 space-y-3">
            <h2 className="text-lg font-bold text-slate-950">样例</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ExampleBlock label="示例输入" value={sampleInput} />
              <ExampleBlock label="示例输出" value={sampleOutput} />
            </div>
          </section>

          <section className="mt-7 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <Code2 className="h-5 w-5" />
                示例代码
              </h2>
            </div>
            <CodePreview
              code={sampleCode}
              copyPasteEnabled={copyPasteEnabled}
              onCopyBlocked={() => setCopyPastePromptOpen(true)}
            />
          </section>

          <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-slate-700">
            <div className="mb-2 font-bold text-slate-950">题目解析</div>
            <p className="whitespace-pre-wrap break-words leading-7">
              {problem.explanation || '先用自定义输入运行，再提交测试全部用例。'}
            </p>
          </section>

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => navigate('/problems')}>
              ← 返回题库
            </Button>
            <Button type="button" size="lg" onClick={goNextProblem}>
              下一题 →
            </Button>
          </div>
        </div>
      </Card>

      <button
        type="button"
        onPointerDown={startResize}
        onDoubleClick={() => setLessonWidth(38)}
        className="practice-resizer"
        aria-label="拖动调整教程和编辑器宽度"
      />

      <div className="practice-main min-h-0">
        <div ref={editorCardRef} className="min-h-0">
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex flex-col gap-3 bg-white lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 min-w-40 items-center gap-2 rounded-t-xl border border-slate-200 border-b-white bg-white px-3 text-sm font-bold">
                  <Code2 className="h-4 w-4 text-blue-600" />
                  <span className="truncate">main.py</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm">
                  <option>Python</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCode(problem.starter_code || '')
                    setNotice('')
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  重置
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRun}
                  disabled={busy}
                  aria-disabled={actionLooksDisabled}
                  className={!pythonReady ? 'cursor-not-allowed opacity-50' : ''}
                >
                  <Play className="h-4 w-4" />
                  {running || pythonState.status === 'running' ? '运行中' : '运行'}
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={busy}
                  aria-disabled={actionLooksDisabled}
                  className={!pythonReady ? 'cursor-not-allowed opacity-50' : ''}
                >
                  <Send className="h-4 w-4" />
                  {submitting ? '提交中' : '提交'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleEditorFullscreen}
                  aria-label={editorFullscreen ? '退出全屏' : '编辑器全屏'}
                >
                  {editorFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>

            <div className="custom-scrollbar code-editor-scroll min-h-0 flex-1 bg-white">
              <div className="code-editor-inner h-full min-h-0">
                <CodeMirror
                  value={code}
                  height="100%"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    foldGutter: false,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: false,
                    crosshairCursor: false,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    syntaxHighlighting: false,
                  }}
                  extensions={editorExtensions}
                  onChange={(value) => setCode(value)}
                  className="code-editor h-full"
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="custom-scrollbar grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[0.8fr_1fr]">
          <Card className="flex min-h-0 flex-col rounded-2xl shadow-none">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-950">控制台输入</h2>
            </div>
            <textarea
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
              placeholder="输入 stdin，点击运行后会传给你的代码"
              className="custom-scrollbar min-h-40 flex-1 resize-none rounded-b-2xl border-0 bg-slate-50 p-4 font-mono text-sm leading-7 text-slate-950 outline-none focus:bg-white"
            />
          </Card>

          <Card className="flex min-h-0 flex-col rounded-2xl shadow-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 font-bold text-slate-950">
                <Terminal className="h-4 w-4" />
                终端输出
              </h2>
              <span className="text-xs font-semibold text-slate-400">stdout</span>
            </div>
            <pre className="custom-scrollbar min-h-40 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-7 text-slate-950">
              {outputText(runResult) || '点击“运行”查看输出。'}
            </pre>
          </Card>

        </Card>
      </div>
    </section>
  )
}
