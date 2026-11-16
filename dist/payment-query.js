/* Structured payment cards supplied for the insurance expert. */
const PaymentQuery=(()=>{
 const question='日达仙支付方式查询';
 const tip='温馨提示：本平台仅提供药品支付方式查询，最终理赔结论以保司理赔审核为准。';
 const steps=['正在识别意图','正在查询专属数据库'];
 const thinkingSteps={overview:steps,products:steps,program:steps,answer:steps};
 const thinkingInterval={overview:900,products:900,program:900};
 const routes=[
  {kind:'blue',label:'惠民保',title:'医保目录内费用责任（可赔）',description:'门急诊 / 住院自付 / 国谈药，含乙类先行自付，',stage:'products'},
  {kind:'yellow',label:'商业保险',title:'一般医疗保险 / 一般疾病住院医疗（可赔）',description:'住院医疗、特殊门诊、门诊手术、住院前30天后30天门急诊的合理医疗费用，',stage:'products'},
  {kind:'green',label:'带病保',title:'e路陪护（可赔）',description:'入组支付会员费后12个月内，在海大夫平台复诊并购药达到限定数量可申请两次理赔，',stage:'program'}
 ];
 const products=[
  {name:'北京普惠健康保（2026年度）',tag:'惠民保',responsibility:'医保内自付费用保障',amount:'100',scope:'住院及门急诊发生的医保目录内个人自付费用：含起付线以下费用、乙类药品/诊疗/材料个人先行自付、共付段按比例自付、超医保限额及超医保支付标准的部分。不含医保目录外全自费费用（属另列的自费责任）。',deduct:'<strong>1.5万</strong> <span>健康体</span>　<strong>30404元</strong> <span>特定既往症（当年大病起付线）</span>',ratios:[['80%','健康体（30404元以上部分；1.5万–30404元报25%）'],['40%','带病体（特定既往症）']],phone:'95518',phoneLabel:'联系保司：95518（人保财）'},
  {name:'平安e生保 2026（标准版）',tag:'商业保险',responsibility:'一般医疗保险金',amount:'300',scope:'住院医疗、特殊门诊、门诊手术、住院前30天后30天门急诊的合理医疗费用，不限医保目录内外（乙类自付及目录外自费均可报）；院外恶性肿瘤特药另列专门责任。',deduct:'<strong>1万</strong> <span>（可选 5000 / 2万计划）</span>',ratios:[['100%','免赔额以上部分（未按医保身份结算降为60%）']],phone:'95511',phoneLabel:'联系保司：95511-7（平安健）'},
  {name:'好医保·长期医疗（标准版）',tag:'商业保险',responsibility:'一般疾病住院医疗费用保险金',amount:'200',scope:'住院医疗、特殊门诊、门诊手术、住院（含出入院当天）前30天后30天门急诊医疗费用；限二级及以上公立医院普通部；外购药械另列专门责任。',deduct:'<strong>1万</strong> <span>（前3年无理赔每年降1000，最低7000）</span>',ratios:[['100%','扣除免赔额后（未按医保身份结算降为60%）']],phone:'95591',phoneLabel:'联系保司：95591（人保健）'}
 ];
 function route(item){return `<section class="payq-route payq-${item.kind}"><div class="payq-route-head"><span class="payq-ribbon">${item.label}</span><h4>${item.title}</h4></div><p><span>可赔范围概述：</span>${item.description}具体详情请查看具体产品相关赔付范围约定</p><button type="button" data-payment-next="${item.stage}">去查看 <span aria-hidden="true">›</span></button></section>`;}
 function ratio([value,note]){return `<div class="payq-ratio"><strong>赔付比例 ${value}</strong><div class="payq-ratio-track"><i style="width:${value}"></i></div><small>${note}</small></div>`;}
 function product(item,index){return `<section class="payq-product"><div class="payq-product-head"><h4>${item.name}</h4><span>${item.tag}</span></div><div class="payq-product-info"><div class="payq-responsibility"><strong>${item.responsibility}</strong><b>${item.amount}<small>万</small></b></div><div class="payq-scope"><p>${item.scope}</p><button type="button" data-payment-scope="${index}" aria-expanded="false">展开 <span aria-hidden="true">⌄</span></button></div><p class="payq-deduct"><b>免赔额：</b>${item.deduct}</p><div class="payq-ratios">${item.ratios.map(ratio).join('')}</div></div><a class="payq-contact" href="tel:${item.phone}">${item.phoneLabel}</a></section>`;}
 function overview(){return `<h3 class="payq-title">查询到「日达仙」有多种支付方式，帮患者缓解购药压力</h3>${routes.map(route).join('')}`;}
 function productList(){return `<h3 class="payq-title">✅ 可配产品范围存在</h3><p class="payq-subtitle">日达仙在赔付范围内，实际赔付必须符合产品条款约定。</p>${products.map(product).join('')}<p class="payq-tip">${tip}</p>`;}
 function program(){return `<div class="payq-product-head"><h3>e路陪护</h3><span>带病保项目</span></div><p class="payq-program-intro">通用名：注射用胸腺法新（日达仙）· 入组支付会员费后 12 个月内，按购药数量分两次理赔 · 每次理赔需在海大夫平台完成至少 1 次视频问诊</p><div class="payq-table-scroll"><table class="payq-plan-table"><thead><tr><th>理赔节点</th><th>完成指定动作</th><th>可理赔盒数</th></tr></thead><tbody><tr><td>第一次理赔</td><td>在海大夫平台复诊并购药，累计购药达到 16盒（32支）至 24盒（48支）（含），且至少 1 次视频问诊</td><td>16–24盒<br>（32–48支）</td></tr><tr><td>第二次理赔</td><td>在海大夫平台累计购药达到 48盒（96支），且首次理赔流程已完成之后完成至少 1 次视频问诊</td><td>48盒<br>（96支）</td></tr><tr><td>合计</td><td>共 2 次理赔机会 · 需至少 2 次视频问诊</td><td>累计至 48盒（96支）</td></tr></tbody></table></div><a class="payq-contact" href="tel:4000000000">📞 拨打项目咨询电话</a><p class="payq-tip">${tip}</p>`;}
 function render(stage){const title=stage==='overview'?question:stage==='products'?'查看可赔产品':'e路陪护项目申请条件';const body=stage==='overview'?overview():stage==='products'?productList():program();return `<article class="answer-card payment-query-card" data-payment-stage="${stage}"><div class="answer-person"><img src="assets/representative.jpg" alt="数字人助手"><strong>${title}</strong></div>${body}</article>`;}
 function renderThinking(stage,activeStep){const attribute=stage==='answer'?'data-answer-thinking=""':`data-payment-thinking="${stage}"`;return `<article class="answer-card kd-thinking-card" ${attribute} role="status" aria-live="polite"><div class="kd-thinking-head"><img src="assets/representative.jpg" alt="数字人助手"><strong>正在查询</strong></div><div class="kd-thinking-steps">${thinkingSteps[stage].map((label,index)=>`<div class="kd-thinking-step ${index<activeStep?'is-done':index===activeStep?'is-active':''}" ${index===activeStep?'aria-current="step"':''}><span class="kd-thinking-icon" aria-hidden="true"></span><span>${label}</span></div>`).join('')}</div></article>`;}
 return {question,render,renderThinking,thinkingSteps,thinkingInterval};
})();
