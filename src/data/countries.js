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
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', region: 'South Asia' },
  { code: 'IN', name: 'India', flag: '🇮🇳', region: 'South Asia' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', region: 'South Asia' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', region: 'South Asia' },
  { code: 'CN', name: 'China', flag: '🇨🇳', region: 'East Asia' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', region: 'East Asia' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', region: 'East Asia' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳', region: 'East Asia' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳', region: 'South-East Asia' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', region: 'South-East Asia' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', region: 'South-East Asia' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', region: 'South-East Asia' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', region: 'South-East Asia' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', region: 'South-East Asia' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', region: 'South-East Asia' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', region: 'South-East Asia' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬', region: 'Central Asia' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', region: 'Central Asia' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', region: 'Central Asia' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶', region: 'Middle East' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Middle East' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', region: 'Africa' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', region: 'Africa' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾', region: 'Africa' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', region: 'Africa' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', region: 'Africa' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', region: 'Europe' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', region: 'Europe' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', region: 'Europe' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', region: 'Europe' },
  { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', region: 'Europe' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', region: 'Europe' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', region: 'Europe' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', region: 'Europe' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', region: 'Europe' },
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷', region: 'Europe' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', region: 'Europe' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'Americas' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', region: 'Americas' },
  { code: 'US', name: 'United States', flag: '🇺🇸', region: 'Americas' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', region: 'Latin America' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', region: 'Latin America' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', region: 'Latin America' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', region: 'Latin America' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', region: 'Latin America' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', region: 'Latin America' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', region: 'Latin America' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', region: 'Latin America' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', region: 'Latin America' },
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