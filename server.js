import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 7860;
const memory = new Map();
const order = [];

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

function cleanText(value, max = 240) {
  return String(value || '').slice(0, max).replace(/[<>]/g, '');
}

function cleanGame(input = {}) {
  return {
    code: cleanText(input.code, 32).toUpperCase(),
    playerName: cleanText(input.playerName),
    partnerName: cleanText(input.partnerName),
    score: Number(input.score || 0),
    hits: Number(input.hits || 0),
    misses: Number(input.misses || 0),
    rewards: Array.isArray(input.rewards)
      ? input.rewards.slice(0, 80).map((r) => ({
          id: cleanText(r.id, 80),
          name: cleanText(r.name),
          customText: cleanText(r.customText, 240),
          rarity: cleanText(r.rarity, 40),
          tier: cleanText(r.tier, 80),
          emoji: cleanText(r.emoji, 20),
          points: Number(r.points || 0),
          createdAt: cleanText(r.createdAt, 80),
        }))
      : [],
    achievements: Array.isArray(input.achievements)
      ? input.achievements.map((a) => cleanText(a, 80)).slice(0, 40)
      : [],
    createdAt: cleanText(input.createdAt, 80) || new Date().toISOString(),
  };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/save-game', (req, res) => {
  const game = cleanGame(req.body);
  if (!game.code || !game.playerName || !game.partnerName) {
    return res.status(400).json({ error: 'Missing names or code' });
  }
  memory.set(game.code, game);
  if (!order.includes(game.code)) order.unshift(game.code);
  return res.json({ ok: true, code: game.code });
});

app.get('/api/redeem', (req, res) => {
  const code = cleanText(req.query.code, 32).toUpperCase();
  const game = memory.get(code);
  if (!game) return res.status(404).json({ error: 'Reward code not found' });
  return res.json(game);
});

app.get('/api/dashboard', (req, res) => {
  if (process.env.ADMIN_PIN && req.headers['x-admin-pin'] !== process.env.ADMIN_PIN) {
    return res.status(401).json({ error: 'Locked' });
  }

  const games = order.map((code) => memory.get(code)).filter(Boolean);
  const totalRewards = games.reduce((n, g) => n + (g.rewards?.length || 0), 0);
  const averageScore = games.length
    ? Math.round(games.reduce((n, g) => n + (g.score || 0), 0) / games.length)
    : 0;
  const counts = new Map();
  games.flatMap((g) => g.rewards || []).forEach((r) => counts.set(r.name, (counts.get(r.name) || 0) + 1));
  const topReward = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  return res.json({ games, totalRewards, averageScore, topReward });
});

app.use(express.static(path.join(__dirname, 'dist'), { extensions: ['html'] }));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cupid game running on ${PORT}`);
});
