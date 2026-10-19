// The roster grew a `country` dimension so both team pickers can filter by it.
// These tests guard the invariants the UI silently depends on: every team has a
// known country, ids and short codes stay unique across the two roster files,
// and the filter helpers only ever mention countries that exist.

import test from 'node:test'
import assert from 'node:assert/strict'

import { TEAMS, KIE_TEAMS, TEAM_MAP, getTeam, teamBadge, teamSubtitle } from '../src/data/teams.js'
import { INTL_TEAMS } from '../src/data/intlTeams.js'
import {
  COUNTRIES,
  COUNTRY_CODES,
  ALL_COUNTRIES,
  getCountry,
  countryLabel,
  countryFlag,
  countriesInRoster,
  countryCounts,
} from '../src/data/countries.js'

test('every roster team carries a country the registry knows', () => {
  const unknown = TEAMS.filter((t) => !COUNTRIES[t.country])
  assert.deepEqual(unknown.map((t) => `${t.id}:${t.country}`), [])
})

test('team ids and short codes are unique across both rosters', () => {
  const ids = new Set()
  const shorts = new Set()
  for (const t of TEAMS) {
    assert.ok(!ids.has(t.id), `duplicate team id: ${t.id}`)
    assert.ok(!shorts.has(t.short), `duplicate team short: ${t.short}`)
    ids.add(t.id)
    shorts.add(t.short)
  }
})

test('the KIE roster is preserved and leads the combined roster', () => {
  assert.equal(TEAMS.length, KIE_TEAMS.length + INTL_TEAMS.length)
  assert.deepEqual(TEAMS.slice(0, KIE_TEAMS.length), KIE_TEAMS)
  // Every KIE leaderboard team is an Indian organisation.
  assert.ok(KIE_TEAMS.every((t) => t.country === 'IN'))
  // International teams have no leaderboard position to show.
  assert.ok(INTL_TEAMS.every((t) => t.rank === null))
})

test('international roster covers more than one country and has no India', () => {
  const countries = new Set(INTL_TEAMS.map((t) => t.country))
  assert.ok(countries.size >= 10, `expected a broad international roster, got ${countries.size} countries`)
  assert.ok(!countries.has('IN'), 'Indian orgs belong to the KIE roster only')
})

test('every team has a name, a short code and brand colours', () => {
  for (const t of TEAMS) {
    assert.ok(t.name && typeof t.name === 'string', `team ${t.id} has no name`)
    assert.ok(t.short && typeof t.short === 'string', `team ${t.id} has no short code`)
    assert.match(t.color || '', /^#[0-9a-f]{6}$/i, `team ${t.id} has no usable colour`)
    assert.match(t.color2 || '', /^#[0-9a-f]{6}$/i, `team ${t.id} has no usable colour2`)
  }
})

test('logoUrl points at public/logos/<SHORT>.png by convention', () => {
  for (const t of TEAMS) {
    if (t.logoUrl === undefined) continue // OUTR opts out on purpose
    assert.equal(t.logoUrl, `logos/${t.short.toUpperCase()}.png`)
  }
})

test('getTeam resolves an id to its roster row', () => {
  const first = TEAMS[0]
  assert.equal(getTeam(first.id), first)
  assert.equal(getTeam('does-not-exist'), null)
  assert.equal(TEAM_MAP[first.id], first)
})

test('country helpers read the registry', () => {
  assert.equal(getCountry('KR').name, 'South Korea')
  assert.equal(getCountry('ZZ'), null)
  assert.equal(countryFlag('KR'), '🇰🇷')
  assert.equal(countryFlag('ZZ'), '🌐')
  assert.equal(countryLabel('IN'), '🇮🇳 India')
  assert.equal(countryLabel('ZZ'), '🌐 Unknown')
})

test('ALL_COUNTRIES is not itself a country', () => {
  assert.equal(ALL_COUNTRIES in COUNTRIES, false)
  assert.equal(COUNTRY_CODES.includes(ALL_COUNTRIES), false)
})

test('countriesInRoster lists only countries that have teams, in registry order', () => {
  const codes = countriesInRoster(TEAMS)
  assert.ok(codes.includes('IN'))
  assert.ok(codes.includes('KR'))
  // Registry order, not roster order.
  assert.deepEqual(codes, COUNTRY_CODES.filter((code) => codes.includes(code)))
  // A roster with no teams yields no chips at all.
  assert.deepEqual(countriesInRoster([]), [])
})

test('countryCounts tallies the roster and ignores unknown codes', () => {
  const counts = countryCounts(TEAMS)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  assert.equal(total, TEAMS.length)
  assert.equal(counts.IN, KIE_TEAMS.length)
  const messy = countryCounts([{ country: 'IN' }, { country: 'ZZ' }, {}, null, { country: 'IN' }])
  assert.deepEqual(messy, { IN: 2 })
})

test('teamBadge and teamSubtitle fall back to the country when there is no rank', () => {
  const ranked = KIE_TEAMS[0]
  const unranked = INTL_TEAMS.find((t) => t.country === 'KR')
  assert.equal(teamBadge(ranked), `#${ranked.rank}`)
  assert.equal(teamSubtitle(ranked), `#${ranked.rank}`)
  assert.equal(teamBadge(unranked), countryFlag(unranked.country))
  assert.equal(teamSubtitle(unranked), countryLabel(unranked.country))
  assert.equal(teamBadge(null), '')
  assert.equal(teamSubtitle(null), '')
})