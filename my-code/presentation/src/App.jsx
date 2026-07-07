import { useEffect, useState } from 'react'
import Intro from './components/Intro.jsx'
import FeatureHub from './components/FeatureHub.jsx'
import Compare from './components/Compare.jsx'

function ThemeToggle() {
  const [theme, setTheme] = useState(null) // null = follow system

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function toggle() {
    const cur = document.documentElement.getAttribute('data-theme')
    const dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(dark ? 'light' : 'dark')
  }

  return (
    <button className="theme-toggle" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      ◐
    </button>
  )
}

export default function App() {
  return (
    <div className="deck">
      <ThemeToggle />
      <Intro />
      <FeatureHub />
      <Compare />
    </div>
  )
}
