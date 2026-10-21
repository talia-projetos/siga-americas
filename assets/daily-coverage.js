// Programação diária por equipe: disponibilidade planejada não significa execução.
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=x=>new Date(x+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});
const stateLabels={programada:"Programada",remanejada:"Remanejada",impedida:"Impedida",informada:"Execução informada",validada:"Validada"};
export async function mountDailyCoverage(root,db,{role,notify}){
 const canManage=["supervisao","gestao","admin"].includes(role);
 root.innerHTML='<p class="document-muted">Carregando a programação diária das equipes...</p>';
 const [daily,teamRes,areaRes,priceRes]=await Promise.all([
  db.from("daily_team_assignments").select("id,work_date,team_id,area_id,contract_item_id,planned_service,planned_location,climate_alternative,block_status,blocker_reason,verified_quantity,work_order_id").gte("work_date","2026-11-01").lte("work_date","2027-01-31").order("work_date").limit(900),
  db.from("teams").select("id,code,name,active").eq("active",true),
  db.from("operational_areas").select("id,code,name"),
  db.from("contract_items").select("id,code,name,unit,source_type").eq("source_type","precos")
 ]);
 const error=[daily,teamRes,areaRes,priceRes].find(x=>x.error)?.error;
 if(error){root.innerHTML='<div class="notice warning">Não foi possível carregar a escala diária: '+safe(error.message)+'</div>';return}
 const entries=daily.data||[],teams=new Map((teamRes.data||[]).map(x=>[x.id,x])),areas=new Map((areaRes.data||[]).map(x=>[x.id,x])),prices=new Map((priceRes.data||[]).map(x=>[x.id,x]));
 let month="2026-11",day=null,teamFilter="";
 const grouped=()=>entries.filter(x=>x.work_date.startsWith(month));
 const dates=()=>[...new Set(grouped().map(x=>x.work_date))].sort();
 const draw=()=>{
  const all=grouped(),days=dates();
  if(!days.includes(day))day=days[0]||null;
  const blocked=all.filter(e=>e.block_status==="impedida").length, reassigned=all.filter(e=>e.block_status==="remanejada").length;
  const daysComplete=days.filter(d=>new Set(all.filter(e=>e.work_date===d).map(e=>e.team_id)).size===6).length;
  let selected=all.filter(e=>e.work_date===day);
  if(teamFilter)selected=selected.filter(e=>teams.get(e.team_id)?.code===teamFilter);
  root.innerHTML='<section class="daily-coverage-shell">'+
   '<div class="finance-panel-heading"><div><span class="eyebrow">COBERTURA OPERACIONAL · SEM MEDIÇÃO PRESUMIDA</span><h2>Escala diária das equipes</h2>'+
   '<p>Programação principal e alternativa para cada equipe. A execução e a autorização de medição precisam de confirmação independente.</p></div></div>'+
   '<div class="daily-cover-kpis">'+
    '<div><strong>'+daysComplete+' / '+days.length+'</strong><span>dias com seis equipes programadas</span></div>'+
    '<div><strong>'+all.length+'</strong><span>alocações no mês</span></div>'+
    '<div><strong>'+blocked+'</strong><span>impedimentos registrados</span></div>'+
    '<div><strong>'+reassigned+'</strong><span>remanejamentos registrados</span></div></div>'+
   '<div class="daily-cover-selects"><label>Competência<select id="daily-month">'+
    [['2026-11','Novembro/2026'],['2026-12','Dezembro/2026'],['2027-01','Janeiro/2027']].map(([v,l])=>'<option value="'+v+'"'+(v===month?' selected':'')+'>'+l+'</option>').join("")+'</select></label>'+
    '<label>Dia operacional<select id="daily-date">'+days.map(d=>'<option value="'+d+'"'+(d===day?' selected':'')+'>'+safe(dateBR(d))+'</option>').join("")+'</select></label>'+
    '<label>Equipe<select id="daily-team"><option value="">Todas as seis</option>'+
     [...teams.values()].sort((a,b)=>a.code.localeCompare(b.code)).map(t=>'<option value="'+safe(t.code)+'"'+(t.code===teamFilter?' selected':'')+'>'+safe(t.code)+' · '+safe(t.name)+'</option>').join("")+'</select></label></div>'+
   '<div class="daily-cover-list">'+selected.map(e=>{
    const t=teams.get(e.team_id)||{},a=areas.get(e.area_id)||{},c=prices.get(e.contract_item_id)||{},locked=e.block_status==="validada";
    return '<article class="daily-cover-card" data-daily-id="'+safe(e.id)+'"><div class="daily-cover-card-head"><div><strong>'+safe(t.code||"—")+' · '+safe(t.name||"Equipe")+'</strong>'+
     '<small>Frente: '+safe(a.name||"A conferir")+' · tabela de preços '+safe(c.code||"—")+' · '+safe(c.unit||"—")+'</small></div>'+
     '<span class="status-chip" data-status="'+safe(e.block_status)+'">'+safe(stateLabels[e.block_status]||e.block_status)+'</span></div>'+
     '<p><strong>Atividade principal: </strong>'+safe(e.planned_service)+'</p>'+
     '<p><strong>Local indicativo: </strong>'+safe(e.planned_location)+'</p>'+
     '<p><strong>Alternativa / chuva: </strong>'+safe(e.climate_alternative)+'</p>'+
     (canManage&&!locked?'<div class="daily-cover-actions"><label>Situação<select class="daily-new-status" aria-label="Situação da equipe">'+
     ['programada','remanejada','impedida'].map(v=>'<option value="'+v+'"'+(e.block_status===v?' selected':'')+'>'+safe(stateLabels[v])+'</option>').join("")+'</select></label>'+
     '<label>Motivo / evidência de impedimento<textarea class="daily-reason" rows="2" placeholder="Obrigatório se impedida">'+safe(e.blocker_reason||"")+'</textarea></label>'+
     '<button type="button" class="btn btn-secondary" data-daily-save="'+safe(e.id)+'">Salvar situação</button></div>':
     (e.blocker_reason?'<p><strong>Justificativa registrada:</strong> '+safe(e.blocker_reason)+'</p>':''))+
     '</article>';
   }).join("")+'</div>'+
   '<p class="finance-scenario-alert">Calendário-base de segunda a sexta-feira, exceto feriados nacionais de 02/11, 20/11, 25/12 e 01/01. Finais de semana, pontos facultativos e escalas especiais exigem confirmação da empresa. Uma equipe programada não está automaticamente mobilizada. Serviços mensais (mês) não são remunerados por dia, mesmo quando a rotina ocorre diariamente.</p>'+
   '</section>';
  root.querySelector("#daily-month").onchange=e=>{month=e.target.value;day=null;draw()};
  root.querySelector("#daily-date").onchange=e=>{day=e.target.value;draw()};
  root.querySelector("#daily-team").onchange=e=>{teamFilter=e.target.value;draw()};
  if(canManage)root.querySelectorAll("[data-daily-save]").forEach(button=>button.onclick=async()=>{
   const item=entries.find(x=>x.id===button.dataset.dailySave),card=button.closest(".daily-cover-card");
   const status=card.querySelector(".daily-new-status").value,reason=card.querySelector(".daily-reason").value.trim();
   if(status==="impedida"&&reason.length<6){notify("Descreva o motivo do bloqueio antes de salvar.",true);return}
   button.disabled=true;
   try{
    const {error}=await db.from("daily_team_assignments").update({block_status:status,blocker_reason:status==="programada"?null:reason||null,updated_at:new Date().toISOString()}).eq("id",item.id);
    if(error)throw error;
    item.block_status=status;item.blocker_reason=status==="programada"?null:reason||null;
    notify("Situação da equipe registrada, sem confirmar execução.");draw();
   }catch(e){notify(e.message||"Erro ao salvar situação.",true);button.disabled=false}
  });
 };
 draw();
}
