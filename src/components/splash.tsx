'use client'

import { useEffect, useState } from 'react'

export function Splash() {
  const [opacity, setOpacity] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setOpacity(100), 50)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="taly-shell items-center justify-center bg-background">
      <div
        className="flex flex-col items-center gap-6 transition-opacity duration-700"
        style={{ opacity }}
      >
        <img src="/logo.png" alt="TalyChat" className="h-24 w-24 rounded-2xl shadow-lg" />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">TalyChat</h1>
          <p className="text-sm text-muted-foreground mt-1">Chat. Connect. Mingle.</p>
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  )
}
