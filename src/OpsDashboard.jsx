import {useEffect,useMemo,useState} from 'react';

const LABELS={
 visitors:'Unique visitors',started:'Sessions started',playing:'Playing now',stageClears:'Stage clears',bossReached:'Boss reached',bossDefeated:'Boss defeated',saveAttempts:'Save attempts',saveVerified:'Verified saves',completed:'Dates completed',abandoned:'Abandoned',inviteOpened:'Invites opened',inviteAccepted:'Invites accepted',reviewOpened:'Reviews opened',submittedReviews:'Reviews submitted',matchedDates:'Matched reviews'
};
const EVENT_LABELS={session_started:'Session started',playing:'Playing',reward_draft:'Reward draft',risk_decision:'Boss reached',boss_defeated:'Boss defeated',boss_escaped:'Boss escaped',save_attempt:'Save attempt',date_saved:'Date saved',save_verified:'Save verified',invite_opened:'Invite opened',invite_accepted:'Invite accepted',review_opened:'Review opened',review_submitted:'Review submitted',itinerary_opened:'Itinerary opened'};
const fmt=t=>t?new Date(t).toLocaleString():'—';

export default function OpsDashboard(){
 const[pin,setPin]=useState(sessionStorage.getItem('cupid-admin-pin')||'');
 const[query,setQuery]=useState('');
 const[data,setData]=useState(null);
 const[error,setError]=useState('');
 const[loading,setLoading]=useState(false);
 const[auto,setAuto]=useState(true);
 const[selected,setSelected]=useState(null);
 async function load(silent=false){
  if(!silent)setLoading(true);
  setError('');
  try{
   const r=await fetch('/api/dashboard?q='+encodeURIComponent(query),{headers:{'x-admin-pin':pin},cache:'no-store'});
   if(!r.ok)throw new Error(r.status===401?'Incorrect admin PIN.':'Dashboard request failed.');
   const x=await r.json();
   setData(x);setSelected(v=>v||x.sessions?.[0]||null);sessionStorage.setItem('cupid-admin-pin',pin);
  }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 async function verify(){
  try{
   const r=await fetch('/api/storage/verify',{headers:{'x-admin-pin':pin},cache:'no-store'});
   const x=await r.json();
   if(!r.ok)throw new Error(x.error||'Storage verification failed.');
   alert(`${x.ok?'PASS':'FAIL'}\nDataset: ${x.datasetId}\nFile: ${x.storage.file}\nWritable: ${x.storage.writable}\nRound trip: ${x.storage.roundTrip}\nSame source: ${x.sameDataSource}`);
   load(true);
  }catch(e){setError(e.message)}
 }
 useEffect(()=>{if(!data||!auto)return;const t=setInterval(()=>load(true),10000);return()=>clearInterval(t)},[data,auto,pin,query]);
 const funnel=useMemo(()=>data?['started','stageClears','bossReached','bossDefeated','saveVerified','inviteOpened','inviteAccepted','submittedReviews'].map(k=>({key:k,value:data.metrics[k]||0})):[],[data]);
 const sessionEvents=useMemo(()=>selected&&data?data.events.filter(e=>e.sessionId===selected.id||e.gameCode&&data.games.some(g=>g.sessionId===selected.id&&g.code===e.gameCode)):[],[selected,data]);
 return <main className="ops">
  <header className="ops-head">
   <div><p>Cupid live operations</p><h1>Player Funnel & Storage</h1></div>
   <div className="ops-controls"><input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Admin PIN"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, session, or code"/><button onClick={()=>load()} disabled={loading}>{loading?'Loading…':'Load'}</button></div>
  </header>
  {error&&<div className="ops-error">{error}</div>}
  {!data&&<section className="ops-empty"><h2>Load live operations</h2><p>This dashboard reads the same dataset used by session tracking and verified date saves.</p></section>}
  {data&&<>
   <section className={`ops-storage ${data.storage.persistent&&data.storage.writable&&data.storage.roundTrip?'pass':'fail'}`}>
    <div><b>{data.storage.persistent?'Persistent /data selected':'Temporary storage selected'}</b><span>{data.storage.file}</span></div>
    <div><b>{data.storage.writable&&data.storage.roundTrip?'Write/read probe passed':'Write/read probe failed'}</b><span>{data.storage.sizeBytes.toLocaleString()} bytes</span></div>
    <div><b>Dataset {data.datasetId}</b><span>Last write: {fmt(data.dataSource.lastWriteAt)}</span></div>
    <button onClick={verify}>Run Storage Test</button>
   </section>
   {!data.storage.persistent&&<div className="ops-warning"><b>History is not durable.</b> Hugging Face is not currently mounting <code>/data</code>. A rebuild or container restart can erase players.</div>}
   <section className="ops-metrics">{Object.entries(data.metrics).map(([k,v])=><article key={k}><b>{v}</b><span>{LABELS[k]||k}</span></article>)}</section>
   <section className="ops-panel">
    <div className="ops-title"><div><p>Conversion path</p><h2>Live Funnel</h2></div><label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> Refresh every 10 seconds</label></div>
    <div className="ops-funnel">{funnel.map((x,i)=><div key={x.key}><b>{x.value}</b><span>{LABELS[x.key]}</span>{i<funnel.length-1&&<em>→</em>}</div>)}</div>
   </section>
   <div className="ops-columns">
    <section className="ops-panel ops-sessions">
     <div className="ops-title"><div><p>All attempts</p><h2>Player Sessions</h2></div><span>{data.sessions.length}</span></div>
     <div className="ops-list">{data.sessions.map(s=><button key={s.id} className={selected?.id===s.id?'active':''} onClick={()=>setSelected(s)}><div><b>{s.playerName||'Unnamed'} + {s.partnerName||'Unknown'}</b><small>{s.id}</small></div><em className={'state '+s.status}>{s.status}</em><span>{s.screen} · round {Number(s.round)+1} · {s.score} pts</span><small>Last seen {fmt(s.lastSeenAt)}</small></button>)}</div>
    </section>
    <section className="ops-panel ops-detail">
     <div className="ops-title"><div><p>Selected session</p><h2>{selected?`${selected.playerName||'Unnamed'} + ${selected.partnerName||'Unknown'}`:'Choose a session'}</h2></div></div>
     {selected&&<>
      <div className="ops-session-facts"><span><b>Status</b>{selected.status}</span><span><b>Started</b>{fmt(selected.startedAt)}</span><span><b>Last seen</b>{fmt(selected.lastSeenAt)}</span><span><b>Score</b>{selected.score}</span></div>
      <h3>Event timeline</h3>
      <div className="ops-events">{sessionEvents.length?sessionEvents.map(e=><article key={e.id}><i/><div><b>{EVENT_LABELS[e.type]||e.type}</b><small>{fmt(e.at)}</small><p>{e.screen||e.status||''}{e.gameCode?` · ${e.gameCode}`:''}{e.score?` · ${e.score} pts`:''}</p></div></article>):<p>No events found for this session.</p>}</div>
     </>}
    </section>
   </div>
   <section className="ops-panel">
    <div className="ops-title"><div><p>Read-after-write proof</p><h2>Completed Dates</h2></div><span>{data.games.length}</span></div>
    <div className="ops-games">{data.games.map(g=><article key={g.code}><div className={'ops-rank rank-'+g.rank}>{g.rank}</div><div><b>{g.playerName} + {g.partnerName}</b><small>{g.code} · {fmt(g.createdAt)}</small><p>{g.rewards?.map(x=>x.name).join(' → ')||'No cards selected'}</p></div><div className={g.saveReceipt?.verified?'verified':'unverified'}><b>{g.saveReceipt?.verified?'✓ Verified':'⚠ Unverified'}</b><small>{g.saveReceipt?.writeId||g.saveReceipt?.attemptId||'Legacy save'}</small></div></article>)}</div>
   </section>
   <section className="ops-panel">
    <div className="ops-title"><div><p>Newest first</p><h2>Global Event Stream</h2></div><span>{data.events.length} shown</span></div>
    <div className="ops-event-table">{data.events.slice(0,150).map(e=><article key={e.id}><time>{new Date(e.at).toLocaleTimeString()}</time><b>{EVENT_LABELS[e.type]||e.type}</b><span>{e.playerName||'—'} {e.partnerName?`+ ${e.partnerName}`:''}</span><small>{e.sessionId||e.gameCode||'server'}</small></article>)}</div>
   </section>
  </>}
 </main>
}
