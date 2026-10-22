// SIGA Américas · teto aritmético ≠ receita executável; 53 rubricas e 4 competências.
const fmt=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pct=v=>Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
export function mountTargetFeasibility(root,prices,proposals,goal,{octoberValidated=null}={}){
 if(!root)return;
 const period=4;
 const tableTotal=prices.reduce((s,p)=>s+Number(p.estimated_total||0),0);
 const monthlyRef=tableTotal/period;
 const fixedIds=new Set(["3.7","3.9","3.10","3.40"]);
 const fixedReference=prices.filter(p=>fixedIds.has(p.code)).reduce((s,p)=>s+Number(p.unit_price||0),0);
 const variableReference=Math.max(0,monthlyRef-fixedReference);
 const measuredQty=proposals.filter(p=>Number(p.proposed_quantity)>0).length;
 const monthlyProposed=proposals.reduce((sum,p)=>sum+(Number(p.proposed_quantity||0)*Number(prices.find(x=>x.id===p.contract_item_id)?.unit_price||0)),0);
 const targetRows=[.99,1,1.01].map(factor=>{
  const value=goal*factor,needed=value-fixedReference,ratio=variableReference?100*needed/variableReference:NaN;
  return {factor,value,needed,ratio,referenceReachable:value<=monthlyRef};
 });
 root.innerHTML='<section class="target-feasibility-panel"><div class="finance-panel-heading"><div>'+
  '<span class="eyebrow">BALANÇO DA META · LIMITES E CENÁRIOS</span><h3>Atingir 99%, 100% ou superar a meta?</h3>'+
  '<p>Referência matemática com 53 itens da tabela vigente e quatro competências. Nenhuma quantidade futura ou medição foi presumida.</p></div></div>'+
  '<div class="target-feasibility-kpis">'+
   '<div><small>Meta mensal gerencial</small><strong>'+fmt(goal)+'</strong></div>'+
   '<div><small>Parcela aritmética mensal do contrato</small><strong>'+fmt(monthlyRef)+'</strong><small>'+pct(goal?100*monthlyRef/goal:0)+' da meta</small></div>'+
   '<div><small>Rubricas de periodicidade mensal (referência)</small><strong>'+fmt(fixedReference)+'</strong><small>Somente quando efetivamente devidas e aceitas</small></div>'+
   '<div><small>Referência mensal das demais rubricas</small><strong>'+fmt(variableReference)+'</strong></div>'+
   '</div>'+
  '<div class="table-scroll"><table class="finance-planning-table"><thead><tr><th>Objetivo</th><th>Valor</th><th>Demais rubricas necessárias*</th><th>Parcela da referência variável</th><th>Leitura</th></tr></thead><tbody>'+
  targetRows.map(r=>'<tr><td><strong>'+pct(r.factor*100)+'</strong></td><td>'+fmt(r.value)+'</td><td>'+fmt(r.needed)+'</td><td>'+pct(r.ratio)+'</td><td>'+
   (r.referenceReachable?'Aritmeticamente dentro da referência':'Acima da distribuição teórica em quatro meses')+'</td></tr>').join("")+
  '</tbody></table></div>'+
  '<p class="finance-scenario-alert">* Os cálculos pressupõem, somente como hipótese, que as rubricas mensais de '+fmt(fixedReference)+
   ' sejam integralmente elegíveis na competência. Se não forem, toda a diferença terá de ser compensada por serviços executáveis, com quantitativos, saldo e medição aceitos.</p>'+
  '<p class="finance-scenario-alert"><strong>Situação documentada:</strong> '+measuredQty+' de '+proposals.length+
   ' propostas mensais com quantidade definida; '+fmt(monthlyProposed)+' em propostas quantificadas. '+
   'Atingimento real de 99% ou 100% não está demonstrado sem demanda, área/quantidade, produtividade, disponibilidade de equipamentos, dias úteis e autorização. A mesma equipe nos postos fixos não pode produzir receita adicional por dupla contagem.</p>'+
  (octoberValidated===null?'':'<p class="finance-scenario-alert">Outubro/2026: '+fmt(octoberValidated)+
   ' em apontamentos com status de validação, equivalente a '+pct(goal?100*octoberValidated/goal:0)+
   ' da meta; não é faturamento comprovado ou saldo financeiro disponível para novembro.</p>')+
  '<details><summary>Simular capacidade de converter o potencial variável em serviços mensuráveis</summary>'+
   '<p class="finance-scenario-alert">É uma sensibilidade aritmética da tabela, não estimativa de campo. Mantenha custos, disponibilidade de pessoal, chuva, saldos contratuais e duplicidade de medição fora do montante elegível.</p>'+
   '<label>Percentual da referência variável hipoteticamente executável <input type="range" data-feasible-variable min="0" max="100" step="1" value="80"></label>'+
   '<div class="target-simulation-result" data-target-sim-result></div></details></section>';
 const slider=root.querySelector("[data-feasible-variable]"),label=root.querySelector("[data-target-sim-result]");
 const update=()=>{
  const share=Number(slider.value)/100,amount=fixedReference+share*variableReference;
  label.textContent=slider.value+"% da referência variável: "+fmt(amount)+" = "+pct(goal?100*amount/goal:0)+
   " da meta. Hipótese com todas as rubricas mensais devidas; não é projeção de receita.";
 };
 slider.addEventListener("input",update);update();
}
