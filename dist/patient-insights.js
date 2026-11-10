/* Synthetic, anonymous fixtures for the doctor-facing display. */
window.PatientInsights = (() => {
  const topics = [
    {id:'payment', label:'支付与权益', prompts:['入组后在哪里查看支付权益？','申请支付支持要准备哪些资料？','怎么查看本次支付申请的进度？']},
    {id:'routine', label:'日常用药', prompts:['我想核对日达仙的用药记录，在哪里看？','出门前怎样整理日达仙的用药记录？','用药提醒可以在哪里设置？']},
    {id:'storage', label:'保存与携带', prompts:['日达仙的保存要求在哪份资料里看？','外出时携带日达仙，要向谁核实保存要求？']},
    {id:'followup', label:'复诊与随访', prompts:['下次复诊时需要带哪些用药记录？','在哪里查看之前的随访安排？','想和医生沟通近况，可以提前记录什么？']},
    {id:'support', label:'用药疑问', prompts:['有用药疑问时，如何联系我的医护团队？','在哪里看日达仙的说明书？']}
  ];
  const dateFormat = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
  const today = Date.parse(dateFormat.format(new Date()) + 'T00:00:00Z');
  const dayMs = 86400000;
  const date = offset => new Date(today - offset * dayMs).toISOString().slice(0,10);
  const patients = Array.from({length:32}, (_,index) => ({
    id:'P'+String(index+1).padStart(3,'0'),
    enrolled:date(index===0 ? 0 : 2*index+1),
    ended:index>=26 ? date(12+index%5) : null
  }));
  const topicOrder = [0,1,0,2,1,3,0,4,2,1,3,4,0];
  const records = Array.from({length:30}, (_,offset) => {
    const at=date(offset);
    const active=patients.filter(patient=>patient.enrolled<=at && (!patient.ended || at<=patient.ended));
    const volume=2+((offset*7+Math.floor(offset/3))%8);
    return Array.from({length:volume}, (_,index) => {
      const patient=active[(offset*3+index*5)%active.length];
      const topic=topics[topicOrder[(offset*7+index*3)%topicOrder.length]];
      return {patientId:patient.id, date:at, topic:topic.id, text:topic.prompts[(offset+index)%topic.prompts.length]};
    });
  }).flat();
  const dateLabel = iso => iso.slice(5).replace('-', '/');
  const topicLabel = id => topics.find(topic=>topic.id===id).label;
  const views = {days:7, topic:'all', status:'all', visible:6};

  function trend(days, questions) {
    const step=days===7 ? 1 : 5;
    const buckets=Array.from({length:Math.ceil(days/step)}, (_,index)=>{
      const start=date(days-1-index*step);
      const end=date(Math.max(0,days-(index+1)*step));
      const count=questions.filter(record=>record.date>=start && record.date<=end).length;
      return {start,end,count};
    });
    const max=Math.max(1,...buckets.map(bucket=>bucket.count));
    return `<div class="pi-chart" aria-label="提问量趋势">${buckets.map(({start,end,count})=>{
      const label=start===end ? dateLabel(start) : dateLabel(start)+'–'+dateLabel(end);
      return `<div class="pi-chart-column" aria-label="${label}，${count}次提问">
        <b>${count}</b><div class="pi-chart-track"><i style="--height:${100*count/max}%"></i></div>
        <span>${dateLabel(start)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function topicRows(ranked, total) {
    return ranked.map(({id,label,count})=>{
      const share=total ? Math.round(100*count/total) : 0;
      return `<button type="button" class="pi-topic" data-pi-topic="${id}" aria-pressed="${views.topic===id}">
        <span class="pi-topic-label"><strong>${label}</strong><span>${count} 次 · ${share}%</span></span>
        <span class="pi-topic-track" aria-hidden="true"><i style="--share:${share}%"></i></span>
      </button>`;
    }).join('');
  }

  function questionRows(questions) {
    const matching=questions.filter(record=>views.topic==='all' || record.topic===views.topic);
    const samples=[...new Map(matching.slice().reverse().map(record=>[record.text,record])).values()]
      .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
    if(!samples.length)return '<p class="pi-empty">该主题在所选时间内暂无提问。</p>';
    return `<ul class="pi-questions">${samples.map(record=>`<li>
      <p>${record.text}</p><small>${topicLabel(record.topic)} · ${dateLabel(record.date)}</small>
    </li>`).join('')}</ul>`;
  }

  function patientRows(questions) {
    const matching=patients.filter(patient=>views.status==='all' || (patient.ended?'ended':'active')===views.status);
    return `<div class="pi-patients">${matching.slice(0,views.visible).map(patient=>{
      const own=questions.filter(record=>record.patientId===patient.id);
      const labels=[...new Set(own.map(record=>topicLabel(record.topic)))];
      return `<details class="pi-patient">
        <summary><span><strong>${patient.id}</strong><small>${dateLabel(patient.enrolled)} 入组</small></span>
          <span class="pi-patient-state ${patient.ended?'is-ended':''}">${patient.ended?'已结项':'在组'}</span></summary>
        <div class="pi-patient-body"><p>近 ${views.days} 天提问 <b>${own.length}</b> 次</p>
          ${labels.length?`<p>关注主题 · ${labels.join('、')}</p><ul>${[...new Set(own.map(record=>record.text))].slice(0,2).map(text=>`<li>${text}</li>`).join('')}</ul>`:'<p>所选时间内暂无提问。</p>'}
        </div>
      </details>`;
    }).join('')}</div>
    ${views.visible<matching.length?`<button type="button" class="pi-more" data-pi-more>查看更多（剩余 ${matching.length-views.visible} 人）</button>`:''}`;
  }

  function render(root) {
    const {days,topic,status}=views;
    const questions=records.filter(record=>record.date>=date(days-1));
    const ranked=topics.map(item=>({...item,count:questions.filter(record=>record.topic===item.id).length}))
      .sort((a,b)=>b.count-a.count);
    const active=patients.filter(patient=>!patient.ended).length;
    const newEnrollments=patients.filter(patient=>patient.enrolled>=date(days-1)).length;
    const asking=new Set(questions.map(record=>record.patientId)).size;
    const leading=ranked[0];
    root.innerHTML=`<div class="pi-dashboard">
      <section class="pi-cohort" aria-labelledby="pi-cohort-title">
        <div class="pi-cohort-top"><span>日达仙</span><span class="pi-data-label">示例数据</span></div>
        <h2 id="pi-cohort-title">创新支付入组概况</h2>
        <p class="pi-cohort-total"><strong>${patients.length}</strong><span>人累计入组</span></p>
        <div class="pi-cohort-breakdown"><span>在组 <b>${active}</b> 人</span><span>已结项 <b>${patients.length-active}</b> 人</span></div>
      </section>

      <section class="pi-card" aria-labelledby="pi-activity-title">
        <div class="pi-card-title"><h2 id="pi-activity-title">单药品智能体洞察</h2></div>
        <div class="pi-segments" role="group" aria-label="统计周期">${[7,30].map(period=>`<button type="button" data-pi-period="${period}" aria-pressed="${days===period}">近 ${period} 天</button>`).join('')}</div>
        <p class="pi-muted pi-date-range">${date(days-1)} 至 ${date(0)}</p>
        <dl class="pi-metrics">
          <div><dt>新增入组</dt><dd>${newEnrollments}<small> 人</small></dd></div>
          <div><dt>提问患者</dt><dd>${asking}<small> 人</small></dd></div>
          <div><dt>提问总量</dt><dd>${questions.length}<small> 次</small></dd></div>
        </dl>
        <div class="pi-card-title pi-chart-title"><h3>提问量趋势</h3><span class="pi-muted">${days===7?'按日':'每 5 天汇总'}</span></div>
        ${trend(days,questions)}
      </section>

      <section class="pi-card" aria-labelledby="pi-topic-title">
        <div class="pi-card-title"><h2 id="pi-topic-title">患者关注主题</h2><span class="pi-muted">按提问次数排序</span></div>
        ${questions.length?`<p class="pi-summary">近 ${days} 天提问最多的是<strong>${leading.label}</strong>，共 ${leading.count} 次，占 ${Math.round(100*leading.count/questions.length)}%。</p>`:''}
        <div class="pi-topics" role="group" aria-label="按主题筛选提问样本">${topicRows(ranked,questions.length)}</div>
      </section>

      <section class="pi-card" aria-labelledby="pi-questions-title">
        <div class="pi-card-title"><h2 id="pi-questions-title">提问样本</h2>${topic==='all'?'<span class="pi-muted">最近 · 去重</span>':'<button type="button" class="pi-clear" data-pi-topic="all">查看全部</button>'}</div>
        ${topic!=='all'?`<p class="pi-filtered">${topicLabel(topic)}</p>`:''}
        ${questionRows(questions)}
      </section>

      <section class="pi-card" aria-labelledby="pi-patients-title">
        <div class="pi-card-title"><h2 id="pi-patients-title">匿名入组明细</h2></div>
        <div class="pi-segments" role="group" aria-label="入组状态">${[['all','全部'],['active','在组'],['ended','已结项']].map(([value,label])=>`<button type="button" data-pi-status="${value}" aria-pressed="${status===value}">${label}</button>`).join('')}</div>
        ${patientRows(questions)}
      </section>
      <details class="pi-method"><summary>数据口径</summary><p>本页为合成示例数据，仅展示创新支付入组人群及其单药品智能体提问。提问患者按匿名编号去重，主题占比按所选时段内提问次数计算。时间按北京时间统计，包含当天。</p></details>
    </div>`;
    const dashboard=root.querySelector('.pi-dashboard');
    dashboard.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(!button)return;
      const {piPeriod,piTopic,piStatus}=button.dataset;
      let nextFocus;
      if(piPeriod){views.days=Number(piPeriod);nextFocus=`[data-pi-period="${piPeriod}"]`;}
      else if(piTopic){
        views.topic=views.topic===piTopic?'all':piTopic;
        nextFocus=piTopic==='all' ? '#pi-questions-title' : `[data-pi-topic="${piTopic}"]`;
      }
      else if(piStatus){views.status=piStatus;views.visible=6;nextFocus=`[data-pi-status="${piStatus}"]`;}
      else if(button.hasAttribute('data-pi-more')){
        nextFocus=`.pi-patient:nth-child(${views.visible+1}) summary`;
        views.visible+=6;
      }else return;
      const opened=[...root.querySelectorAll('.pi-patient')].filter(item=>item.open).map(item=>item.querySelector('strong').textContent);
      render(root);
      root.querySelectorAll('.pi-patient').forEach(item=>{item.open=opened.includes(item.querySelector('strong').textContent);});
      const focusTarget=root.querySelector(nextFocus);
      if(focusTarget?.tagName==='H2')focusTarget.tabIndex=-1;
      focusTarget?.focus({preventScroll:!button.hasAttribute('data-pi-more')});
    });
  }

  return {render};
})();
