import express from 'express';
import session from 'express-session';
import * as oidc from 'openid-client';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {validateHabit,validDate} from './lib/habits.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||5173);
const base=new URL(process.env.APP_URL||`http://localhost:${port}`);
const demo=process.env.DEMO_MODE==='true';
const allowedSubjects=(process.env.ALLOWED_SUBJECTS||'').split(',').map(s=>s.trim()).filter(Boolean);
const networkDemo=process.env.ALLOW_NETWORK_DEMO==='true';
const trustedOrigins=new Set([base.origin,...(process.env.ADDITIONAL_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)]);
if(demo&&(process.env.NODE_ENV==='production'||(!networkDemo&&(!['127.0.0.1','localhost','::1'].includes(host)||!['localhost','127.0.0.1','[::1]'].includes(base.hostname)))))throw Error('Network demo requires explicit ALLOW_NETWORK_DEMO=true; demo mode is never allowed in production.');
if(!demo&&(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32))throw Error('Set SESSION_SECRET to at least 32 random characters.');
mkdirSync(resolve(root,'data'),{recursive:true});
const db=new DatabaseSync(process.env.DB_PATH||resolve(root,'data/app.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, profile TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS habits(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entries(habitId TEXT NOT NULL REFERENCES habits(id), date TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(habitId,date));
CREATE TABLE IF NOT EXISTS vacations(id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,habitId TEXT NOT NULL REFERENCES habits(id),userId TEXT NOT NULL REFERENCES users(id),at TEXT NOT NULL,message TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL);`);
const app=express();app.disable('x-powered-by');
if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});next()});
class SQLiteSessions extends session.Store {
 get(id,cb){try{const row=db.prepare('SELECT data FROM sessions WHERE id=? AND expires>?').get(id,Date.now());cb(null,row?JSON.parse(row.data):null)}catch(e){cb(e)}}
 set(id,value,cb){try{db.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?)').run(id,JSON.stringify(value),Date.now()+7*86400000);db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());cb?.()}catch(e){cb?.(e)}}
 destroy(id,cb){try{db.prepare('DELETE FROM sessions WHERE id=?').run(id);cb?.()}catch(e){cb?.(e)}}
}
app.use(session({store:new SQLiteSessions(),secret:process.env.SESSION_SECRET||randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,name:'vv.sid',cookie:{httpOnly:true,sameSite:'lax',secure:base.protocol==='https:',maxAge:7*86400000}}));
app.use(express.json({limit:'32kb'}));
const user=id=>{const r=db.prepare('SELECT * FROM users WHERE id=?').get(id);return r?{id:r.id,name:r.name,...JSON.parse(r.profile)}:null};
function upsertUser(id,name){db.prepare('INSERT INTO users VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id,name,JSON.stringify({weekStart:1,timeZone:'UTC',reminder:'20:30'}));return user(id)}
let oidcConfig;
async function config(){if(!process.env.OIDC_ISSUER||!process.env.OIDC_CLIENT_ID)throw Error('Pocket ID is not configured.');return oidcConfig||=(await oidc.discovery(new URL(process.env.OIDC_ISSUER),process.env.OIDC_CLIENT_ID,process.env.OIDC_CLIENT_SECRET))}
const regenerate=req=>new Promise((yes,no)=>req.session.regenerate(e=>e?no(e):yes()));
app.get('/healthz',(req,res)=>{db.prepare('SELECT 1').get();res.json({ok:true})});
app.get('/auth/login',async(req,res)=>{
 if(demo){await regenerate(req);upsertUser('demo-you','You');upsertUser('demo-spouse','Your wife');req.session.userId='demo-you';return req.session.save(()=>res.redirect('/'))}
 const c=await config();const verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();
 req.session.auth={verifier,state,nonce,at:Date.now()};
 const url=oidc.buildAuthorizationUrl(c,{redirect_uri:new URL('/auth/callback',base).href,scope:'openid profile',code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',state,nonce});
 req.session.save(err=>err?res.status(500).send('Unable to start sign-in.'):res.redirect(url.href));
});
app.get('/auth/callback',async(req,res)=>{
 const auth=req.session.auth;delete req.session.auth;
 if(!auth||Date.now()-auth.at>600000)return res.status(400).send('Sign-in expired. Please try again.');
 const tokens=await oidc.authorizationCodeGrant(await config(),new URL(req.originalUrl,base),{pkceCodeVerifier:auth.verifier,expectedState:auth.state,expectedNonce:auth.nonce,idTokenExpected:true});
 const claims=tokens.claims();
 if(!claims?.sub||!allowedSubjects.includes(claims.sub))return res.status(403).send('This account is not approved for this household.');
 await regenerate(req);upsertUser(claims.sub,String(claims.name||claims.preferred_username||'Family member').slice(0,100));req.session.userId=claims.sub;req.session.save(()=>res.redirect('/'));
});
app.use('/api',(req,res,next)=>{if(req.session.userId&&!demo&&!allowedSubjects.includes(req.session.userId))return req.session.destroy(()=>res.status(401).json({error:'This account is no longer approved.'}));next()});
app.get('/api/session',(req,res)=>{res.set('Cache-Control','no-store');if(!req.session.userId)return res.json({user:null,demo});req.session.csrf ||=randomBytes(24).toString('hex');res.json({user:user(req.session.userId),csrf:req.session.csrf,demo})});
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!req.session.userId)return res.status(401).json({error:'Sign in to continue.'});if(!['GET','HEAD'].includes(req.method)&&(req.get('X-CSRF-Token')!==req.session.csrf||!trustedOrigins.has(req.get('origin'))))return res.status(403).json({error:'Invalid request. Refresh and try again.'});next()});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('vv.sid');res.json({ok:true})}));
if(demo)app.post('/api/demo-switch',async(req,res)=>{const id=req.session.userId==='demo-you'?'demo-spouse':'demo-you';await regenerate(req);req.session.userId=id;res.json({ok:true})});
const habits=()=>db.prepare('SELECT data FROM habits').all().map(r=>JSON.parse(r.data));
const visible=(h,id)=>h.shared||h.owner===id||!h.private;
function editable(id,viewer){const h=habits().find(h=>h.id===id);if(!h||!visible(h,viewer)){const e=Error('Habit not found.');e.status=404;throw e}if(!h.shared&&h.owner!==viewer){const e=Error('Only the owner can edit this habit.');e.status=403;throw e}return h}
function log(h,req,message){db.prepare('INSERT INTO activity(habitId,userId,at,message) VALUES(?,?,?,?)').run(h.id,req.session.userId,new Date().toISOString(),message)}
app.get('/api/state',(req,res)=>{
 const hs=habits().filter(h=>visible(h,req.session.userId)),ids=new Set(hs.map(h=>h.id));
 const members=demo?db.prepare('SELECT id,name FROM users').all():allowedSubjects.map(id=>({id,name:user(id)?.name||'Family member'}));
 res.json({habits:hs,entries:db.prepare('SELECT data FROM entries').all().map(r=>JSON.parse(r.data)).filter(e=>ids.has(e.habitId)),members,vacations:db.prepare('SELECT data FROM vacations').all().map(r=>JSON.parse(r.data)),activity:db.prepare('SELECT * FROM activity ORDER BY id DESC').all().filter(a=>ids.has(a.habitId)).slice(0,100)});
});
app.post('/api/habits',(req,res)=>{const h=validateHabit(req.body,req.session.userId);h.id=randomUUID();db.prepare('INSERT INTO habits VALUES(?,?,?)').run(h.id,h.owner,JSON.stringify(h));log(h,req,'Created '+h.name);res.status(201).json(h)});
app.put('/api/habits/:id',(req,res)=>{const old=editable(req.params.id,req.session.userId);const h=validateHabit({...req.body,id:old.id},old.owner);db.prepare('UPDATE habits SET data=? WHERE id=?').run(JSON.stringify(h),h.id);log(h,req,(h.archived?'Archived ':'Updated ')+h.name);res.json(h)});
app.put('/api/entries/:id/:date',(req,res)=>{
 const h=editable(req.params.id,req.session.userId),date=req.params.date;
 if(!validDate(date)||date<h.start)throw Error('Choose a valid date on or after the habit start.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:user(req.session.userId).timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(date>today)throw Error('Future entries cannot be recorded.');
 const {status,count}=req.body;if(!['success','missed','unrecorded'].includes(status)||!Number.isInteger(count)||count<0||count>999)throw Error('Invalid entry.');
 const entry={habitId:h.id,date,status,count};db.prepare('INSERT OR REPLACE INTO entries VALUES(?,?,?)').run(h.id,date,JSON.stringify(entry));log(h,req,`${h.name}: ${count>0?count+' occurrence(s)':status} on ${date}`);res.json(entry);
});
app.put('/api/profile',(req,res)=>{const {weekStart,timeZone,reminder}=req.body;if(!Number.isInteger(weekStart)||weekStart<0||weekStart>6)throw Error('Invalid week start.');try{new Intl.DateTimeFormat('en',{timeZone}).format()}catch{throw Error('Invalid timezone.')}if(reminder&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder))throw Error('Invalid reminder.');db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify({weekStart,timeZone,reminder}),req.session.userId);res.json(user(req.session.userId))});
app.post('/api/vacations',(req,res)=>{const {start,end,policy,target}=req.body;if(!validDate(start)||!validDate(end)||end<start||!['reduce','manual','excuse'].includes(policy)||!Number.isInteger(target)||target<0||target>7)throw Error('Invalid vacation dates or target.');const v={id:randomUUID(),userId:req.session.userId,start,end,policy,target};db.prepare('INSERT INTO vacations VALUES(?,?,?)').run(v.id,v.userId,JSON.stringify(v));res.status(201).json(v)});
app.delete('/api/vacations/:id',(req,res)=>{db.prepare('DELETE FROM vacations WHERE id=? AND userId=?').run(req.params.id,req.session.userId);res.json({ok:true})});
app.use('/lib',express.static(resolve(root,'lib'),{index:false}));app.use(express.static(resolve(root,'public')));
app.use((err,req,res,next)=>{console.error(err.message);res.status(err.status||400).json({error:err.status?err.message:(req.path.startsWith('/auth')?'Sign-in failed. Check Pocket ID configuration and try again.':err.message)})});
app.listen(port,host,()=>console.log(`Virtues & Vices: ${base.href}${demo?' (local demo mode)':''}`));
