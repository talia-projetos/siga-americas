import {listLowMobilization} from "./low-resource-options.js?v=1";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dec=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
export function mountLowMobilizationBalance(root,prices,proposals,goal,expected){
 const candidates=listLowMobilization(prices);
 const allowed=new Set(candidates.map(x=>x.id));
 const existing=proposals.filter(p=>allowed.has(p.contract_item_id)&&Number(p.proposed_quantity)>0);
 const priced=new Map(candidates.map(p=>[p.id,p]));
 const plannedValue=existing.reduce((s,p)=>s+Number(p.proposed_quantity)*Number(priced.get(p.contract_item_id)?.unit_price||0),0);
 root.innerHTML='<section class="low-resource-panel"><div class="low-resource-heading"><div>'+
  '<span class="eyebrow">ALTERNATIVAS · CUSTEIO VIGENTE</span><h3>Potencial de baixa mobilização</h3>'+
  '<p>Comparação de serviços que podem aproveitar equipes já presentes, sem presumir veículo ou máquina adicional. Aplicabilidade, acesso, segurança e medições dependem de validação local.</p></div>'+
  '<div class="low-resource-kpis"><div><small>Propostas já quantificadas</small><strong>'+existing.length+'</strong></div>'+
  '<div><small>Potencial previsto nessas propostas</small><strong>'+money(plannedValue)+'</strong></div>'+
  '<div><small>Diferença até a meta</small><strong>'+money(Math.max(0,goal-expected))+'</strong></div></div></div>'+
  '<details><summary>Simular atividades alternativas por rubrica ('+candidates.length+' opções)</summary>'+
  '<p class="low-resource-warning">A simulação não cria planejamento, OS ou medição. Informe somente quantidades tecnicamente plausíveis na unidade contratual; preços não representam receita realizada nem lucro. Não executar em condição insegura para alcançar meta.</p>'+
  '<div class="table-scroll"><table class="low-resource-table"><thead><tr><th>Rubrica e serviço</th><th>Unidade e tarifa</th><th>Requisitos de aplicação</th><th>Quantidade hipotética</th><th>Potencial simulado</th></tr></thead><tbody>'+
  candidates.map(item=>'<tr data-low-resource="'+safe(item.code)+'" data-rate="'+safe(item.unit_price)+'">'+
   '<td><strong>'+safe(item.code)+' · '+safe(item.name)+'</strong></td>'+
   '<td>'+money(item.unit_price)+' / '+safe(item.unit)+'</td><td>'+safe(item.requirements)+'</td>'+
   '<td><input type="number" min="0" step="any" inputmode="decimal" data-low-resource-quantity placeholder="Sem estimativa" aria-label="Quantidade hipotética '+safe(item.code)+'"></td>'+
   '<td data-low-resource-potential>—</td></tr>').join("")+
  '</tbody></table></div><div class="low-resource-total"><span>Potencial adicional simulado, sujeito a confirmação</span><strong data-low-resource-total>—</strong></div></details></section>';
 const update=()=>{
  let total=0,valid=true;
  root.querySelectorAll("[data-low-resource]").forEach(row=>{
   const input=row.querySelector("[data-low-resource-quantity]"),text=input.value.trim(),n=Number(text);
   const cell=row.querySelector("[data-low-resource-potential]");
   if(!text){cell.textContent="—";return;}
   if(!Number.isFinite(n)||n<0){cell.textContent="Quantidade inválida";valid=false;return;}
   const result=n*Number(row.dataset.rate||0);total+=result;
   cell.textContent=money(result)+" (hipótese)";
  });
  root.querySelector("[data-low-resource-total]").textContent=valid?money(total):"Revise quantidades inválidas";
 };
 root.querySelectorAll("[data-low-resource-quantity]").forEach(el=>el.oninput=update);
}
