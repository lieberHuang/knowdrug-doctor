(() => {
'use strict';
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calendar='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-12 5h6"/></svg>';
const time=v=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
const day=v=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',day:'numeric'}).format(new Date(v)).replace('日','');
const month=v=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric'}).format(new Date(v));
let host,state,route='',id='',filter='all',type='all',audience='all',selected=new Set(),search='',busy=false,connectionError='',refreshing=false,refreshTimer;
const isRep=()=>host?.role==='representative';
const doctorId=()=>state?.doctors.find(d=>d.name===host?.currentDoctor?.().name)?.id||'d1';
const delivery=m=>state?.deliveries.find(d=>d.meetingId===m.id&&d.doctorId===doctorId());
const deliveries=m=>state.deliveries.filter(d=>d.meetingId===m.id);
const closed=m=>Date.now()>new Date(m.deadline).getTime();
const over=m=>Date.now()>new Date(m.end).getTime();
const count=m=>deliveries(m).filter(d=>d.registration).length;
const kind=m=>m.type==='online'?'线上会议':'线下会议';
const tag=(text,extra='')=>`<span class="mt-tag ${extra}">${h(text)}</span>`;
function status(m,d){if(d?.registration)return '已报名';if(over(m))return '已结束';if(closed(m))return '报名截止';if(d?.response==='declined')return '不参加';if(d?.response==='interested')return '待报名';return '待回复';}
function go(page,meetingId='',replace=false){host.go(page,meetingId,replace);}
function empty(text,sub=''){return `<div class="mt-empty">${calendar}<h3>${h(text)}</h3>${sub?`<p>${h(sub)}</p>`:''}</div>`;}
function homeMarkup(){return `<button class="mt-home-entry" data-meeting-action="list"><span class="mt-home-icon">${calendar}</span><strong>${isRep()?'会议管理':'我的会议'}</strong><span data-meeting-home-count></span><span class="mt-chevron">›</span></button>`;}
function updateHome(){const slots=$$('[data-meeting-home-count]');if(!state)return;const unread=isRep()?state.meetings.filter(m=>!closed(m)&&!deliveries(m).length).length:state.deliveries.filter(d=>d.doctorId===doctorId()&&!d.readAt).length;slots.forEach(el=>{el.textContent=unread?`${unread}${isRep()?'场待邀请':'条新邀请'}`:'';});}
function badges(m){return `${tag(kind(m),m.type)}${tag(m.drug,'drug')}`;}
function card(m){const ds=deliveries(m),d=delivery(m);return `<button class="mt-card" data-meeting-action="detail" data-mid="${m.id}"><span class="mt-date"><b>${day(m.start)}</b><span>${month(m.start)}</span></span><span class="mt-card-body"><span class="mt-tags">${badges(m)}${!isRep()&&d&&!d.readAt?tag('未读','unread'):''}</span><h3>${h(m.title)}</h3><span class="mt-meta">${time(m.start)} – ${time(m.end).split(' ')[1]||'16:00'}</span><span class="mt-location">${h(m.location)}</span><span class="mt-card-footer">${isRep()?`<span>${over(m)?'已结束':closed(m)?'报名截止':ds.length?'已邀请 '+ds.length+' 位医生':'待邀请'}</span><span>${ds.filter(d=>d.readAt).length} 已查看 · ${count(m)} 已报名</span>`:`<span class="mt-state ${d?.registration?'positive':''}">${status(m,d)}</span><span>林晓邀请</span>`}</span></span></button>`;}
function list(){
 const meetings=isRep()?state.meetings:state.meetings.filter(m=>delivery(m));
 const filtered=meetings.filter(m=>(type==='all'||m.type===type)&&(isRep()?(filter!=='sent'||deliveries(m).length):(filter!=='registered'||delivery(m).registration)&&(filter!=='pending'||!closed(m)&&delivery(m).response!=='declined'&&!delivery(m).registration)));
 return `<div class="mt-heading"><h2>${isRep()?'会议中心':'我的会议'}</h2><button class="mt-text" data-meeting-action="refresh" aria-label="刷新会议">刷新</button></div><div class="mt-segments" role="group" aria-label="会议列表范围">${(isRep()?[['all','后台会议'],['sent','已邀请']]:[['all','全部邀请'],['pending','待处理'],['registered','已报名']]).map(([value,label])=>`<button data-meeting-filter="${value}" aria-pressed="${filter===value}" class="${filter===value?'active':''}">${label}</button>`).join('')}</div><div class="mt-chips" role="group" aria-label="会议类型">${[['all','全部'],['online','线上会议'],['offline','线下会议']].map(([value,label])=>`<button data-meeting-type="${value}" aria-pressed="${type===value}" class="${type===value?'active':''}">${label}</button>`).join('')}</div><div class="mt-list">${filtered.length?filtered.map(card).join(''):empty('暂无符合条件的会议')}</div>`;
}
function info(m){return `<section class="mt-detail-head"><div class="mt-tags">${badges(m)}${closed(m)?tag(over(m)?'已结束':'报名截止','neutral'):tag('报名中','positive')}</div><h2>${h(m.title)}</h2><dl class="mt-info"><div><dt>会议时间</dt><dd>${time(m.start)} – ${time(m.end).split(' ')[1]||'16:00'}</dd></div><div><dt>${m.type==='online'?'会议形式':'会议地点'}</dt><dd>${h(m.location)}<span>${h(m.address)}</span></dd></div><div><dt>报名截止</dt><dd>${time(m.deadline)}</dd></div><div><dt>组织方</dt><dd>${h(m.organizer)}</dd></div><div><dt>报名名额</dt><dd>${m.capacity} 位</dd></div></dl></section>`;}
function agenda(m){return `<section class="mt-section"><h3>会议介绍</h3><p class="mt-copy">${h(m.intro)}</p><h3 class="mt-agenda-title">会议议程</h3><ol class="mt-agenda">${m.agenda.map(([t,label])=>`<li><time>${h(t)}</time><span>${h(label)}</span></li>`).join('')}</ol></section>`;}
function doctorActions(m,d){
 if(d.registration)return `<section class="mt-ticket"><div class="mt-ticket-head"><span class="mt-check">✓</span><div><h3>报名成功</h3><p>报名编号 ${h(d.registration.code)}</p></div></div><div class="mt-ticket-name">${h(d.registration.name)}<span>${h(d.registration.hospital)} · ${h(d.registration.department)}</span></div>${m.type==='online'?'<div class="mt-access">线上会议入口将于会前30分钟开放，请留意会议安排。</div>':`<div class="mt-access">请于开场前15分钟到达${h(m.address)}签到。</div>`}<button class="mt-text" data-meeting-action="registration-info">查看报名信息</button>${!closed(m)?'<button class="mt-text danger" data-meeting-action="cancel">取消报名</button>':''}</section>`;
 if(closed(m))return `<section class="mt-section">${empty(over(m)?'会议已结束':'报名已截止',d.response==='declined'?'您已选择不参加本次会议。':'如需了解后续安排，请联系您的代表。')}</section>`;
 if(d.response==='interested')return `<section class="mt-section mt-intent"><span class="mt-check">✓</span><h3>已确认参加，请完成报名</h3><p>填写报名信息后，才会为您保留席位。</p><button class="mt-primary full" data-meeting-action="register">填写报名信息</button><button class="mt-text" data-meeting-action="decline">改为不参加</button></section>`;
 if(d.response==='declined')return `<section class="mt-section mt-intent"><h3>您已选择不参加</h3><button class="mt-secondary full" data-meeting-action="interested">改为参加并报名</button></section>`;
 return `<section class="mt-section mt-intent"><h3>是否参加本次会议？</h3><div class="mt-actions"><button class="mt-secondary" data-meeting-action="decline">暂不参加</button><button class="mt-primary" data-meeting-action="interested">参加并报名</button></div></section>`;
}
function stats(m){const ds=deliveries(m);return `<div class="mt-stats">${[[ds.length,'已邀请'],[ds.filter(d=>d.readAt).length,'已查看'],[ds.filter(d=>d.response==='interested').length,'愿参加'],[count(m),'已报名']].map(([n,label])=>`<div><b>${n}</b><span>${label}</span></div>`).join('')}</div>`;}
function audienceRows(m){
 const ds=deliveries(m).filter(d=>audience==='all'||audience==='unread'&&!d.readAt||audience==='read'&&d.readAt||audience==='interested'&&d.response==='interested'&&!d.registration||audience==='registered'&&d.registration||audience==='declined'&&d.response==='declined');
 return ds.length?ds.map(d=>{const doctor=state.doctors.find(x=>x.id===d.doctorId);return `<article class="mt-doctor-status"><div class="mt-person"><span class="mt-person-avatar">${h(doctor.name[0])}</span><div><h4>${h(doctor.name)}</h4><p>${h(doctor.hospital)} · ${h(doctor.department)}</p></div>${d.registration?`<button class="mt-text" data-meeting-action="recipient-info" data-did="${d.doctorId}">报名信息</button>`:''}</div><div class="mt-status-grid"><div><span>阅读</span><b class="${d.readAt?'positive':''}">${d.readAt?'已查看':'未查看'}</b></div><div><span>参与意向</span><b>${{pending:'待回复',interested:'愿参加',declined:'不参加'}[d.response]}</b></div><div><span>报名</span><b class="${d.registration?'positive':''}">${d.registration?'已报名':d.response==='interested'?'待报名':'—'}</b></div></div><details class="mt-timeline"><summary>查看时间记录</summary><p>邀请发送：${time(d.sentAt)}</p>${d.readAt?`<p>首次查看：${time(d.readAt)}</p>`:''}${d.respondedAt?`<p>意向回复：${time(d.respondedAt)}</p>`:''}${d.registration?`<p>报名提交：${time(d.registration.at)}</p>`:''}</details></article>`;}).join(''):empty('暂无对应的医生');
}
function representativeDetail(m){const ds=deliveries(m);return `${info(m)}${stats(m)}<section class="mt-section"><div class="mt-section-heading"><h3>邀请医生</h3><button class="mt-text" data-meeting-action="refresh" aria-label="刷新会议状态">刷新</button><button class="mt-text" data-meeting-action="send" ${closed(m)?'disabled':''}>${ds.length?'继续邀请':'选择医生'}</button></div>${ds.length?`<div class="mt-audience-filter" role="group" aria-label="医生状态筛选">${[['all','全部'],['unread','未查看'],['read','已查看'],['interested','待报名'],['registered','已报名'],['declined','不参加']].map(([value,label])=>`<button data-meeting-audience="${value}" aria-pressed="${audience===value}" class="${audience===value?'active':''}">${label}</button>`).join('')}</div><div id="mt-audience-list">${audienceRows(m)}</div>`:empty(closed(m)?'暂无邀请记录':'尚未邀请医生',closed(m)?'本次会议已截止报名。':'选择医生，发送本次会议邀请。')}</section>${!closed(m)?`<button class="mt-primary full mt-bottom-action" data-meeting-action="send">${ds.length?'继续邀请医生':'选择医生并发送邀请'}</button>`:''}${agenda(m)}`;}
function detail(){const m=state.meetings.find(m=>m.id===id);if(!m)return empty('未找到这场会议');if(isRep())return representativeDetail(m);const d=delivery(m);if(!d)return empty('尚未收到此会议邀请');return `${info(m)}${doctorActions(m,d)}${agenda(m)}`;}
function sendRows(){const m=state.meetings.find(m=>m.id===id);return state.doctors.filter(d=>(d.name+d.hospital+d.department).includes(search)).map(d=>{const sent=deliveries(m).some(x=>x.doctorId===d.id);return `<label class="mt-select-doctor ${sent?'sent':''}"><input type="checkbox" name="meeting-doctor" value="${d.id}" ${sent?'checked disabled':selected.has(d.id)?'checked':''}><span class="mt-person-avatar">${h(d.name[0])}</span><span class="mt-select-copy"><strong>${h(d.name)}</strong><span>${h(d.hospital)} · ${h(d.department)}</span></span>${sent?tag('已邀请','neutral'):''}</label>`;}).join('')||empty('没有找到医生');}
function sendPage(){const m=state.meetings.find(m=>m.id===id);if(!m)return empty('会议不存在');if(closed(m))return empty('报名已截止，无法继续邀请');return `<section class="mt-send-summary">${badges(m)}<h2>${h(m.title)}</h2><p>${time(m.start)}</p></section><label class="mt-search"><span>搜索医生</span><input id="mt-doctor-search" type="search" placeholder="姓名、医院或科室" value="${h(search)}" aria-label="搜索邀请医生"></label><div class="mt-section-heading mt-selection"><h3>选择接收医生</h3><button class="mt-text" data-meeting-action="select-all">全选未邀请医生</button></div><div class="mt-select-list" id="mt-select-list">${sendRows()}</div><div class="mt-send-footer"><span id="mt-selected-count">已选择 ${selected.size} 位医生</span><button class="mt-primary" data-meeting-action="send-review" ${selected.size?'':'disabled'}>发送邀请</button></div>`;}
function registerPage(){const m=state.meetings.find(m=>m.id===id),d=m&&delivery(m);if(!m||!d)return empty('尚未收到会议邀请');if(d.registration||closed(m))return detail();const person={...state.doctors.find(d=>d.id===doctorId()),...host.currentDoctor?.()};return `<section class="mt-send-summary">${badges(m)}<h2>${h(m.title)}</h2><p>${time(m.start)}</p></section><form id="mt-registration" novalidate><section class="mt-section mt-form"><h3>报名信息</h3><label for="mt-name">姓名<span>*</span></label><input id="mt-name" name="name" value="${h(person.name)}" maxlength="60" autocomplete="name" required><label for="mt-hospital">医院<span>*</span></label><input id="mt-hospital" name="hospital" value="${h(person.hospital)}" maxlength="60" autocomplete="organization" required><label for="mt-department">科室<span>*</span></label><input id="mt-department" name="department" value="${h(person.department)}" maxlength="60" required><label for="mt-phone">手机号<span>*</span></label><input id="mt-phone" name="phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="用于接收本次会议通知" required><p class="mt-field-error" id="mt-form-error" role="alert" hidden></p></section><label class="mt-consent"><input name="consent" type="checkbox"><span>我确认报名信息准确，同意将以上信息用于本次会议报名与会务联系。</span></label><button class="mt-primary full" type="submit">提交报名</button></form>`;}
function render(){
 if(!host||!route)return;const root=host.root();if(!root)return;
 root.classList.add('mt-root');root.innerHTML=!state?`<div class="mt-empty"><h3>${connectionError?'会议暂时连接不上':'正在加载会议…'}</h3>${connectionError?'<p>请检查网络及浏览器的站点存储设置后重试。</p><button class="mt-primary" data-meeting-action="refresh">重新连接</button>':''}</div>`:route==='meetings'?list():route==='meetingSend'?sendPage():route==='meetingRegister'?registerPage():detail();
}
async function load(force=false){
 if(refreshing)return;refreshing=true;
 try{const next=await MeetingHub.request('snapshot');const changed=next.revision!==state?.revision;state=next;connectionError='';if(!isRep()&&route==='meetingDetail'){const m=state.meetings.find(m=>m.id===id),d=m&&delivery(m);if(d&&!d.readAt)state=await MeetingHub.request('read',{meetingId:id,doctorId:doctorId()});}updateHome();if(force||changed&&route&&!['meetingRegister','meetingSend'].includes(route))render();return next;}catch(e){connectionError=e.message;if(!state)render();if(force)host.toast('会议连接失败，请重试');}finally{refreshing=false;}
}
async function mutate(op,args){if(busy)return null;busy=true;try{const result=await MeetingHub.request(op,args);state=result.state||result;updateHome();return result;}catch(e){host.toast(e.message);return null;}finally{busy=false;}}
function registrationInfo(doctorId){const m=state.meetings.find(m=>m.id===id),d=deliveries(m).find(d=>d.doctorId===doctorId),r=d?.registration;if(!r)return;host.modal('报名信息',`<div class="mt-root"><h3>${h(m.title)}</h3><dl class="mt-info"><div><dt>姓名</dt><dd>${h(r.name)}</dd></div><div><dt>医院</dt><dd>${h(r.hospital)}</dd></div><div><dt>科室</dt><dd>${h(r.department)}</dd></div><div><dt>手机号</dt><dd>${h(r.phone.replace(/(\d{3})\d{4}(\d{4})/,'$1 **** $2'))}</dd></div><div><dt>报名编号</dt><dd>${h(r.code)}</dd></div><div><dt>报名时间</dt><dd>${time(r.at)}</dd></div></dl></div>`);}
async function respond(value){const result=await mutate('respond',{meetingId:id,doctorId:doctorId(),response:value});if(!result)return;host.toast(value==='interested'?'已确认参加，请完成报名':'已回复不参加');if(value==='interested')go('meetingRegister',id);else render();}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-meeting-action],[data-meeting-filter],[data-meeting-type],[data-meeting-audience]');if(!b||!host||b.disabled)return;
 if(b.dataset.meetingFilter){filter=b.dataset.meetingFilter;render();return;}
 if(b.dataset.meetingType){type=b.dataset.meetingType;render();return;}
 if(b.dataset.meetingAudience){audience=b.dataset.meetingAudience;await load();render();return;}
 const action=b.dataset.meetingAction;
 if(action==='list'){filter='all';type='all';go('meetings');return;}
 if(action==='detail'){audience='all';go('meetingDetail',b.dataset.mid);return;}
 if(action==='refresh'){await load(true);return;}
 if(!state){host.toast('会议尚未连接，请稍后重试');return;}
 const m=state.meetings.find(m=>m.id===id);
 if(action==='send'){selected=new Set();search='';go('meetingSend',id);}
 if(action==='select-all'){const available=state.doctors.filter(d=>(d.name+d.hospital+d.department).includes(search)&&!deliveries(m).some(x=>x.doctorId===d.id));const all=available.every(d=>selected.has(d.id));available.forEach(d=>all?selected.delete(d.id):selected.add(d.id));render();}
 if(action==='send-review'){
  if(!selected.size)return;const names=state.doctors.filter(d=>selected.has(d.id)).map(d=>d.name);
  host.modal('发送会议邀请',`<div class="mt-root"><h3>${h(m.title)}</h3><p class="mt-review-copy">将邀请 ${names.length} 位医生参加本次${kind(m)}。</p><div class="mt-review-names">${names.map(n=>tag(n)).join('')}</div><button class="mt-primary full" data-meeting-action="send-confirm">确认发送</button></div>`);
 }
 if(action==='send-confirm'){
  b.disabled=true;const result=await mutate('send',{meetingId:id,doctorIds:[...selected]});if(!result){b.disabled=false;return;}selected.clear();host.closeThen(()=>{go('meetingDetail',id,true);host.toast(`已发送给 ${result.sentCount} 位医生`);});
 }
 if(action==='interested')await respond('interested');
 if(action==='decline'){
  if(delivery(m).registration){host.toast('请先取消报名');return;}
  await respond('declined');
 }
 if(action==='register')go('meetingRegister',id);
 if(action==='registration-info')registrationInfo(doctorId());
 if(action==='recipient-info')registrationInfo(b.dataset.did);
 if(action==='cancel')host.modal('取消本次会议报名',`<div class="mt-root"><h3>${h(m.title)}</h3><p class="mt-review-copy">取消后将释放席位，并向代表回复“不参加”。报名截止前仍可重新报名。</p><button class="mt-primary full" data-meeting-action="cancel-confirm">确认取消报名</button></div>`);
 if(action==='cancel-confirm'){b.disabled=true;const result=await mutate('cancel',{meetingId:id,doctorId:doctorId()});if(result)host.closeThen(()=>{render();host.toast('已取消报名');});else b.disabled=false;}
});
document.addEventListener('input',e=>{if(e.target.id==='mt-doctor-search'){search=e.target.value.trim();$('#mt-select-list').innerHTML=sendRows();}});
document.addEventListener('change',e=>{if(e.target.name!=='meeting-doctor')return;const id=e.target.value;if(e.target.checked)selected.add(id);else selected.delete(id);$('#mt-selected-count').textContent=`已选择 ${selected.size} 位医生`;$('[data-meeting-action="send-review"]').disabled=!selected.size;});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='mt-registration')return;e.preventDefault();if(busy)return;
 const form=e.target,fields=new FormData(form),payload={name:fields.get('name').trim(),hospital:fields.get('hospital').trim(),department:fields.get('department').trim(),phone:fields.get('phone').trim(),consent:fields.get('consent')==='on'};
 let error='',target='';for(const field of ['name','hospital','department'])if(payload[field].length<2){error='请完整填写姓名、医院和科室';target='mt-'+field;break;}
 if(!error&&!/^1[3-9]\d{9}$/.test(payload.phone)){error='请填写正确的11位手机号';target='mt-phone';}
 if(!error&&!payload.consent)error='请确认报名信息的使用授权';
 if(error){const box=$('#mt-form-error');box.hidden=false;box.textContent=error;if(target)$('#'+target).focus();return;}
 const button=$('[type="submit"]',form);button.disabled=true;button.textContent='正在提交…';const result=await mutate('register',{meetingId:id,doctorId:doctorId(),form:payload});
 if(result){go('meetingDetail',id,true);host.toast('报名成功');}else{button.disabled=false;button.textContent='提交报名';}
});
window.Meetings={
 init(options){host=options;load();refreshTimer=setInterval(()=>{if(!document.hidden)load();},5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});window.addEventListener('focus',()=>load());window.addEventListener('storage',e=>{if(e.key==='knowdrug-meetings-v1')load();});window.addEventListener('meeting-state-updated',()=>{if(!busy)load();});},
 homeMarkup,
 render(nextRoute,meetingId){route=nextRoute;id=meetingId||'';render();if(!isRep()&&nextRoute==='meetingDetail'&&state){const m=state.meetings.find(m=>m.id===id),d=m&&delivery(m);if(d&&!d.readAt)mutate('read',{meetingId:id,doctorId:doctorId()}).then(()=>{if(route===nextRoute&&id===meetingId)render();});}load();},
 leave(){route='';host?.root()?.classList.remove('mt-root');updateHome();},
 refresh:()=>load()
};
})();
