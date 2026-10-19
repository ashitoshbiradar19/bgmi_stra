// Countries the team roster can be filtered by.
//
// Every team in the roster carries a `country` code (see `src/data/teams.js`).
// This file is the single place that knows what a code means, so the pickers in
// `MapCanvas` and `TeamRecords` never have to hard-code a country name or flag.
//
// Codes are ISO 3166-1 alpha-2. The order of the keys below is the order the
// country chips appear in the UI, so keep it roughly regional rather than
// alphabetical.

// `flag` is a regional-indicator pair — it renders as a flag emoji on macOS,
// iOS, Windows 10+ and Android, and degrades to the two letters if a platform
// has no flag font. That is why it is paired with `name` everywhere it is shown.
const LIST = [
  { code: 'IN', name: 'India', flag: '🇮🇳', region: 'South Asia' },
  { code: 'CN', name: 'China', flag: '🇨🇳', region: 'East Asia' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', region: 'East Asia' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', region: 'East Asia' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', region: 'South-East Asia' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', region: 'South-East Asia' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', region: 'South-East Asia' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Middle East' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', region: 'Europe' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', region: 'Europe' },
  { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', region: 'Europe' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', region: 'Europe' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', region: 'Europe' },
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷', region: 'Europe' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', region: 'Europe' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'Americas' },
  { code: 'US', name: 'United States', flag: '🇺🇸', region: 'Americas' },
]

export const COUNTRIES = Object.fromEntries(LIST.map((c) => [c.code, c]))

// Display order for the country chips. `ALL` is the "no filter" option and is
// deliberately not part of COUNTRIES — it is not a country.
export const COUNTRY_CODES = LIST.map((c) => c.code)
export const ALL_COUNTRIES = 'ALL'

export function getCountry(code) {
  return COUNTRIES[code] || null
}

// `🇰🇷 South Korea` — flag first, name second, so the chips read as a flag list.
export function countryLabel(code) {
  const c = COUNTRIES[code]
  return c ? `${c.flag} ${c.name}` : '🌐 Unknown'
}

// Just the flag, for the tight spaces (the grid tiles under each logo).
export function countryFlag(code) {
  const c = COUNTRIES[code]
  return c ? c.flag : '🌐'
}

// The countries actually represented by a roster, in display order. Used by the
// filter so a country chip never appears unless it has at least one team.
export function countriesInRoster(teams) {
  const present = new Set()
  for (const t of teams) {
    if (t && t.country && COUNTRIES[t.country]) present.add(t.country)
  }
  return COUNTRY_CODES.filter((code) => present.has(code))
}

// How many teams each country has — the count shown on the chips.
export function countryCounts(teams) {
  const counts = {}
  for (const t of teams) {
    if (t && t.country && COUNTRIES[t.country]) {
      counts[t.country] = (counts[t.country] || 0) + 1
    }
  }
  return counts
}