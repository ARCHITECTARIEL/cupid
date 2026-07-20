import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 7860;
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'cupid-games.json');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

function cleanText(value, max = 240) { return String(value || '').slice(0, max).replace(/[<>]/g, ''); }
function normalize(value) { return cleanText(value, 120).trim().toLowerCase().replace(/\s+/g, ' '); }
function loadGames() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function saveGames(games) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
}
function cleanGame(input = {}) {
  return {
    code: cleanText(input.code, 32).toUpperCase(),
    playerName: cleanText(input.playerName), partnerName: cleanText(input.partnerName),
    dateName: cleanText(input.dateName || `${input.playerName || ''} + ${input.partnerName || ''}`),
    identityKey: `${normalize(input.playerName)}::${normalize(input.partnerName)}`,
    mode: cleanText(input.mode, 30), nights: Math.max(1, Math.min(3, Number(input.nights || 1))),
    score: Number(input.score || 0), hits: Number(input.hits || 0), misses: Number(input.misses || 0),
    bestCombo: Number(input.bestCombo || 0),
    rewards: Array.isArray(input.rewards) ? input.rewards.slice(0, 120).map(r => ({
      id: cleanText(r.id, 80), name: cleanText(r.name), customText: cleanText(r.customText, 240),
      category: cleanText(r.category || r.tier, 80), tier: cleanText(r.tier, 80), emoji: cleanText(r.emoji, 20),
      points: Number(r.points || r.cost || 0), night: Math.max(0, Number(r.night || 0)), duration: cleanText(r.duration, 80)
    })) : [],
    dna: {
      playsBefore: Number(input.dna?.plays || 0),
      picks: input.dna?.picks && typeof input.dna.picks === 'object' ? input.dna.picks : {},
      categories: input.dna?.categories && typeof input.dna.categories === 'object' ? input.dna.categories : {},
      custom: Array.isArray(input.dna?.custom) ? input.dna.custom.slice(0, 50).map(x => ({ id: cleanText(x.id,80), name: cleanText(x.name), category: cleanText(x.category,80), cost: Number(x.cost||0) })) : []
    },
    createdAt: cleanText(input.createdAt, 80) || new Date().toISOString()
  };
}
function aggregateProfile(games) {
  const picks = {}, categories = {};
  games.forEach(g => (g.rewards || []).forEach(r => {
    picks[r.name] = (picks[r.name] || 0) + 1;
    categories[r.category || 'Other'] = (categories[r.category || 'Other'] || 0) + 1;
  }));
  const sortedPicks = Object.entries(picks).sort((a,b)=>b[1]-a[1]);
  const sortedCategories = Object.entries(categories).sort((a,b)=>b[1]-a[1]);
  return {
    identityKey: games[0]?.identityKey, playerName: games[0]?.playerName, partnerName: games[0]?.partnerName,
    plays: games.length, totalPoints: games.reduce((n,g)=>n+g.score,0),
    averagePoints: games.length ? Math.round(games.reduce((n,g)=>n+g.score,0)/games.length) : 0,
    favoritePick: sortedPicks[0]?.[0] || '', favoriteCategory: sortedCategories[0]?.[0] || '',
    picks: sortedPicks.map(([name,count])=>({name,count})), categories: sortedCategories.map(([name,count])=>({name,count})),
    games: games.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
  };
}

app.get('/health', (_req,res)=>res.json({ok:true}));
app.post('/api/save-game', (req,res) => {
  const game = cleanGame(req.body);
  if (!game.code || !game.playerName || !game.partnerName) return res.status(400).json({error:'Missing names or code'});
  const games = loadGames();
  const index = games.findIndex(g=>g.code===game.code);
  if (index >= 0) games[index] = game; else games.unshift(game);
  saveGames(games.slice(0,5000));
  res.json({ok:true,code:game.code});
});
app.get('/api/redeem', (req,res) => {
  const code = cleanText(req.query.code,32).toUpperCase();
  const game = loadGames().find(g=>g.code===code);
  if (!game) return res.status(404).json({error:'Reward code not found'});
  const { dna, identityKey, ...publicGame } = game;
  res.json(publicGame);
});
app.get('/api/dashboard', (req,res) => {
  if (process.env.ADMIN_PIN && req.headers['x-admin-pin'] !== process.env.ADMIN_PIN) return res.status(401).json({error:'Locked'});
  const query = normalize(req.query.q || '');
  let games = loadGames();
  if (query) games = games.filter(g => [g.code,g.playerName,g.partnerName,g.dateName].some(v=>normalize(v).includes(query)));
  const grouped = new Map();
  loadGames().forEach(g=>{ const list=grouped.get(g.identityKey)||[]; list.push(g); grouped.set(g.identityKey,list); });
  let profiles = [...grouped.values()].map(aggregateProfile);
  if (query) profiles = profiles.filter(p => [p.playerName,p.partnerName,p.identityKey,...p.games.map(g=>g.code)].some(v=>normalize(v).includes(query)));
  const totalRewards = games.reduce((n,g)=>n+(g.rewards?.length||0),0);
  const averageScore = games.length ? Math.round(games.reduce((n,g)=>n+g.score,0)/games.length) : 0;
  const counts={}; games.flatMap(g=>g.rewards||[]).forEach(r=>counts[r.name]=(counts[r.name]||0)+1);
  const topReward=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  res.json({games,profiles,totalRewards,averageScore,topReward});
});

app.use(express.static(path.join(__dirname,'dist'),{extensions:['html']}));
app.use((_req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`Cupid game running on ${PORT}; data: ${DATA_FILE}`));