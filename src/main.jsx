import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
    window.location.hash = ''
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#070A0F] p-6 text-center text-slate-100 font-sans">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0D1525] p-8 shadow-2xl">
            <div className="mb-4 text-4xl">🎯</div>
            <h1 className="text-xl font-bold text-amber-400">BGMI Tactical Analyzer</h1>
            <p className="mt-2 text-sm text-slate-400">
              A temporary layout error occurred during session restore.
            </p>
            {this.state.error?.message && (
              <div className="mt-4 max-h-32 overflow-y-auto rounded-lg bg-black/40 p-3 text-left font-mono text-xs text-rose-400 border border-rose-500/20">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
