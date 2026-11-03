export const iso = d => new Date(d).toISOString().slice(0,10);
export function addDays(date, n) { const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return iso(d); }
export const weekday = date => new Date(date+'T12:00:00Z').getUTCDay();
export function weekStart(date, start=1) { return addDays(date,-((weekday(date)-start+7)%7)); }
export function dates(start,end) { const out=[]; for(let d=start;d<=end;d=addDays(d,1)) out.push(d); return out; }
export function onVacation(habit,date,vacations,members) {
  if(!habit.vacationable) return false;
  const owners=habit.shared?members.map(m=>m.id):[habit.owner];
  return owners.length>0 && owners.every(id=>vacations.some(v=>v.userId===id&&v.start<=date&&v.end>=date));
}
export function dayState(habit,date,entries,vacations=[],members=[]) {
  if(date<habit.start) return 'outside';
  if(onVacation(habit,date,vacations,members)) return 'paused';
  const entry=entries.find(e=>e.habitId===habit.id&&e.date===date);
  if(habit.kind==='vice') {
    if(entry?.count>0) return 'missed';
    if(entry?.status==='success') return 'success';
    if(entry?.status==='missed') return 'missed';
    return habit.automatic?'success':'unrecorded';
  }
  return entry?.status||'unrecorded';
}
export function periodState(habit,start,end,entries,vacations,members) {
  let scheduled=dates(start,end).filter(d=>d>=habit.start);
  if(!scheduled.length) return {state:'outside',successes:0,target:habit.target};
  const paused=scheduled.filter(d=>onVacation(habit,d,vacations,members));
  const relevant=vacations.filter(v=>v.start<=end&&v.end>=start&&(habit.shared||v.userId===habit.owner));
  if(paused.length&&relevant.some(v=>v.policy==='excuse')) return {state:'paused',successes:0,target:habit.target};
  let target=habit.target;
  if(paused.length) {
    const manual=relevant.find(v=>v.policy==='manual');
    target=manual?manual.target:Math.ceil(target*(scheduled.length-paused.length)/scheduled.length);
  }
  if(target===0||paused.length===scheduled.length) return {state:'paused',successes:0,target};
  const successes=scheduled.filter(d=>dayState(habit,d,entries,vacations,members)==='success').length;
  const slips=scheduled.filter(d=>dayState(habit,d,entries,vacations,members)==='missed').length;
  const success=habit.kind==='vice'?slips<=target:successes>=target;
  return {state:success?'success':'missed',successes,slips,target};
}
export function progress(habit,today,entries,vacations=[],members=[]) {
  const weekly=habit.schedule==='weekly';let current=0,best=0,run=0,pending=0;
  const periods=weekly?dates(weekStart(habit.start,habit.weekStart),weekStart(today,habit.weekStart)).filter(d=>weekday(d)===habit.weekStart):dates(habit.start,today);
  for(const start of periods) {
    const end=weekly?addDays(start,6):start;
    if(!weekly&&!habit.days.includes(weekday(start))) continue;
    const result=weekly?periodState(habit,start,end,entries,vacations,members):{state:dayState(habit,start,entries,vacations,members)};
    if(result.state==='paused'||result.state==='outside') continue;
    if(end>=today) {
      // An automatic avoidance period is only successful once it has ended.
      if(result.state==='success'&&!(habit.kind==='vice'&&(weekly||habit.automatic))) run++;
      best=Math.max(best,run);continue;
    }
    if(result.state==='unrecorded'){pending++;continue;}
    if(weekly&&((habit.kind==='virtue'&&result.state==='missed')||(habit.kind==='vice'&&result.state==='success'))) {
      const unresolved=dates(start,end).some(d=>d>=habit.start&&dayState(habit,d,entries,vacations,members)==='unrecorded');
      if(unresolved){pending++;continue;}
    }
    if(result.state==='success')run++;else run=0;
    best=Math.max(best,run);
  }
  current=run;
  const week=periodState(habit,weekStart(today,habit.weekStart),addDays(weekStart(today,habit.weekStart),6),entries,vacations,members);
  return {current,best,pending,unit:weekly?'weeks':'days',week};
}
export function validateHabit(input,owner) {
  const h={id:input.id,owner,name:String(input.name||'').trim(),kind:input.kind,shared:!!input.shared,private:!!input.private,schedule:input.schedule,target:Number(input.target),days:input.days,weekStart:Number(input.weekStart),automatic:!!input.automatic,vacationable:!!input.vacationable,start:input.start,reminder:input.reminder||'',archived:!!input.archived};
  if(!h.name||h.name.length>100)throw Error('Habit name must be 1–100 characters.');
  if(!['virtue','vice'].includes(h.kind)||!['daily','weekly'].includes(h.schedule))throw Error('Invalid habit type or schedule.');
  if(!Number.isInteger(h.target)||h.target<(h.kind==='vice'?0:1)||h.target>7)throw Error('Weekly target must be between '+(h.kind==='vice'?0:1)+' and 7.');
  if(!Array.isArray(h.days)||!h.days.length||h.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Choose at least one valid preferred day.');
  if(!Number.isInteger(h.weekStart)||h.weekStart<0||h.weekStart>6)throw Error('Invalid week start.');
  if(!validDate(h.start)||h.start<'2000-01-01'||h.start>'2100-12-31')throw Error('Choose a start date between 2000 and 2100.');
  if(h.reminder&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.reminder))throw Error('Invalid reminder time.');
  if(h.shared)h.private=false;
  return h;
}
export function validDate(value) { return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&iso(value)===value; }
