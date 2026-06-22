import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';

import {
  GAME_PRESETS,
  DEFAULT_GUEST_STATS,
  MIN_PLAYERS,
  generateRound,
  buildSessionSummaries,
  performanceTier,
  type GamePreset,
  type GameLang,
  type Player,
} from './engine/index';
import {
  getDrinkingGames,
  getDrinkingGame,
  type DrinkingGameId,
} from './content/index';

const PORT = Number(process.env.PORT ?? 4000);
const API_KEY = process.env.GAMES_API_KEY ?? '';
// CORS origins. Native Capacitor WebViews use fixed origins that must ALWAYS be
// allowed so the mobile app works regardless of per-deployment config:
//   iOS     → capacitor://localhost
//   Android → https://localhost
// Web origins are configured per-deployment via ALLOWED_ORIGINS.
// ⚠️ The API_KEY is embedded in client bundles (web & mobile) and is public; it is not a secret.
const NATIVE_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];
const ALLOWED_ORIGINS = Array.from(
  new Set([
    ...NATIVE_ORIGINS,
    ...(process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ]),
);

// Per-key/per-IP rate limiting to deter abuse of the public API key.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 120);

const app = express();
// Behind a TLS-terminating reverse proxy the real client IP arrives in
// X-Forwarded-For; enable TRUST_PROXY in that deployment so per-IP limiting is accurate.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) {
  app.set('trust proxy', Number.isNaN(Number(TRUST_PROXY)) ? TRUST_PROXY : Number(TRUST_PROXY));
}
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  }),
);
app.use(express.json({ limit: '256kb' }));

// ─── Health (no auth) ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── Rate limiting (per API key + IP) ──────────────────────────────────────────
// Runs before auth so requests with a missing/invalid key are limited too.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) {
    if (b.resetAt <= now) rateBuckets.delete(k);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  const key = `${req.header('x-api-key') ?? 'anon'}:${req.ip ?? 'unknown'}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
});

// ─── API-key auth for everything under /api ────────────────────────────────────
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (!API_KEY) {
    res.status(500).json({ error: 'GAMES_API_KEY is not configured on the server' });
    return;
  }
  const provided = req.header('x-api-key');
  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }
  next();
});

const langParam = (req: Request): string | undefined => {
  const lang = req.query.lang;
  return typeof lang === 'string' ? lang : undefined;
};

// ─── Prompt/deck games (content) ───────────────────────────────────────────────
app.get('/api/games', (req, res) => {
  res.json(getDrinkingGames(langParam(req)));
});

app.get('/api/games/:id', (req, res) => {
  res.json(getDrinkingGame(req.params.id as DrinkingGameId, langParam(req)));
});

// ─── Dynamic Kollekt game ──────────────────────────────────────────────────────
app.get('/api/kollekt/meta', (_req, res) => {
  res.json({
    presets: GAME_PRESETS,
    minPlayers: MIN_PLAYERS,
    defaultGuestStats: DEFAULT_GUEST_STATS,
  });
});

app.post('/api/kollekt/round', (req, res) => {
  const {
    roundNumber,
    players,
    preset,
    usedIds,
    lang,
  } = req.body as {
    roundNumber?: number;
    players?: Player[];
    preset?: GamePreset;
    usedIds?: string[];
    lang?: GameLang;
  };

  const presetEntry = preset ? GAME_PRESETS[preset] : GAME_PRESETS.default;
  if (!presetEntry || !Array.isArray(players) || typeof roundNumber !== 'number') {
    res.status(400).json({ error: 'roundNumber, players and a valid preset are required' });
    return;
  }

  const usedIdSet = new Set<string>(Array.isArray(usedIds) ? usedIds : []);
  const round = generateRound(
    roundNumber,
    players,
    presetEntry.config,
    usedIdSet,
    lang === 'no' ? 'no' : 'en',
  );

  res.json({ round, usedIds: Array.from(usedIdSet) });
});

app.post('/api/kollekt/summary', (req, res) => {
  const { players } = req.body as { players?: Player[] };
  if (!Array.isArray(players)) {
    res.status(400).json({ error: 'players is required' });
    return;
  }
  const summaries = buildSessionSummaries(players).map((s) => ({
    ...s,
    tier: performanceTier(s.performanceScore),
  }));
  res.json({ summaries });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Kollekt Games service listening on :${PORT}`);
});
