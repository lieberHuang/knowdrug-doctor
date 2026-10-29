/* MedLink: dependency-free interaction prototype. Medical data is explicitly illustrative. */
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage = { get(key, fallback) { try { return JSON.parse(localStorage.getItem('medlink-'+key)) ?? fallback; } catch { return fallback; } }, set(key, value) { try { localStorage.setItem('medlink-'+key, JSON.stringify(value)); } catch {} } };
let doctor = storage.get('doctor', {name:'张医生',department:'心血管内科',hospital:'医伴学术中心'});
if (doctor.hospital === '医伴示范医院') doctor.hospital = '医伴学术中心';
// Upgrade persisted sample content without discarding conversations or notes.
function migrateDrugCopy(value){
 if(typeof value==='string')return [["\u745e\u8212\u4f10\u4ed6\u6c40\u9499\u7247","日达仙"],["\u745e\u8212\u4f10\u4ed6\u6c40","日达仙"],["\u4ed6\u6c40\u7c7b","日达仙药品资料"],["\u8840\u8102\u7ba1\u7406","日达仙资料"],["\u964d\u8102\u6cbb\u7597","日达仙相关研究"],["\u964d\u8102\u76f8\u5173\u836f\u7269","日达仙"],["\u964d\u8102\u76f8\u5173","日达仙相关"],["\u964d\u8102","日达仙"],["\u8840\u8102","药品"],["\u4ed6\u6c40","日达仙"]].reduce((text,[oldName,newName])=>text.split(oldName).join(newName),value);
 if(Array.isArray(value))return value.map(migrateDrugCopy);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,migrateDrugCopy(item)]));
 return value;
}
let sessions = migrateDrugCopy(storage.get('sessions', []));
let favorites = storage.get('favorites', []);
let activeSession = null;
let currentPage = 'home';
let pageContext = {};
let questionBatch = 0;
let answering = false;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
let afterModalClose=null;
function finishModalAction(){const action=afterModalClose;afterModalClose=null;if(action)action();}
function closeModalThen(action){afterModalClose=action;$('#modal').close();}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200); }
function showModal(title, html) { $('#welcome-audio').pause(); $('#modal').classList.remove('call-sheet'); $('#modal-title').textContent = title; $('#modal-content').innerHTML = html; openPopup(); }
function openPopup(){if(!$('#modal').open){history.pushState({...history.state,modal:true},'');$('#modal').showModal();}}
$('#modal').addEventListener('close',()=>{if(history.state?.modal)history.back();else finishModalAction();});
let sheetTouchStart=null;
$('#modal').addEventListener('touchstart',event=>{sheetTouchStart=$('#modal').scrollTop<=0?event.touches[0].clientY:null;},{passive:true});
$('#modal').addEventListener('touchend',event=>{if(sheetTouchStart!==null&&event.changedTouches[0].clientY-sheetTouchStart>90)$('#modal').close();sheetTouchStart=null;},{passive:true});
$('#modal-close').onclick = () => $('#modal').close();
$('#modal').addEventListener('click', e => { if(e.target === $('#modal')) { const r = e.target.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) e.target.close(); } });
const date = new Date();
const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'numeric',hour12:false}).format(date));
$('#greeting-time').textContent = hour<11?'上午好':hour<14?'中午好':hour<18?'下午好':'晚上好';
function updateDoctor() { $('#doctor-header').textContent = doctor.name; $('#doctor-greeting').textContent = doctor.name; $('.avatar').textContent = doctor.name.slice(0,1); }
updateDoctor();
const questions = [
 ['日达仙的药品资料有哪些？','如何查阅用法用量与注意事项？','有哪些需要关注的药物相互作用？','有哪些相关的指南与研究可以参考？'],
 ['特殊人群用药需要核对哪些信息？','如何了解药品的不良反应？','开始治疗前应关注哪些资料？','可以帮我梳理一份药品阅读清单吗？'],
 ['如何查阅日达仙相关的指南与资料？','如何解读一篇药品临床研究？','病历点评支持哪些分析维度？','怎样向医药代表申请更多学术资料？']
];
function renderQuestions() { $('#suggestions').innerHTML = questions[questionBatch].map(q=>`<button type="button">${escapeHtml(q)}</button>`).join(''); $$('#suggestions button').forEach(b => b.onclick = () => askQuestion(b.textContent)); }
renderQuestions();
$('#refresh-questions').onclick = () => { questionBatch=(questionBatch+1)%questions.length; renderQuestions(); };

// Welcome media: AI portrait + Chinese narrated introduction, with real audio timing.
const audio = $('#welcome-audio');
const captions = [
 [0, '医生，您好。我是您的专属医药代表林晓。'],
 [4, '很高兴在医伴与您见面。'],
 [6, '我会为您提供药品资料与学术支持。'],
 [10, '在这里，您可以向药品助手提问。'],
 [13, '也可以查看相关指南、文献，或者使用病历点评。'],
 [18, '让我们从您关心的问题开始吧。']
];
const timeLabel = t => `${String(Math.floor((t||0)/60)).padStart(2,'0')}:${String(Math.floor((t||0)%60)).padStart(2,'0')}`;
function syncAudio() { const playing = !audio.paused; $('#home-page').classList.toggle('is-playing',playing); $('#play-label').textContent = playing?'暂停专属介绍':audio.currentTime>0?'继续播放专属介绍':'播放我的专属介绍'; $('#video-toggle').textContent = playing?'Ⅱ':'▶'; $('#video-toggle').setAttribute('aria-label',playing?'暂停欢迎介绍':'播放欢迎介绍'); $('#video-caption').hidden = !playing; }
async function toggleAudio() { if(!audio.paused) audio.pause(); else { try { await audio.play(); } catch { toast('音频暂时无法播放，请稍后重试。'); } } syncAudio(); }
$('#play-welcome').onclick=toggleAudio; $('#video-toggle').onclick=toggleAudio;
audio.addEventListener('loadedmetadata',()=>{ $('#video-total').textContent=timeLabel(audio.duration); $('.video-duration').textContent=timeLabel(audio.duration); });
audio.addEventListener('timeupdate',()=>{ $('#video-time').textContent=timeLabel(audio.currentTime); $('#video-progress').value=audio.duration?audio.currentTime/audio.duration*100:0; const caption=[...captions].reverse().find(([start])=>audio.currentTime>=start); const subtitle=(caption?.[1]||'').replace('张医生',doctor.name);const captionEl=$('#video-caption');if(captionEl.textContent!==subtitle){captionEl.textContent=subtitle;captionEl.classList.remove('caption-reveal');void captionEl.offsetWidth;captionEl.classList.add('caption-reveal');} });
audio.addEventListener('ended',()=>{syncAudio();$('#play-label').textContent='重新播放专属介绍';});
audio.addEventListener('pause',syncAudio); audio.addEventListener('play',syncAudio);
$('#video-progress').oninput = e => {if(Number.isFinite(audio.duration)) audio.currentTime=Number(e.target.value)/100*audio.duration;};
$('#mute').onclick=()=>{audio.muted=!audio.muted;$('#mute').textContent=audio.muted?'♩':'♪';$('#mute').setAttribute('aria-label',audio.muted?'取消静音':'静音');toast(audio.muted?'已静音':'已开启声音');};
// Keep the video folded during reading and restore it when the doctor returns to the top.
let ignoreWelcomeScroll=false;
let lastWelcomeScrollY=window.scrollY;
let welcomeTouchY=null;
function settleWelcomeScroll(){
 requestAnimationFrame(()=>requestAnimationFrame(()=>{lastWelcomeScrollY=window.scrollY;ignoreWelcomeScroll=false;}));
}
function collapseWelcome(){
 if($('#home-page').classList.contains('collapsed'))return;
 ignoreWelcomeScroll=true;
 const before=$('#agent-panel').getBoundingClientRect().top;
 $('#home-page').classList.add('collapsed');$('#welcome-hero').inert=true;$('#welcome-hero').setAttribute('aria-hidden','true');$('#compact-welcome').hidden=false;audio.pause();
 const after=$('#agent-panel').getBoundingClientRect().top;
 if(window.scrollY>100)window.scrollBy({top:after-before,behavior:'instant'});
 settleWelcomeScroll();
}
function expandWelcome(){
 if(!$('#home-page').classList.contains('collapsed'))return;
 ignoreWelcomeScroll=true;
 $('#home-page').classList.remove('collapsed');$('#welcome-hero').inert=false;$('#welcome-hero').removeAttribute('aria-hidden');$('#compact-welcome').hidden=true;
 window.scrollTo({top:0,behavior:'instant'});settleWelcomeScroll();
}
function restoreWelcomeAtTop(){
 if(currentPage==='home'&&!ignoreWelcomeScroll&&!$('#modal').open&&window.scrollY<=8)expandWelcome();
}
$('#collapse-video').onclick=collapseWelcome;
window.addEventListener('scroll',()=>{
 if(currentPage!=='home'||ignoreWelcomeScroll||$('#modal').open)return;
 const position=Math.max(0,window.scrollY);const scrollingUp=position<lastWelcomeScrollY;lastWelcomeScrollY=position;
 if($('#home-page').classList.contains('collapsed')){if(position<=8&&scrollingUp)expandWelcome();}
 else if($('#welcome-hero').getBoundingClientRect().bottom<125)collapseWelcome();
},{passive:true});
// An upward gesture must also work when a short, folded page is already at scroll position zero.
window.addEventListener('wheel',event=>{if(event.deltaY<0)restoreWelcomeAtTop();},{passive:true});
window.addEventListener('touchstart',event=>{welcomeTouchY=event.touches[0]?.clientY??null;},{passive:true});
window.addEventListener('touchmove',event=>{if(welcomeTouchY!==null&&event.touches[0].clientY-welcomeTouchY>24){restoreWelcomeAtTop();welcomeTouchY=null;}},{passive:true});
window.addEventListener('touchend',()=>{welcomeTouchY=null;},{passive:true});

const pageTitles={home:'首页',case:'病历点评',caseDetail:'病历详情',casePublish:'发布病历',caseRedact:'遮挡患者信息',guides:'相关指南',papers:'最新文献',history:'问答记录',favorites:'我的收藏',academic:'学术中心',mine:'我的'};
history.replaceState({page:'home'},'');
function navigate(page, options={}) {
 if(!pageTitles[page]) page='home';
 const nextContext=options.context||{};
 const changed=currentPage!==page||JSON.stringify(pageContext)!==JSON.stringify(nextContext);
 currentPage=page;pageContext=nextContext;document.body.dataset.page=page;
 $('#page-subtitle').textContent=pageTitles[page];
 const selected=['case','caseDetail','casePublish','caseRedact','guides','papers'].includes(page)?'academic':['history','favorites'].includes(page)?'mine':page;
 $$('.tab-item').forEach(b=>{b.classList.toggle('active',b.dataset.page===selected);b.setAttribute('aria-current',b.dataset.page===selected?'page':'false');});
 $('#home-page').hidden=page!=='home';$('#module-page').hidden=page==='home';
 if(changed&&!options.fromHistory){if(options.replace)history.replaceState({page,context:pageContext},'');else history.pushState({page,context:pageContext},'');}
 if(page==='home'){if(!options.agent){expandWelcome();window.scrollTo({top:0,behavior:'instant'});}}
 else{audio.pause();renderModule(page);window.scrollTo({top:0,behavior:'instant'});}
 document.activeElement?.blur();
}
window.addEventListener('popstate',event=>{const target=event.state?.page||'home';if($('#modal').open&&!event.state?.modal)$('#modal').close();if(event.state?.modal&&!$('#modal').open)$('#modal').showModal();if(target!==currentPage||JSON.stringify(event.state?.context||{})!==JSON.stringify(pageContext))navigate(target,{context:event.state?.context||{},fromHistory:true});if(!event.state?.modal)finishModalAction();});
$('#new-question').onclick=()=>newConversation();
$('#back').onclick=()=>{if(history.state?.page&&history.state.page!=='home')history.back();else navigate('home');};
document.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button&&button!==document.body&&button.dataset.page){navigate(button.dataset.page);}});
$('.brand').onclick=e=>{e.preventDefault();navigate('home');};

// The number can be replaced with the representative's business phone.
const representative={name:'林晓',phone:'13800000000'};
function openDialer(){
 audio.pause();
 $('#modal').classList.add('call-sheet');$('#modal-title').textContent='联系'+representative.name;
 $('#modal-content').innerHTML=`<div class="call-person"><img src="assets/representative.png" alt="林晓"><h2>${representative.name}</h2><div class="call-number">${representative.phone.replace(/(\d{3})(\d{4})(\d{4})/,'$1 $2 $3')}</div></div><div class="call-actions"><button id="cancel-call">取消</button><a href="tel:${representative.phone}" id="dial-call" aria-label="呼叫${representative.name}">${icon('phone')}呼叫</a></div>`;
 openPopup();$('#cancel-call').onclick=()=>$('#modal').close();
}
$('#contact-representative').onclick=openDialer;
function updateKeyboard(){const vv=window.visualViewport;const offset=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;document.documentElement.style.setProperty('--keyboard-offset',offset+'px');document.body.classList.toggle('keyboard-open',offset>100&&document.activeElement===$('#question'));}
window.visualViewport?.addEventListener('resize',updateKeyboard);window.visualViewport?.addEventListener('scroll',updateKeyboard);$('#question').addEventListener('focus',updateKeyboard);$('#question').addEventListener('blur',()=>{document.body.classList.remove('keyboard-open');document.documentElement.style.setProperty('--keyboard-offset','0px');});
$('#question').addEventListener('input',()=>{const field=$('#question');field.style.height='auto';field.style.height=Math.min(field.scrollHeight,120)+'px';});
$('#drug-info').onclick=()=>showModal('日达仙 · 药品资料',`<h3>说明书信息</h3><p>药品名称、规格、适应症、用法用量、禁忌、注意事项、不良反应与药物相互作用。</p><h3>循证信息</h3><p>关联指南、临床研究原文、资料版本及来源信息。</p>`);

function answerFor(q) {
 if(/指南|文献|研究|循证/.test(q))return {title:'为您梳理循证资料的查阅路径',body:'您可以从“相关指南”查看指南阅读要点，再到“最新文献”梳理研究问题、人群、结局与局限性。\n阅读时，建议记录原文出处、发表时间与资料版本，并结合研究人群和适用范围理解证据。',action:'查看相关指南',page:'guides'};
 if(/病历|病例|点评/.test(q))return {title:'从病历列表开始交流',body:'进入“病历点评”，选择任意病历查看详情并发表点评。您也可以发布自己的病历并上传图片。\n发布前请隐藏患者姓名、联系方式、证件号、病案号、二维码及可识别的面部照片，逐项确认文字与图片已完成脱敏。',action:'前往病历点评',page:'case'};
 if(/相互作用|合用|联合/.test(q))return {title:'药物相互作用的资料核对清单',body:'查阅相互作用信息时，需要先确认完整的合并用药清单，包括处方药、非处方药与补充剂，并核对具体药品的最新获批说明书。\n建议逐项记录：合并药物、资料来源、相关风险提示，以及说明书中的限制条件。具体用药组合应结合患者背景，由医生进行专业评估。',action:'查看药品资料',page:'drug'};
 if(/剂量|用法|用量|特殊|人群|治疗|不良|反应/.test(q))return {title:'先确认用药背景，再查阅对应资料',body:'药品资料的核对应结合具体产品说明书，并关注患者年龄、既往病史、肝肾功能、合并用药等背景信息。\n用法用量、不良反应与特殊人群限制应以实际获批说明书为准。您可以通过“药品资料”查看需要关注的信息维度。',action:'查看药品资料',page:'drug'};
 if(/代表|联系|申请/.test(q))return {title:'整理您需要的学术资料',body:'您可以通过页面上的“联系我”直接找到您的专属医药代表。\n点击后查看联系电话，选择“呼叫”即可打开手机拨号界面。',action:'联系我',page:'contact'};
 if(!/药|日达仙|阅读|资料|信息|你好|您好/.test(q))return {title:'我专注于日达仙的学术资料',body:'您可以询问药品资料的查阅方式、用药信息核对要点，或进入病历点评、相关指南与最新文献模块。',action:'查看药品资料',page:'drug'};
 return {title:'为您整理这款药品的资料阅读清单',body:'建议按“药品基本信息 → 获批说明书 → 用药注意事项 → 关联指南 → 临床研究”依次查阅。\n阅读过程中，请重点核对适应症、用法用量、禁忌、注意事项与药物相互作用，并保留所查阅资料的版本和出处。',action:'查看药品资料',page:'drug'};
}
// Refresh saved assistant copy while retaining the user's conversations.
if (storage.get('content-version', 0) < 5) {
 sessions.forEach(session => {
  let question = '';
  session.messages.forEach(message => {
   if (message.role === 'user') question = message.text;
   else if (message.role === 'assistant') message.answer = answerFor(question);
  });
 });
 storage.set('sessions', sessions);
 storage.set('content-version', 5);
}
function renderMessage(role,text,answer,index) { const el=document.createElement('div');el.className='message '+role; if(role==='user')el.textContent=text;else el.innerHTML=`<span class="message-avatar">${icon('spark')}</span><div class="message-body"><strong>${escapeHtml(answer.title)}</strong><p>${escapeHtml(answer.body)}</p><div class="message-tools"><button data-answer-action="${answer.page}">${answer.action} ›</button><button data-copy="${index}">复制回答</button></div></div>`;$('#messages').append(el);return el; }
async function askQuestion(q) { q=q.trim();if(!q||answering)return;if(currentPage!=='home')navigate('home',{agent:true});collapseWelcome();answering=true;$('#send').disabled=true;$('#agent-welcome').hidden=true;$('#question').value='';if(!activeSession){activeSession={id:Date.now().toString(),title:q,time:new Date().toISOString(),messages:[]};sessions.unshift(activeSession);}renderMessage('user',q);activeSession.messages.push({role:'user',text:q});const loader=document.createElement('div');loader.className='message assistant';loader.innerHTML=`<span class="message-avatar">${icon('spark')}</span><div class="message-body"><p>正在整理资料<span aria-hidden="true">…</span></p></div>`;$('#messages').append(loader);loader.scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'nearest'});await new Promise(r=>setTimeout(r,650));loader.remove();const answer=answerFor(q);activeSession.messages.push({role:'assistant',answer});const index=activeSession.messages.length-1;const el=renderMessage('assistant','',answer,index);sessions=sessions.slice(0,30);storage.set('sessions',sessions);answering=false;$('#send').disabled=false;if(currentPage==='home')$('#chat-form').scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'end'}); }
$('#chat-form').onsubmit=e=>{e.preventDefault();askQuestion($('#question').value);};
$('#question').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing){e.preventDefault();askQuestion(e.target.value);}});
$('#messages').addEventListener('click',async e=>{const action=e.target.closest('[data-answer-action]');if(action){if(action.dataset.answerAction==='drug')$('#drug-info').click();else if(action.dataset.answerAction==='contact')openDialer();else navigate(action.dataset.answerAction);}const copy=e.target.closest('[data-copy]');if(copy){const a=activeSession?.messages[Number(copy.dataset.copy)]?.answer;if(a){try{await navigator.clipboard.writeText(a.title+'\n'+a.body);toast('回答已复制');}catch{toast('当前浏览器未开放剪贴板，请选中文字复制');}}}});
function openHomeAgent(){if(currentPage!=='home')navigate('home',{agent:true});collapseWelcome();$('#agent-panel').scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'start'});}
function newConversation() { if(answering){toast('请等待当前回答完成');return;}activeSession=null;$('#question').value='';$('#question').style.height='';$('#messages').innerHTML='';$('#agent-welcome').hidden=false;openHomeAgent();toast('已开启新的药品问答'); }

const resources = [
 {id:'g1',type:'guides',category:'药品资料',title:'日达仙 · 资料阅读要点',publisher:'指南阅读',summary:'围绕风险评估、干预目标、治疗路径与随访信息，建立结构化阅读框架。',sections:[['阅读前先明确问题','明确目标人群、临床场景、指南适用范围与发布机构。'],['关注证据与推荐','区分推荐意见与支持证据，记录推荐强度、证据等级和原文位置。'],['连接具体药品资料','核对指南建议与具体产品的获批适应症、注意事项及说明书版本。']]},
 {id:'g2',type:'guides',category:'用药管理',title:'日达仙用药管理 · 资料核对框架',publisher:'用药资料管理',summary:'以药品说明书为起点，梳理合并用药、特殊人群与用药资料的核对顺序。',sections:[['建立用药清单','逐项记录药品名称、剂型、用法、用量和实际使用情况。'],['核对完整背景','确认病史、合并用药及检查资料是否完整。'],['记录资料依据','保留资料名称、来源、版本和核对日期，便于后续复核。']]},
 {id:'g3',type:'guides',category:'药品资料',title:'日达仙相关资料 · 循证查阅清单',publisher:'循证阅读',summary:'按研究人群、临床问题与证据类型组织资料，便于后续查阅和讨论。',sections:[['提出临床问题','以人群、干预、对照和结局构建一个可以检索的问题。'],['阅读原始出处','核验文献出处与发布时间，避免只依赖摘要转述。'],['关注适用边界','记录研究局限性与适用人群，结合实际临床背景理解。']]},
 {id:'p1',type:'papers',category:'临床研究',title:'日达仙相关研究：如何阅读一项临床研究？',publisher:'研究方法 · 文献精读',summary:'从研究设计、人群特征、主要终点与结果解释四个方面，梳理文献解读要点。',sections:[['研究问题','首先明确研究试图回答什么问题，以及研究设计是否适合该问题。'],['结果解读','关注主要终点、效应量、置信区间与统计方法，不将统计学意义直接等同于临床意义。'],['局限与适用性','核对纳入排除标准、随访、偏倚和研究局限，评估是否适用于所关注的人群。']]},
 {id:'p2',type:'papers',category:'循证方法',title:'从研究摘要到全文：建立您的循证阅读路径',publisher:'循证方法 · 文献精读',summary:'区分摘要结论与原文证据，记录研究方法、利益冲突与资料来源。',sections:[['摘要初筛','判断研究主题、类型和人群是否与问题相关。'],['阅读全文','重点查阅方法、结果、局限性及补充材料。'],['形成阅读笔记','将结论与证据分别记录，并保留原文出处以便复核。']]},
 {id:'p3',type:'papers',category:'临床研究',title:'真实世界证据：阅读观察性研究时关注什么？',publisher:'研究方法 · 证据解读',summary:'梳理混杂因素、数据完整性与因果解释的边界，建立审慎的证据理解。',sections:[['理解数据来源','确认数据收集方式、覆盖人群与缺失信息。'],['关注偏倚与混杂','记录研究如何处理选择偏倚、混杂因素及时间相关偏倚。'],['保持解释边界','观察到的关联不自动代表因果关系，需结合研究设计与其他证据理解。']]}
];
function heading(title,description,extra=''){return extra?`<div class="module-heading">${extra}</div>`:'';}
function renderModule(page) {
 const root=$('#module-page');
 if(page==='academic'){
 root.innerHTML=`<div class="hub-banner"><h2>学术工具</h2>${icon('book')}</div><div class="hub-links">${[['case','case','病历点评','梳理信息，聚焦病例讨论'],['guides','book','相关指南','从临床问题出发，查阅循证依据'],['papers','paper','最新文献','梳理研究方法与证据质量']].map(([page,symbol,title,desc])=>`<button class="hub-row" data-page="${page}"><span class="tool-icon">${icon(symbol)}</span><div><h3>${title}</h3></div><span class="row-chevron">›</span></button>`).join('')}</div><h2 class="section-caption">随时回顾</h2><div class="profile-links"><button class="profile-row" data-page="favorites">${icon('star')}我的收藏<span class="row-chevron">›</span></button></div>`;
 }else if(page==='mine'){
 root.innerHTML=`<div class="profile-card"><span class="avatar">${escapeHtml(doctor.name[0])}</span><div><h2>${escapeHtml(doctor.name)}</h2><p>${escapeHtml(doctor.department)}<br>${escapeHtml(doctor.hospital)}</p></div></div><div class="profile-links"><button class="profile-row" data-page="history">${icon('clock')}问答记录<span class="row-chevron">›</span></button><button class="profile-row" data-page="favorites">${icon('star')}我的收藏<span class="row-chevron">›</span></button><button class="profile-row" id="mine-contact">${icon('phone')}我的专属代表<span class="row-chevron">›</span></button></div>`;$('#mine-contact').onclick=openDialer;
 }else if(['case','caseDetail','casePublish','caseRedact'].includes(page)){
 window.CaseBoard.render(page,pageContext);
 }else if(page==='guides'||page==='papers'){
 const guides=page==='guides';root.innerHTML=heading(guides?'相关指南':'最新文献',guides?'从临床问题出发，建立有据可循的资料阅读路径。':'关注研究方法与证据质量，让学术阅读更高效。')+`<div class="library-toolbar"><label class="search-field">${icon('search')}<input id="resource-search" placeholder="搜索${guides?'指南':'文献'}或关键词" aria-label="搜索资料"></label><button class="filter-btn active" data-filter="全部">全部</button>${(guides?['药品资料','用药管理']:['临床研究','循证方法']).map(t=>`<button class="filter-btn" data-filter="${t}">${t}</button>`).join('')}</div><div id="resource-list" class="resource-list"></div>`;let filter='全部';const render=()=>{const query=$('#resource-search').value.trim();renderResources(resources.filter(r=>r.type===page&&(filter==='全部'||r.category===filter)&&(`${r.title}${r.summary}${r.category}`).includes(query)));};$('#resource-search').oninput=render;$$('[data-filter]',root).forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]',root).forEach(x=>x.classList.toggle('active',x===b));render();});render();
 }else if(page==='favorites'){
 root.innerHTML=heading('我的收藏','保存值得再次阅读的学术资料。')+'<div id="resource-list" class="resource-list"></div>';renderResources(resources.filter(r=>favorites.includes(r.id)),true);
 }else if(page==='history'){
 root.innerHTML=heading('问答记录','延续每一次学术思考，随时回到之前的讨论。',`<button class="primary-button" id="new-chat">+ 新建问答</button>`)+(sessions.length?sessions.map(s=>`<button class="history-row" data-session="${escapeHtml(s.id)}"><div><b>${escapeHtml(s.title)}</b><small>${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s.time))} · ${s.messages.filter(m=>m.role==='user').length} 次提问</small></div>${icon('arrow')}</button>`).join(''):`<div class="empty-state">${icon('chat')}<h3>暂无问答记录</h3><button class="primary-button" id="first-chat">开始药品问答</button></div>`);$('#new-chat').onclick=newConversation;if($('#first-chat'))$('#first-chat').onclick=newConversation;$$('[data-session]').forEach(b=>b.onclick=()=>{if(answering){toast('请等待当前回答完成');return;}activeSession=sessions.find(s=>s.id===b.dataset.session);$('#messages').innerHTML='';$('#agent-welcome').hidden=true;activeSession.messages.forEach((m,i)=>renderMessage(m.role,m.text||'',m.answer,i));openHomeAgent();});
 }
}
function renderResources(list,isFavorites=false) {
 $('#resource-list').innerHTML=list.length?list.map(r=>`<article class="resource-card"><span class="resource-icon">${icon(r.type==='guides'?'book':'paper')}</span><div class="resource-card-body"><div class="resource-meta"><span class="resource-badge">${r.category}</span></div><h3>${r.title}</h3><p>${r.summary}</p><div class="resource-actions"><button data-read="${r.id}">阅读要点 ›</button><button class="save-resource" data-save="${r.id}">${favorites.includes(r.id)?'★ 已收藏':'☆ 收藏'}</button></div></div></article>`).join(''):`<div class="empty-state">${icon(isFavorites?'star':'search')}<h3>${isFavorites?'暂无收藏':'未找到相关资料'}</h3>${isFavorites?'<button class="primary-button" id="browse-guides">浏览相关指南</button>':''}</div>`;
 $$('[data-read]').forEach(b=>b.onclick=()=>{const r=resources.find(r=>r.id===b.dataset.read);showModal(r.title,`<span class="resource-badge">${r.category}</span><p>${r.summary}</p>${r.sections.map(([title,body])=>`<h3>${title}</h3><p>${body}</p>`).join('')}`);});
 $$('[data-save]').forEach(b=>b.onclick=()=>{const id=b.dataset.save;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];storage.set('favorites',favorites);b.textContent=favorites.includes(id)?'★ 已收藏':'☆ 收藏';toast(favorites.includes(id)?'已加入我的收藏':'已取消收藏');if(isFavorites)renderModule('favorites');});if($('#browse-guides'))$('#browse-guides').onclick=()=>navigate('guides');
}
