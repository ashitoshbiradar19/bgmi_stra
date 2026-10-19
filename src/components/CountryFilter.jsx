import { useMemo } from 'react'
import { Globe2 } from 'lucide-react'
import { ALL_COUNTRIES, countriesInRoster, countryCounts, countryFlag, countryLabel } from '../data/countries'

// Country selector for the team-logo pickers.
//
// Both pickers (the map inspector and the Teams → Only Logos tab) show the same
// roster, so they show the same filter. It is one component rather than two
// copies because the chip order and the counts must not drift between them.
//
// Countries are derived from the roster itself — a chip only exists for a
// country that actually has at least one team, which is what keeps the row
// short even though the registry knows more countries than any one roster uses.
export default function CountryFilter({ teams, value, onChange, accent = 'amber' }) {
  const codes = useMemo(() => countriesInRoster(teams), [teams])
  const counts = useMemo(() => countryCounts(teams), [teams])
  const total = teams.length

  const isOn = value === ALL_COUNTRIES
  const activeClass =
    accent === 'cyan'
      ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
      : 'border-amber-400/50 bg-amber-400/15 text-amber-200'
  const idleClass = 'border-slate-800/60 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'

  const chip = (isSelected, onClick, key, title, children) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      title={title}
      className={`flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold tabular-nums transition-colors ${isSelected ? activeClass : idleClass}`}
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
        <Globe2 size={11} className="text-amber-400" />
        <span>Country</span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {chip(isOn, () => onChange(ALL_COUNTRIES), 'all', `All countries (${total} teams)`, (
          <>
            <span className="text-slate-500">ALL</span>
            <span>{total}</span>
          </>
        ))}
        {codes.map((code) =>
          chip(value === code, () => onChange(code), code, `${countryLabel(code)} — ${counts[code]} teams`, (
            <>
              <span>{countryFlag(code)}</span>
              <span>{counts[code]}</span>
            </>
          )),
        )}
      </div>
    </div>
  )
}