// SIGA Américas | CAPE: Contrato, Aptidão, Programação, Evidência.
// Indicadores de cobertura por rubrica; nunca confundir catálogo ou rascunho com execução.
// Simulação altera somente quantidade hipotética, sem alterar preços nem criar OS.
const html=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=x=>Number(x||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const number=(x,d=1)=>Number(x||0).toLocaleString("pt-BR",{maximumFractionDigits:d});
const percent=(n,d)=>d?100*n/d:0;
const fraction=(n,d)=>number(percent(n,d),1)+"%";
const isPositive=x=>Number.isFinite(Number(x))&&Number(x)>0;
const itemValue=p=>Number(p.estimated_total||Number(p.unit_price)*Number(p.estimated_quantity)||0);
const fixedUnit=u=>String(u||"").toLocaleLowerCase("pt-BR").includes("mês");
const isHeavy=i=>/retroescavadeira|basculante|trator|transplante|poda|corte de árvores|corte de arvores|químic|quimic|fornecimento/i.test(i.name||"");
const rulesFor=i=>fixedUnit(i.unit)?"Serviço periódico já previsto: comprovar obrigação, mês elegível e aceite. Não multiplicar por dia ou posto.":
 isHeavy(i)?"Conferir demanda, autorização técnica, segurança, recursos específicos e saldo. Não assumir equipamento disponível.":
 "Conferir local e demanda, medir na unidade contratual, estimar equipe-horas e checar saldo; evitar dupla medição.";
export function calculateContractCoverage(prices,monthProposals=[],allProposals=[],actionCatalogue=[],fieldItems=[]){
 const catalog=(prices||[]).filter(p=>p.id&&isPositive(p.unit_price)&&Number(p.estimated_quantity)>=0);
 const itemIds=new Set(catalog.map(i=>i.id));
 const planned=(monthProposals||[]).filter(x=>itemIds.has(x.contract_item_id));
 const candidate=new Set(planned.map(p=>p.contract_item_id));
 const quantified=new Set(planned.filter(p=>isPositive(p.proposed_quantity)).map(p=>p.contract_item_id));
 const authorized=new Set(planned.filter(p=>Boolean(p.work_order_id)).map(p=>p.contract_item_id));
 const counts=new Map();
 for(const p of planned)counts.set(p.contract_item_id,(counts.get(p.contract_item_id)||0)+1);
 const active=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
 const top3=active.slice(0,3).reduce((s,x)=>s+x[1],0);
 const catalogActions=new Set((actionCatalogue||[]).map(a=>a.id).filter(Boolean));
 const mappedActivities=new Set((fieldItems||[]).filter(x=>catalogActions.has(x.activity_id)&&x.contract_item_id&&itemIds.has(x.contract_item_id)).map(x=>x.activity_id));
 const actionsWithPlan=new Set((fieldItems||[]).filter(x=>catalogActions.has(x.activity_id)&&x.planned_quantity!=null&&Number(x.planned_quantity)>0).map(x=>x.activity_id));
 return {items:catalog,candidate,quantified,authorized,counts,
  total:catalog.length,planned:planned.length,
  actionsTotal:catalogActions.size,actionsMapped:mappedActivities.size,actionsQuantified:actionsWithPlan.size,
  top3Share:planned.length?top3/planned.length:0,
  missing:catalog.filter(i=>!candidate.has(i.id)).sort((a,b)=>itemValue(b)-itemValue(a)),
  candidates:catalog.filter(i=>candidate.has(i.id)).sort((a,b)=>(counts.get(b.id)||0)-(counts.get(a.id)||0)),
  coverage:percent(candidate.size,catalog.length),quantifiedCoverage:percent(quantified.size,catalog.length),authorizedCoverage:percent(authorized.size,catalog.length)};
}
export function mountContractCoverage(root,prices,monthProposals,allProposals,actionCatalogue,fieldItems,{
 month="2026-11",workingDays=0,goal=919000
}={}){
 if(!root)return;
 const metrics=calculateContractCoverage(prices,monthProposals,allProposals,actionCatalogue,fieldItems);
 const totalReference=metrics.items.reduce((s,p)=>s+itemValue(p),0)/4;
 const days=Number(workingDays)||0;
 const expected=metrics.items.length;
 const bar=(n,d)=>
 '<div class="contract-coverage-meter"><span style="width:'+Math.max(0,Math.min(100,percent(n,d)))+'%"></span></div>';
 root.innerHTML='<section class="contract-coverage-panel" aria-labelledby="coverage-method-title">'+
  '<div class="contract-coverage-header"><div><span class="eyebrow">CAPE · COBERTURA E DIVERSIFICAÇÃO CONTRATUAL</span>'+
  '<h3 id="coverage-method-title">Quanto do contrato entrou no planejamento?</h3>'+
  '<p>Acompanhe a diversificação sem aumentar atividades artificiais ou presumir produtividade. A meta é usar as rubricas <strong>pertinentes e executáveis</strong>, não preencher todas indiscriminadamente.</p></div>'+
  '<div class="contract-coverage-month">'+html(month.slice(5,7)+"/"+month.slice(0,4))+'<small>'+days+' dias úteis da escala</small></div></div>'+
  '<div class="contract-coverage-kpis">'+
   '<div><small>Rubricas com proposta</small><strong>'+fraction(metrics.candidate.size,expected)+'</strong><span>'+metrics.candidate.size+' de '+expected+'</span>'+bar(metrics.candidate.size,expected)+'</div>'+
   '<div><small>Rubricas com quantidade</small><strong>'+fraction(metrics.quantified.size,expected)+'</strong><span>'+metrics.quantified.size+' de '+expected+'</span>'+bar(metrics.quantified.size,expected)+'</div>'+
   '<div><small>Com OS vinculada</small><strong>'+fraction(metrics.authorized.size,expected)+'</strong><span>'+metrics.authorized.size+' de '+expected+'</span>'+bar(metrics.authorized.size,expected)+'</div>'+
   '<div><small>Concentração em três rubricas</small><strong>'+number(metrics.top3Share*100,1)+'%</strong><span>das '+metrics.planned+' propostas do mês</span>'+
   '<small>Reduzir apenas quando houver alternativas realmente aplicáveis</small></div>'+
  '</div>'+
  '<div class="contract-coverage-focus"><div><h4>Onde ampliar a diversidade</h4>'+
  '<p>'+metrics.missing.length+' rubricas sem proposta nesta competência. A lista é de <strong>análise de oportunidades</strong>, não autorização de serviço ou ranking automático de viabilidade.</p></div>'+
  '<button type="button" class="btn btn-secondary" data-coverage-toggle>Consultar todas as '+expected+' rubricas</button></div>'+
  '<div class="contract-coverage-list" data-coverage-list hidden></div>'+
  '<details class="contract-coverage-method"><summary>Metodologia única: Contrato → Aptidão → Programação → Evidência (CAPE)</summary>'+
  '<div class="contract-coverage-steps">'+
  '<p><strong>1 · Contrato.</strong> Universo de '+expected+' rubricas com preço e unidade. As '+metrics.actionsTotal+' ações do catálogo técnico são universo distinto, sem dupla contagem. '+metrics.actionsMapped+' ações têm vínculo explícito a uma rubrica na programação e '+metrics.actionsQuantified+' têm quantidade no planejamento técnico.</p>'+
  '<p><strong>2 · Aptidão.</strong> Verificar demanda real, local, pessoa/equipamento, segurança, calendário, tipo de unidade e saldo, antes de incluir quantidade. Não há percentual de aptidão comprovada se os dados não existirem.</p>'+
  '<p><strong>3 · Programação.</strong> Cobertura de rubricas com proposta = códigos distintos com proposta ÷ '+expected+'. Cobertura quantificada requer quantidade maior que zero. A simulação não grava nem aprova quantidades.</p>'+
  '<p><strong>4 · Evidência.</strong> A cobertura com OS exige vínculo cadastrado; execução ou faturamento exigem medição e aceite separados. Não somar horas ou serviços de postos fixos novamente às equipes nem cobrar rotina mensal por turno.</p>'+
  '<p><strong>5 · Revisão sustentável.</strong> Conferir toda semana lacunas, repetição, frentes, horas, dias, riscos e saldo; diversificar apenas com demanda e recursos disponíveis.</p></div></details>'+
  '<details class="contract-scenario"><summary>Simulação de sensibilidade · até 150% das quantidades de referência</summary>'+
  '<p>O multiplicador incide exclusivamente sobre quantidades teóricas de referência (total contratado dividido por quatro); os preços unitários não mudam. Mais quantidade <strong>não</strong> significa autorização nem saldo disponível.</p>'+
  '<label>Quantidade hipotética sobre a referência <input type="range" min="50" max="150" step="10" value="100" data-coverage-factor> <strong data-coverage-factor-label>100%</strong></label>'+
  '<div class="contract-scenario-result" data-coverage-scenario></div>'+
  '<p class="contract-coverage-note">Para validar a hipótese: calcular a quantidade de cada item por dia útil, o tempo necessário da equipe, recursos/insumos, saldo remanescente do contrato e possibilidade de medição. A simulação não emite OS.</p>'+
  '</details></section>';
 const list=root.querySelector("[data-coverage-list]"),button=root.querySelector("[data-coverage-toggle]");
 let showAll=false;
 const renderList=()=>{
  const candidateIds=metrics.candidate;
  const all=metrics.items.slice().sort((a,b)=>{
   const x=candidateIds.has(a.id)?1:0,y=candidateIds.has(b.id)?1:0;
   return x-y||itemValue(b)-itemValue(a);
  });
  const rows=showAll?all:all.slice(0,10);
  list.innerHTML='<div class="table-scroll"><table class="finance-planning-table contract-coverage-table"><thead>'+
   '<tr><th>Rubrica</th><th>Situação da competência</th><th>Referência mensal</th><th>Qtd. de referência/dia*</th><th>Critérios de aptidão</th></tr></thead><tbody>'+
   rows.map(i=>{
    const covered=candidateIds.has(i.id),qty=metrics.quantified.has(i.id),os=metrics.authorized.has(i.id),
     unit=html(i.unit||"un"),refQ=Number(i.estimated_quantity||0)/4;
    return '<tr><td><strong>'+html(i.code)+' · '+html(i.name)+'</strong></td>'+
      '<td><span class="contract-coverage-chip '+(qty?'quantified':covered?'candidate':'missing')+'">'+
       (os?"OS vinculada":qty?"Quantificada":covered?"Candidata":"Sem proposta")+'</span></td>'+
      '<td>'+brl(itemValue(i)/4)+'</td>'+
      '<td>'+(fixedUnit(i.unit)?'1 unid. / competência':days?number(refQ/days,3)+' '+unit+' / dia':'Dias úteis a verificar')+'</td>'+
      '<td>'+html(rulesFor(i))+'</td></tr>';
   }).join("")+'</tbody></table></div>'+
   '<p class="contract-coverage-note">* Distribuição meramente aritmética de quatro competências; não é produtividade medida. Em itens mensais a unidade permanece “mês”.</p>';
 };
 button.onclick=()=>{
  showAll=!showAll;list.hidden=false;
  button.textContent=showAll?"Mostrar 10 oportunidades prioritárias":"Mostrar todas as "+expected+" rubricas";
  renderList();
 };
 const slider=root.querySelector("[data-coverage-factor]"),label=root.querySelector("[data-coverage-factor-label]"),output=root.querySelector("[data-coverage-scenario]");
 const update=()=>{
  const f=Number(slider.value)/100,estimated=totalReference*f,monthsValue=totalReference*3*f,
   dayValue=days?estimated/days:0,over=f>1;
  label.textContent=number(f*100,0)+"%";
  output.innerHTML='<strong>'+brl(estimated)+'</strong> na competência · '+fraction(estimated,goal)+' da meta de '+brl(goal)+
   (days?' · '+brl(dayValue)+' / dia útil aritmético':'')+
   '<p>'+brl(monthsValue)+' em três competências, mantida a mesma hipótese. '+
   (over?'<strong>Alerta:</strong> acima da referência contratual de quantidade da competência; exige verificar saldos, prazo e autorização; pode ser inexequível.':
   'Ainda exige medição de campo, saldo, disponibilidade e aprovação.')+'</p>';
 };
 slider.oninput=update;update();
}
