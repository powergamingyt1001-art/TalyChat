'use client'

import React from 'react'

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TalyChat ErrorBoundary]', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined })
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl">😅</div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Please reload the page.
          </p>
          {this.state.error?.message && (
            <pre className="max-w-md overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="btn-brand rounded-lg px-4 py-2 text-sm font-medium"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
