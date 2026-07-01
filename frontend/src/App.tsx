import { useCallback, useEffect, useState } from 'react'

import { api } from './api/client'
import type { User } from './api/types'
import './App.css'
import { Layout } from './components/Layout'
import { parseRoute } from './lib/router'
import type { Route } from './lib/router'
import { AuthPage } from './pages/AuthPage'
import { ActivityDetailPage } from './pages/ActivityDetailPage'
import { ActivityListPage } from './pages/ActivityListPage'
import { HomePage } from './pages/HomePage'
import { MyPracticePage } from './pages/MyPracticePage'
import { PracticePage } from './pages/PracticePage'
import { ProblemListPage } from './pages/ProblemListPage'
import { WrongBookPage } from './pages/WrongBookPage'

function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute())
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [user, setUser] = useState<User | null>(null)

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path)
    setCurrentPath(window.location.pathname)
    setRoute(parseRoute())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname)
      setRoute(parseRoute())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    api
      .me()
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
  }, [])

  const handleLogout = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
    navigate('/')
  }, [navigate])

  function renderRoute() {
    if (route.name === 'login') {
      return <AuthPage mode="login" onAuthed={setUser} navigate={navigate} />
    }
    if (route.name === 'register') {
      return <AuthPage mode="register" onAuthed={setUser} navigate={navigate} />
    }
    if (route.name === 'problems') {
      return <ProblemListPage navigate={navigate} />
    }
    if (route.name === 'activities') {
      return <ActivityListPage user={user} navigate={navigate} />
    }
    if (route.name === 'activity') {
      return <ActivityDetailPage activityId={route.activityId} user={user} navigate={navigate} />
    }
    if (route.name === 'practice') {
      return <PracticePage problemId={route.problemId} user={user} navigate={navigate} />
    }
    if (route.name === 'my-practice') {
      return <MyPracticePage user={user} navigate={navigate} />
    }
    if (route.name === 'wrong-book') {
      return <WrongBookPage user={user} navigate={navigate} />
    }
    return <HomePage navigate={navigate} />
  }

  return (
    <Layout currentPath={currentPath} user={user} navigate={navigate} onLogout={handleLogout}>
      {renderRoute()}
    </Layout>
  )
}

export default App
