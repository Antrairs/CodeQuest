import { BarChart3, BookOpen, TerminalSquare } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

type HomePageProps = {
  navigate: (path: string) => void
}

const features = [
  {
    icon: TerminalSquare,
    title: '实时运行代码',
    description: '内置在线 IDE，边学边练，立即看到运行结果。',
  },
  {
    icon: BookOpen,
    title: '渐进式课程',
    description: '从基础到进阶，用题目串起 Python 核心语法。',
  },
  {
    icon: BarChart3,
    title: '智能刷题反馈',
    description: '保存提交记录，错题会自动进入错题本。',
  },
]

export function HomePage({ navigate }: HomePageProps) {
  return (
    <section className="space-y-6">
      <Card className="grid gap-8 overflow-hidden p-6 md:grid-cols-[1.15fr_0.85fr] md:p-10">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase text-blue-700">Python 在线练习</p>
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              开始你的 <span className="text-blue-600">Python 学习之旅</span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              面向 Python 初学者的在线练习网站。浏览题目、在浏览器里运行 Python、提交测试点，
              并持续跟踪练习和错题状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={() => navigate('/problems')}>
              开始练习
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate('/problems')}>
              进入题库
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950 p-5 font-mono text-sm leading-7 text-slate-100">
          <div className="mb-3 text-slate-400">浏览器内运行</div>
          <pre>{`name = input()
print(f"Hello, {name}!")

# stdout
Hello, Python learner!`}</pre>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon
          const tones = ['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-indigo-50 text-indigo-600']
          return (
            <Card key={feature.title} className="p-5">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tones[index]}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-bold text-slate-950">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
