export type Route =
  | { name: 'home' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'problems' }
  | { name: 'practice'; problemId: number }
  | { name: 'my-practice' }
  | { name: 'wrong-book' }

export function parseRoute(pathname = window.location.pathname): Route {
  const parts = pathname.split('/').filter(Boolean)

  if (parts[0] === 'login') return { name: 'login' }
  if (parts[0] === 'register') return { name: 'register' }
  if (parts[0] === 'practice-log') return { name: 'my-practice' }
  if (parts[0] === 'wrong-book') return { name: 'wrong-book' }
  if (parts[0] === 'problems' && parts[1]) {
    const problemId = Number(parts[1])
    return Number.isFinite(problemId) ? { name: 'practice', problemId } : { name: 'problems' }
  }
  if (parts[0] === 'problems') return { name: 'problems' }

  return { name: 'home' }
}

