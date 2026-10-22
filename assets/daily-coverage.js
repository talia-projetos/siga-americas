// SIGA Américas · planejamento diário por manhã/tarde e postos fixos.
// O registro diário é referência; somente turnos gravados são considerados detalhados.
// Não atribuir automaticamente atividades, trabalhadores, validação ou execução.
import {downloadDailySchedules,downloadMonthlySchedules} from "./daily-schedule-pdf.js?v=7";
import {secondaryCandidates,priceLabel} from "./low-resource-options.js?v=1";
import {mountDailyApproval} from "./daily-approval.js?v=2";
import {mountMaintenanceActionPanel} from "./maintenance-action-panel.js?v=1";
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=x=>new Date(x+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});
const stateLabels={programada:"Programada",remanejada:"Remanejada",impedida:"Impedida",informada:"Execução informada",validada:"Validada"};
const shifts=[["manha","MANHÃ"],["tarde","TARDE"]];
const sorted=(a,b)=>String(a.code).localeCompare(String(b.code),"pt-BR",{numeric:true});
const trimDaily=s=>String(s||"").replace(/\s*·\s*programação diária.*$/i,"").trim();

export async function mountDailyCoverage(root,db,{role,notify}){
 const canManage=["supervisao","gestao","admin"].includes(role);
 root.innerHTML='<p class="document-muted">Carregando equipes, postos fixos e turnos...</p>';
 const [dailyRes,teamRes,areaRes,priceRes,postRes,routineRes,shiftRes,shiftRes2,approvalRes,orderLinksRes]=await Promise.all([
  db.from("daily_team_assignments").select("id,work_date,team_id,area_id,contract_item_id,planned_service,planned_location,climate_alternative,block_status,blocker_reason,verified_quantity,work_order_id").gte("work_date","2026-11-01").lte("work_date","2027-01-31").order("work_date").limit(900),
  db.from("teams").select("id,code,name,active").eq("active",true),
  db.from("operational_areas").select("id,code,name"),
  db.from("contract_items").select("id,code,name,unit,unit_price,source_type").eq("source_type","precos"),
  db.from("service_posts").select("id,code,name,contractual_reference,fixed_positions,verification_status").order("code"),
  db.from("field_routine_templates").select("id,service_post_id,routine_code,title,frequency,execution_guidance,active,validation_status").eq("active",true).limit(150),
  db.from("daily_shift_plans").select("id,work_date,shift,team_assignment_id,service_post_id,planned_activity,planned_location,supervisor_note,review_status,reviewed_by,reviewed_at").gte("work_date","2026-11-01").lte("work_date","2027-01-31").order("work_date").order("id").range(0,999),
  db.from("daily_shift_plans").select("id,work_date,shift,team_assignment_id,service_post_id,planned_activity,planned_location,supervisor_note,review_status,reviewed_by,reviewed_at").gte("work_date","2026-11-01").lte("work_date","2027-01-31").order("work_date").order("id").range(1000,1999),
  db.from("daily_plan_approvals").select("id,work_date,manager_name,approval_reference,approved_on,recorded_by").gte("work_date","2026-11-01").lte("work_date","2027-01-31"),
  db.from("daily_plan_order_links").select("id,work_date,work_order_id,team_assignment_id,service_post_id").gte("work_date","2026-11-01").lte("work_date","2027-01-31").limit(1600)
 ]);
 const error=[dailyRes,teamRes,areaRes,priceRes,postRes,routineRes,shiftRes,shiftRes2,approvalRes,orderLinksRes].find(x=>x.error)?.error;
 if(error){root.innerHTML='<div class="notice warning">Não foi possível carregar a escala por turnos: '+safe(error.message)+'</div>';return}
 const entries=dailyRes.data||[],teams=new Map((teamRes.data||[]).map(x=>[x.id,x])),
  areas=new Map((areaRes.data||[]).map(x=>[x.id,x])),prices=new Map((priceRes.data||[]).map(x=>[x.id,x])),
  posts=(postRes.data||[]).slice().sort(sorted),routines=routineRes.data||[],plans=[...(shiftRes.data||[]),...(shiftRes2.data||[])];
 const planKey=(kind,id,date,shift)=>kind+":"+id+":"+date+":"+shift;
 const planIndex=new Map(plans.map(p=>[planKey(p.service_post_id?"posto":"equipe",p.service_post_id||p.team_assignment_id,p.work_date,p.shift),p]));
 const approvals=new Map((approvalRes.data||[]).map(p=>[p.work_date,p]));
 let orderLinks=orderLinksRes.data||[];
 const getPlan=(kind,id,date,shift)=>planIndex.get(planKey(kind,id,date,shift));
 let month="2026-11",day=null,teamFilter="",postFilter="",generatingPDF=false,busy=false;
 const openCards=new Set();let initialCardSet=false,maintenanceOpened=false;
 const grouped=()=>entries.filter(e=>e.work_date.startsWith(month));
 const dates=()=>[...new Set(grouped().map(e=>e.work_date))].sort();
 const postRoutines=id=>routines.filter(r=>r.service_post_id===id).sort((a,b)=>a.routine_code.localeCompare(b.routine_code,"pt-BR"));
 const selectedRoutine=(ref,date,shift)=>{
  // Uma rotina semanal ou mensal exige indicação efetiva da supervisão;
  // não presumir uma data fixa de execução com base no dia da semana.
  if(!ref.length)return null;
  const dailyCode=shift==="manha"?"D1":"D2";
  return ref.find(r=>r.routine_code===dailyCode)||null;
 };
 const routineLabel=r=>{
  const frequency={diaria:"Diária",semanal:"Semanal",mensal:"Mensal"}[r.frequency]||r.frequency;
  return frequency+" · "+r.title+" ("+r.routine_code+")";
 };
 const dailyValid=(kind,id,date)=>shifts.every(([shift])=>{const plan=getPlan(kind,id,date,shift);return Boolean(plan?.review_status==="revisado"&&plan?.planned_activity?.trim()&&plan?.planned_location?.trim())});
 const shiftRows=(kind,id,date)=>{
  return '<div class="daily-shift-grid">'+shifts.map(([shift,label])=>{
   const p=getPlan(kind,id,date,shift),ref=kind==="posto"?postRoutines(id):[],
    savedRoutine=ref.find(r=>String(p?.planned_activity||"").startsWith(r.title)),
    routine=kind==="posto"?(savedRoutine||(p?.planned_activity?null:selectedRoutine(ref,date,shift))):null;
   return '<div class="daily-shift" data-shift-kind="'+kind+'" data-shift-id="'+safe(id)+'" data-shift-date="'+safe(date)+'" data-shift="'+shift+'">'+
    '<div class="daily-shift-head"><strong>'+label+'</strong><span class="daily-shift-state '+(p?.review_status==="revisado"?"is-saved":"is-pending")+'">'+(p?.review_status==="revisado"?"Turno revisado":p?"Rascunho · revisar":"A definir / conferir")+'</span></div>'+
    (canManage&&!approvals.has(date)?'<label>Atividade prevista<textarea class="daily-shift-activity" maxlength="600" rows="2" placeholder="Definir atividade deste turno">'+safe(p?.planned_activity||"")+'</textarea></label>'+
     '<label>Local / trecho<input class="daily-shift-location" maxlength="300" value="'+safe(p?.planned_location||"")+'" placeholder="Local a confirmar"></label>'+
     '<label>Orientação / observação<input class="daily-shift-note" maxlength="1000" value="'+safe(p?.supervisor_note||"")+'" placeholder="Opcional"></label>'+
     (kind==="posto"&&ref.length?'<label>Rotina contratual sugerida<select class="daily-routine-choice"><option value="">Sem rotina específica</option>'+
       ref.map(r=>'<option value="'+safe(r.id)+'"'+(routine?.id===r.id?' selected':'')+'>'+safe(routineLabel(r))+'</option>').join("")+'</select></label>':"")+
     '<button class="btn btn-secondary" type="button" data-save-shift>Revisar e salvar '+label.toLowerCase()+'</button>':
     '<p><strong>Atividade:</strong> '+safe(p?.planned_activity||"A definir pela supervisão")+'</p>'+
     '<p><strong>Local:</strong> '+safe(p?.planned_location||"A confirmar")+'</p>'+
     (p?.supervisor_note?'<p>'+safe(p.supervisor_note)+'</p>':""))+
   '</div>';
  }).join("")+'</div>';
 };
 const draw=()=>{
  const all=grouped(),days=dates();
  if(!days.includes(day))day=days[0]||null;
  const todayTeams=all.filter(e=>e.work_date===day);
  const shownTeams=todayTeams.filter(e=>!teamFilter||teams.get(e.team_id)?.code===teamFilter);
  const shownPosts=posts.filter(p=>!postFilter||p.code===postFilter);
  if(!initialCardSet){if(shownTeams[0])openCards.add("equipe:"+shownTeams[0].id);initialCardSet=true;}
  const dayShifts=todayTeams.filter(e=>dailyValid("equipe",e.id,day)).length+
   posts.filter(p=>dailyValid("posto",p.id,day)).length;
  const totalBlocks=todayTeams.length+posts.length;
  const approval=approvals.get(day),issued=orderLinks.filter(link=>link.work_date===day);
  const monthDates=days.length;
  root.innerHTML='<section class="daily-coverage-shell daily-cover-shifts">'+
   '<div class="finance-panel-heading daily-cover-top"><div><span class="eyebrow">PROPOSTA PARA VALIDAÇÃO · GESTÃO CONTRATUAL</span><h2>Planejamento diário · manhã e tarde</h2>'+
   '<p>Seis equipes operacionais e seis postos fixos do item 3.40. Cada turno possui atividade própria; campos em branco exigem definição da supervisão.</p></div>'+
   '<div class="daily-pdf-actions"><button type="button" class="btn btn-primary" id="daily-pdf-month">PDF mensal · equipes e postos</button>'+
   '<button type="button" class="btn btn-secondary" id="daily-pdf-all">PDF do dia · completo</button>'+
   (teamFilter?'<button type="button" class="btn btn-secondary" id="daily-pdf-selected">PDF da equipe</button>':"")+
   '</div></div>'+
   '<div class="daily-cover-kpis daily-cover-overview">'+
    '<div><strong>'+todayTeams.length+'</strong><span>equipes na data</span></div>'+
    '<div><strong>'+posts.length+'</strong><span>postos fixos contratuais</span></div>'+
    '<div><strong>'+dayShifts+' de '+totalBlocks+'</strong><span>unidades com ambos os turnos revisados</span></div>'+
   '</div>'+
   '<div class="daily-overview-progress" aria-label="Progresso de revisão de turnos"><span style="width:'+Math.min(100,totalBlocks?100*dayShifts/totalBlocks:0)+'%"></span></div>'+
   '<div class="daily-cover-selects"><label>Competência<select id="daily-month">'+
    [["2026-11","Novembro/2026"],["2026-12","Dezembro/2026"],["2027-01","Janeiro/2027"]].map(([m,n])=>'<option value="'+m+'"'+(m===month?' selected':'')+'>'+n+'</option>').join("")+'</select></label>'+
   '<label>Dia útil previsto<select id="daily-date">'+days.map(d=>'<option value="'+d+'"'+(d===day?' selected':'')+'>'+safe(dateBR(d))+'</option>').join("")+'</select></label>'+
   '<label>Equipe<select id="daily-team"><option value="">Todas as seis</option>'+[...teams.values()].sort(sorted).map(t=>'<option value="'+safe(t.code)+'"'+(t.code===teamFilter?' selected':'')+'>'+safe(t.code+' · '+t.name)+'</option>').join("")+'</select></label>'+
   '<label>Posto fixo<select id="daily-post"><option value="">Todos os seis</option>'+posts.map(p=>'<option value="'+safe(p.code)+'"'+(p.code===postFilter?' selected':'')+'>'+safe(p.code+' · '+p.name)+'</option>').join("")+'</select></label></div>'+
   '<div class="daily-plan-block-title"><h3>1 · Equipes operacionais</h3><span>Selecione um cartão para revisar manhã e tarde</span></div>'+
   '<div class="daily-cover-list">'+shownTeams.map(e=>{
    const t=teams.get(e.team_id)||{},a=areas.get(e.area_id)||{},c=prices.get(e.contract_item_id)||{};
    const locked=e.block_status==="validada",secondary=secondaryCandidates([...prices.values()],e,a);
    return '<details class="daily-cover-card daily-plan-accordion" data-daily-id="'+safe(e.id)+'"'+(openCards.has('equipe:'+e.id)?' open':'')+'>'+
     '<summary class="daily-cover-card-head"><div><strong>'+safe(t.code||"—")+' · '+safe(t.name||"Equipe")+'</strong>'+
      '<small>'+safe(a.name||"Frente a confirmar")+' · Rubrica '+safe(c.code||"—")+'</small></div>'+
      '<span class="daily-card-status"><span class="daily-card-count">'+shifts.filter(([shift])=>getPlan('equipe',e.id,day,shift)?.review_status==='revisado').length+'/2 turnos</span><span class="status-chip" data-status="'+safe(e.block_status)+'">'+safe(stateLabels[e.block_status]||e.block_status)+'</span><span class="daily-card-chevron" aria-hidden="true">⌄</span></span></summary><div class="daily-plan-card-content">'+
     '<p class="daily-activity-title"><small>Atividade diária de referência:</small> '+safe(trimDaily(e.planned_service))+'</p>'+
     '<p class="daily-place"><strong>Local original:</strong><span>'+safe(e.planned_location)+'</span></p>'+
     shiftRows("equipe",e.id,day)+
     '<details class="daily-plan-details"><summary>Alternativa e segurança</summary><p>'+safe(e.climate_alternative)+'</p>'+
     (secondary.length?'<ul class="daily-secondary-prices">'+secondary.map(p=>'<li><strong>'+safe(priceLabel(p))+'</strong><small>'+safe(p.requirements)+'</small></li>').join("")+'</ul>':"")+
     '<small>Os itens alternativos são possibilidades condicionadas à avaliação técnica e à medição contratual.</small></details>'+
     (canManage&&!locked&&!approval?'<div class="daily-cover-actions"><label>Situação<select class="daily-new-status">'+
       ["programada","remanejada","impedida"].map(v=>'<option value="'+v+'"'+(e.block_status===v?' selected':'')+'>'+safe(stateLabels[v])+'</option>').join("")+'</select></label>'+
       '<label class="daily-reason-wrap" '+(e.block_status==="programada"?"hidden":"")+'>Motivo / providência<textarea class="daily-reason" rows="2">'+safe(e.blocker_reason||"")+'</textarea></label>'+
       '<button type="button" class="btn btn-secondary" data-daily-save="'+safe(e.id)+'">Salvar situação</button></div>':
       e.blocker_reason?'<p>'+safe(e.blocker_reason)+'</p>':"")+
    '</div></details>';
   }).join("")+'</div>'+
   '<details class="daily-maintenance-wrapper"'+(maintenanceOpened?' open':'')+'><summary><strong>Carteira de manutenção global</strong><span>Prioridades, pendências e rotinas · abrir acompanhamento</span></summary><div id="daily-maintenance-actions"></div></details>'+
   '<div class="daily-plan-block-title"><h3>2 · Postos fixos · item 3.40</h3><span>Rotinas próprias, sem duplicação de efetivo</span></div>'+
   '<p class="daily-routine-legend"><strong>Legenda das rotinas:</strong> <b>D1</b> Conservação de jardins (diária) · <b>D2</b> Rastelamento (diária) · <b>S1</b> Vasos e jardineiras (semanal) · <b>M1–M3</b> Rotinas mensais. Frequência não determina automaticamente o dia de realização.</p>'+
   '<div class="daily-cover-list">'+shownPosts.map(p=>{
     const rt=postRoutines(p.id),daily=rt.filter(r=>r.frequency==="diaria");
     return '<details class="daily-cover-card daily-fixed-post daily-plan-accordion" data-post-id="'+safe(p.id)+'"'+(openCards.has('posto:'+p.id)?' open':'')+'><summary class="daily-cover-card-head"><div><strong>Posto '+safe(p.code)+' · '+safe(p.name)+'</strong>'+
       '<small>'+safe(p.contractual_reference)+' · '+safe(p.fixed_positions)+' posição(ões) contratual(is) · '+safe(p.verification_status)+'</small></div>'+
       '<span class="daily-card-status"><span class="daily-card-count">'+shifts.filter(([shift])=>getPlan('posto',p.id,day,shift)?.review_status==='revisado').length+'/2 turnos</span><span class="status-chip" data-status="'+safe(p.verification_status)+'">'+(dailyValid("posto",p.id,day)?"Revisado":"Rascunho")+'</span><span class="daily-card-chevron" aria-hidden="true">⌄</span></span></summary><div class="daily-plan-card-content">'+
       '<p class="daily-activity-title"><small>Rotinas diárias de referência:</small> '+safe(daily.map(r=>r.title).join(" · ")||"Consultar modelo contratual")+'</p>'+
       shiftRows("posto",p.id,day)+
       '<details class="daily-plan-details"><summary>Rotinas e orientações do posto ('+rt.length+')</summary><ul>'+
       rt.map(r=>'<li><strong>'+safe(routineLabel(r))+'</strong> <small>'+safe(r.execution_guidance||"")+'</small></li>').join("")+
       '</ul></details></div></details>';
   }).join("")+'</div>'+
   '<div id="daily-approval-slot"></div>'+ 
   '<details class="daily-plan-guidance"><summary>Critérios para aprovação e cuidados do planejamento</summary><p>O gestor deve confirmar horários, alocação nominal, segurança, local e documentação. Os postos fixos não são equipes adicionais; rotinas cadastradas são referência, não execução comprovada. A escala-base exclui os feriados nacionais de 02/11, 20/11, 25/12 e 01/01; conferir feriados locais e situações especiais. Exportar PDF não constitui aceite nem OS autorizada.</p></details>'+
   '</section>';
  const maintenanceWrapper=root.querySelector(".daily-maintenance-wrapper");
  const loadMaintenance=()=>{
   if(!maintenanceWrapper.open||maintenanceWrapper.dataset.loaded)return;
   maintenanceWrapper.dataset.loaded="true";
   void mountMaintenanceActionPanel(root.querySelector("#daily-maintenance-actions"),db,{role,notify});
  };
  if(maintenanceOpened)loadMaintenance();
  maintenanceWrapper.addEventListener("toggle",()=>{maintenanceOpened=maintenanceWrapper.open;loadMaintenance()});
  mountDailyApproval(root.querySelector("#daily-approval-slot"),db,{date:day,approval,issued,expected:totalBlocks,completed:dayShifts,canManage,notify,teams,areas,prices,
   onApproved:record=>{approvals.set(day,record);draw()},
   onIssued:links=>{orderLinks=[...orderLinks.filter(x=>x.work_date!==day),...links];draw()}
  });
  root.querySelectorAll("details.daily-plan-accordion").forEach(card=>card.addEventListener("toggle",()=>{
   const key=card.dataset.dailyId?"equipe:"+card.dataset.dailyId:"posto:"+card.dataset.postId;
   if(card.open)openCards.add(key);else openCards.delete(key);
  }));
  root.querySelector("#daily-month").onchange=e=>{month=e.target.value;day=null;draw()};
  root.querySelector("#daily-date").onchange=e=>{day=e.target.value;draw()};
  root.querySelector("#daily-team").onchange=e=>{teamFilter=e.target.value;if(teamFilter){const item=entries.find(x=>teams.get(x.team_id)?.code===teamFilter);if(item)openCards.add("equipe:"+item.id);}draw()};
  root.querySelector("#daily-post").onchange=e=>{postFilter=e.target.value;if(postFilter){const p=posts.find(x=>x.code===postFilter);if(p)openCards.add("posto:"+p.id);}draw()};
  root.querySelectorAll(".daily-routine-choice").forEach(select=>select.onchange=()=>{
   const r=routines.find(v=>v.id===select.value);if(!r)return;
   const box=select.closest(".daily-shift");
   if(box)box.querySelector(".daily-shift-activity").value=r.title+(r.execution_guidance?" · "+r.execution_guidance:"");
  });
  if(canManage)root.querySelectorAll("[data-save-shift]").forEach(button=>button.onclick=async()=>{
   if(busy)return;
   const row=button.closest(".daily-shift"),kind=row.dataset.shiftKind,id=row.dataset.shiftId,
    shift=row.dataset.shift,date=row.dataset.shiftDate,
    activity=row.querySelector(".daily-shift-activity").value.trim(),
    location=row.querySelector(".daily-shift-location").value.trim(),
    note=row.querySelector(".daily-shift-note").value.trim(),
    existing=getPlan(kind,id,date,shift);
   if(activity.length<3||location.length<3){notify("Preencha atividade e local do turno antes de salvar.",true);return;}
   if(kind==="equipe"&&!entries.some(e=>e.id===id&&e.work_date===date)){notify("Equipe não corresponde à data selecionada.",true);return;}
   busy=true;button.disabled=true;
   const auth=await db.auth.getUser();
   const reviewer=auth.data?.user?.id;
   if(auth.error||!reviewer){notify("É necessário estar autenticado para revisar o turno.",true);busy=false;button.disabled=false;return;}
   const payload={work_date:date,shift,planned_activity:activity,planned_location:location,supervisor_note:note||null,
    review_status:"revisado",reviewed_by:reviewer,reviewed_at:new Date().toISOString(),
    team_assignment_id:kind==="equipe"?id:null,service_post_id:kind==="posto"?id:null,updated_at:new Date().toISOString()};
   try{
    const query=existing?db.from("daily_shift_plans").update(payload).eq("id",existing.id):
      db.from("daily_shift_plans").insert(payload);
    const {data,error}=await query.select("id,work_date,shift,team_assignment_id,service_post_id,planned_activity,planned_location,supervisor_note,review_status,reviewed_by,reviewed_at").single();
    if(error)throw error;
    planIndex.set(planKey(kind,id,date,shift),data);
    notify("Turno revisado e salvo como proposta para avaliação do gestor. Não constitui aprovação.");draw();
   }catch(e){notify("Erro ao salvar turno: "+(e.message||e),true);button.disabled=false}
   finally{busy=false}
  });
  const setBusy=flag=>{generatingPDF=flag;root.querySelectorAll("#daily-pdf-month,#daily-pdf-all,#daily-pdf-selected").forEach(b=>{b.disabled=flag;b.setAttribute("aria-busy",String(flag))});};
  const printDay=async single=>{
   if(generatingPDF||!day)return;
   const onDay=entries.filter(e=>e.work_date===day),chosen=single?onDay.filter(e=>teams.get(e.team_id)?.code===teamFilter):onDay;
   if(!chosen.length){notify("Não há equipe programada na data selecionada.",true);return;}
   setBusy(true);
   try{
    await downloadDailySchedules(chosen,teams,areas,prices,single?[]:posts,planIndex,single?[]:routines,approvals.get(day)||null);
    notify("PDF de proposta por manhã/tarde gerado para revisão do gestor do contrato.");
   }catch(e){notify("Erro ao gerar PDF: "+(e.message||e),true)}finally{setBusy(false)}
  };
  root.querySelector("#daily-pdf-all").onclick=()=>printDay(false);
  if(teamFilter)root.querySelector("#daily-pdf-selected").onclick=()=>printDay(true);
  root.querySelector("#daily-pdf-month").onclick=async()=>{
   if(generatingPDF)return;
   const monthly=entries.filter(e=>e.work_date.startsWith(month));
   if(!monthly.length){notify("Nenhuma programação nesta competência.",true);return;}
   setBusy(true);
   try{
    await downloadMonthlySchedules(monthly,teams,areas,prices,month,posts,planIndex,routines);
    notify("PDF mensal com equipes e postos fixos gerado para validação contratual.");
   }catch(e){notify("Erro ao gerar PDF mensal: "+(e.message||e),true)}finally{setBusy(false)}
  };
  root.querySelectorAll(".daily-new-status").forEach(select=>select.onchange=()=>{
   const wrap=select.closest(".daily-cover-actions")?.querySelector(".daily-reason-wrap");
   if(wrap)wrap.hidden=select.value==="programada";
  });
  if(canManage)root.querySelectorAll("[data-daily-save]").forEach(button=>button.onclick=async()=>{
   if(busy)return;
   const item=entries.find(x=>x.id===button.dataset.dailySave),card=button.closest(".daily-cover-card");
   const status=card.querySelector(".daily-new-status").value,reason=card.querySelector(".daily-reason").value.trim();
   if(["impedida","remanejada"].includes(status)&&reason.length<6){notify("Descreva o impedimento antes de salvar.",true);return;}
   busy=true;button.disabled=true;
   try{
    const {error}=await db.from("daily_team_assignments").update({block_status:status,blocker_reason:status==="programada"?null:reason||null,updated_at:new Date().toISOString()}).eq("id",item.id);
    if(error)throw error;
    item.block_status=status;item.blocker_reason=status==="programada"?null:reason||null;
    notify("Situação diária atualizada, sem confirmar execução.");draw();
   }catch(e){notify(e.message||"Erro ao salvar situação.",true);button.disabled=false}finally{busy=false}
  });
 };
 draw();
}
