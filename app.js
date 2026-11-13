/* Browser-local doctor experience. Videos use portrait motion with generated narration. */
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('medlink-'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('medlink-'+key,JSON.stringify(value));return true;}catch{toast('历史记录未保存，请检查浏览器存储空间');return false;}}};
let doctor=storage.get('doctor',{name:'张医生',department:'心血管内科',hospital:'医伴学术中心'});
if(doctor.hospital==='医伴示范医院')doctor.hospital='医伴学术中心';
let sessions=storage.get('sessions',[]),activeSession=null,currentPage='home',answering=false,requestSession=null;
let activeVideo=0,muted=true,feedObserver,toastTimer,recognition=null,voiceEpoch=0,listening=false;
let pendingBack=false;const ignoredCloses=new WeakSet();
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageTitles={home:'首页',patientInsights:'患者洞察',mine:'我的',history:'问答记录'};
const timeLabel=value=>{const s=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function answerFor(question){
 if(/支付|保险|申请|理赔|权益/.test(question))return {title:'创新支付资料核对',body:'可先核对具体服务规则、申请条件与材料清单，再梳理提交方式、审核进度与需要补充的资料。\n\n具体权益与服务结果需结合实际规则和审核反馈确认。',page:'drug',action:'查看药品资料'};
 if(/指南|文献|研究|循证/.test(question))return {title:'循证资料的阅读路径',body:'可以先明确临床问题，再核对资料来源、研究人群、结果与适用范围。\n\n阅读时记录原文出处、发表时间和资料版本，便于查阅与复核。',page:'drug',action:'查看药品资料'};
 if(/相互作用|合用|联合/.test(question))return {title:'药物相互作用资料核对',body:'先确认完整的合并用药信息，包括处方药、非处方药与补充剂，再查阅具体产品的获批说明书。\n\n可逐项记录资料来源、相关提示和限制条件。具体用药组合需结合患者背景，由医生进行专业评估。',page:'drug',action:'查看药品资料'};
 if(/剂量|用法|用量|特殊|人群|治疗|不良|反应|安全/.test(question))return {title:'日达仙用药资料核对要点',body:'请先核对具体产品的获批说明书及版本，再按问题查阅用法用量、注意事项、不良反应、特殊人群或相互作用条目。\n\n具体用药信息需以获批说明书为准，并结合患者背景核对相应资料。',page:'drug',action:'查看药品资料'};
 if(/代表|联系/.test(question))return {title:'与您的专属代表交流',body:'您可以在视频下方点击“联系我”，或从“我的”联系专属代表。\n\n也可以先整理您需要的资料名称、关注问题与原文出处，方便后续交流。',page:'contact',action:'联系我'};
 if(!/药|日达仙|阅读|资料|信息|你好|您好/.test(question))return {title:'我专注于日达仙相关资料',body:'您可以询问药品资料的查阅方式、用药信息核对要点与相关研究的阅读问题。',page:'drug',action:'查看药品资料'};
 return {title:'日达仙资料阅读清单',body:'可以按“药品基本信息 → 获批说明书 → 注意事项 → 关联证据”依次查阅。\n\n重点核对适应症、用法用量、禁忌、注意事项及相互作用，并保留资料版本与出处。',page:'drug',action:'查看药品资料'};
}
function followUps(question){const candidates=/支付|保险|申请|权益/.test(question)?['申请材料需要核对哪些内容？','如何整理服务进度的核对清单？','服务权益应如何确认？','材料不齐时需要补充什么？']:/指南|研究|文献|循证/.test(question)?['如何核对资料的原始出处？','如何判断研究人群是否适用？','如何记录资料版本和阅读要点？','研究结果不同应如何梳理？']:['合并用药需要核对哪些资料？','如何核对特殊人群的说明书条目？','日达仙资料版本与出处怎么核对？','用药安全有哪些资料核对要点？'];return candidates.filter(item=>item!==question).slice(0,3);}
// Refresh old assistant actions while preserving the doctor's own questions.
if(!Array.isArray(sessions))sessions=[];
if(storage.get('content-version',0)<7){sessions=sessions.filter(session=>Array.isArray(session.messages));for(const session of sessions){let question='';for(const message of session.messages){if(message.role==='user')question=message.text||'';else if(message.role==='assistant'){message.answer=answerFor(question);message.followUps=followUps(question);}}}storage.set('sessions',sessions);storage.set('content-version',7);}
function state(){return history.state||{page:'home'};}
function commitState(next,replace=false){history[replace?'replaceState':'pushState'](next,'');applyState(next);}
function closeDialog(dialog){if(dialog.open){ignoredCloses.add(dialog);dialog.close();}}
function applyState(next){
 const page=Object.hasOwn(pageTitles,next.page)?next.page:'home',changed=page!==currentPage;
 currentPage=page;document.body.dataset.page=page;$('#page-subtitle').textContent=pageTitles[page];$('#home-page').hidden=page!=='home';$('#module-page').hidden=page==='home';
 if(changed||page==='history')renderModule(page);
 const composer=page==='home'&&!!next.composer,locked=page!=='home'||composer||!!next.answer||!!next.modal||!!next.drawer;$('#video-feed').inert=locked;$('#video-feed').classList.toggle('feed-locked',locked);$('#ask-banner').hidden=!composer;$('#ask-open').hidden=page!=='home'||composer||!!next.answer||!!next.modal||!!next.drawer;$('#ask-open').setAttribute('aria-expanded',String(composer));$('#profile').setAttribute('aria-expanded',String(!!next.drawer));if(!next.drawer)closeDialog($('#profile-drawer'));else if(!$('#profile-drawer').open)$('#profile-drawer').showModal();
 if(!next.modal)closeDialog($('#modal'));else if(!$('#modal').open)$('#modal').showModal();
 if(!next.answer)closeDialog($('#answer-sheet'));else{if(next.sessionId){const saved=sessions.find(session=>session.id===next.sessionId);if(saved)activeSession=saved;}renderAnswers();if(!$('#answer-sheet').open)$('#answer-sheet').showModal();}
 if(page!=='home'||composer||next.answer||next.modal||next.drawer){pauseVideos();if(!composer)stopVoice();}else playActiveVideo();
 if(changed)window.scrollTo({top:0,behavior:'instant'});
 updateKeyboard();
}
function navigate(page,options={}){if(!Object.hasOwn(pageTitles,page))page='home';stopVoice();if(options.fromHistory)applyState({...options,page});else{if(page===currentPage&&state().drawer){requestClose('drawer');return;}if(page===currentPage&&!state().answer&&!state().modal&&!state().composer&&!state().drawer&&!options.replace)return;commitState({page},!!options.replace||!!state().drawer);}}
window.addEventListener('popstate',event=>{pendingBack=false;applyState(event.state||{page:'home'});});
function requestClose(kind){if(kind==='composer')stopVoice();if(state()[kind]){if(!pendingBack){pendingBack=true;history.back();}}else applyState({...state(),[kind]:false});}
for(const [id,kind] of [['modal','modal'],['answer-sheet','answer'],['profile-drawer','drawer']]){
 const dialog=$('#'+id);dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose(kind);});
 dialog.addEventListener('close',()=>{if(ignoredCloses.has(dialog)){ignoredCloses.delete(dialog);return;}if(state()[kind])requestClose(kind);});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)requestClose(kind);});
}
let sheetStart=null;
$('.answer-sheet-head').addEventListener('touchstart',event=>{sheetStart=event.touches[0].clientY;},{passive:true});
$('.answer-sheet-head').addEventListener('touchend',event=>{if(sheetStart!==null&&event.changedTouches[0].clientY-sheetStart>95)requestClose('answer');sheetStart=null;},{passive:true});
function showModal(title,body,call=false){pauseVideos();stopVoice();$('#modal').classList.toggle('call-sheet',call);$('#modal-title').textContent=title;$('#modal-content').innerHTML=body;if(!state().modal)commitState({...state(),modal:true});else applyState(state());}
function openDialer(){showModal('联系林晓',`<div class="call-person"><img src="assets/representative.png" alt="林晓"><h2>林晓</h2><div class="call-number">138 0000 0000</div></div><div class="call-actions"><button id="cancel-call">取消</button><a href="tel:13800000000">${icon('phone')}呼叫</a></div>`,true);$('#cancel-call').onclick=()=>requestClose('modal');}
function showDrugInfo(){showModal('日达仙 · 药品资料','<h3>说明书信息</h3><p>药品名称、规格、适应症、用法用量、禁忌、注意事项、不良反应与相互作用。</p><h3>资料核对</h3><p>核对获批说明书及资料版本，保留来源与原文位置。</p>');}
function renderFeed(){
 $('#video-feed').innerHTML=VIDEO_FEED.map((clip,index)=>`<article class="feed-slide" data-video-index="${index}" aria-label="${esc(clip.title)}"><video class="feed-media" data-index="${index}" playsinline muted loop preload="${index===0?'metadata':'none'}" poster="${esc(clip.poster)}" src="${esc(clip.src)}" aria-label="${esc(clip.title)}"></video><div class="feed-shade"></div><div class="feed-topline"><span class="feed-digital">AI 数字人</span><div class="feed-pages">${VIDEO_FEED.map((_,i)=>`<button data-feed-to="${i}" aria-label="切换到第 ${i+1} 个视频" class="${i===index?'active':''}"></button>`).join('')}</div></div><button class="video-play" data-toggle-video="${index}" aria-label="播放视频">${icon('play')}</button><div class="feed-story"><div class="feed-representative"><img src="assets/representative.png" alt=""><strong>${esc(clip.representative)}</strong><span>日达仙</span></div><h2>${esc(clip.title)}</h2><p class="feed-caption" data-caption="${index}">${esc(clip.captions[0]?.[1]||'')}</p></div><div class="feed-progress"><label class="sr-only" for="progress-${index}">视频进度</label><input type="range" id="progress-${index}" data-seek="${index}" min="0" max="100" value="0"><div><span data-time="${index}">00:00</span><span>${timeLabel(clip.duration)}</span></div></div><div class="feed-actions"><button data-mute="${index}" aria-label="开启声音">${icon('muted')}</button><button class="feed-contact" data-contact>${icon('phone')}联系我</button></div><p class="feed-media-status" data-media-status="${index}" role="status" hidden></p></article>`).join('');
 $$('.feed-media').forEach((media,index)=>{media.addEventListener('play',()=>syncVideoState(index));media.addEventListener('pause',()=>syncVideoState(index));media.addEventListener('timeupdate',()=>{const clip=VIDEO_FEED[index],caption=[...clip.captions].reverse().find(([start])=>media.currentTime>=start);$(`[data-caption="${index}"]`).textContent=caption?.[1]||clip.captions[0][1];$(`[data-time="${index}"]`).textContent=timeLabel(media.currentTime);$(`[data-seek="${index}"]`).value=media.duration?String(media.currentTime/media.duration*100):'0';});media.addEventListener('error',()=>{const message=$(`[data-media-status="${index}"]`);message.hidden=false;message.textContent='视频暂时无法播放，请轻触重试或切换下一个视频';syncVideoState(index);});media.addEventListener('click',()=>toggleVideo(index));});
 if(window.IntersectionObserver){feedObserver=new IntersectionObserver(entries=>{if(currentPage!=='home'||state().composer||state().answer||state().modal||state().drawer)return;const visible=entries.filter(entry=>entry.isIntersecting&&entry.intersectionRatio>=.65).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)activateVideo(Number(visible.target.dataset.videoIndex));},{root:$('#video-feed'),threshold:[.65,.85]});$$('.feed-slide').forEach(slide=>feedObserver.observe(slide));}
 let scrolling=false;$('#video-feed').addEventListener('scroll',()=>{if(scrolling)return;scrolling=true;requestAnimationFrame(()=>{scrolling=false;const height=$('#video-feed').clientHeight;if(height>0&&canPlay())activateVideo(Math.round($('#video-feed').scrollTop/height));});},{passive:true});
 $('#video-feed').addEventListener('keydown',event=>{if(event.target.matches('input,button'))return;if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();scrollToVideo(activeVideo+(event.key==='ArrowDown'?1:-1));}});
 syncVideoState(0);
}
function syncVideoState(index){const media=$$('.feed-media')[index],slide=media.closest('.feed-slide');slide.classList.toggle('is-playing',!media.paused);const button=$(`[data-toggle-video="${index}"]`);button.setAttribute('aria-label',media.paused?'播放视频':'暂停视频');button.innerHTML=icon(media.paused?'play':'pause');}
function pauseVideos(){for(const media of $$('.feed-media'))if(!media.paused)media.pause();}
function canPlay(){return currentPage==='home'&&!document.hidden&&!state().composer&&!state().answer&&!state().modal&&!state().drawer;}
async function playActiveVideo(){if(!canPlay())return;const media=$$('.feed-media')[activeVideo];if(!media)return;media.muted=muted;try{await media.play();}catch{syncVideoState(activeVideo);}}
function activateVideo(index){if(!Number.isInteger(index)||index<0||index>=VIDEO_FEED.length)return;if(index!==activeVideo){pauseVideos();activeVideo=index;const media=$$('.feed-media')[index];try{media.currentTime=0;}catch{}$$('.feed-slide').forEach((slide,i)=>slide.classList.toggle('is-active',i===index));}$('#feed-position').textContent=`第 ${index+1} 个视频，共 ${VIDEO_FEED.length} 个`;playActiveVideo();}
function scrollToVideo(index){index=Math.max(0,Math.min(VIDEO_FEED.length-1,index));$('#video-feed').scrollTo({top:index*$('#video-feed').clientHeight,behavior:reduceMotion?'instant':'smooth'});if(!$('#video-feed').clientHeight)activateVideo(index);}
async function toggleVideo(index){if(index!==activeVideo){activateVideo(index);return;}const media=$$('.feed-media')[index];if(!media.paused){media.pause();return;}try{await media.play();}catch{toast('视频暂时无法播放，请稍后重试');}}
function toggleMute(){muted=!muted;$$('.feed-media').forEach(media=>media.muted=muted);$$('[data-mute]').forEach(button=>{button.innerHTML=icon(muted?'muted':'volume');button.setAttribute('aria-label',muted?'开启声音':'静音');});playActiveVideo();}
function renderModule(page){
 const root=$('#module-page');if(page==='home')return;
 if(page==='patientInsights'){PatientInsights.render(root);return;}
 if(page==='mine'){root.innerHTML=`<div class="profile-card"><span class="avatar">${esc(doctor.name[0])}</span><div><h2>${esc(doctor.name)}</h2><p>${esc(doctor.department)}<br>${esc(doctor.hospital)}</p></div></div><div class="profile-links"><button class="profile-row" data-page="history">${icon('clock')}问答记录<span class="row-chevron">›</span></button><button class="profile-row" data-contact>${icon('phone')}我的专属代表<span class="row-chevron">›</span></button></div>`;return;}
 if(page==='history'){root.innerHTML=`<div class="history-toolbar"><h2>问答记录</h2><button class="text-button" data-new-chat>新建问答</button></div>`+(sessions.length?sessions.map(session=>`<button class="history-row" data-session="${esc(session.id)}"><div><b>${esc(session.title)}</b><small>${new Date(session.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${session.messages.filter(message=>message.role==='user').length} 次提问</small></div>${icon('arrow')}</button>`).join(''):'<div class="empty-state"><h3>暂无问答记录</h3><button class="primary-button" data-new-chat>开始提问</button></div>');}
}
function openComposer(){stopVoice();pauseVideos();const replace=!!state().answer;commitState({page:'home',composer:true},replace);$('#question').focus({preventScroll:true});}
function newConversation(){if(answering){toast('请等待当前回答完成');return;}activeSession=null;$('#question').value='';openComposer();}
function openAnswer(){pauseVideos();stopVoice();commitState({page:currentPage,answer:true,sessionId:activeSession?.id},!!state().composer);}
function renderAnswers(){
 let question='';const messages=activeSession?.messages||[];
 $('#answer-content').innerHTML=messages.map((message,index)=>{if(message.role==='user'){question=message.text;return `<div class="answer-question">${esc(message.text)}</div>`;}const answer=message.answer||answerFor(question),related=Array.isArray(message.followUps)&&message.followUps.length===3?message.followUps:followUps(question);return `<article class="answer-card"><div class="answer-person"><img src="assets/representative.png" alt="数字人助手"><strong>${esc(answer.title)}</strong></div><p>${esc(answer.body)}</p><div class="answer-tools"><button data-answer-action="${esc(answer.page||'drug')}">${esc(answer.action||'查看药品资料')} ›</button><button data-copy="${index}">复制回答</button></div><div class="answer-followups"><h3>猜你想问</h3>${related.map((text,i)=>`<button data-followup="${i}" data-answer-index="${index}" ${answering?'disabled':''}>${esc(text)}<span>›</span></button>`).join('')}</div></article>`;}).join('')+(answering&&requestSession===activeSession?.id?'<div class="answer-loading" role="status"><i></i><i></i><i></i><span>正在整理资料</span></div>':'');
 $('#answer-continue').disabled=answering;
}
async function askQuestion(raw){
 const text=String(raw||'').trim();if(!text||answering)return;stopVoice();pauseVideos();
 if(!activeSession){activeSession={id:crypto.randomUUID?.()||String(Date.now()),title:text,time:new Date().toISOString(),messages:[]};sessions.unshift(activeSession);}const session=activeSession;
 answering=true;requestSession=session.id;session.messages.push({role:'user',text,videoId:VIDEO_FEED[activeVideo].id});sessions=sessions.slice(0,30);storage.set('sessions',sessions);$('#question').value='';$('#send').disabled=true;
 if(!state().answer)openAnswer();else renderAnswers();$('#answer-content').scrollTop=$('#answer-content').scrollHeight;
 try{await new Promise(resolve=>setTimeout(resolve,650));const answer=answerFor(text);session.messages.push({role:'assistant',answer,followUps:followUps(text)});storage.set('sessions',sessions);}finally{answering=false;requestSession=null;$('#send').disabled=false;if($('#answer-sheet').open&&activeSession?.id===session.id){renderAnswers();const cards=$$('.answer-card',$('#answer-content'));cards.at(-1)?.scrollIntoView?.({behavior:reduceMotion?'instant':'smooth',block:'start'});}if(currentPage==='history')renderModule('history');}
}
function voiceStatus(text){$('#voice-status').textContent=text;$('#voice-status').hidden=!text;}
function syncVoice(){const button=$('#voice-input');button.classList.toggle('listening',listening);button.setAttribute('aria-pressed',String(listening));button.setAttribute('aria-label',listening?'结束语音输入':'语音输入');$('span',button).textContent=listening?'结束录音':'语音输入';}
function stopVoice(){voiceEpoch++;const old=recognition;recognition=null;listening=false;if(old){old.onresult=old.onerror=old.onend=null;try{old.abort();}catch{}}syncVoice();}
function startVoice(){
 if(listening){stopVoice();voiceStatus($('#question').value.trim()?'可修改识别文字后发送':'语音输入已结束');return;}
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){voiceStatus('当前浏览器不支持语音识别，可使用手机键盘的语音输入');return;}
 pauseVideos();const base=$('#question').value,epoch=++voiceEpoch;let heard=false;
 try{recognition=new Recognition();recognition.lang='zh-CN';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
 recognition.onresult=event=>{if(epoch!==voiceEpoch||!state().composer)return;let transcript='';for(let i=0;i<event.results.length;i++)transcript+=event.results[i][0].transcript;$('#question').value=(base?base+' ':'')+transcript;heard=!!transcript.trim();voiceStatus('识别中，可在结束后修改文字');};
 recognition.onerror=event=>{if(epoch!==voiceEpoch)return;const message=event.error==='not-allowed'||event.error==='service-not-allowed'?'请允许麦克风权限，或改用文字输入':event.error==='no-speech'?'未听清，请再试一次':'语音识别暂时不可用，请重试或使用文字输入';stopVoice();voiceStatus(message);};
 recognition.onend=()=>{if(epoch!==voiceEpoch)return;recognition=null;listening=false;syncVoice();voiceStatus(heard?'识别完成，可修改后发送':'未识别到文字，请重试或直接输入');};
 recognition.start();listening=true;syncVoice();voiceStatus('正在聆听，请说出您的问题…');
 }catch{stopVoice();voiceStatus('无法启动语音识别，请重试或使用文字输入');}
}
function updateKeyboard(){const vv=window.visualViewport,offset=vv?Math.max(0,innerHeight-vv.height-vv.offsetTop):0,active=state().composer&&offset>100;document.documentElement.style.setProperty('--keyboard-offset',active?offset+'px':'0px');document.body.classList.toggle('keyboard-open',active);}
$('#doctor-header').textContent=doctor.name;$('#doctor-avatar').textContent=doctor.name[0];$('#drawer-title').textContent=doctor.name;$('#drawer-avatar').textContent=doctor.name[0];
$('#profile').onclick=()=>{const wasListening=listening;stopVoice();if(wasListening)voiceStatus($('#question').value.trim()?'可修改识别文字后发送':'语音输入已结束');pauseVideos();if(!state().drawer)commitState({...state(),drawer:true});};$('#drawer-close').onclick=()=>requestClose('drawer');
$('#ask-open').onclick=()=>{voiceStatus('');openComposer();};$('#ask-close').onclick=()=>requestClose('composer');$('#voice-input').onclick=startVoice;
$('#chat-form').onsubmit=event=>{event.preventDefault();askQuestion($('#question').value);};
$('#question').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();askQuestion(event.target.value);}});
$('#question').addEventListener('input',event=>{if(listening&&event.isTrusted)stopVoice();});
$('#question').addEventListener('focus',updateKeyboard);$('#question').addEventListener('blur',()=>setTimeout(updateKeyboard,0));window.visualViewport?.addEventListener('resize',updateKeyboard);window.visualViewport?.addEventListener('scroll',updateKeyboard);
$('#answer-close').onclick=()=>requestClose('answer');$('#modal-close').onclick=()=>requestClose('modal');$('#answer-continue').onclick=openComposer;$('#new-question').onclick=newConversation;
$('#back').onclick=()=>{if(currentPage!=='home'&&history.length>1)history.back();else navigate('home',{replace:true});};$('.brand').onclick=event=>{event.preventDefault();navigate('home');};
document.addEventListener('click',async event=>{
 const target=event.target.closest('button,a');if(!target)return;
 if(target.dataset.page){navigate(target.dataset.page);return;}
 if(target.dataset.toggleVideo!==undefined){toggleVideo(Number(target.dataset.toggleVideo));return;}
 if(target.dataset.feedTo!==undefined){scrollToVideo(Number(target.dataset.feedTo));return;}
 if(target.dataset.mute!==undefined){toggleMute();return;}
 if(target.hasAttribute('data-contact')){openDialer();return;}
 if(target.hasAttribute('data-new-chat')){newConversation();return;}
 if(target.dataset.session){if(answering){toast('请等待当前回答完成');return;}activeSession=sessions.find(session=>session.id===target.dataset.session)||null;if(activeSession)openAnswer();return;}
 if(target.dataset.followup!==undefined){const index=Number(target.dataset.answerIndex),message=activeSession?.messages[index],prior=activeSession?.messages[index-1];if(message?.answer){const related=message.followUps||followUps(prior?.text||'');askQuestion(related[Number(target.dataset.followup)]);}return;}
 if(target.dataset.answerAction){if(target.dataset.answerAction==='contact')openDialer();else showDrugInfo();return;}
 if(target.dataset.copy!==undefined){const answer=activeSession?.messages[Number(target.dataset.copy)]?.answer;if(answer){try{await navigator.clipboard.writeText(answer.title+'\n'+answer.body);toast('回答已复制');}catch{toast('请长按回答文字复制');}}}
});
$('#video-feed').addEventListener('input',event=>{if(event.target.dataset.seek===undefined)return;const media=$$('.feed-media')[Number(event.target.dataset.seek)];if(Number.isFinite(media.duration))media.currentTime=Number(event.target.value)/100*media.duration;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseVideos();stopVoice();}else playActiveVideo();});
window.addEventListener('pagehide',()=>{pauseVideos();stopVoice();});
window.addEventListener('resize',()=>{const feed=$('#video-feed');if(feed.clientHeight)feed.scrollTo({top:activeVideo*feed.clientHeight,behavior:'instant'});});
history.scrollRestoration='manual';history.replaceState({page:'home'},'');renderFeed();applyState({page:'home'});
