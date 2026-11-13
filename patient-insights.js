/* Synthetic, anonymous fixtures for exploring the enrolled cohort. */
window.PatientInsights = (() => {
  const dimensions = [
    {id:'sex', label:'性别', options:['女性','男性']},
    {id:'age', label:'年龄', options:['18–39 岁','40–59 岁','60 岁及以上']},
    {id:'region', label:'所在地区', options:['华东','华北','华南','西南']},
    {id:'stage', label:'疾病进展', options:['初诊评估','稳定随访','进展评估']}
  ];
  const topics = [
    {id:'payment', label:'支付与权益', questions:['在哪里查看我的创新支付权益？','申请支付支持需要准备哪些资料？','在哪里查看申请进度？']},
    {id:'routine', label:'日常用药', questions:['在哪里查看日达仙的用药记录？','怎样整理用药记录，方便复诊时查看？','在哪里设置用药提醒？']},
    {id:'storage', label:'保存与携带', questions:['在哪里查询日达仙的保存要求？','外出前可以向谁确认药品携带要求？']},
    {id:'followup', label:'复诊与随访', questions:['复诊时需要带哪些用药记录？','在哪里查看随访安排？','复诊前可以记录哪些近期变化？']},
    {id:'support', label:'用药疑问', questions:['在哪里查看日达仙的说明书？','有用药疑问时如何联系医护团队？']}
  ];

  const dateFormat = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
  const today = Date.parse(dateFormat.format(new Date()) + 'T00:00:00Z');
  const dayMs = 86400000;
  const date = offset => new Date(today - offset * dayMs).toISOString().slice(0,10);
  const [sex, age, region, stage] = dimensions;
  const patients = Array.from({length:32}, (_,index) => ({
    enrolled:date(index===0 ? 0 : 2*index+1),
    ended:index>=26 ? date(12+index%5) : null,
    sex:sex.options[index%7<4 ? 0 : 1],
    age:age.options[index%age.options.length],
    region:region.options[Math.floor(index/age.options.length)%region.options.length],
    stage:stage.options[Math.floor(index/(age.options.length*region.options.length))%stage.options.length]
  }));
  const topicOrder = [0,1,0,2,1,3,0,4,2,1,3,4,0];
  const records = Array.from({length:30}, (_,offset) => {
    const at=date(offset);
    const active=patients.filter(patient=>patient.enrolled<=at && (!patient.ended || at<=patient.ended));
    const volume=2+((offset*7+Math.floor(offset/3))%8);
    return Array.from({length:volume}, (_,index) => {
      const patient=active[(offset*3+index*5)%active.length];
      const topic=topics[topicOrder[(offset*7+index*3)%topicOrder.length]];
      return {patient, topic:topic.id, text:topic.questions[(offset+index)%topic.questions.length]};
    });
  }).flat();

  const formatShare = new Intl.NumberFormat('zh-CN',{style:'percent',maximumFractionDigits:1});

  function distributionMarkup(cohort, visibleDimensions) {
    if(!cohort.length)return '<p class="pi-empty">暂无患者分布。</p>';
    return `<div class="pi-chart-grid">${visibleDimensions.map(({id,label,options})=>`
      <div class="pi-chart">
        <h3>${label}</h3>
        <ul>${options.map(option=>{
          const count=cohort.filter(patient=>patient[id]===option).length;
          const share=count/cohort.length;
          const percentage=formatShare.format(share);
          return `<li class="pi-chart-row">
            <span>${option}</span><strong>${percentage}</strong>
            <span class="pi-chart-track" aria-hidden="true"><i style="--share:${share*100}%"></i></span>
          </li>`;
        }).join('')}</ul>
      </div>`).join('')}</div>`;
  }

  function resultsMarkup(matching, selectedTopic) {
    const available=topics.filter(topic=>matching.some(record=>record.topic===topic.id));
    if(!available.length)return '<p class="pi-empty">暂无相关提问。</p>';
    const visible=matching.filter(record=>!selectedTopic || record.topic===selectedTopic);
    const unique=[...new Map(visible.map(record=>[record.text,record])).values()];
    const names=new Map(available.map(topic=>[topic.id,topic.label]));
    return `<div class="pi-topics" role="group" aria-label="提问主题">
      <button type="button" data-pi-topic="" aria-pressed="${!selectedTopic}">全部主题</button>
      ${available.map(topic=>`<button type="button" data-pi-topic="${topic.id}" aria-pressed="${topic.id===selectedTopic}">${topic.label}</button>`).join('')}
    </div>
    <h3>代表性提问</h3>
    <ul class="pi-questions">${unique.slice(0,5).map(record=>`<li><p>${record.text}</p><span>${names.get(record.topic)}</span></li>`).join('')}</ul>`;
  }

  function render(root) {
    let selectedTopic='';
    let selectedChart='profile';
    root.innerHTML = `<div class="pi-dashboard">
      <section class="pi-card" aria-labelledby="pi-distribution-title">
        <div class="pi-card-heading"><h2 id="pi-distribution-title">人群分布</h2><span class="pi-chart-caption">患者占比</span></div>
        <div class="pi-chart-switch" role="group" aria-label="人群分布维度">
          <button type="button" data-pi-chart="profile" aria-pressed="true">性别与年龄</button>
          <button type="button" data-pi-chart="context" aria-pressed="false">地区与疾病进展</button>
        </div>
        <div class="pi-distribution"></div>
      </section>
      <section class="pi-card" aria-labelledby="pi-topics-title">
        <h2 id="pi-topics-title">提问主题</h2>
        <p class="pi-context" role="status"></p>
        <div class="pi-results"></div>
      </section>
    </div>`;
    const panel=root.querySelector('.pi-dashboard');
    const context=panel.querySelector('.pi-context');
    const results=panel.querySelector('.pi-results');
    const distribution=panel.querySelector('.pi-distribution');
    const chartButtons=[...panel.querySelectorAll('[data-pi-chart]')];

    function updateResults() {
      const cohort=patients;
      const members=new Set(cohort);
      context.textContent='全部患者';
      results.innerHTML=resultsMarkup(records.filter(({patient})=>members.has(patient)),selectedTopic);
      distribution.innerHTML=distributionMarkup(cohort,selectedChart==='profile'?[sex,age]:[region,stage]);
    }

    for(const button of chartButtons){
      button.addEventListener('click',()=>{
        selectedChart=button.dataset.piChart;
        for(const option of chartButtons)option.setAttribute('aria-pressed',String(option===button));
        updateResults();
      });
    }

    results.addEventListener('click',event=>{
      const button=event.target.closest('[data-pi-topic]');
      if(!button)return;
      selectedTopic=button.dataset.piTopic;
      updateResults();
      results.querySelector(`[data-pi-topic="${selectedTopic}"]`)?.focus({preventScroll:true});
    });
    updateResults();
  }

  return {render};
})();
