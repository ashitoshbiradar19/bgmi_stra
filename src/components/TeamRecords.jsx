import { useMemo, useState } from 'react'
import { Trophy, Users, Target, Shield, Sword, RotateCw, TrendingUp, ChevronRight, ChevronDown, Award, Star, Search } from 'lucide-react'
import { TEAM_RECORDS, HEAD_TO_HEAD, PRIZE_MONEY, MVP_AWARDS, STRENGTH_MATRIX } from '../data/teamRecords'

function SectionLabel({ children, className = '' }) {
  return (
    <div className={`text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500 ${className}`}>
      {children}
    </div>
  )
}

function StatBar({ label, value, color = 'bg-cyan-500' }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
        <span>{label}</span>
        <span className="text-slate-300">{value}/5</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800/60 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  )
}

function ExpansionRow({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[11px] font-bold text-slate-300 hover:bg-slate-800/40 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>
      {open && <div className="border-t border-slate-800/40 px-3.5 py-3 space-y-2.5">{children}</div>}
    </div>
  )
}

export default function TeamRecords({ onApply }) {
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [activeTab, setActiveTab] = useState('teams')

  const tabs = [
    { id: 'teams', label: 'Teams' },
    { id: 'head2head', label: 'H2H' },
    { id: 'records', label: 'Records' },
    { id: 'matrix', label: 'Matrix' },
  ]

  const selected = useMemo(
    () => TEAM_RECORDS.find((t) => t.id === selectedTeam) || TEAM_RECORDS[0],
    [selectedTeam],
  )

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex-1 py-2.5 text-[10px] font-extrabold tracking-wide transition-all duration-200 ${
              activeTab === t.id ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-sky-300" />
            )}
          </button>
        ))}
      </div>

      {/* ==================== TEAMS TAB ==================== */}
      {activeTab === 'teams' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
                <Trophy size={13} className="text-cyan-400" />
              </div>
              Team Records &amp; Statistics
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Complete data on top Indian esports teams, their rosters, playstyles, rotations, and records.
            </p>
          </div>

          {/* Team Selector */}
          <div className="space-y-2">
            <SectionLabel>Select Team</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {TEAM_RECORDS.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                    selected?.id === team.id
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-slate-800/50 bg-[#0D1525] text-slate-400 hover:border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }}
                  />
                  <span className="truncate text-[11px] font-bold">{team.short}</span>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="space-y-3">
              {/* Team Header */}
              <div className="rounded-2xl border border-slate-800/40 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-lg" style={{ borderColor: `${selected.color}33` }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-xs"
                    style={{ backgroundColor: selected.color, color: '#fff', boxShadow: `0 0 16px ${selected.color}44` }}
                  >
                    {selected.short.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white truncate">{selected.name}</div>
                    <div className="text-[10px] font-bold text-slate-500">{selected.game} · {selected.org || '—'}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-center">
                  <div className="rounded-xl border border-slate-800/40 bg-slate-900/40 px-2 py-1.5">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Founded</div>
                    <div className="text-[11px] font-extrabold text-slate-200">{selected.founded || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/40 bg-slate-900/40 px-2 py-1.5">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Sponsors</div>
                    <div className="text-[11px] font-extrabold text-slate-200 truncate">{selected.sponsors || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Roster */}
              <ExpansionRow title="Roster & Roles" defaultOpen>
                {selected.rosters ? (
                  Object.entries(selected.rosters).map(([div, players]) => (
                    <div key={div} className="space-y-1.5">
                      <SectionLabel className="text-cyan-500/80 pt-1">{div}</SectionLabel>
                      {players.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-950/40 px-3 py-2 text-[11px]">
                          <span className="font-bold text-slate-200 uppercase">{p.id}</span>
                          <span className="text-slate-500 text-right">{p.role}{p.realName ? ` · ${p.realName}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="space-y-1.5">
                    {(selected.roster || []).map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-950/40 px-3 py-2 text-[11px]">
                        <span className="font-bold text-slate-200 uppercase">{p.id}</span>
                        <span className="text-slate-500 text-right">{p.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ExpansionRow>

              {/* Playstyle */}
              <ExpansionRow title="Strategy & Playstyle" defaultOpen>
                {Object.entries(selected.playstyle || {}).map(([key, val]) => (
                  <div key={key} className="flex gap-2.5 items-start">
                    <TrendingUp size={13} className="mt-0.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] font-extrabold text-slate-500 uppercase">{key.replace(/([A-Z])/g, ' $1')}</div>
                      <div className="text-[11px] text-slate-300">{val}</div>
                    </div>
                  </div>
                ))}
              </ExpansionRow>

              {/* Rotations */}
              {selected.rotation && (
                <ExpansionRow title="Rotation Style" defaultOpen>
                  <div className="space-y-2">
                    {Object.entries(selected.rotation).map(([phase, desc]) => (
                      <div key={phase} className="rounded-lg border border-slate-800/40 bg-slate-900/40 px-3 py-1.5">
                        <div className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider">{phase}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{desc}</div>
                      </div>
                    ))}
                  </div>
                </ExpansionRow>
              )}

              {/* Strengths / Weaknesses */}
              <ExpansionRow title="Strengths">
                <div className="space-y-1.5">
                  {(selected.strengths || []).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-emerald-300">
                      <Shield size={12} className="mt-0.5 shrink-0 text-emerald-400" /> {s}
                    </div>
                  ))}
                </div>
              </ExpansionRow>

              <ExpansionRow title="Weaknesses">
                <div className="space-y-1.5">
                  {(selected.weaknesses || []).map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-red-300">
                      <Sword size={12} className="mt-0.5 shrink-0 text-red-400" /> {w}
                    </div>
                  ))}
                </div>
              </ExpansionRow>

              {/* Achievements */}
              <ExpansionRow title="Major Achievements" defaultOpen>
                <div className="space-y-1.5">
                  {(selected.achievements || []).map((a, i) => (
                    <div key={i} className="rounded-xl border border-slate-800/40 bg-slate-950/40 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
                        <Award size={11} /> {a.tournament}
                        <span className="ml-auto text-slate-500">{a.year}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-200 mt-0.5">{a.result}</div>
                    </div>
                  ))}
                </div>
              </ExpansionRow>

              {/* Team Stats */}
              {selected.teamStats && (
                <ExpansionRow title="Performance Statistics" defaultOpen>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(selected.teamStats).map(([key, val]) => {
                      if (typeof val === 'object') return null
                      return (
                        <div key={key} className="rounded-xl border border-slate-800/40 bg-slate-950/40 px-2.5 py-2">
                          <div className="text-[9px] font-bold text-slate-500 uppercase truncate">{key.replace(/([A-Z])/g, ' $1')}</div>
                          <div className="text-[11px] font-extrabold text-cyan-300">{val}</div>
                        </div>
                      )
                    })}
                  </div>
                </ExpansionRow>
              )}

              {onApply && (
                <button
                  onClick={() => onApply(selected)}
                  className="w-full rounded-xl border border-slate-800/50 bg-slate-800/30 py-2 text-[11px] font-bold text-slate-300 hover:border-slate-600 hover:text-white transition-all duration-200"
                >
                  Apply Team to Map
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== HEAD-TO-HEAD TAB ==================== */}
      {activeTab === 'head2head' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-purple-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
                <Users size={13} className="text-purple-400" />
              </div>
              Head-to-Head Records
            </div>
          </div>
          {HEAD_TO_HEAD.map((h2h, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-800/40 bg-slate-900/30 p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[11px] font-extrabold text-white">{h2h.matchup}</div>
                <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">VS</div>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-1">Metric</div>
                  <div className="text-center">{h2h.teamA}</div>
                  <div className="text-center">{h2h.teamB}</div>
                </div>
                {h2h.stats.map((s, i) => (
                  <div key={i} className="grid grid-cols-3 gap-1.5 items-center rounded-lg border border-slate-800/40 bg-slate-950/40 px-2 py-2 text-[10px]">
                    <div className="text-slate-400 font-semibold">{s.label}</div>
                    <div className={`text-center font-bold ${s.winner === h2h.teamA ? 'text-emerald-400' : 'text-slate-300'}`}>{s.a}</div>
                    <div className={`text-center font-bold ${s.winner === h2h.teamB ? 'text-emerald-400' : 'text-slate-300'}`}>{s.b}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">{h2h.analysis}</p>
            </div>
          ))}
        </div>
      )}

      {/* ==================== RECORDS TAB ==================== */}
      {activeTab === 'records' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                <Star size={13} className="text-emerald-400" />
              </div>
              Records &amp; Achievements
            </div>
          </div>

          {/* Prize Money */}
          <div className="space-y-2">
            <SectionLabel>Total Prize Money (2025-2026)</SectionLabel>
            <div className="space-y-1.5">
              {PRIZE_MONEY.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-[#0D1525] px-3 py-2.5 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-mono text-[10px] font-bold w-4">{i + 1}</span>
                    <span className="font-bold text-slate-200 truncate">{p.team}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-amber-400">{p.amount}</div>
                    <div className="text-[9px] text-slate-500">{p.wins}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MVP Awards */}
          <div className="space-y-2">
            <SectionLabel>MVP Awards (2025-2026)</SectionLabel>
            <div className="space-y-1.5">
              {MVP_AWARDS.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-[11px]">
                  <Award size={14} className="text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-white uppercase truncate">{m.player}</div>
                    <div className="text-[10px] text-slate-500">{m.team} · {m.tournament}</div>
                  </div>
                  <div className="ml-auto shrink-0 rounded-lg bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-400/20">
                    {m.award}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Records list */}
          <div className="space-y-2">
            <SectionLabel>All-Time Records (Indian Esports)</SectionLabel>
            <div className="space-y-1.5">
              {[
                ['Most BGMI Titles', 'Team SouL'],
                ['Most FF Third-Party Wins (2025)', 'GodLike (5)'],
                ['Fastest Org to World Cup', 'TAG (3 months)'],
                ['Highest Prize (Single Event)', 'Team Hind ₹3.5 Cr'],
                ['Most Consistent Team', 'Team SouL (0 zero-pointers)'],
                ['Highest Ceiling Team', 'GodLike'],
                ['Largest Fanbase', 'Total Gaming (20M+)'],
              ].map(([record, holder], i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-900/30 px-3 py-2 text-[11px]">
                  <span className="text-slate-400 font-semibold">{record}</span>
                  <span className="font-extrabold text-slate-200 truncate ml-2">{holder}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MATRIX TAB ==================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-sky-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
                <Target size={13} className="text-sky-400" />
              </div>
              Team Capability Matrix
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Comparative ratings across key competitive categories.
            </p>
          </div>

          <div className="space-y-4">
            {STRENGTH_MATRIX.map((team) => (
              <div key={team.team} className="rounded-2xl border border-slate-800/40 bg-slate-900/30 p-3.5">
                <div className="text-[11px] font-extrabold text-white mb-2.5">{team.team}</div>
                <div className="space-y-2">
                  <StatBar label="Mechanical Skill" value={team.mechanical} />
                  <StatBar label="Game Sense" value={team.gameSense} color="bg-emerald-500" />
                  <StatBar label="Rotation" value={team.rotation} color="bg-purple-500" />
                  <StatBar label="Endgame" value={team.endgame} color="bg-amber-500" />
                  <StatBar label="Clutch Factor" value={team.clutch} color="bg-pink-500" />
                  <StatBar label="Coordination" value={team.coordination} color="bg-indigo-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
