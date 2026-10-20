// SIGA Américas · Métricas financeiras de execução registradas.
// Estimativa de valor ≠ produção comprovada ≠ medição aprovada.
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0));
const numeric=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(Number(n||0));
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=d=>d?String(d).slice(8,10)+"/"+String(d).slice(5,7)+"/"+String(d).slice(0,4):"—";
const monthBR=m=>new Date(m+"-01T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
const counted=r=>r.execution_status!=="cancelada"&&r.validation_status!=="glosada";
export function monthlyExecution(entries,goals,month,matrix=[]){
 const rows=(entries||[]).filter(r=>String(r.performed_on||"").slice(0,7)===month);
 const target=Number((goals||[]).find(g=>String(g.period_month||"").slice(0,7)===month)?.target_amount??500000);
 const included=rows.filter(counted);
 const executed=included.filter(r=>r.execution_status==="executada");
 const matrixIds=new Set((matrix||[]).map(r=>r.id));
 const executedActivities=new Set(executed.filter(r=>matrixIds.has(r.activity_id)).map(r=>r.activity_id));
 const estimated=included.reduce((s,r)=>s+Number(r.estimated_amount||0),0);
 const validated=included.filter(r=>r.validation_status==="validada").reduce((s,r)=>s+Number(r.estimated_amount||0),0);
 const pct=target>0?estimated/target*100:0;
 return {rows,estimated,validated,target,pct,executionCount:executed.length,executedActivities:executedActivities.size,matrixTotal:matrixIds.size,pending:rows.filter(r=>r.validation_status==="a_conferir").length,remaining:Math.max(0,target-estimated)};
}
export function renderFinancialIndicator(entries,goals,month,compact=false,matrix=[]){
 const m=monthlyExecution(entries,goals,month,matrix),pct=Math.min(100,Math.max(0,m.pct));
 const boxes=[
  ["Valor potencial registrado",money(m.estimated),"Execução informada, ainda sujeita à conferência"],
  ["Meta-base mensal",money(m.target),"Referência gerencial, não receita garantida"],
  ["Relação potencial / meta",numeric(m.pct)+"%","Não representa faturamento efetivo"],
  ["Diferença para a meta",money(m.remaining),"Sem projetar dias ainda não registrados"]
 ];
 return '<section class="execution-finance" aria-label="Métricas financeiras da produção registrada">'+
  '<div class="execution-finance-head"><div><span class="eyebrow">META E PRODUÇÃO · '+escape(monthBR(month).toUpperCase())+'</span><h2>Produção financeira mensal</h2>'+
  '<p>Valores estimados por quantidade informada × preço unitário contratual. Não representam medição aceita nem faturamento emitido.</p></div>'+
  (!compact?'<label class="execution-month-label">Competência <input type="month" id="execution-month" value="'+escape(month)+'"></label>':'')+'</div>'+
  '<div class="metric-grid execution-money-grid">'+boxes.map(([name,value,hint])=>
    '<div class="metric"><div class="metric-header">'+escape(name)+'</div><strong>'+escape(value)+'</strong><small>'+escape(hint)+'</small></div>').join('')+'</div>'+
  '<div class="execution-goal-progress"><div><strong>Meta-base: '+escape(money(m.target))+'</strong><span>'+escape(numeric(m.pct))+'% do valor potencial registrado</span></div>'+
  '<div class="execution-progress-track"><span style="width:'+pct.toFixed(2)+'%"></span></div>'+
  '<div class="execution-finance-detail"><strong>'+m.executionCount+' apontamentos de execução cadastrados</strong>'+
  '<span>'+m.executedActivities+' de '+m.matrixTotal+' atividades da matriz com apontamentos neste mês</span>'+
  '<span>'+m.pending+' registros pendentes de conferência técnica/documental</span>'+
  (m.validated>0?'<span>Valor tecnicamente validado: '+money(m.validated)+'</span>':'<span>Nenhum valor tecnicamente validado neste indicador</span>')+
  '<span>Apontamento não comprova entrega, medição aceita ou faturamento.</span></div></div></section>';
}
export function renderExecutionTable(entries,month){
 const rows=(entries||[]).filter(r=>String(r.performed_on||"").slice(0,7)===month)
  .sort((a,b)=>String(a.performed_on).localeCompare(String(b.performed_on))||String(a.activity_label).localeCompare(String(b.activity_label),"pt-BR"));
 return '<section class="table-panel execution-month-table">'+
  '<div class="table-head"><div><h2>Com execução registrada · '+escape(monthBR(month))+'</h2>'+
  '<span>'+rows.length+' formulários individuais · registros do preposto e demais fontes cadastradas</span></div>'+
  '<button class="btn btn-secondary" type="button" data-nav="field_execution_entries">Abrir formulários de execução</button></div>'+

  '<div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Atividade / local</th><th>Quantidade</th><th>Preço unitário</th><th>Valor estimado</th><th>Conferência</th><th>Formulário</th></tr></thead><tbody>'+
  (rows.map(r=>'<tr><td>'+escape(dateBR(r.performed_on))+'</td>'+
   '<td><strong>'+escape(r.activity_label)+'</strong><small class="execution-location">'+escape(r.location||"Local a conferir")+'</small></td>'+
   '<td>'+escape(numeric(r.quantity))+' '+escape(r.unit||"")+'</td>'+
   '<td>'+escape(money(r.unit_price))+'</td>'+
   '<td><strong>'+escape(money(r.estimated_amount))+'</strong></td>'+
   '<td>'+escape(r.validation_status==="validada"?"Validada":r.validation_status==="glosada"?"Glosada":"A conferir")+'</td>'+
   '<td><button class="table-action" data-action="editExecution" data-execution-id="'+escape(r.id)+'">Editar ↗</button></td></tr>').join('')
   ||'<tr><td colspan="7">Nenhuma execução registrada nesta competência.</td></tr>')+
  '</tbody></table></div></section>';
}
