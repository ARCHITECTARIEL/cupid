import { useEffect, useMemo, useRef, useState } from 'react';

const rewards = {
  common: { label: 'Sweet', emoji: '❤️', points: 80, items: ['Coffee Date','Ice Cream','Walk the Pier','Visit Vinoy Park','Sunset Walk','Browse Local Shops','Bookstore Date'] },
  rare: { label: 'Romantic', emoji: '💙', points: 150, items: ['Mural Tour','Dali Museum','Chihuly Collection','Live Music','Wine Bar','Dessert Crawl','Rooftop Cocktails'] },
  epic: { label: 'Chemistry', emoji: '💜', points: 250, items: ['Massage','First Base','Second Base','Third Base','Home Run','Your FANTASY','Cook Dinner Together','Dance in the Living Room','Movie Night','Candlelit Dessert','Watch the Sunrise','No Phones for One Hour'] },
  legendary: { label: 'Legendary', emoji: '💛', points: 500, items: ['Golden Arrow','Choose Any Reward','Unlock Three Cards','Double Reward','Weekend Jackpot'] }
};

const connectionCards = [
  "What's your biggest green flag?",
  "What's your love language?",
  "What's your ideal Saturday together?",
  "What makes you feel appreciated?",
  "Where would you travel together tomorrow?",
  "What does a perfect morning together look like?",
  "What's something you've always wanted to try on a date?"
];

const stageData = [
  { name: 'First Spark', subtitle: 'Warm up your aim', duration: 22, speed: 1 },
  { name: 'Chemistry', subtitle: 'Keep the streak alive', duration: 24, speed: 1.35 },
  { name: 'The Big Date', subtitle: 'Connect the final hearts', duration: 18, speed: 1.7 }
];

const targetTypes = {
  heart: { emoji: '💗', className: 'heart', points: 80 },
  golden: { emoji: '💛', className: 'golden', points: 220 },
  clock: { emoji: '⏰', className: 'clock', points: 60 },
  broken: { emoji: '💔', className: 'broken', points: 140 },
  bomb: { emoji: '🖤', className: 'bomb', points: -120 }
};

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function randomTarget(stage, id) {
  const roll = Math.random();
  let type = 'heart';
  if (roll > .91) type = 'bomb';
  else if (roll > .82) type = 'golden';
  else if (roll > .72) type = 'clock';
  else if (roll > .60) type = 'broken';
  const size = type === 'golden' ? 76 : type === 'bomb' ? 68 : 62;
  return {
    id,
    type,
    x: 10 + Math.random() * 78,
    y: 14 + Math.random() * 63,
    size,
    driftX: (Math.random() > .5 ? 1 : -1) * (10 + Math.random() * 28) * stageData[stage].speed,
    driftY: (Math.random() > .5 ? 1 : -1) * (8 + Math.random() * 18),
    hp: type === 'broken' ? 2 : 1
  };
}

function drawReward(round, scoreBoost = 0) {
  const roll = Math.random() + Math.min(.18, scoreBoost / 6000);
  let rarity = 'common';
  if (round % 10 === 0 || roll > .98) rarity = 'legendary';
  else if (roll > .77) rarity = 'epic';
  else if (roll > .43) rarity = 'rare';
  const tier = rewards[rarity];
  const name = tier.items[Math.floor(Math.random() * tier.items.length)];
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name,
    rarity,
    tier: tier.label,
    emoji: tier.emoji,
    points: tier.points,
    createdAt: new Date().toISOString()
  };
}

function Dashboard() {
  const [pin, setPin] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  async function load() {
    setErr('');
    try {
      const res = await fetch('/api/dashboard', { headers: { 'x-admin-pin': pin } });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setErr('Locked or no data yet.'); }
  }
  function csv() {
    if (!data?.games?.length) return;
    const rows = [['date','player','partner','code','score','winnings'], ...data.games.map(g => [g.createdAt,g.playerName,g.partnerName,g.code,g.score,(g.rewards || []).map(r => r.customText || r.name).join('|')])];
    const blob = new Blob([rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cupids-revenge-results.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="page"><section className="panel"><p className="eyebrow">Private Admin</p><h1>Cupid Dashboard</h1><p>No public leaderboard. Only private game results.</p><div className="row"><input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Admin PIN"/><button onClick={load}>Unlock</button></div>{err && <p className="error">{err}</p>}</section>{data && <section className="panel wide"><div className="top"><h2>Results</h2><button onClick={csv}>Export CSV</button></div><div className="metrics"><b>{data.games.length}<span>Games</span></b><b>{data.totalRewards}<span>Rewards</span></b><b>{data.averageScore}<span>Avg Score</span></b><b>{data.topReward || '—'}<span>Top Reward</span></b></div><table><thead><tr><th>Date</th><th>Players</th><th>Code</th><th>Score</th><th>Winnings</th></tr></thead><tbody>{data.games.map(g => <tr key={g.code}><td>{new Date(g.createdAt).toLocaleString()}</td><td>{g.playerName} / {g.partnerName}</td><td>{g.code}</td><td>{g.score}</td><td>{(g.rewards || []).map(r => r.customText || r.name).join(', ')}</td></tr>)}</tbody></table></section>}</main>;
}

function Redeem() {
  const c = location.pathname.split('/').pop();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/redeem?code=' + encodeURIComponent(c)).then(r => r.ok ? r.json() : Promise.reject()).then(setGame).catch(() => setErr('Reward code not found.')); }, [c]);
  return <main className="page"><section className="panel wide"><p className="eyebrow">Reward Wallet</p>{err && <h1>{err}</h1>}{game && <><h1>{game.playerName} & {game.partnerName}</h1><p>Code <b>{game.code}</b> · Score {game.score}</p><div className="wallet">{game.rewards.map(r => <div className={'chip ' + r.rarity} key={r.id}><span>{r.emoji}</span><b>{r.customText || r.name}</b><em>{r.points}</em></div>)}</div><p className="fine">Cash these in together. Consent, comfort, and timing always win.</p></>}</section></main>;
}

function SunsetFinale({ game, names, onSave }) {
  const level = game.score >= 2600 ? 'legendary' : game.score >= 1500 ? 'epic' : 'sweet';
  return <main className={'sunset-finale ' + level}>
    <div className="sun"/><div className="cloud cloud1"/><div className="cloud cloud2"/><div className="birds">⌁⌁</div>
    <div className="water"><i/><i/><i/></div>
    <div className="pier"><span/><span/><span/><span/></div>
    <div className="couple"><div className="person one"><i/><b/></div><div className="joined-hands">♥</div><div className="person two"><i/><b/></div></div>
    <div className="heart-particles">{Array.from({length: 14}, (_, i) => <i key={i}>♥</i>)}</div>
    <section className="final-copy panel">
      <p className="eyebrow">{level === 'legendary' ? 'Legendary Night' : 'Your story begins here'}</p>
      <h1>{names.playerName} & {names.partnerName}</h1>
      <p>You found the spark, survived Cupid, and earned a night worth remembering.</p>
      <div className="final-stats"><b>{game.score}<span>Score</span></b><b>{game.bestCombo}x<span>Best Combo</span></b><b>{game.rewards.length}<span>Rewards</span></b></div>
      <button onClick={onSave}>Reveal Our Reward Code</button>
    </section>
  </main>;
}

export default function App() {
  if (location.pathname === '/dashboard') return <Dashboard/>;
  if (location.pathname.startsWith('/redeem/')) return <Redeem/>;

  const [screen, setScreen] = useState('intro');
  const [form, setForm] = useState({ playerName: '', partnerName: '', mood: 'romantic' });
  const [stage, setStage] = useState(0);
  const [timeLeft, setTimeLeft] = useState(stageData[0].duration);
  const [targets, setTargets] = useState([]);
  const [game, setGame] = useState({ hits: 0, misses: 0, score: 0, rewards: [], round: 1, combo: 0, bestCombo: 0 });
  const [modal, setModal] = useState(null);
  const [saved, setSaved] = useState(null);
  const [fantasy, setFantasy] = useState('');
  const idRef = useRef(1);
  const ready = useMemo(() => form.playerName.trim() && form.partnerName.trim(), [form]);

  useEffect(() => {
    if (screen !== 'game') return;
    setTargets(Array.from({ length: stage === 2 ? 5 : 4 }, () => randomTarget(stage, idRef.current++)));
    const spawn = setInterval(() => {
      setTargets(current => current.length >= 7 ? current : [...current, randomTarget(stage, idRef.current++)]);
    }, Math.max(620, 1150 - stage * 190));
    return () => clearInterval(spawn);
  }, [screen, stage]);

  useEffect(() => {
    if (screen !== 'game') return;
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [screen, stage]);

  useEffect(() => {
    if (screen !== 'game' || timeLeft > 0) return;
    if (stage < stageData.length - 1) {
      setStage(s => s + 1);
      setTimeLeft(stageData[stage + 1].duration);
      setTargets([]);
      setGame(g => ({ ...g, combo: 0 }));
    } else {
      setScreen('finale');
    }
  }, [timeLeft, screen, stage]);

  function startGame() {
    setStage(0);
    setTimeLeft(stageData[0].duration);
    setScreen('game');
  }

  function hitTarget(target) {
    const meta = targetTypes[target.type];
    if (target.type === 'bomb') {
      setTargets(t => t.filter(x => x.id !== target.id));
      setGame(g => ({ ...g, misses: g.misses + 1, combo: 0, score: Math.max(0, g.score + meta.points), round: g.round + 1 }));
      return;
    }
    if (target.type === 'broken' && target.hp > 1) {
      setTargets(t => t.map(x => x.id === target.id ? { ...x, hp: 1, emoji: '❤️‍🩹' } : x));
      setGame(g => ({ ...g, score: g.score + 35, combo: g.combo + 1 }));
      return;
    }
    setTargets(t => t.filter(x => x.id !== target.id));
    setGame(g => {
      const combo = g.combo + 1;
      const multiplier = 1 + Math.min(2, Math.floor(combo / 4) * .25);
      const bonus = Math.round(meta.points * multiplier);
      const reward = drawReward(g.round, g.score);
      const nextRewards = target.type === 'golden' ? [...g.rewards, reward] : (g.round % 3 === 0 ? [...g.rewards, reward] : g.rewards);
      if (target.type === 'golden' || g.round % 3 === 0) setModal({ reward, card: Math.random() > .45 ? connectionCards[Math.floor(Math.random() * connectionCards.length)] : '' });
      return { ...g, hits: g.hits + 1, combo, bestCombo: Math.max(g.bestCombo, combo), score: g.score + bonus, rewards: nextRewards, round: g.round + 1 };
    });
    if (target.type === 'clock') setTimeLeft(t => t + 4);
  }

  function missArena(e) {
    if (e.target !== e.currentTarget) return;
    setGame(g => ({ ...g, misses: g.misses + 1, combo: 0, round: g.round + 1 }));
  }

  async function saveGame() {
    const payload = { ...game, ...form, code: makeCode(), createdAt: new Date().toISOString() };
    await fetch('/api/save-game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    setSaved(payload);
  }

  if (saved) return <main className="page"><section className="panel victory"><div className="logo">💘</div><p className="eyebrow">Weekend unlocked</p><h1>{saved.playerName} & {saved.partnerName}</h1><p>Your private reward code is ready.</p><b className="bigcode">{saved.code}</b><button onClick={() => location.href = '/redeem/' + saved.code}>Open Reward Wallet</button></section></main>;
  if (screen === 'finale') return <SunsetFinale game={game} names={form} onSave={saveGame}/>;

  return <main className={'app mood-' + form.mood}>
    <div className="glow g1"/><div className="glow g2"/>
    {screen === 'intro' ? <section className="panel hero">
      <div className="logo">💘</div><p className="eyebrow">Cupid's Revenge · Chapter Two</p>
      <h1>Aim for the spark. Earn the night.</h1>
      <p>A three-stage romantic arcade game with moving hearts, streaks, surprises, and one final shot at the sunset.</p>
      <div className="names"><input value={form.playerName} onChange={e => setForm({ ...form, playerName: e.target.value })} placeholder="Player One"/><input value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} placeholder="Player Two"/></div>
      <div className="moods">{['cute','romantic','adventurous','flirty'].map(m => <button key={m} className={form.mood === m ? 'active' : ''} onClick={() => setForm({ ...form, mood: m })}>{m}</button>)}</div>
      <button disabled={!ready} onClick={startGame}>Start Our Adventure</button>
      <p className="fine">Tap hearts. Avoid black hearts. Broken hearts need two hits. Clocks add time.</p>
    </section> : <>
      <header className="game-header"><div><p className="eyebrow">Stage {stage + 1} of 3</p><h2>{stageData[stage].name}</h2><span>{stageData[stage].subtitle}</span></div><div className="timer"><b>{timeLeft}</b><span>seconds</span></div></header>
      <section className="game-layout">
        <div className="arena-v2" onClick={missArena}>
          <div className="moon"/><div className="cityline">▂▃▅▂▆▃▅▇▂▅▃</div><div className="waterline"/>
          {targets.map(target => <button key={target.id} className={'target ' + targetTypes[target.type].className} style={{ left: target.x + '%', top: target.y + '%', width: target.size, height: target.size, '--dx': target.driftX + 'px', '--dy': target.driftY + 'px', '--speed': `${3.8 / stageData[stage].speed}s` }} onClick={e => { e.stopPropagation(); hitTarget(target); }}>{target.emoji || targetTypes[target.type].emoji}<span>{target.type === 'broken' && target.hp > 1 ? '2 hits' : target.type}</span></button>)}
          <div className="crosshair">＋</div>
          <div className="combo-burst" key={game.combo}>{game.combo >= 3 ? `${game.combo}x COMBO` : ''}</div>
          <div className="legend"><span>💗 points</span><span>💛 reward</span><span>⏰ +4 sec</span><span>💔 2 hits</span><span>🖤 avoid</span></div>
        </div>
        <aside className="panel side v2"><div className="score-card"><span>Score</span><b>{game.score}</b></div><div className="stats-row"><div><b>{game.hits}</b><span>Hits</span></div><div><b>{game.misses}</b><span>Misses</span></div><div><b>{game.bestCombo}x</b><span>Best</span></div></div><div className="stage-track">{stageData.map((s, i) => <i key={s.name} className={i <= stage ? 'done' : ''}/>)}</div><h3>Weekend Wallet</h3><div className="wallet">{game.rewards.slice().reverse().map(r => <div className={'chip ' + r.rarity} key={r.id}><span>{r.emoji}</span><b>{r.customText || r.name}</b><em>{r.points}</em></div>)}</div></aside>
      </section>
    </>}
    {modal && <div className="modal"><section className={'panel reward ' + modal.reward.rarity}><div className="badge">{modal.reward.emoji}</div><p className="eyebrow">{modal.reward.tier} unlocked</p><h2>{modal.reward.name}</h2><p>This card is now in your private weekend wallet.</p>{modal.reward.name === 'Your FANTASY' && <textarea value={fantasy} onChange={e => setFantasy(e.target.value)} placeholder="Write a playful, consensual idea you both agree sounds fun..."/>}{modal.card && <div className="connection"><b>Connection Card</b><span>{modal.card}</span></div>}<button onClick={() => { if (modal.reward.name === 'Your FANTASY' && fantasy.trim()) setGame(g => ({ ...g, rewards: g.rewards.map(r => r.id === modal.reward.id ? { ...r, customText: fantasy } : r) })); setFantasy(''); setModal(null); }}>Add to Weekend</button></section></div>}
  </main>;
}
