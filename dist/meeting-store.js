/* Browser-local meeting workflow. Only the doctor origin owns the shared state. */
(() => {
'use strict';
const KEY='knowdrug-meetings-v1', CHANNEL='knowdrug-meeting-v1';
const DOCTOR_ORIGIN='https://medlink-doctor-jh1029.f4rb8jrv26.chatgpt.site';
const REP_ORIGIN='https://knowdrug-representative-jh1029.f4rb8jrv26.chatgpt.site';
const local=['localhost','127.0.0.1'].includes(location.hostname);
const ownerOrigin=local?location.protocol+'//'+location.hostname+':8080':DOCTOR_ORIGIN;
const bridgeMode=document.documentElement.hasAttribute('data-meeting-bridge');
const owner=bridgeMode||document.body?.dataset.meetingRole==='doctor';
const doctors=[['d1','张医生','心血管内科','仁和医院'],['d2','李医生','内分泌科','江城中心医院'],['d3','王医生','心血管内科','滨江医院'],['d4','陈医生','全科医学科','仁和医院'],['d5','刘医生','心血管内科','江城中心医院'],['d6','赵医生','内分泌科','滨江医院'],['d7','周医生','全科医学科','仁和医院'],['d8','吴医生','心血管内科','滨江医院'],['d9','郑医生','内分泌科','江城中心医院'],['d10','孙医生','全科医学科','仁和医院'],['d11','许医生','心血管内科','滨江医院'],['d12','林医生','内分泌科','江城中心医院']].map(([id,name,department,hospital])=>({id,name,department,hospital}));
function seed(){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const anchor=new Date(today+'T14:00:00+08:00').getTime();
 const at=(days,hours=0)=>new Date(anchor+days*86400000+hours*3600000).toISOString();
 const meeting=(id,type,title,days,location,address,capacity,agenda)=>({id,type,title,start:at(days),end:at(days,2),deadline:at(days-1,4),location,address,capacity,organizer:'知药学术支持团队',drug:'日达仙',issuedAt:at(-1,-4),intro:'围绕日达仙相关资料的查阅与学术沟通展开交流。请结合说明书、指南和研究原文参与讨论。',agenda});
 const meetings=[
 meeting('m1','offline','日达仙学术交流会',7,'上海 · 知药学术中心','二层学术会议厅',60,[['14:00','签到与开场'],['14:15','药品资料查阅路径'],['15:00','病例资料整理与交流'],['15:40','讨论与答疑']]),
 meeting('m2','online','日达仙循证文献研读',4,'知药线上会议室','报名后查看入会安排',100,[['14:00','阅读主题介绍'],['14:15','研究设计与证据解读'],['15:00','原文阅读讨论'],['15:40','交流与总结']]),
 meeting('m3','online','日达仙病例讨论工作坊',12,'知药线上会议室','报名后查看入会安排',40,[['14:00','病例资料准备'],['14:20','讨论问题梳理'],['15:00','分组交流'],['15:40','总结与答疑']]),
 meeting('m4','offline','日达仙学术资料阅读沙龙',-2,'杭州 · 知药学术空间','一层交流厅',30,[['14:00','签到'],['14:30','资料阅读与交流'],['15:30','讨论与总结']])
 ];
 const delivery=(meetingId,doctorId,read=false,response='pending')=>({meetingId,doctorId,sentAt:at(-1),readAt:read?at(-1,1):null,response,respondedAt:response!=='pending'?at(-1,2):null,registration:null});
 return {version:1,revision:1,doctors,meetings,deliveries:[delivery('m1','d1'),delivery('m1','d2',true,'interested'),delivery('m1','d3',true,'declined'),delivery('m2','d1'),delivery('m2','d4',true)]};
}
function get(){let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}if(!state||state.version!==1){state=seed();localStorage.setItem(KEY,JSON.stringify(state));}return state;}
function put(state){state.revision++;localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent('meeting-state-updated'));return state;}
function action(op,args={}){
 const s=get();if(op==='snapshot')return s;
 const m=s.meetings.find(m=>m.id===args.meetingId);if(!m)throw Error('会议不存在，请返回列表刷新');
 const closed=Date.now()>new Date(m.deadline).getTime();
 const d=s.deliveries.find(d=>d.meetingId===m.id&&d.doctorId===args.doctorId);
 const now=new Date().toISOString();
 if(op==='send'){
  if(closed)throw Error('会议已截止报名，无法继续邀请');
  const ids=[...new Set(args.doctorIds||[])];if(!ids.length||ids.some(id=>!s.doctors.some(d=>d.id===id)))throw Error('请选择有效的医生');
  const added=ids.filter(id=>!s.deliveries.some(d=>d.meetingId===m.id&&d.doctorId===id));
  if(!added.length)throw Error('所选医生已收到邀请，无需重复发送');
  added.forEach(doctorId=>s.deliveries.push({meetingId:m.id,doctorId,sentAt:now,readAt:null,response:'pending',respondedAt:null,registration:null}));
  return {state:put(s),sentCount:added.length};
 }
 if(!d)throw Error('尚未收到此会议邀请');
 if(op==='read'){if(!d.readAt){d.readAt=now;put(s);}return s;}
 if(op==='respond'){
  if(closed)throw Error('已截止报名，无法修改参与意向');
  if(!['interested','declined'].includes(args.response))throw Error('请选择参与意向');
  d.response=args.response;d.respondedAt=now;d.readAt=d.readAt||now;if(args.response==='declined')d.registration=null;return put(s);
 }
 if(op==='register'){
  if(closed)throw Error('报名已截止');
  if(d.registration)throw Error('您已报名，请勿重复提交');
  if(d.response!=='interested')throw Error('请先确认参加会议');
  if(s.deliveries.filter(x=>x.meetingId===m.id&&x.registration).length>=m.capacity)throw Error('报名名额已满');
  const r=args.form||{};
  for(const field of ['name','hospital','department'])if(typeof r[field]!=='string'||r[field].trim().length<2||r[field].trim().length>60)throw Error('请完整填写姓名、医院和科室');
  if(!/^1[3-9]\d{9}$/.test(r.phone||''))throw Error('请填写正确的11位手机号');
  if(r.consent!==true)throw Error('请确认报名信息的使用授权');
  d.readAt=d.readAt||now;d.registration={name:r.name.trim(),hospital:r.hospital.trim(),department:r.department.trim(),phone:r.phone,at:now,code:'KD'+m.id.slice(1)+args.doctorId.slice(1).padStart(3,'0'),consentAt:now};return put(s);
 }
 if(op==='cancel'){
  if(closed)throw Error('已截止报名，如需变更请联系代表');
  d.registration=null;d.response='declined';d.respondedAt=now;return put(s);
 }
 throw Error('操作不受支持');
}
if(bridgeMode){
 const allowed=[REP_ORIGIN];if(local)allowed.push(location.protocol+'//'+location.hostname+':8081');
 window.addEventListener('message',e=>{
  const p=e.data;if(e.source!==parent||!allowed.includes(e.origin)||p?.channel!==CHANNEL||typeof p.id!=='string')return;
  try{if(!['snapshot','send'].includes(p.op))throw Error('操作未获授权');e.source.postMessage({channel:CHANNEL,id:p.id,result:action(p.op,p.args)},e.origin);}catch(err){e.source.postMessage({channel:CHANNEL,id:p.id,error:err.message},e.origin);}
 });return;
}
let frame,seq=0;const pending=new Map();
function remote(op,args){
 if(!frame){frame=document.createElement('iframe');frame.src=ownerOrigin+'/meeting-bridge.html?v=20261103';frame.title='会议状态连接';frame.hidden=true;document.body.append(frame);}
 return new Promise((resolve,reject)=>{
  const id='q'+Date.now()+'-'+(++seq);const timer=setTimeout(()=>{pending.delete(id);reject(Error('会议连接超时，请重试，并确认浏览器允许站点存储'));},12000);
  pending.set(id,{resolve,reject,timer});
  const send=()=>frame.contentWindow.postMessage({channel:CHANNEL,id,op,args},ownerOrigin);
  if(frame.dataset.ready)send();else frame.addEventListener('load',()=>{frame.dataset.ready='1';send();},{once:true});
 });
}
window.addEventListener('message',e=>{if(e.origin!==ownerOrigin||e.source!==frame?.contentWindow||e.data?.channel!==CHANNEL)return;const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);clearTimeout(p.timer);if(e.data.error)p.reject(Error(e.data.error));else p.resolve(e.data.result);});
window.MeetingHub={request:async(op,args)=>owner?action(op,args):remote(op,args),ownerOrigin};
})();
