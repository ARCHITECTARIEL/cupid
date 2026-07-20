import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {fileURLToPath} from 'url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const PORT=process.env.PORT||7860;
const PERSISTENT_DIR='/data';
const DIR=process.env.DATA_DIR||(fs.existsSync(PERSISTENT_DIR)?PERSISTENT_DIR:path.join(__dirname,'.data'));
const FILE=path.join(DIR,'cupid-data.json');
const PROBE_FILE=path.join(DIR,'.cupid-storage-probe');

app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));

const clean=(v,m=800)=>String(v??'').slice(0,m).replace(/[<>]/g,'');
const norm=v=>clean(v,160).trim().toLowerCase().replace(/\s+/g,' ');
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const token=()=>crypto.randomBytes(24).toString('base64url');
const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();

function empty(){return{version:3,datasetId:id(),games:[],sessions:[],events:[],lastWriteAt:null,lastWriteId:null}}
function normalizeData(x){
 if(Array.isArray(x))return{...empty(),games:x};
 if(!x||typeof x!=='object')return empty();
 return{...empty(),...x,games:Array.isArray(x.games)?x.games:[],sessions:Array.isArray(x.sessions)?x.sessions:[],events:Array.isArray(x.events)?x.events:[]};
}
function load(){try{return normalizeData(JSON.parse(fs.readFileSync(FILE,'utf8')))}catch{return empty()}}
function save(data){
 fs.mkdirSync(DIR,{recursive:true});
 data.lastWriteAt=now();
 data.lastWriteId=id();
 const tmp=FILE+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(data,null,2));
 fs.renameSync(tmp,FILE);
 return data.lastWriteId;
}
function storageProbe(){
 const result={dir:DIR,file:FILE,persistent:DIR===PERSISTENT_DIR,exists:false,writable:false,roundTrip:false,sizeBytes:0,error:null};
 try{
  fs.mkdirSync(DIR,{recursive:true});
  const value=`${now()}-${id()}`;
  fs.writeFileSync(PROBE_FILE,value,'utf8');
  result.writable=true;
  result.roundTrip=fs.readFileSync(PROBE_FILE,'utf8')===value;
  result.exists=fs.existsSync(FILE);
  if(result.exists)result.sizeBytes=fs.statSync(FILE).size;
 }catch(e){result.error=clean(e.message,300)}
 return result;
}
function event(data,type,input={},req=null){
 const e={
  id:id(),type:clean(type,80),at:now(),sessionId:clean(input.sessionId,80),gameCode:clean(input.gameCode||input.code,32).toUpperCase(),
  playerName:clean(input.playerName,120),partnerName:clean(input.partnerName,120),screen:clean(input.screen,40),round:Number(input.round??0),score:Number(input.score??0),
  status:clean(input.status,50),details:input.details&&typeof input.details==='object'?input.details:{},
  userAgent:clean(req?.headers?.['user-agent'],300),ipHash:req?.ip?hash(req.ip).slice(0,16):''
 };
 data.events.unshift(e);
 data.events=data.events.slice(0,25000);
 return e;
}
function upsertSession(data,input,status){
 const sessionId=clean(input.sessionId||input.id,80);
 if(!sessionId)return null;
 let s=data.sessions.find(x=>x.id===sessionId);
 if(!s){
  s={id:sessionId,playerName:clean(input.playerName,120),partnerName:clean(input.partnerName,120),nights:Math.max(1,Math.min(3,Number(input.nights||1))),status:status||'started',screen:clean(input.screen||'setup',40),round:Number(input.round||0),score:Number(input.score||0),startedAt:now(),lastSeenAt:now(),completedAt:null,lastEvent:status||'started'};
  data.sessions.unshift(s);
 }else{
  Object.assign(s,{playerName:clean(input.playerName||s.playerName,120),partnerName:clean(input.partnerName||s.partnerName,120),nights:Math.max(1,Math.min(3,Number(input.nights||s.nights))),status:status||input.status||s.status,screen:clean(input.screen||s.screen,40),round:Number(input.round??s.round),score:Number(input.score??s.score),lastSeenAt:now(),lastEvent:status||input.status||s.lastEvent});
 }
 data.sessions=data.sessions.slice(0,10000);
 return s;
}
const reviewClean=i=>({dateRating:Math.max(1,Math.min(5,Number(i.dateRating||1))),connection:Math.max(1,Math.min(5,Number(i.connection||1))),comfort:Math.max(1,Math.min(5,Number(i.comfort||1))),fun:Math.max(1,Math.min(5,Number(i.fun||1))),repeat:Boolean(i.repeat),favoriteActivity:clean(i.favoriteActivity,160),privateNote:clean(i.privateNote,900),submittedAt:now()});
function cleanGame(i={}){return{code:clean(i.code,32).toUpperCase(),sessionId:clean(i.sessionId,80),playerName:clean(i.playerName,120),partnerName:clean(i.partnerName,120),dateName:clean(i.dateName||`${i.playerName||''} + ${i.partnerName||''}`),identityKey:`${norm(i.playerName)}::${norm(i.partnerName)}`,nights:Math.max(1,Math.min(3,Number(i.nights||1))),score:Number(i.score||0),hits:Number(i.hits||0),shots:Number(i.shots||0),accuracy:Number(i.accuracy||0),bestCombo:Number(i.bestCombo||i.best||0),rank:clean(i.rank||'C',3),bossDefeated:Boolean(i.bossDefeated),risk:clean(i.risk||'bank',20),loot:Array.isArray(i.loot)?i.loot.slice(0,30).map(x=>({id:clean(x.id,80),name:clean(x.name,120),type:clean(x.type,40),rarity:clean(x.rarity,30),emoji:clean(x.emoji,20)})):[],rewards:Array.isArray(i.rewards)?i.rewards.slice(0,180).map(r=>({id:clean(r.id,80),name:clean(r.name,160),notes:clean(r.notes),category:clean(r.category||r.tier,80),rarity:clean(r.rarity||'Common',30),emoji:clean(r.emoji,20),points:Number(r.points||r.cost||0),night:Math.max(0,Number(r.night||0)),duration:clean(r.duration,80),traits:r.traits&&typeof r.traits==='object'?r.traits:{}})):[],participants:i.participants||null,invite:i.invite||null,saveReceipt:i.saveReceipt||null,createdAt:clean(i.createdAt,80)||now()}}
function findByToken(games,t,kind='review'){const h=hash(t);for(const g of games){if(kind==='invite'&&g.invite?.tokenHash===h)return{g};for(const role of ['creator','partner'])if(g.participants?.[role]?.tokenHash===h)return{g,role,p:g.participants[role]}}return null}
function shared(g){const a=g.participants?.creator?.review,b=g.participants?.partner?.review;if(!a||!b)return null;const avg=k=>Number(((Number(a[k])+Number(b[k]))/2).toFixed(1)),favorites=[a.favoriteActivity,b.favoriteActivity].filter(Boolean);let message='Cupid has enough clues to make the next run even better.';if(avg('connection')>=4.5)message='Strong connection unlocked. Keep choosing moments that give you room to talk and laugh.';else if(avg('fun')>=4.5)message='Playfulness is your strongest shared signal. Your next date should keep the energy moving.';else if(avg('comfort')>=4.5)message='You both felt comfortable—an excellent foundation for a bolder next adventure.';return{dateRating:avg('dateRating'),connection:avg('connection'),comfort:avg('comfort'),fun:avg('fun'),bothWantAnother:Boolean(a.repeat&&b.repeat),favoriteActivities:[...new Set(favorites)],message}}
function profile(gs){const picks={},cats={},ratings=[];gs.forEach(g=>{(g.rewards||[]).forEach(r=>{picks[r.name]=(picks[r.name]||0)+1;cats[r.category||'Other']=(cats[r.category||'Other']||0)+1});Object.values(g.participants||{}).forEach(p=>p.review?.dateRating&&ratings.push(p.review.dateRating))});const sp=Object.entries(picks).sort((a,b)=>b[1]-a[1]),sc=Object.entries(cats).sort((a,b)=>b[1]-a[1]);return{identityKey:gs[0]?.identityKey,playerName:gs[0]?.playerName,partnerName:gs[0]?.partnerName,plays:gs.length,totalPoints:gs.reduce((n,g)=>n+g.score,0),averagePoints:gs.length?Math.round(gs.reduce((n,g)=>n+g.score,0)/gs.length):0,favoritePick:sp[0]?.[0]||'',favoriteCategory:sc[0]?.[0]||'',averageRating:ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):'',completedReviews:ratings.length,picks:sp.map(([name,count])=>({name,count})),games:gs.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))}}
function requireAdmin(q,r,next){if(process.env.ADMIN_PIN&&q.headers['x-admin-pin']!==process.env.ADMIN_PIN)return r.status(401).json({error:'Locked'});next()}

app.get('/health',(_q,r)=>{const d=load();r.json({ok:true,datasetId:d.datasetId,storage:{...storageProbe(),games:d.games.length,sessions:d.sessions.length,events:d.events.length,lastWriteAt:d.lastWriteAt,lastWriteId:d.lastWriteId}})});
app.get('/api/storage/verify',requireAdmin,(_q,r)=>{const before=load(),probe=storageProbe(),after=load();r.json({ok:probe.writable&&probe.roundTrip,sameDataSource:before.datasetId===after.datasetId,datasetId:after.datasetId,storage:{...probe,lastWriteAt:after.lastWriteAt,lastWriteId:after.lastWriteId},counts:{games:after.games.length,sessions:after.sessions.length,events:after.events.length}})});
app.post('/api/events',(q,r)=>{try{const d=load();const e=event(d,q.body.type||'client_event',q.body,q);const writeId=save(d);r.json({ok:true,eventId:e.id,writeId})}catch(e){r.status(500).json({ok:false,error:'Event could not be persisted',detail:clean(e.message,240)})}});
app.post('/api/session/start',(q,r)=>{try{const d=load(),s=upsertSession(d,q.body,'started');if(!s)return r.status(400).json({error:'Missing session id'});event(d,'session_started',{...q.body,status:'started',screen:'setup'},q);const writeId=save(d);r.json({ok:true,session:s,writeId})}catch(e){r.status(500).json({ok:false,error:'Session could not be persisted',detail:clean(e.message,240)})}});
app.post('/api/session/progress',(q,r)=>{try{const d=load(),status=q.body.status||'playing',s=upsertSession(d,q.body,status);if(!s)return r.status(400).json({error:'Missing session id'});event(d,status,{...q.body,status},q);const writeId=save(d);r.json({ok:true,eventStored:true,writeId})}catch(e){r.status(500).json({ok:false,error:'Progress could not be persisted',detail:clean(e.message,240)})}});
app.post('/api/save-game',(q,r)=>{
 const attemptId=id();
 try{
  const game=cleanGame(q.body);
  if(!game.code||!game.playerName||!game.partnerName)return r.status(400).json({ok:false,error:'Missing names or code',attemptId});
  const creatorToken=token(),partnerToken=token(),inviteToken=token();
  game.participants={creator:{name:game.playerName,role:'creator',tokenHash:hash(creatorToken),review:null},partner:{name:game.partnerName,role:'partner',tokenHash:hash(partnerToken),review:null}};
  game.invite={tokenHash:hash(inviteToken),openedAt:null,acceptedAt:null};
  const d=load();
  event(d,'save_attempt',{...game,status:'attempt',details:{attemptId,rewardCount:game.rewards.length}},q);
  const ix=d.games.findIndex(x=>x.code===game.code);
  if(ix>=0)d.games[ix]=game;else d.games.unshift(game);
  const s=upsertSession(d,{sessionId:game.sessionId,playerName:game.playerName,partnerName:game.partnerName,nights:game.nights,screen:'finale',score:game.score},'completed');
  if(s)s.completedAt=now();
  game.saveReceipt={attemptId,verified:false,datasetId:d.datasetId,savedAt:now(),file:FILE};
  event(d,'date_saved',{...game,status:'completed',details:{attemptId,rank:game.rank}},q);
  d.games=d.games.slice(0,5000);
  const writeId=save(d);
  const verified=load();
  const persisted=verified.datasetId===d.datasetId&&verified.lastWriteId===writeId&&verified.games.some(x=>x.code===game.code&&x.sessionId===game.sessionId);
  if(!persisted)return r.status(500).json({ok:false,error:'Save verification failed',attemptId,writeId,storage:storageProbe()});
  const savedGame=verified.games.find(x=>x.code===game.code);
  savedGame.saveReceipt={...savedGame.saveReceipt,verified:true,writeId,verifiedAt:now()};
  event(verified,'save_verified',{...savedGame,status:'verified',details:{attemptId,writeId}},q);
  const finalWriteId=save(verified);
  r.json({ok:true,persisted:true,code:game.code,attemptId,writeId:finalWriteId,datasetId:verified.datasetId,creatorReviewToken:creatorToken,partnerReviewToken:partnerToken,inviteToken,storage:{dir:DIR,persistent:DIR===PERSISTENT_DIR,file:FILE}});
 }catch(e){r.status(500).json({ok:false,error:'Game could not be saved',attemptId,detail:clean(e.message,300),storage:storageProbe()})}
});
app.get('/api/invite/:token',(q,r)=>{const d=load(),f=findByToken(d.games,q.params.token,'invite');if(!f)return r.status(404).json({error:'Invite not found'});if(!f.g.invite.openedAt){f.g.invite.openedAt=now();event(d,'invite_opened',{...f.g,gameCode:f.g.code,status:'opened'},q);save(d)}const{participants,identityKey,invite,...pub}=f.g;r.json({...pub,inviteStatus:{opened:Boolean(f.g.invite.openedAt),accepted:Boolean(f.g.invite.acceptedAt)}})});
app.post('/api/invite/:token/accept',(q,r)=>{const d=load(),f=findByToken(d.games,q.params.token,'invite');if(!f)return r.status(404).json({error:'Invite not found'});f.g.invite.acceptedAt=now();event(d,'invite_accepted',{...f.g,gameCode:f.g.code,status:'accepted'},q);save(d);r.json({ok:true,acceptedAt:f.g.invite.acceptedAt})});
app.get('/api/review/:token',(q,r)=>{const d=load(),f=findByToken(d.games,q.params.token);if(!f)return r.status(404).json({error:'Private review link not found'});event(d,'review_opened',{...f.g,gameCode:f.g.code,status:f.role,details:{role:f.role}},q);save(d);const s=shared(f.g);r.json({code:f.g.code,reviewerName:f.p.name,otherName:f.role==='creator'?f.g.partnerName:f.g.playerName,role:f.role,rewards:f.g.rewards,submitted:Boolean(f.p.review),review:f.p.review?{...f.p.review,privateNote:undefined}:null,bothSubmitted:Boolean(s),shared:s})});
app.post('/api/review/:token',(q,r)=>{const d=load(),f=findByToken(d.games,q.params.token);if(!f)return r.status(404).json({error:'Private review link not found'});f.p.review=reviewClean(q.body);event(d,'review_submitted',{...f.g,gameCode:f.g.code,status:f.role,details:{role:f.role,bothSubmitted:Boolean(shared(f.g))}},q);save(d);r.json({ok:true,bothSubmitted:Boolean(shared(f.g)),shared:shared(f.g)})});
app.get('/api/redeem',(q,r)=>{const d=load(),g=d.games.find(x=>x.code===clean(q.query.code,32).toUpperCase());if(!g)return r.status(404).json({error:'Reward code not found'});event(d,'itinerary_opened',{...g,gameCode:g.code,status:'opened'},q);save(d);const{identityKey,participants,invite,...pub}=g;r.json({...pub,reviewStatus:{creator:Boolean(participants?.creator?.review),partner:Boolean(participants?.partner?.review)},inviteStatus:{opened:Boolean(invite?.openedAt),accepted:Boolean(invite?.acceptedAt)}})});
app.get('/api/dashboard',requireAdmin,(q,r)=>{
 const query=norm(q.query.q||''),d=load(),all=d.games;
 const games=query?all.filter(g=>[g.code,g.playerName,g.partnerName,g.dateName].some(v=>norm(v).includes(query))):all;
 const sessions=query?d.sessions.filter(s=>[s.id,s.playerName,s.partnerName,s.status].some(v=>norm(v).includes(query))):d.sessions;
 const events=query?d.events.filter(e=>[e.type,e.sessionId,e.gameCode,e.playerName,e.partnerName,e.status].some(v=>norm(v).includes(query))):d.events;
 const grouped=new Map();all.forEach(g=>{const a=grouped.get(g.identityKey)||[];a.push(g);grouped.set(g.identityKey,a)});
 let profiles=[...grouped.values()].map(profile);if(query)profiles=profiles.filter(p=>[p.playerName,p.partnerName,p.identityKey,...p.games.map(g=>g.code)].some(v=>norm(v).includes(query)));
 const thirty=Date.now()-30*60*1000,abandoned=sessions.filter(s=>s.status!=='completed'&&new Date(s.lastSeenAt).getTime()<thirty).length;
 const count=t=>d.events.filter(e=>e.type===t).length;
 r.json({
  datasetId:d.datasetId,dataSource:{file:FILE,dir:DIR,adminReadsSameFile:true,lastWriteAt:d.lastWriteAt,lastWriteId:d.lastWriteId},storage:storageProbe(),games,sessions,events:events.slice(0,500),profiles,
  metrics:{visitors:new Set(d.events.map(e=>e.ipHash).filter(Boolean)).size,started:count('session_started'),playing:sessions.filter(s=>s.status==='playing').length,stageClears:count('reward_draft'),bossReached:count('risk_decision'),bossDefeated:count('boss_defeated'),saveAttempts:count('save_attempt'),saveVerified:count('save_verified'),completed:games.length,abandoned,inviteOpened:count('invite_opened'),inviteAccepted:count('invite_accepted'),reviewOpened:count('review_opened'),submittedReviews:count('review_submitted'),matchedDates:games.filter(g=>shared(g)).length}
 })
});

app.use(express.static(path.join(__dirname,'dist'),{extensions:['html']}));
app.use((_q,r)=>r.sendFile(path.join(__dirname,'dist','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`Cupid running on ${PORT}; dataset=${load().datasetId}; storage=${FILE}`));
