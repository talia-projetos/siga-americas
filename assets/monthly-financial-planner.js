import {mountWeatherAdvisory} from "./climate-planner.js?v=3";
import {mountDailyCoverage} from "./daily-coverage.js?v=5";
import {mountLowMobilizationBalance} from "./low-resource-panel.js?v=2";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const currency=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const qty=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
const date=x=>x?new Date(String(x).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
export async function mountMonthlyFinancialPlanner(root,db,{role,notify}){
 const canWrite=["admin","gestao","supervisao"].includes(role);
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Consultando custeio e propostas de campo…</p></div>';
 try{
  const [itemsResult,goalsResult,proposalsResult,recordsResult]=await Promise.all([
   db.from("contract_items").select("id,code,name,unit,unit_price,estimated_quantity,estimated_total,source_type").eq("source_type","precos").limit(150),
   db.from("finance_goals").select("period_month,target_amount,notes").in("period_month",["2026-11-01","2026-12-01","2027-01-01"]),
   db.from("monthly_operational_proposals").select("id,period_month,planned_for,location_description,justification,climate_alternative,proposed_quantity,proposal_status,contract_item_id,area_id,work_order_id").order("planned_for",{ascending:true}).limit(250),
   db.from("field_execution_entries").select("performed_on,estimated_amount,validation_status").gte("performed_on","2026-11-01").lt("performed_on","2027-02-01").limit(700)
  ]);
  for(const v of [itemsResult,goalsResult,proposalsResult,recordsResult])if(v.error)throw v.error;
  const prices=(itemsResult.data||[]).filter(x=>Number.isFinite(Number(x.unit_price))&&Number.isFinite(Number(x.estimated_quantity))),
   byId=new Map(prices.map(i=>[i.id,i])),
   goals=new Map((goalsResult.data||[]).map(g=>[g.period_month,g])),
   proposed=proposalsResult.data||[],actual=recordsResult.data||[];
  const months=[["2026-11-01","Novembro de 2026"],["2026-12-01","Dezembro de 2026"],["2027-01-01","Janeiro de 2027"]];
  const average=prices.reduce((sum,p)=>sum+Number(p.estimated_total||Number(p.unit_price)*Number(p.estimated_quantity)),0)/4;
  let selected=months[0][0];
  const panel=()=>{
   const target=Number(goals.get(selected)?.target_amount||919000);
   const monthActual=actual.filter(a=>a.performed_on?.startsWith(selected.slice(0,7))&&a.validation_status==="validada").reduce((s,v)=>s+Number(v.estimated_amount||0),0);
   const monthTasks=proposed.filter(v=>v.period_month===selected);
   const expected=monthTasks.reduce((s,v)=>s+(Number(v.proposed_quantity||0)*Number(byId.get(v.contract_item_id)?.unit_price||0)),0);
    const quantified=monthTasks.filter(v=>Number(v.proposed_quantity)>0).length;
    const withOs=monthTasks.filter(v=>v.work_order_id).length;
    const located=monthTasks.filter(v=>v.area_id&&v.location_description&&!/a confirmar|a definir|local exato/i.test(v.location_description)).length;
   const referenced=prices.reduce((sum,i)=>sum+Number(i.estimated_total||0)/4,0);
   const body=monthTasks.map(t=>{
    const item=byId.get(t.contract_item_id)||{},released=Boolean(t.work_order_id);
    const code=[item.code,item.name].filter(Boolean).join(" · ");
    return '<tr data-proposal="'+esc(t.id)+'"><td>'+(canWrite&&!released?'<input type="date" class="monthly-date" aria-label="Data prevista" value="'+esc(t.planned_for)+'">':esc(date(t.planned_for)))+'</td>'+ 
    '<td><strong>'+esc(code)+'</strong><small>Local da atividade:</small>'+(canWrite&&!released?'<input type="text" class="monthly-location" aria-label="Local exato" value="'+esc(t.location_description)+'">':'<small>'+esc(t.location_description)+'</small>')+'</td>'+ 
    '<td><strong>'+esc(item.unit||"—")+'</strong><small>'+esc(currency(item.unit_price))+' / '+esc(item.unit||"un")+'</small></td>'+
    '<td><input type="number" min="0.001" step="0.001" inputmode="decimal" class="monthly-qty" aria-label="Quantidade proposta para '+esc(item.code)+'" '+(released||!canWrite?'disabled ':'')+'value="'+(t.proposed_quantity===null?"":esc(t.proposed_quantity))+'" placeholder="A medir"></td>'+
    '<td>'+esc(t.proposal_status==="os_gerada"?"OS emitida":t.proposal_status==="candidata"?"A validar":t.proposal_status)+'</td>'+
    '<td><details><summary>Condições</summary><p>'+esc(t.justification)+'</p><p>'+esc(t.climate_alternative||"")+'</p></details></td>'+
    '<td>'+(canWrite?(released?'<span class="muted">Gerada</span>':'<button type="button" class="table-action" data-save-proposal="'+esc(t.id)+'">Salvar</button><button type="button" class="table-action" data-issue-proposal="'+esc(t.id)+'">Aprovar e gerar OS</button>'):'<span class="muted">Consulta</span>')+'</td></tr>';
   }).join("");
   const quote=prices.slice().sort((a,b)=>Number(b.estimated_total)-Number(a.estimated_total)).map(i=>'<tr><td>'+esc(i.code)+'</td><td>'+esc(i.name)+'</td><td>'+esc(qty(Number(i.estimated_quantity)/4))+' '+esc(i.unit||"")+'</td><td>'+esc(currency(Number(i.estimated_total)/4))+'</td></tr>').join("");
   root.querySelector("#finance-plan-current").innerHTML=
    '<div class="finance-planning-kpis"><div><span>Meta gerencial</span><strong>'+currency(target)+'</strong></div><div><span>Referência aritmética (1/4)</span><strong>'+currency(referenced)+'</strong></div><div><span>Propostas quantificadas</span><strong>'+currency(expected)+'</strong></div><div><span>Produção com validação registrada</span><strong>'+currency(monthActual)+'</strong></div></div>'+
    '<p class="finance-scenario-alert"><strong>Prontidão do mês:</strong> '+quantified+' de '+monthTasks.length+' propostas com quantidade numérica; '+located+' com frente vinculada e local descritivo; '+withOs+' OS emitidas. Quantidade, local, disponibilidade, autorização, clima e medição devem ser validados antes da execução.</p>'+ 
    '<p class="finance-scenario-alert"><strong>Não é previsão de faturamento:</strong> dividir o custeio por quatro produz um limite matemático de comparação, não um calendário executável. Os trabalhos sem área delimitada, autorização, disponibilidade e medição permanecem sem quantidade. Saldo contratual e execução de outubro precisam ser reconciliados antes de aprovação.</p>'+
    '<div class="finance-panel-heading"><h3>Propostas operacionais com datas indicativas</h3><span>'+monthTasks.length+' ações candidatas</span></div>'+
    '<div class="table-scroll"><table class="finance-planning-table"><thead><tr><th>Data</th><th>Serviço e local</th><th>Unidade / preço</th><th>Quantidade</th><th>Situação</th><th>Critérios</th><th>Ação</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
    '<div id="low-resource-balance"></div>'+
    '<details class="finance-reference-table"><summary>Conferir todas as '+prices.length+' rubricas da tabela de custeio · distribuição teórica em quatro meses</summary><div class="table-scroll"><table class="finance-planning-table"><thead><tr><th>Código</th><th>Rubrica vigente</th><th>Referência mensal teórica</th><th>Parcela do custeio</th></tr></thead><tbody>'+quote+'</tbody></table></div></details>';
   mountLowMobilizationBalance(root.querySelector("#low-resource-balance"),prices,monthTasks,target,expected);
   if(canWrite){
    const getTask=id=>monthTasks.find(v=>v.id===id);
    const qtyInput=id=>root.querySelector('tr[data-proposal="'+id+'"] .monthly-qty');
    root.querySelectorAll("[data-save-proposal]").forEach(button=>button.onclick=async()=>{
     const task=getTask(button.dataset.saveProposal),row=button.closest("tr"),textQty=qtyInput(task.id).value.trim(),n=Number(textQty),planned_for=row.querySelector(".monthly-date")?.value||task.planned_for,location_description=row.querySelector(".monthly-location")?.value.trim()||task.location_description;
     if(textQty&&(!Number.isFinite(n)||n<=0)){notify("Quantidade deve ser maior que zero.",true);return}
      if(!planned_for.startsWith(selected.slice(0,7))){notify("A data precisa pertencer ao mês selecionado.",true);return}
      if(location_description.length<4){notify("Informe o local de execução.",true);return}
     button.disabled=true;
     try{
      const {error}=await db.from("monthly_operational_proposals").update({proposed_quantity:textQty?n:null,planned_for,location_description}).eq("id",task.id);
      if(error)throw error;
      task.proposed_quantity=textQty?n:null;task.planned_for=planned_for;task.location_description=location_description;
      notify("Quantidade preliminar atualizada, ainda sem emissão de OS.");panel();
     }catch(e){notify(e.message,true)}finally{button.disabled=false}
    });
    root.querySelectorAll("[data-issue-proposal]").forEach(button=>button.onclick=async()=>{
     const task=getTask(button.dataset.issueProposal),n=Number(qtyInput(task.id).value.trim());
     if(!Number.isFinite(n)||n<=0){notify("Defina e salve antes a quantidade mensurável por unidade contratual.",true);return}
     const row=button.closest("tr"),editedDate=row.querySelector(".monthly-date")?.value||task.planned_for,editedLocation=row.querySelector(".monthly-location")?.value.trim()||task.location_description;
      if(n!==Number(task.proposed_quantity)||editedDate!==task.planned_for||editedLocation!==task.location_description){notify("Salve quantidade, data e local antes de emitir a OS.",true);return}
      if(/a confirmar|a definir|local exato/i.test(task.location_description)){notify("Defina o local exato antes da emissão da OS.",true);return}
     if(!window.confirm("Confirmou local, medida, disponibilidade e autorização? Esta ação gera uma OS programada para "+date(task.planned_for)+"."))return;
     button.disabled=true;
     try{
      const {data,error}=await db.rpc("issue_planned_work_order",{p_proposal_id:task.id});
      if(error)throw error;
      task.work_order_id=data;task.proposal_status="os_gerada";
      notify("OS gerada a partir de proposta aprovada.");panel();
     }catch(e){notify(e.message,true)}finally{button.disabled=false}
    });
   }
  };
  root.innerHTML='<section class="finance-planning-shell"><div class="finance-panel-heading"><div><span class="eyebrow">CUSTEIO DO CONTRATO ATUAL</span><h2>Planejamento de novembro a janeiro</h2><p>Três competências com meta gerencial, serviços candidatos e autorização de OS controlada pela supervisão.</p></div></div>'+
   '<div class="finance-month-tabs" id="finance-month-tabs">'+months.map(([v,label])=>'<button type="button" data-fin-month="'+v+'"'+(v===selected?' aria-current="true"':'')+'>'+label+'</button>').join("")+'</div>'+
   '<div id="finance-daily-coverage"></div><div id="finance-plan-current"></div></section><div id="finance-climate-advisory"></div>';
  root.querySelectorAll("[data-fin-month]").forEach(btn=>btn.onclick=()=>{
   selected=btn.dataset.finMonth;root.querySelectorAll("[data-fin-month]").forEach(b=>b.setAttribute("aria-current",String(b===btn)));
   const dailyMonth=root.querySelector("#daily-month");if(dailyMonth){dailyMonth.value=selected.slice(0,7);dailyMonth.dispatchEvent(new Event("change"));}
   panel();
  });
  panel();
  await mountDailyCoverage(root.querySelector("#finance-daily-coverage"),db,{role,notify});
  mountWeatherAdvisory(root.querySelector("#finance-climate-advisory"),db);
 }catch(e){root.innerHTML='<div class="notice danger">Não foi possível carregar o planejamento: '+esc(e.message)+'</div>';}
}
