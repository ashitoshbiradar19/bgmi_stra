// Shared team record builders.
//
// Both the KIE leaderboard roster (`src/data/teams.js`) and the international
// roster (`src/data/intlTeams.js`) go through this file so a team record always
// has the same shape and a `country` code. Splitting the factory out is what
// keeps the two roster files free of an import cycle.

const PAL = [
  ['#f43f5e', '#1c1420'],
  ['#38bdf8', '#0c1a2e'],
  ['#34d399', '#062820'],
  ['#facc15', '#29210a'],
  ['#a78bfa', '#1a1230'],
  ['#fb923c', '#241409'],
  ['#2dd4bf', '#05201c'],
  ['#e879f9', '#24102b'],
  ['#f472b6', '#261019'],
  ['#818cf8', '#0f1230'],
]

// The ids are the short code, stripped to lowercase alphanumerics, so the same
// org never gets two records with two ids.
function idFrom(short, name) {
  return short.toLowerCase().replace(/[^a-z0-9]+/g, '') || name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export const KIE_EVENT = 'KIE Global Leaderboard 2026'
export const INTL_EVENT = 'International Roster'

// A ranked team from the Krafton India Esports leaderboard. Colours cycle
// through the deterministic palette so a roster row keeps its identity even
// when it has no logo.
export function team(name, short, rank, i, opts = {}) {
  const [color, color2] = PAL[i % PAL.length]
  return {
    id: idFrom(short, name),
    name,
    short,
    rank,
    color,
    color2,
    country: opts.country || 'IN',
    event: KIE_EVENT,
    logoUrl: opts.logo === false ? undefined : `logos/${short.toUpperCase()}.png`,
    ...(opts.players ? { players: opts.players } : {}),
  }
}

// A team from outside the Indian leaderboard. These have no leaderboard rank,
// so `rank` stays null and the UI shows the country flag instead of "#n".
export function intlTeam(name, short, country, color, color2, opts = {}) {
  return {
    id: idFrom(short, name),
    name,
    short,
    rank: opts.rank ?? null,
    color,
    color2,
    country,
    event: opts.event || INTL_EVENT,
    logoUrl: opts.logo === false ? undefined : `logos/${short.toUpperCase()}.png`,
    ...(opts.players ? { players: opts.players } : {}),
  }
}