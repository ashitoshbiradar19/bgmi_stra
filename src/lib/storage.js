const AUTOSAVE_KEY = 'bgmi_tactical_autosave_v2'
const SAVED_STRATEGIES_KEY = 'bgmi_tactical_saved_strategies_v2'

export function getAutoSaveState() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveAutoSaveState(state) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }))
  } catch {
    /* ignore storage quota errors */
  }
}

export function getSavedStrategies() {
  try {
    const raw = localStorage.getItem(SAVED_STRATEGIES_KEY)
    if (!raw) return []
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

export function saveStrategy(name, state) {
  try {
    const existing = getSavedStrategies()
    const newStrategy = {
      id: 'strat_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
      name: name || `Strategy ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      mapId: state.mapId || 'erangel',
      circles: state.circles || [],
      annos: state.annos || [],
      createdAt: Date.now(),
    }
    const updated = [newStrategy, ...existing.slice(0, 49)]
    localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return getSavedStrategies()
  }
}

export function deleteSavedStrategy(id) {
  try {
    const existing = getSavedStrategies()
    const updated = existing.filter((s) => s.id !== id)
    localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return getSavedStrategies()
  }
}

export function exportStrategyToFile(strategy) {
  const jsonStr = JSON.stringify(strategy, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `BGMI_Strategy_${(strategy.name || strategy.mapId || 'board').replace(/[^a-z0-9]/gi, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importStrategyFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data || (!data.circles && !data.annos && !data.c && !data.a)) {
          reject(new Error('Invalid BGMI strategy JSON format'))
          return
        }
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
