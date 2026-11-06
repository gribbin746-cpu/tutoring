'use strict';
(function () {
  const L = typeof module !== 'undefined' && module.exports ? require('./Ehan_Loop_Content.js') : window.EhanLesson;
  const LIMIT = 30 * 60 * 1000;
  const questions = L.passages.flatMap(p => p.questions);
  const checks = L.checks.flatMap(g => g.items.map(([id,text]) => [id,g.group,text]));
  const reasonIds = new Set(L.reasons.map(r => r[0]));
  function fresh(student) {
    return {version:L.version,student,reading:{answers:{},marked:false,startedAt:null,markedAt:null,reasons:{},delivery:'idle'},writing:{startedAt:null,deadline:null,text:'',frozen:null,checks:{},marks:{},ack:false,delivery:'idle'}};
  }
  function restore(raw, student) {
    const s = fresh(student);
    if (!raw || raw.version !== L.version || raw.student !== student) return s;
    const r=raw.reading||{}, w=raw.writing||{};
    questions.forEach(q=>{if(Object.hasOwn(q.options,(r.answers||{})[q.n])) s.reading.answers[q.n]=r.answers[q.n];});
    s.reading.marked=!!r.marked && questions.every(q=>s.reading.answers[q.n]);
    for(const k of ['startedAt','markedAt']) if(Number.isFinite(r[k])&&r[k]>0) s.reading[k]=r[k];
    questions.forEach(q=>{const x=(r.reasons||{})[q.n];if(x) s.reading.reasons[q.n]={codes:Array.isArray(x.codes)?[...new Set(x.codes.filter(c=>reasonIds.has(c)))]:[],note:typeof x.note==='string'?x.note:''};});
    if(Number.isFinite(w.startedAt)&&w.startedAt>0){s.writing.startedAt=w.startedAt;s.writing.deadline=w.startedAt+LIMIT;}
    s.writing.text=typeof w.text==='string'?w.text:'';
    s.writing.frozen=typeof w.frozen==='string'&&s.writing.startedAt?w.frozen:null;
    checks.forEach(c=>s.writing.checks[c[0]]=!!(w.checks||{})[c[0]]);
    L.rubric.forEach(c=>{const v=(w.marks||{})[c.key];if(Number.isInteger(v)&&v>=0&&v<=5)s.writing.marks[c.key]=v;});
    s.writing.ack=!!w.ack;
    for(const [dest,src] of [[s.reading,r],[s.writing,w]]){dest.delivery=['sent','uncertain'].includes(src.delivery)?src.delivery:src.delivery==='pending'?'uncertain':'idle';if(src.submittedAt)dest.submittedAt=src.submittedAt;}
    return s;
  }
  function result(s) {
    const wrong=questions.filter(q=>s.reading.answers[q.n]!==q.answer);
    return {score:questions.length-wrong.length,wrong};
  }
  function reasonComplete(s,q) {
    const r=s.reading.reasons[q.n];
    return !!r&&r.codes.some(c=>reasonIds.has(c))&&(!r.codes.includes('other')||!!r.note.trim());
  }
  function reviewComplete(s) {return s.reading.marked&&result(s).wrong.every(q=>reasonComplete(s,q));}
  function expire(w,now) {
    if(w.startedAt&&now>=w.deadline&&w.frozen===null){w.frozen=w.text;return true;}return false;
  }
  function write(w,text,now) {
    expire(w,now);
    if(!w.startedAt||w.frozen!==null||w.delivery==='sent')return false;
    w.text=text;return true;
  }
  function wordCount(text){return (text.trim().match(/\S+/g)||[]).length;}
  function total(w){return L.rubric.every(c=>Number.isInteger(w.marks[c.key]))?L.rubric.reduce((n,c)=>n+w.marks[c.key],0):null;}
  function canSend(s){return reviewComplete(s)&&s.writing.frozen!==null&&!!s.writing.frozen.trim()&&total(s.writing)!==null&&s.writing.ack&&s.writing.delivery!=='sent';}
  function wrongRecords(s){return result(s).wrong.map(q=>({q:q.n,skill:'Word cloze',picked:q.options[s.reading.answers[q.n]],correct:q.word,explanation:q.explanation,reasons:(s.reading.reasons[q.n]?.codes||[]).map(c=>L.reasons.find(r=>r[0]===c)?.[1]||c),note:s.reading.reasons[q.n]?.note||''}));}
  function questionContext(q){const p=L.passages.find(p=>p.questions.includes(q));const pos=p.text.indexOf(q.word),prior=p.text.lastIndexOf('. ',pos),start=prior===-1?0:prior+2,end=p.text.indexOf('. ',pos);return (start>0?'… ':'')+p.text.slice(start,end===-1?p.text.length:end+1)+(end!==-1?' …':'');}
  function readingPayload(s){const r=result(s);return {nameKey:s.student,paperId:L.readingId,score:r.score,outOf:30,timeUsedSec:Math.max(0,Math.round(((s.reading.markedAt||Date.now())-(s.reading.startedAt||s.reading.markedAt||Date.now()))/1000)),perSkillJson:{'Word cloze':{c:r.score,t:30}},answersJson:{...s.reading.answers},wrongJson:wrongRecords(s)};}
  function report(s){
    const w=s.writing, r=result(s),out=['MEET MY CREATION — DOCIX REWRITE','Student: '+s.student,'Writing time: 30 minutes','Started: '+new Date(w.startedAt).toISOString(),'Deadline: '+new Date(w.deadline).toISOString(),'Words: '+wordCount(w.frozen??w.text),'',w.frozen??w.text,'','SELF-MARKS: '+(total(w)??'incomplete')+'/30'];
    L.rubric.forEach(c=>{const n=w.marks[c.key];out.push(c.label+': '+(n??'unmarked')+'/5'+(n!==undefined?' — '+c.levels[n]:''));});
    out.push('','CHECKLIST');checks.forEach(c=>out.push((w.checks[c[0]]?'[x] ':'[ ] ')+c[2]));
    out.push('','WORD CLOZE: '+r.score+'/30','');
    questions.forEach(q=>{const picked=s.reading.answers[q.n],wrong=picked!==q.answer;out.push(q.n+'. '+(wrong?'INCORRECT':'Correct')+' | chose '+(picked||'—')+': '+(q.options[picked]||'—')+' | answer '+q.answer+': '+q.word);if(wrong){const x=s.reading.reasons[q.n]||{codes:[],note:''};out.push('Text: '+questionContext(q));out.push('Why: '+x.codes.map(c=>L.reasons.find(r=>r[0]===c)?.[1]||c).join('; '));if(x.note)out.push('Note: '+x.note);out.push(q.explanation);}});
    out.push('','TEXT CREDITS');L.passages.forEach(p=>out.push(p.author+', '+p.title+' ('+p.year+'), '+p.section+'. '+p.url));
    return out.join('\n');
  }
  function writingPayload(s){return {nameKey:s.student,promptId:L.writingId,promptTitle:'ASAT rewrite: Meet My Creation (Docix) + word cloze review',wordCount:wordCount(s.writing.frozen??s.writing.text),timeUsedSec:1800,responseText:report(s)};}
  const core={L,LIMIT,questions,checks,fresh,restore,result,reasonComplete,reviewComplete,expire,write,total,wordCount,canSend,wrongRecords,questionContext,readingPayload,report,writingPayload};
  if(typeof module!=='undefined'&&module.exports){module.exports=core;return;}
  const $=id=>document.getElementById(id),esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const API='https://script.google.com/macros/s/AKfycbyY7uCEPmhqsTrgaKwMR0M-i0X1nsDmov-HoxdnAlGEzDJMjZdhbgsOEjDwDaBETym_9g/exec';
  const params=new URLSearchParams(location.search);let student='ehan',state,view='reading',passage=0,wrongIndex=0,busy=false,storageOK=true;
  const key=()=> 'noof_ehan_loop_v1_'+student;
  function readLocal(){try{return JSON.parse(localStorage.getItem(key()));}catch(_){return null;}}
  function save(){try{localStorage.setItem(key(),JSON.stringify(state));}catch(_){storageOK=false;$('storageWarning').hidden=false;}}
  function status(id,text,error=false){$(id).textContent=text;$(id).className='status'+(error?' error':'');}
  async function post(action,payload){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action,payload}),redirect:'follow',signal:controller.signal});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'The server did not confirm this submission.');return d.data;}finally{clearTimeout(timer);}}
  function go(next){
    if(next!=='reading'&&!state.reading.marked)next='reading';
    if(next==='writing'&&!reviewComplete(state))next='review';
    if(next==='reading'&&!state.reading.marked&&!state.reading.startedAt){state.reading.startedAt=Date.now();save();}
    view=next;for(const v of ['reading','review','writing']){$(v+'View').hidden=v!==view;$('step'+v[0].toUpperCase()+v.slice(1)).setAttribute('aria-current',v===view?'step':'false');}
    $('stepReview').disabled=!state.reading.marked;$('stepWriting').disabled=!reviewComplete(state);
    const p=new URLSearchParams({student,view});history.replaceState(null,'',location.pathname+'?'+p);
    if(view==='reading')renderReading();if(view==='review')renderReview();if(view==='writing')renderWriting();
  }
  function gapHTML(p){return p.gapped.split(/(\[\[\d+\]\])/).map(part=>{const m=part.match(/^\[\[(\d+)\]\]$/);if(!m)return esc(part);const n=Number(m[1]),q=questions[n-1];return '<span class="gap" data-gap="'+n+'">'+n+' · '+esc(q.options[state.reading.answers[n]]||'______')+'</span>';}).join('');}
  function renderReading(){
    const p=L.passages[passage];$('readingProgress').textContent=Object.keys(state.reading.answers).length+' of 30 answered';
    $('passageTabs').innerHTML=L.passages.map((p,i)=>'<button role="tab" aria-selected="'+(i===passage)+'" aria-controls="passagePanel" id="passageTab'+i+'" data-passage="'+i+'">'+(i+1)+'. '+esc(p.author.split(' ').at(-1))+' · '+p.questions[0].n+'–'+p.questions.at(-1).n+'</button>').join('');
    $('passagePanel').setAttribute('aria-labelledby','passageTab'+passage);$('passageTitle').textContent=p.title;$('passageText').innerHTML=gapHTML(p);
    $('passageCredit').innerHTML=esc(p.author)+' · <i>'+esc(p.title)+'</i> ('+p.year+'), '+esc(p.section)+'. <a href="'+p.url+'" target="_blank" rel="noopener">Original text</a>';
    $('questionPanel').innerHTML=p.questions.map(q=>'<fieldset class="question"'+(state.reading.marked?' disabled':'')+'><legend>Question '+q.n+'</legend><div class="options">'+Object.entries(q.options).map(([letter,word])=>'<label class="option"><input type="radio" name="q'+q.n+'" value="'+letter+'" data-question="'+q.n+'"'+(state.reading.answers[q.n]===letter?' checked':'')+'><span>'+letter+'. '+esc(word)+'</span></label>').join('')+'</div></fieldset>').join('');
    $('markReading').textContent=state.reading.marked?'View my results':'Mark all 30';
    $('prevPassage').disabled=passage===0;$('nextPassage').disabled=passage===L.passages.length-1;
  }
  function mark(){
    if(state.reading.marked){go('review');return;}
    const missing=questions.find(q=>!state.reading.answers[q.n]);
    if(missing){passage=L.passages.findIndex(p=>p.questions.some(q=>q.n===missing.n));renderReading();status('readingStatus','Choose an answer for question '+missing.n+' first.',true);document.querySelector('[name="q'+missing.n+'"]').focus();return;}
    state.reading.marked=true;state.reading.markedAt=Date.now();save();go('review');window.scrollTo({top:0,behavior:'smooth'});
  }
  const context=questionContext;
  function updateReviewProgress(){const r=result(state),done=r.wrong.filter(q=>reasonComplete(state,q)).length;$('reasonProgress').textContent=done+' of '+r.wrong.length+' mistakes checked';$('stepWriting').disabled=!reviewComplete(state);document.querySelectorAll('[data-wrong]').forEach(b=>b.classList.toggle('done',reasonComplete(state,r.wrong[Number(b.dataset.wrong)])));}
  function renderReview(){
    const r=result(state);wrongIndex=Math.min(wrongIndex,Math.max(0,r.wrong.length-1));$('readingScore').textContent=r.score+' / 30';
    $('reviewIntro').textContent=r.wrong.length?'Open each missed question and tick what happened.':'All 30 correct. You’re ready for the rewrite.';
    $('wrongNav').innerHTML=r.wrong.map((q,i)=>'<button data-wrong="'+i+'" aria-pressed="'+(i===wrongIndex)+'">'+q.n+'</button>').join('');
    $('wrongCard').hidden=!r.wrong.length;
    if(r.wrong.length){const q=r.wrong[wrongIndex],reason=state.reading.reasons[q.n]||{codes:[],note:''};$('wrongCard').innerHTML='<div class="eyebrow">Question '+q.n+'</div><div class="comparison"><div><span>You chose</span><strong class="picked">'+esc(q.options[state.reading.answers[q.n]])+'</strong></div><div><span>Best answer</span><strong class="correct">'+esc(q.word)+'</strong></div></div><div class="context">'+esc(context(q))+'</div><p>'+esc(q.explanation)+'</p><h3>What happened?</h3><div class="reasonlist">'+L.reasons.map(([code,label])=>'<label class="check"><input type="checkbox" data-reason="'+code+'"'+(reason.codes.includes(code)?' checked':'')+'><span>'+esc(label)+'</span></label>').join('')+'</div><label id="otherWrap"'+(reason.codes.includes('other')?'':' hidden')+'><span class="small">What was it?</span><textarea class="notes" id="otherNote" aria-label="Other reason">'+esc(reason.note)+'</textarea></label>'+(r.wrong.length>1?'<div class="toolbar"><button class="btn secondary" id="nextWrong">Next mistake</button></div>':'');}
    if(state.writing.delivery==='sent')$('wrongCard').querySelectorAll('input,textarea').forEach(e=>e.disabled=true);
    updateReviewProgress();
  }
  function reasonUpdate(code,checked){const q=result(state).wrong[wrongIndex];if(!q||state.writing.delivery==='sent')return;const x=state.reading.reasons[q.n] ||= {codes:[],note:''};x.codes=checked?[...new Set([...x.codes,code])]:x.codes.filter(c=>c!==code);save();$('otherWrap').hidden=!x.codes.includes('other');updateReviewProgress();}
  async function saveReview(){
    if(busy)return;const missing=result(state).wrong.find(q=>!reasonComplete(state,q));if(missing){wrongIndex=result(state).wrong.indexOf(missing);renderReview();status('reviewStatus','Tick a reason for question '+missing.n+(state.reading.reasons[missing.n]?.codes.includes('other')?' and add a note for “Other”.':'.'),true);return;}
    if(state.reading.delivery==='sent'||state.reading.delivery==='uncertain'){go('writing');return;}
    busy=true;$('continueWriting').disabled=true;state.reading.delivery='pending';save();status('reviewStatus','Saving your cloze review…');
    try{await post('submitReading',readingPayload(state));state.reading.delivery='sent';save();go('writing');}
    catch(_){state.reading.delivery='uncertain';save();go('writing');status('writingStatus','Your cloze review is saved in this browser. The server did not confirm it; it will also be included with your rewrite.');}
    finally{busy=false;$('continueWriting').disabled=false;if(view==='writing')renderWriting();}
  }
  function buildWriting(){
    $('writingPrompt').textContent=L.prompt;$('originalSpeech').textContent=L.original;
    const groups=[...new Set(checks.map(c=>c[1]))];$('checklist').innerHTML=groups.map(g=>'<fieldset class="checkgroup"><legend>'+esc(g)+'</legend>'+checks.filter(c=>c[1]===g).map(c=>'<label class="check"><input type="checkbox" data-check="'+c[0]+'"><span>'+esc(c[2])+'</span></label>').join('')+'</fieldset>').join('');
    $('rubricRows').innerHTML=L.rubric.map((c,i)=>'<fieldset class="criterion"><legend>'+esc(c.label)+' / 5</legend><p class="small">'+esc(c.description)+'</p><div class="scores">'+c.levels.map((text,n)=>'<label class="scorechoice" title="'+esc(text)+'"><input type="radio" name="mark_'+c.key+'" value="'+n+'" data-mark="'+c.key+'" aria-describedby="anchor_'+c.key+'"><span>'+n+'</span></label>').join('')+'</div><p id="anchor_'+c.key+'" class="anchor"></p><details><summary class="small">See all marks</summary>'+c.levels.map((t,n)=>'<p class="small"><b>'+n+'</b> · '+esc(t)+'</p>').join('')+'</details></fieldset>').join('');
  }
  function renderWriting(){
    const w=state.writing;if(expire(w,Date.now()))save();const ended=w.frozen!==null,sent=w.delivery==='sent';
    $('rewrite').value=ended?w.frozen:w.text;$('rewrite').readOnly=!w.startedAt||ended||sent;
    $('startWriting').hidden=!!w.startedAt;$('startWriting').disabled=!reviewComplete(state)||busy;
    $('selfMark').hidden=!ended||sent;$('sentBox').hidden=!sent;
    $('checklistHint').textContent=sent?'Your submitted checklist.':ended?'Tick what you actually did. Leave anything you didn’t do unticked.':'Use this while you write. You can tick it when the 30 minutes are up.';
    document.querySelectorAll('.checkgroup').forEach(f=>f.disabled=!ended||sent||busy);
    document.querySelectorAll('[data-check]').forEach(e=>e.checked=!!w.checks[e.dataset.check]);
    document.querySelectorAll('[data-mark]').forEach(e=>{e.checked=w.marks[e.dataset.mark]===Number(e.value);e.disabled=!ended||sent||busy;});
    L.rubric.forEach(c=>{const n=w.marks[c.key];$('anchor_'+c.key).textContent=n===undefined?'Choose a mark.':c.levels[n];});
    $('rubricTotal').textContent=(total(w)??'—')+' / 30';$('reviewAck').checked=w.ack;$('reviewAck').disabled=busy||sent;
    $('sendWork').disabled=busy||!canSend(state);$('sendWork').textContent=busy?'Sending…':w.delivery==='uncertain'?'Retry sending to Hanoof':'Send to Hanoof';
    renderClock();
  }
  function renderClock(){if(!state)return;const w=state.writing,ended=w.frozen!==null,remaining=w.startedAt?Math.max(0,Math.ceil((w.deadline-Date.now())/1000)):1800;$('clock').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');$('clock').classList.toggle('expired',ended);$('clockLabel').textContent=w.delivery==='sent'?'Submitted':ended?'Time’s up · check your work':w.startedAt?'Time remaining':'Not started';$('saveLabel').textContent=wordCount(ended?w.frozen:w.text)+' words · '+(w.delivery==='sent'?'Submitted':storageOK?'Saved in this browser':'Download a copy');}
  function begin(){if(busy||!reviewComplete(state))return;const shared=restore(readLocal(),student);if(shared.writing.startedAt){state=shared;renderWriting();return;}state.writing.startedAt=Date.now();state.writing.deadline=state.writing.startedAt+LIMIT;save();status('writingStatus','The clock keeps running if you leave this page. Your speech locks at 00:00.');renderWriting();$('rewrite').focus();}
  function download(){const body=state.writing.startedAt?report(state):JSON.stringify(state,null,2),blob=new Blob([body],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Ehan_Docix_and_cloze.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function send(){
    if(busy||!canSend(state))return;
    // A lost response may still have reached the server. Only a deliberate retry sends again.
    if(state.writing.delivery==='uncertain'&&!confirm('The last request was not confirmed. It may already have arrived. Send it again?'))return;
    const retryApproved=state.writing.delivery==='uncertain';
    busy=true;renderWriting();status('writingStatus','Sending your rewrite and cloze review…');
    const run=async()=>{
      const shared=restore(readLocal(),student);if(shared.writing.delivery==='sent'){state=shared;return;}
      if(shared.writing.delivery==='uncertain'&&!retryApproved){state=shared;status('writingStatus','Another tab has already tried to submit. Download a copy before deciding whether to retry.',true);return;}
      state.writing.delivery='pending';save();
      try{await post('submitWriting',writingPayload(state));state.writing.delivery='sent';state.writing.submittedAt=new Date().toISOString();save();status('writingStatus','');}
      catch(_){state.writing.delivery='uncertain';save();status('writingStatus','The server did not confirm your submission. Your work is saved here. Download a copy before retrying; the first request may already have arrived.',true);}
    };
    try{if(navigator.locks)await navigator.locks.request('noof-ehan-submit-'+student,run);else await run();}finally{busy=false;renderWriting();}
  }
  $('passageTabs').addEventListener('click',e=>{const b=e.target.closest('[data-passage]');if(!b)return;passage=Number(b.dataset.passage);renderReading();});
  $('passageTabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();passage=e.key==='Home'?0:e.key==='End'?4:Math.max(0,Math.min(4,passage+(e.key==='ArrowRight'?1:-1)));renderReading();$('passageTab'+passage).focus();});
  $('questionPanel').addEventListener('change',e=>{const el=e.target;if(!el.dataset.question||state.reading.marked)return;if(!state.reading.startedAt)state.reading.startedAt=Date.now();state.reading.answers[el.dataset.question]=el.value;save();$('readingProgress').textContent=Object.keys(state.reading.answers).length+' of 30 answered';$('passageText').innerHTML=gapHTML(L.passages[passage]);status('readingStatus','');});
  $('prevPassage').onclick=()=>{passage--;renderReading();};$('nextPassage').onclick=()=>{passage++;renderReading();};$('markReading').onclick=mark;
  $('wrongNav').onclick=e=>{const b=e.target.closest('[data-wrong]');if(b){wrongIndex=Number(b.dataset.wrong);renderReview();}};
  $('wrongCard').addEventListener('change',e=>{if(e.target.dataset.reason)reasonUpdate(e.target.dataset.reason,e.target.checked);});
  $('wrongCard').addEventListener('input',e=>{if(e.target.id==='otherNote'&&state.writing.delivery!=='sent'){const q=result(state).wrong[wrongIndex],x=state.reading.reasons[q.n] ||= {codes:[],note:''};x.note=e.target.value;save();updateReviewProgress();}});
  $('wrongCard').addEventListener('click',e=>{if(e.target.id==='nextWrong'){wrongIndex=(wrongIndex+1)%result(state).wrong.length;renderReview();}});
  $('continueWriting').onclick=saveReview;$('stepReading').onclick=()=>go('reading');$('stepReview').onclick=()=>go('review');$('stepWriting').onclick=()=>go('writing');
  $('startWriting').onclick=()=>{if(navigator.locks)navigator.locks.request('noof-ehan-start-'+student,begin);else begin();};
  $('rewrite').addEventListener('beforeinput',e=>{if(expire(state.writing,Date.now())){save();e.preventDefault();renderWriting();}});
  $('rewrite').addEventListener('input',()=>{if(!write(state.writing,$('rewrite').value,Date.now()))renderWriting();save();renderClock();});
  $('checklist').addEventListener('change',e=>{if(e.target.dataset.check&&state.writing.frozen!==null&&state.writing.delivery!=='sent'){state.writing.checks[e.target.dataset.check]=e.target.checked;save();}});
  $('rubricRows').addEventListener('change',e=>{if(e.target.dataset.mark&&state.writing.frozen!==null&&state.writing.delivery!=='sent'){state.writing.marks[e.target.dataset.mark]=Number(e.target.value);save();renderWriting();}});
  $('reviewAck').onchange=()=>{state.writing.ack=$('reviewAck').checked;save();renderWriting();};$('downloadWork').onclick=download;$('sendWork').onclick=send;
  document.addEventListener('visibilitychange',()=>{if(!state)return;if(expire(state.writing,Date.now())){save();renderWriting();}});
  window.addEventListener('storage',e=>{if(state&&e.key===key()&&!busy){state=restore(readLocal(),student);if(expire(state.writing,Date.now()))save();go(view);}});
  setInterval(()=>{if(!state)return;if(expire(state.writing,Date.now())){save();if(view==='writing')renderWriting();}if(view==='writing')renderClock();},250);
  async function init(){
    $('retryLogin').hidden=true;$('loadingText').textContent='Opening your work…';
    if(params.get('student')&&params.get('student').toLowerCase()!=='ehan'){$('loadingText').textContent='This task is for Ehan. Open your own tasks from the home page.';return;}
    try{const c=await post('login',{name:'ehan'});if(c.profile?.nameKey!=='ehan')throw new Error('Profile unavailable');student=c.profile.nameKey;$('studentLabel').textContent=(c.profile.displayName||'Ehan')+' · Reading & writing';}
    catch(_){$('loadingText').textContent='Your profile could not be checked. Try again when you’re connected.';$('retryLogin').hidden=false;return;}
    state=restore(readLocal(),student);if(expire(state.writing,Date.now()))save();
    const link='index.html?student='+encodeURIComponent(student);$('homeLink').href=link;$('returnLink').href=link;
    buildWriting();$('loading').hidden=true;$('lesson').hidden=false;go(params.get('view')==='writing'?'writing':state.reading.marked?'review':'reading');
    if(state.writing.delivery==='uncertain')status('writingStatus','An earlier submission was not confirmed. Your saved work is here. Download a copy before choosing whether to retry.',true);
  }
  $('retryLogin').onclick=init;init();
})();
