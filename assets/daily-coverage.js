// Programação diária por equipe: disponibilidade planejada não significa execução.
import {downloadDailySchedules} from "./daily-schedule-pdf.js?v=1";
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
 let month="2026-11",day=null,teamFilter="",generatingPDF=false;
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
   '<div class="finance-panel-heading daily-cover-top"><div><span class="eyebrow">PROGRAMAÇÃO DE CAMPO</span><h2>Escala diária das equipes</h2>'+
   '<p>Atividade principal, alternativa segura e bloqueio quando necessário.</p></div>'+
   '<div class="daily-pdf-actions"><button type="button" class="btn btn-primary" id="daily-pdf-all">PDF do dia · 6 equipes</button>'+
   (teamFilter?'<button type="button" class="btn btn-secondary" id="daily-pdf-selected">PDF da equipe</button>':"")+
   '</div></div>'+
   '<div class="daily-cover-kpis daily-cover-overview">'+
   '<div><strong>'+daysComplete+' de '+days.length+'</strong><span>dias com equipes programadas</span></div>'+
   '<div><strong>'+selected.length+'</strong><span>equipes exibidas no dia</span></div>'+
   '<div><strong>'+blocked+' imp. · '+reassigned+' rem.</strong><span>ocorrências neste mês</span></div></div>'+
   '<div class="daily-cover-selects"><label>Competência<select id="daily-month">'+
    [['2026-11','Novembro/2026'],['2026-12','Dezembro/2026'],['2027-01','Janeiro/2027']].map(([v,l])=>'<option value="'+v+'"'+(v===month?' selected':'')+'>'+l+'</option>').join("")+'</select></label>'+
    '<label>Dia operacional<select id="daily-date">'+days.map(d=>'<option value="'+d+'"'+(d===day?' selected':'')+'>'+safe(dateBR(d))+'</option>').join("")+'</select></label>'+
    '<label>Equipe<select id="daily-team"><option value="">Todas as seis</option>'+
     [...teams.values()].sort((a,b)=>a.code.localeCompare(b.code)).map(t=>'<option value="'+safe(t.code)+'"'+(t.code===teamFilter?' selected':'')+'>'+safe(t.code)+' · '+safe(t.name)+'</option>').join("")+'</select></label></div>'+
   '<div class="daily-cover-list">'+selected.map(e=>{
    const t=teams.get(e.team_id)||{},a=areas.get(e.area_id)||{},c=prices.get(e.contract_item_id)||{},locked=e.block_status==="validada";
    return '<article class="daily-cover-card" data-daily-id="'+safe(e.id)+'"><div class="daily-cover-card-head"><div><strong>'+safe(t.code||"—")+' · '+safe(t.name||"Equipe")+'</strong>'+
     '<small>'+safe(a.name||"A conferir")+' · Rubrica '+safe(c.code||"—")+' · '+safe(c.unit||"—")+'</small></div>'+
     '<span class="status-chip" data-status="'+safe(e.block_status)+'">'+safe(stateLabels[e.block_status]||e.block_status)+'</span></div>'+
     '<p class="daily-activity-title">'+safe(String(e.planned_service||"").replace(/\\s*·\\s*programação diária.*$/i,""))+'</p>'+
     '<p class="daily-place"><strong>Local previsto</strong><span>'+safe(e.planned_location)+'</span></p>'+
     '<details class="daily-plan-details"><summary>Alternativa e orientações</summary><p>'+safe(e.climate_alternative)+'</p></details>'+
     (canManage&&!locked?'<div class="daily-cover-actions"><label>Situação<select class="daily-new-status" aria-label="Situação da equipe">'+
     ['programada','remanejada','impedida'].map(v=>'<option value="'+v+'"'+(e.block_status===v?' selected':'')+'>'+safe(stateLabels[v])+'</option>').join("")+'</select></label>'+
     '<label class="daily-reason-wrap" '+(e.block_status==="programada"?"hidden":"")+' >Motivo / providência<textarea class="daily-reason" rows="2" placeholder="Descreva o bloqueador e a alternativa adotada">'+safe(e.blocker_reason||"")+'</textarea></label>'+
     '<button type="button" class="btn btn-secondary" data-daily-save="'+safe(e.id)+'">Salvar</button></div>':
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
   if((status==="impedida"||status==="remanejada")&&reason.length<6){notify("Descreva o bloqueio ou remanejamento antes de salvar.",true);return}
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
