// International esports organisations — teams outside the KIE (Krafton India
// Esports) leaderboard, grouped by country so the pickers can filter by flag.
//
// These rows carry `rank: null` because they are not ranked on the Indian
// leaderboard; the UI shows the country flag in place of the "#n" line.
//
// Logo files live in `public/logos/<SHORT>.png` — the same convention as the
// KIE roster. The crests shipped here are generated from brand colours by
// `scripts/generate-intl-logos.mjs`; drop a real 256px PNG with the same file
// name over the top of one to replace it.

import { intlTeam } from './teamFactory'

export const INTL_TEAMS = [
  // ---------------- China ----------------
  intlTeam('Nova Esports', 'NS', 'CN', '#3b82f6', '#08152e'),
  intlTeam('JD Gaming', 'JDG', 'CN', '#e11d48', '#2b0a13'),
  intlTeam('Team 214', 'T214', 'CN', '#22d3ee', '#062530'),
  intlTeam('Tyloo Esports', 'TYL', 'CN', '#f97316', '#26130a'),
  intlTeam('Snipers Elite', 'STE', 'CN', '#ef4444', '#2b0c0c'),
  intlTeam('PeRo', 'PERO', 'CN', '#e879f9', '#290f2d'),
  intlTeam('4T Esports', '4T', 'CN', '#facc15', '#271f08'),

  // ---------------- South Korea ----------------
  intlTeam('Dplus KIA', 'DPL', 'KR', '#e11d48', '#12131a'),
  intlTeam('Aurora Gaming', 'AUR', 'KR', '#f59e0b', '#281c05'),
  intlTeam('Soniqs', 'SNQ', 'KR', '#22d3ee', '#052430'),
  intlTeam('Gaimin Gladiators', 'GMG', 'KR', '#a855f7', '#1d0f30'),

  // ---------------- Europe ----------------
  intlTeam('Natus Vincere', 'NAVI', 'UA', '#facc15', '#231c06'),
  intlTeam('G2 Esports', 'G2', 'DE', '#f1f5f9', '#12141c'),
  intlTeam('Team Secret', 'SECRET', 'NL', '#60a5fa', '#0a1730'),
  intlTeam('Virtus.pro', 'VP', 'RU', '#fb923c', '#2a1206'),
  intlTeam('Team Spirit', 'TS', 'DE', '#f97316', '#26130a'),
  intlTeam('Alliance', 'ALL', 'SE', '#e2e8f0', '#0b0f18'),
  intlTeam('Team Liquid', 'LIQ', 'NL', '#3b82f6', '#071227'),
  intlTeam('FaZe Clan', 'FAZE', 'US', '#ef4444', '#2b0c0c'),
  intlTeam('BIG', 'BIG', 'DE', '#facc15', '#241c06'),
  intlTeam('MOUZ', 'MOUZ', 'DE', '#dc2626', '#2b0b0b'),
  intlTeam('ENCE', 'ENCE', 'FI', '#2dd4bf', '#052622'),
  intlTeam('HEROIC', 'HEROIC', 'DK', '#f87171', '#2a0f0f'),
  intlTeam('Ninjas in Pyjamas', 'NIP', 'SE', '#fde047', '#282205'),
  intlTeam('Team Vitality', 'VIT', 'FR', '#fde047', '#262105'),
  intlTeam('Dark Passage', 'DARK', 'TR', '#fb923c', '#2a1206'),

  // ---------------- North America ----------------
  intlTeam('Complexity', 'COL', 'US', '#0ea5e9', '#04182a'),
  intlTeam('Cloud9', 'C9', 'US', '#38bdf8', '#06182c'),
  intlTeam('Evil Geniuses', 'EG', 'US', '#f97316', '#26130a'),
  intlTeam('TSM', 'TSM', 'US', '#f59e0b', '#261904'),
  intlTeam('100 Thieves', '100T', 'US', '#e2e8f0', '#11151f'),
  intlTeam('FlyQuest', 'FLY', 'US', '#84cc16', '#18250a'),

  // ---------------- Middle East ----------------
  intlTeam('Team Falcons', 'FLC', 'SA', '#10b981', '#04261b'),
  intlTeam('Twisted Minds', 'TM', 'SA', '#8b5cf6', '#1a0f30'),

  // ---------------- Asia-Pacific ----------------
  intlTeam('Buriram United Esports', 'BURIRAM', 'TH', '#3b82f6', '#071a33'),
  intlTeam('TNC Esports', 'TNC', 'TH', '#fb923c', '#2a1206'),
  intlTeam('GAM Esports', 'GAM', 'VN', '#ef4444', '#2b0c0c'),
  intlTeam('EVOS Esports', 'EVOS', 'ID', '#fb7185', '#2b0c14'),
  intlTeam('ZETA Division', 'ZETA', 'JP', '#ef4444', '#2b0c0c'),

  // ---------------- Brazil ----------------
  intlTeam('LOUD', 'LOUD', 'BR', '#22d3ee', '#062630'),
  intlTeam('Fluxo', 'FLUXO', 'BR', '#4ade80', '#082614'),
  intlTeam('9z Team', '9Z', 'BR', '#eab308', '#241a04'),
  intlTeam('RED Canids', 'RED', 'BR', '#dc2626', '#2b0b0b'),
  intlTeam('W7M Esports', 'W7M', 'BR', '#a3e635', '#1a2405'),
]