/* Synthetic, anonymous fixtures for the doctor-facing display. */
window.PatientInsights = (() => {
  const topics = [
    {id:'payment', label:'支付与权益', focus:'入组权益、申请材料及办理进度'},
    {id:'routine', label:'日常用药', focus:'用药记录及用药提醒'},
    {id:'storage', label:'保存与携带', focus:'药品保存要求及外出携带'},
    {id:'followup', label:'复诊与随访', focus:'复诊准备及随访安排'},
    {id:'support', label:'用药疑问', focus:'查阅说明书及联系医护团队'}
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
      return {patientId:patient.id, date:at, topic:topic.id};
    });
  }).flat();

  const patientsById = new Map(patients.map(patient => [patient.id, patient]));

  function topicCounts(questions) {
    const counts = new Map(topics.map(topic => [topic.id, 0]));
    for (const question of questions) counts.set(question.topic, counts.get(question.topic) + 1);
    return topics.map(topic => ({...topic, count: counts.get(topic.id)}));
  }

  function byCount(questions) {
    return topicCounts(questions).sort((a, b) => b.count - a.count);
  }

  function concernByStage() {
    const early = records.filter(question => {
      const patient = patientsById.get(question.patientId);
      return Date.parse(question.date) - Date.parse(patient.enrolled) < 7 * dayMs;
    });
    const established = records.filter(question => {
      const patient = patientsById.get(question.patientId);
      return Date.parse(question.date) - Date.parse(patient.enrolled) >= 7 * dayMs;
    });
    if (!early.length || !established.length) return null;
    const establishedCounts = new Map(topicCounts(established).map(topic => [topic.id, topic.count]));
    const gaps = topicCounts(early).map(topic => ({
      ...topic,
      gap: topic.count / early.length - establishedCounts.get(topic.id) / established.length
    })).sort((a, b) => b.gap - a.gap);
    const [initialFocus] = gaps;
    const ongoingFocus = gaps.at(-1);
    if (initialFocus.gap <= 0 || ongoingFocus.gap >= 0) return null;
    return `与入组一段时间的患者相比，刚入组的患者更常关注${initialFocus.focus}。在入组时间较长的患者中，${ongoingFocus.focus}在提问中更突出。`;
  }

  function recentChanges() {
    const recent = records.filter(question => question.date >= date(6));
    const previous = records.filter(question => question.date < date(6) && question.date >= date(13));
    if (!recent.length || !previous.length) return null;
    const earlier = new Map(topicCounts(previous).map(topic => [topic.id, topic.count]));
    const direction = Math.sign(recent.length - previous.length);
    if (direction === 0) return '近一周的提问活跃度与前一周相近。';
    const drivers = topicCounts(recent).map(topic => ({
      ...topic, change: (topic.count - earlier.get(topic.id)) * direction
    })).filter(topic => topic.change > 0)
      .sort((a, b) => b.change - a.change).slice(0, 3);
    const movement = direction > 0 ? '增加' : '减少';
    return `相比前一周，近一周提问${movement}，主要体现在${drivers.map(topic => topic.label).join('、')}方面。`;
  }

  function render(root) {
    const [leading] = byCount(records);
    const cards = [
      {icon:'i-chat', title:'患者最关心什么', text:leading.count
        ? `${leading.label}是患者最关注的主题，问题主要围绕${leading.focus}。` : null},
      {icon:'i-user', title:'不同入组阶段的关注差异', text:concernByStage()},
      {icon:'i-insights', title:'近期提问变化', text:recentChanges()}
    ].filter(card => card.text);
    root.innerHTML = `<div class="pi-dashboard">
      <section class="pi-cohort" aria-labelledby="pi-conclusion-title">
        <p class="pi-product">日达仙</p>
        <h2 id="pi-conclusion-title">患者洞察结论</h2>
        <p>综合创新支付入组阶段和近期提问，梳理患者关注重点。</p>
      </section>
      ${cards.map(card => `<section class="pi-card">
        <span class="pi-icon" aria-hidden="true"><svg><use href="#${card.icon}"/></svg></span>
        <div><h3>${card.title}</h3><p>${card.text}</p></div>
      </section>`).join('')}
      ${cards.length ? '' : '<p class="pi-empty">暂无可归纳的洞察。</p>'}
    </div>`;
  }

  return {render};
})();
