// SIGA Américas · Prioridades semanais pela metodologia CAPE.
// Sem relatórios técnicos enviados não se presume cumprimento nem descumprimento.
// Cumprimento informado e validação da supervisão são indicadores distintos.
const number=v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(v||0));
const text=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalized=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim();
const numericCode=v=>Number(String(v||"").split(".")[1])||0;
const iso=x=>String(x||"").slice(0,10);
const shiftDay=(s,n)=>{const d=new Date(iso(s)+"T12:00:00");d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const monday=day=>{const d=new Date(iso(day)+"T12:00:00");return shiftDay(iso(day),-((d.getDay()+6)%7))};
const nowBR=()=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day};
const formatWeek=x=>new Date(x+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
const resultLabels={executada:"Executada (informada)",parcial:"Parcial (informada)",impedida:"Impedida (informada)",nao_aplicavel:"Não aplicável"};
export function summarizeWeekly(matrix,teams,reports,items,plans,programs,week,teamId=""){
 const end=shiftDay(week,6),validActivities=new Set(matrix.map(x=>x.id));
 const teamsShown=teams.filter(x=>!teamId||teamId===x.id),teamIds=new Set(teamsShown.map(x=>x.id));
 const weeklyReports=reports.filter(x=>x.report_period==="semanal"&&x.period_start===week&&teamIds.has(x.team_id));
 const submitted=weeklyReports.filter(x=>x.status==="enviado"||x.status==="validado");
 const byReport=new Map(submitted.map(x=>[x.id,x]));
 const weeklyItems=items.filter(x=>validActivities.has(x.activity_id)&&byReport.has(x.report_id))
  .map(x=>({...x,report:byReport.get(x.report_id)}));
 const programTeams=new Map(programs.filter(p=>teamIds.has(p.team_id)).map(p=>[p.id,p.team_id]));
 const weeklyPlans=plans.filter(p=>validActivities.has(p.activity_id)&&p.planned_for&&p.planned_for>=week&&p.planned_for<=end&&programTeams.has(p.program_id));
 const checkedPlans=weeklyPlans.map(p=>{
   const teamId=programTeams.get(p.program_id);
   const sameActivityPlans=weeklyPlans.filter(q=>q.activity_id===p.activity_id&&programTeams.get(q.program_id)===teamId);
   const relevant=weeklyItems.filter(i=>i.report.team_id===teamId &&
     (i.field_plan_item_id===p.id||(!i.field_plan_item_id&&sameActivityPlans.length===1&&i.activity_id===p.activity_id)));
   return {id:p.id,activity_id:p.activity_id,team_id:teamId,
    informed:relevant.some(i=>i.result==="executada"),
    validated:relevant.some(i=>i.result==="executada"&&i.report.status==="validado"),
    partial:relevant.some(i=>i.result==="parcial"),
    blocked:relevant.some(i=>i.result==="impedida")};
 });
 const receivedTeams=new Set(submitted.map(x=>x.team_id));
 const validatedTeams=new Set(submitted.filter(x=>x.status==="validado").map(x=>x.team_id));
 return {week,end,teamsShown,weeklyReports,submitted,weeklyItems,weeklyPlans,checkedPlans,programTeams,receivedTeams,validatedTeams,
  informed:new Set(weeklyItems.map(x=>x.activity_id)),
  confirmed:new Set(weeklyItems.filter(x=>x.report.status==="validado").map(x=>x.activity_id)),
  planned:new Set(weeklyPlans.map(x=>x.activity_id)),
  pendingReview:submitted.filter(x=>x.status==="enviado").length};
}
export async function mountContractSuggestions(root,db,{onPlan=()=>{},notify=()=>{}}={}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Carregando dados semanais…</p></div>';
 const initial=await Promise.all([
  db.from("activity_catalog").select("id,code,name,category").order("code").limit(150),
  db.from("teams").select("id,code,name,active").eq("active",true).order("code")
 ]);
 for(const r of initial)if(r.error)throw r.error;
 const [matrix,teams]=initial.map(x=>x.data||[]);
 const byActivity=new Map(matrix.map(x=>[x.id,x])),byTeam=new Map(teams.map(x=>[x.id,x]));
 let week=monday(nowBR()),team="",search="",reports=[],items=[],programs=[],plans=[],lastUpdate="",requestId=0,loading=false;
 root.innerHTML='<section class="weekly-panel">'+
  '<header class="weekly-head"><div><span class="eyebrow">CAPE · CICLO SEMANAL</span><h2>Prioridades da semana</h2>'+
  '<p>Atividades programadas, cumprimento informado pelos técnicos e validação da supervisão.</p></div>'+
  '<span class="weekly-source-pill">Dados operacionais do SIGA</span></header>'+
  '<div class="weekly-filters"><div class="weekly-date-tools"><button class="btn btn-secondary" id="weekly-back" type="button" aria-label="Semana anterior">‹</button>'+
  '<label>Semana de referência<input type="date" id="weekly-date"></label>'+
  '<button class="btn btn-secondary" id="weekly-forward" type="button" aria-label="Próxima semana">›</button></div>'+
  '<label>Equipe<select id="weekly-team"><option value="">Todas as equipes</option>'+
   teams.map(t=>'<option value="'+text(t.id)+'">'+text(t.code+" · "+t.name)+'</option>').join("")+'</select></label>'+
  '<label>Buscar<input id="weekly-search" type="search" placeholder="Código, serviço ou categoria"></label>'+
  '<button class="btn btn-secondary" id="weekly-reload" type="button">Atualizar dados</button></div>'+
  '<div id="weekly-feedback" aria-live="polite"></div><div id="weekly-counters"></div><div id="weekly-teams"></div><div id="weekly-work"></div>'+
  '<details class="weekly-reference"><summary><strong>Catálogo técnico e critérios CAPE</strong><small>'+matrix.length+' itens apenas como referência</small></summary>'+
  '<div id="weekly-reference-list"></div></details></section>';
 const el=q=>root.querySelector(q);
 const taskButton=id=>'<button type="button" class="table-action" data-suggest-plan="'+text(id)+'">Analisar no planejamento ↗</button>';
 const teamLabel=id=>{const t=byTeam.get(id);return t?t.code+" · "+t.name:"Equipe"};
 function render(){
  el("#weekly-date").value=week;el("#weekly-team").value=team;
  const d=summarizeWeekly(matrix,teams,reports,items,plans,programs,week,team);
  const filter=a=>!search||normalized([a.code,a.name,a.category].join(" ")).includes(normalized(search));
  el("#weekly-feedback").innerHTML='<div class="weekly-period-label"><strong>'+text(formatWeek(week))+' a '+text(formatWeek(d.end))+'</strong>'+
   '<span>'+text(lastUpdate?"Consultado: "+lastUpdate:"Consultando…")+'</span></div>';
  const completed=d.checkedPlans.filter(x=>x.informed).length;
  const accepted=d.checkedPlans.filter(x=>x.validated).length;
  const stats=[
    ["Relatórios recebidos",d.receivedTeams.size+" / "+d.teamsShown.length,
     "Equipes com envio semanal"],
    ["Cumprimento informado",d.checkedPlans.length?(number(100*completed/d.checkedPlans.length)+"%"):"Sem base",
     d.checkedPlans.length?completed+" de "+d.checkedPlans.length+" ações datadas":"Nenhuma ação com data e equipe na semana"],
    ["Cumprimento validado",d.checkedPlans.length?(number(100*accepted/d.checkedPlans.length)+"%"):"Sem base",
     d.checkedPlans.length?accepted+" ação(ões) revisadas pela supervisão":"Sem denominador de programação"],
    ["Atividades informadas",d.informed.size,
     d.confirmed.size+" em relatórios validados"]
  ];
  el("#weekly-counters").innerHTML='<div class="weekly-stats">'+stats.map(([label,value,detail])=>
    '<div class="weekly-stat"><small>'+text(label)+'</small><strong>'+text(value)+'</strong><span>'+text(detail)+'</span></div>').join("")+'</div>';
  const reportPerTeam=new Map(d.weeklyReports.map(r=>[r.team_id,r]));
  el("#weekly-teams").innerHTML='<div class="weekly-team-strip">'+
    d.teamsShown.map(t=>{
     const rep=reportPerTeam.get(t.id),states={validado:"Validado",enviado:"Enviado",rascunho:"Rascunho",devolvido:"Devolvido"};
     return '<button type="button" class="weekly-team-pill '+text(rep?.status||"missing")+'" data-weekly-team="'+text(t.id)+'" title="Filtrar equipe '+text(t.code)+'">'+
       '<strong>'+text(t.code)+'</strong><span>'+text(states[rep?.status]||"Sem envio")+'</span></button>';
    }).join("")+'</div>';
  el("#weekly-teams").querySelectorAll("[data-weekly-team]").forEach(button=>button.onclick=()=>{
    team=button.dataset.weeklyTeam;render();
  });
  const activityIds=new Set([...d.informed,...d.planned]);
  const rows=[...activityIds].map(id=>{
   const activity=byActivity.get(id),linked=d.weeklyItems.filter(x=>x.activity_id===id);
   const planned=d.weeklyPlans.filter(x=>x.activity_id===id);
   const statuses=new Set(linked.map(x=>x.result));
   const kind=statuses.has("impedida")?"blocked":statuses.has("parcial")?"partial":
    linked.some(x=>x.report.status==="validado")?"validated":linked.length?"informed":"planned";
   const badge={blocked:"Impedimento informado",partial:"Execução parcial",validated:"Relatório validado",
    informed:"Enviado · em análise",planned:"Programada · aguardando relato"}[kind];
   const teamLabels=[...new Set(linked.map(x=>x.report.team_id))].map(teamLabel);
   const notes=linked.filter(x=>x.result==="impedida"||x.result==="parcial")
      .map(x=>String(x.notes||"").trim()).filter(Boolean).slice(0,2);
   return {activity,id,kind,badge,linked,planned,teamLabels,notes};
  }).filter(x=>x.activity&&filter(x.activity))
   .sort((a,b)=>({blocked:0,partial:1,planned:2,informed:3,validated:4}[a.kind]-
     {blocked:0,partial:1,planned:2,informed:3,validated:4}[b.kind])||
     a.activity.code.localeCompare(b.activity.code,"pt-BR",{numeric:true}));
  const reportStatus=d.submitted.length===0?
   '<div class="weekly-no-reports"><strong>Aguardando relatórios dos técnicos</strong><p>Nenhum relatório enviado para esta semana. '+
   'Isso não demonstra descumprimento das rotinas. Utilize os relatórios semanais para alimentar o acompanhamento.</p>'+
   '<button class="btn btn-secondary" type="button" data-nav="field_report">Abrir relatórios de campo</button></div>':
   '<div class="weekly-report-note"><strong>'+d.receivedTeams.size+' equipe(s) com relatório enviado.</strong> '+
   d.validatedTeams.size+' validada(s) pela supervisão; '+d.pendingReview+' aguardando conferência. '+
   'Atividades parciais e impedidas refletem relato técnico, não conclusão da fiscalização.</div>';
  const content=rows.length?rows.map(x=>{
   const a=x.activity;
   const info=[x.planned.length?x.planned.length+" programação(ões) com data":"",
     x.linked.length?x.linked.length+" apontamento(s) de atividade":"",...x.teamLabels].filter(Boolean).join(" · ");
   const explanation={blocked:"Conferir impedimento, recursos e reprogramação.",
    partial:"Verificar quantidade restante e plano de continuidade.",
    planned:"Há planejamento datado, mas nenhum retorno técnico vinculado.",
    informed:"Aguardar validação do relatório pela supervisão.",
    validated:"Relatório validado; medição e faturamento permanecem etapas separadas."}[x.kind];
   return '<article class="weekly-activity-card"><div class="weekly-activity-title"><strong>'+text(a.code+" · "+a.name)+'</strong>'+
    '<span class="weekly-status-chip '+x.kind+'">'+text(x.badge)+'</span></div><p>'+text(explanation)+'</p>'+
    (info?'<small>'+text(info)+'</small>':'')+
    (x.notes.length?'<p class="weekly-activity-note">'+x.notes.map(text).join(" · ")+'</p>':'')+
    '<div class="weekly-card-action">'+taskButton(x.id)+'</div></article>';
  }).join(""):'<div class="weekly-empty">Nenhuma atividade com programação datada ou relato enviado nesta seleção.'+
   (search?' Tente outra busca.':' O catálogo não é automaticamente uma lista de pendências.')+'</div>';
  el("#weekly-work").innerHTML='<section class="weekly-worklist"><header><div><h3>Acompanhamento e próximas ações</h3>'+
   '<p>Primeiro os impedimentos e parciais, depois programação sem retorno. Sem pontuação fictícia de receita ou clima.</p></div>'+
   '<span>'+rows.length+' atividade(s)</span></header>'+reportStatus+
   '<div class="weekly-activity-grid">'+content+'</div>'+
   '<footer><span>Relatórios recebidos: '+d.submitted.length+'. Programações sem data não são consideradas exigíveis na semana.</span>'+
   '<button type="button" class="btn btn-secondary" data-nav="field_monitor">Revisar relatórios</button></footer></section>';
  const catalog=matrix.filter(filter).sort((a,b)=>numericCode(a.code)-numericCode(b.code));
  el("#weekly-reference-list").innerHTML='<p>As '+matrix.length+' atividades são referências técnicas, não metas semanais automáticas. '+
   'Cumprimento depende de atividade com programação datada, relato do técnico e validação.</p>'+
   '<div class="weekly-reference-rows">'+catalog.map(a=>
    '<div><span><strong>'+text(a.code+" · "+a.name)+'</strong><small>'+text(a.category||"Sem categoria")+'</small></span>'+
    (numericCode(a.code)<=57?taskButton(a.id):'<small>Rubrica de referência</small>')+'</div>').join("")+'</div>'+
   '<p class="weekly-method">CAPE: Contrato (atividade elegível) → Aptidão (demanda e condições) → Programação (data/equipe) → '+
   'Evidência (relatório enviado, conferência e medição separadas). A falta de relatório não representa comprovação de descumprimento.</p>';
 }
 async function refresh(){
  const token=++requestId,selected=week;loading=true;el("#weekly-reload").disabled=true;
  el("#weekly-feedback").textContent="Consultando os relatórios da semana…";
  try{
   const [rep,scheduled]=await Promise.all([
     db.from("field_daily_reports").select("id,team_id,report_period,period_start,period_end,status,submitted_at,reviewed_at")
       .eq("report_period","semanal").eq("period_start",selected).limit(500),
     db.from("field_plan_items").select("id,program_id,activity_id,planned_for,planned_quantity,action_status")
       .gte("planned_for",selected).lte("planned_for",shiftDay(selected,6)).limit(1000)
   ]);
   if(rep.error)throw rep.error;if(scheduled.error)throw scheduled.error;
   if((scheduled.data||[]).length>=1000)throw Error("Limite de programações semanais atingido; a consulta precisa ser paginada.");
   const localReports=rep.data||[],ids=localReports.map(x=>x.id);
   const localPlans=scheduled.data||[];
   const programIds=[...new Set(localPlans.map(p=>p.program_id).filter(Boolean))];
   let localPrograms=[];
   if(programIds.length){
     const pr=await db.from("field_programs").select("id,team_id").in("id",programIds).limit(1000);
     if(pr.error)throw pr.error;localPrograms=pr.data||[];
   }
   let localItems=[];
   if(ids.length){
    for(let i=0;i<ids.length;i+=100){
     const r=await db.from("field_daily_report_items").select("id,report_id,activity_id,field_plan_item_id,result,notes,quantity").in("report_id",ids.slice(i,i+100)).limit(1000);
     if(r.error)throw r.error;
     localItems.push(...(r.data||[]));
    }
   }
   if(token!==requestId||selected!==week)return;
   reports=localReports;items=localItems;plans=localPlans;programs=localPrograms;
   lastUpdate=new Date().toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});render();
  }catch(e){if(token===requestId){el("#weekly-feedback").innerHTML='<div class="weekly-error">Não foi possível atualizar: '+text(e.message||e)+'</div>';notify(String(e.message||e),true)}}
  finally{if(token===requestId){loading=false;el("#weekly-reload").disabled=false}}
 }
 el("#weekly-back").onclick=()=>{week=shiftDay(week,-7);void refresh()};
 el("#weekly-forward").onclick=()=>{week=shiftDay(week,7);void refresh()};
 el("#weekly-date").onchange=e=>{if(e.target.value){week=monday(e.target.value);void refresh()}};
 el("#weekly-team").onchange=e=>{team=e.target.value;render()};
 el("#weekly-search").oninput=e=>{search=e.target.value;render()};
 el("#weekly-reload").onclick=()=>void refresh();
 root.addEventListener("click",e=>{const b=e.target.closest("[data-suggest-plan]");if(b&&root.contains(b))onPlan(b.dataset.suggestPlan)});
 await refresh();
 return ()=>{requestId++};
}
