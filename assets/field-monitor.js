// SIGA · Painel gerencial de relatórios de campo e validação dos técnicos.
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=x=>x?new Date(String(x).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const pt=x=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(Number(x||0));
const statuses={rascunho:"Rascunho",enviado:"Aguardando validação",validado:"Validado",devolvido:"Devolvido para ajuste"};
const results={executada:"Executada",parcial:"Parcial",impedida:"Impedida",nao_aplicavel:"Não aplicável"};
const dateToday=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const weekStart=date=>{const d=new Date(String(date).slice(0,10)+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)};
const query=async(db,t,columns="*",limit=1000)=>{
 const{data,error}=await db.from(t).select(columns).limit(limit);if(error)throw error;return data||[];
};
export async function mountFieldMonitor(root,db,{user,notify}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Consolidando relatórios das equipes…</p></div>';
 let teams,areas,reports,activities,employees,posts,orders;
 const initialWeek=weekStart(dateToday());
 const reportFields="id,team_id,area_id,service_post_id,report_date,report_period,period_start,period_end,shift,status,reported_by,team_leader,team_size,impediments,general_notes,weather,equipment_used,supervisor_notes,submitted_at,created_at";
 const fetchWeek=async target=>{
  const result=await db.from("field_daily_reports").select(reportFields)
   .eq("report_period","semanal").eq("period_start",target).limit(1000);
  if(result.error)throw result.error;
  if((result.data||[]).length>=1000)throw Error("Limite de relatórios na semana; precisa de paginação para assegurar a contagem.");
  return result.data||[];
 };
 try{
 [teams,areas,reports,activities,employees,posts,orders]=await Promise.all([
   query(db,"teams","id,code,name,active",30),
   query(db,"operational_areas","id,code,name",50),
   fetchWeek(initialWeek),
   query(db,"activity_catalog","id,code,name",100),
   query(db,"employees","id,name,team_id",500),
   query(db,"service_posts","id,code,name,area_id",30),
   query(db,"work_orders","id,reference",500)
 ]);
 }catch(e){root.innerHTML='<div class="notice danger">Não foi possível carregar os relatórios: '+esc(e.message)+'</div>';return}
 const byDate=(a,b)=>String(b.report_date||"").localeCompare(String(a.report_date||""));
 const activeTeams=teams.filter(x=>x.active!==false);
 let period=initialWeek,selectedTeam="all",selectedStatus="all";
 const teamName=id=>{const t=teams.find(x=>x.id===id);return t?[t.code,t.name].filter(Boolean).join(" · "):"Equipe não identificada"};
 const areaName=id=>areas.find(x=>x.id===id)?.name||"Frente não informada";
 const inPeriod=r=>r.report_period==="semanal"?r.period_start===period:r.report_date===period;
 const filtered=()=>reports.filter(r=>(!period||inPeriod(r))&&(selectedTeam==="all"||r.team_id===selectedTeam)&&(selectedStatus==="all"||r.status===selectedStatus)).sort(byDate);
 function refresh(){
  const set=filtered();
  const withReports=new Set(reports.filter(r=>inPeriod(r)&&["enviado","validado"].includes(r.status)).map(r=>r.team_id));
  const activeToday=activeTeams.filter(t=>withReports.has(t.id)).length;
  const awaiting=set.filter(r=>r.status==="enviado").length;
  const validated=set.filter(r=>r.status==="validado").length;
  const blocked=set.filter(r=>r.impediments?.trim()).length;
  const bars=activeTeams.map(t=>{
   const n=set.filter(r=>r.team_id===t.id).length,den=Math.max(1,...activeTeams.map(x=>set.filter(r=>r.team_id===x.id).length));
   return '<div class="monitor-bar-row"><span>'+esc(t.code)+'</span><div class="analytics-bar-track"><span class="analytics-bar-fill" style="width:'+Math.round(n/den*100)+'%;background:#4CA314"></span></div><strong>'+n+'</strong></div>';
  }).join("");
  root.innerHTML='<div class="field-header"><div><span class="eyebrow">SUPERVISÃO · REGISTROS DAS EQUIPES</span><h2>Acompanhamento das equipes</h2><p>Relatórios enviados pelos técnicos com atividade, equipe, frente, participantes, quantidades e impedimentos.</p></div></div>'+
   '<div class="monitor-controls"><label>Semana de referência <input type="date" id="monitor-date" value="'+esc(period)+'"></label><label>Equipe <select id="monitor-team"><option value="all">Todas as equipes</option>'+teams.map(t=>'<option value="'+esc(t.id)+'"'+(selectedTeam===t.id?" selected":"")+'>'+esc(t.code+" · "+t.name)+'</option>').join("")+'</select></label><label>Situação <select id="monitor-status"><option value="all">Todas</option>'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'"'+(selectedStatus===k?" selected":"")+'>'+esc(v)+'</option>').join("")+'</select></label><button type="button" id="monitor-refresh" class="btn btn-secondary">Atualizar relatórios</button></div>'+
   '<div class="catalog-stats monitor-stats">'+[
    ["Equipes com envio na semana",activeToday+" / "+activeTeams.length,"Não pressupõe descumprimento nas demais"],
    ["Aguardando análise",awaiting,"Relatórios enviados"],
    ["Validados",validated,"Relatórios aceitos"],
    ["Com impedimentos",blocked,"Ocorrências informadas"]
   ].map(x=>'<div class="catalog-stat"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></div>').join("")+'</div>'+
   '<div class="panel-grid monitor-panels"><section class="panel"><div class="panel-inner"><h2>Registros por equipe</h2><p>Acompanhe a distribuição dos apontamentos na data e nos filtros escolhidos.</p><div class="monitor-bars">'+bars+'</div></div></section><section class="panel"><div class="panel-inner"><h2>Critério de supervisão</h2><p>O envio não implica validação automática da execução. Confira atividades, trabalhadores envolvidos, quantitativos, condições de segurança e observações antes de aceitar o registro.</p><div class="notice warning" style="margin-top:13px">Ausência de relatório não significa necessariamente ausência de trabalho: verifique escala, expediente e disponibilidade do técnico.</div></div></section></div>'+
   '<section class="table-panel monitor-list"><div class="table-head"><div><h2>Relatórios do período</h2><span>'+set.length+' registro(s)</span></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Equipe</th><th>Frente</th><th>Trabalhadores presentes</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+
   (set.length?set.map(r=>'<tr><td>'+esc(dateBR(r.report_date))+'</td><td>'+esc(teamName(r.team_id))+'</td><td>'+esc(areaName(r.area_id))+'</td><td>'+esc(r.team_size??"—")+'</td><td><span class="field-status '+esc(r.status)+'">'+esc(statuses[r.status])+'</span></td><td><button class="table-action" data-monitor-detail="'+esc(r.id)+'">Conferir ↗</button></td></tr>').join(""):'<tr><td colspan="6"><div class="empty-state">Nenhum relatório informado na semana com os filtros selecionados.</div></td></tr>')+
   '</tbody></table></div></section><div id="field-monitor-detail"></div>';
  let activeFetch=0;
  async function reloadWeek(){
   const token=++activeFetch,selected=period;
   const button=root.querySelector("#monitor-refresh");
   if(button)button.disabled=true;
   try{
    const next=await fetchWeek(selected);
    if(token!==activeFetch||period!==selected)return;
    reports=next;refresh();
   }catch(error){if(token===activeFetch)notify("Falha ao consultar relatórios da semana: "+error.message,true)}
   finally{if(token===activeFetch&&button?.isConnected)button.disabled=false}
  }
  root.querySelector("#monitor-date").addEventListener("change",e=>{period=weekStart(e.target.value);void reloadWeek()});
  root.querySelector("#monitor-refresh")?.addEventListener("click",()=>void reloadWeek());
  root.querySelector("#monitor-team").addEventListener("change",e=>{selectedTeam=e.target.value;refresh()});
  root.querySelector("#monitor-status").addEventListener("change",e=>{selectedStatus=e.target.value;refresh()});
  root.querySelectorAll("[data-monitor-detail]").forEach(b=>b.addEventListener("click",()=>showDetail(b.dataset.monitorDetail)));
 }
 async function showDetail(id){
  const report=reports.find(r=>r.id===id);if(!report)return;
  const target=root.querySelector("#field-monitor-detail");target.innerHTML='<div class="loading-page"><div class="loader"></div></div>';
  try{
   const [rows,attendance,participants]=await Promise.all([
    query(db,"field_daily_report_items","*",1000),
    query(db,"field_daily_attendance","*",1000),
    query(db,"field_daily_item_workers","*",1500)
   ]);
   const group=rows.filter(x=>x.report_id===id),presence=attendance.filter(x=>x.report_id===id);
   const roster=presence.map(p=>{const e=employees.find(x=>x.id===p.employee_id);return '<span class="monitor-worker">'+esc(e?.name||"Colaborador")+' · '+esc(({presente:"Presente",ausente:"Ausente",folga:"Folga",outro:"Outro"})[p.presence_status]||p.presence_status)+'</span>'}).join("");
   const entries=group.map(row=>{
    const cat=activities.find(x=>x.id===row.activity_id),post=posts.find(x=>x.id===row.service_post_id),os=orders.find(x=>x.id===row.work_order_id),people=participants.filter(p=>p.report_item_id===row.id).map(p=>employees.find(e=>e.id===p.employee_id)?.name||"Colaborador");
    return '<article class="monitor-entry"><strong>'+esc(cat?.code||"—")+' · '+esc(cat?.name||"Atividade")+'</strong><p>'+esc(results[row.result]||row.result)+' · '+esc((post?"Posto "+post.code+" · "+post.name+" · ":"")+(row.location||"Sem setor específico"))+(os?" · OS "+esc(os.reference):"")+(row.performed_on?" · "+esc(dateBR(row.performed_on)):"")+' · '+esc(row.quantity??"—")+' '+esc(row.unit||"")+' · '+esc(row.hours_worked??"—")+' horas</p><p>'+esc(row.notes||"")+'</p><small>Participantes: '+esc(people.length?people.join(", "):"Não informados")+'</small>'+(row.evidence_ref?'<p>Referência da evidência: '+esc(row.evidence_ref)+'</p>':"")+'</article>';
   }).join("");
   target.innerHTML='<section class="monitor-detail"><div class="modal-head"><div><span class="eyebrow">RELATÓRIO DE CAMPO</span><h2>'+esc(teamName(report.team_id))+' · '+esc(dateBR(report.report_date))+'</h2></div><button type="button" class="icon-btn" id="close-monitor-detail" aria-label="Fechar detalhes">✕</button></div>'+
    '<div class="monitor-detail-body"><p><strong>Frente:</strong> '+esc(areaName(report.area_id))+' · <strong>Técnico:</strong> '+esc(report.team_leader||"Não informado")+'</p>'+
    '<p><strong>Clima:</strong> '+esc(report.weather||"Não informado")+' · <strong>Condições:</strong> '+esc(report.equipment_used||"Equipamentos não informados")+'</p>'+
    '<h3>Atividades informadas</h3>'+(entries||'<p>Sem atividades registradas.</p>')+
    '<h3>Composição da equipe</h3><div class="monitor-roster">'+(roster||"Nenhuma presença registrada")+'</div>'+
    '<h3>Impedimentos e observações</h3><p>'+esc(report.impediments||"Nenhum impedimento informado")+'</p><p>'+esc(report.general_notes||"")+'</p>'+
    '<label class="field-input"><span>Observações da supervisão</span><textarea id="monitor-review-notes" rows="3" placeholder="Correções, evidências ou validações">'+esc(report.supervisor_notes||"")+'</textarea></label>'+
    '<div class="monitor-review-actions"><button class="btn btn-ghost" data-review="devolvido">Devolver para ajuste</button><button class="btn btn-primary" data-review="validado">Validar relatório</button></div></div></section>';
   target.scrollIntoView({behavior:"smooth",block:"start"});
   target.querySelector("#close-monitor-detail").addEventListener("click",()=>target.innerHTML="");
   target.querySelectorAll("[data-review]").forEach(b=>b.addEventListener("click",async()=>{
    const state=b.dataset.review,note=target.querySelector("#monitor-review-notes").value.trim();
    if(["rascunho","devolvido"].includes(report.status)){notify("O técnico precisa enviar o relatório antes da validação.",true);return}
    b.disabled=true;
    const {data,error}=await db.from("field_daily_reports").update({status:state,supervisor_notes:note||null,reviewed_at:new Date().toISOString(),reviewed_by:user.id}).eq("id",id).select("id,status,supervisor_notes").single();
    if(error){notify(error.message,true);b.disabled=false;return}
    Object.assign(report,data);notify(state==="validado"?"Relatório validado pela supervisão.":"Relatório devolvido para ajuste.");
    // Preserva a seleção de data, equipe, situação e a posição após a validação.
    const workspace=root.closest(".workspace"),main=root.closest("#main");
    const y=window.scrollY,workY=workspace?.scrollTop||0,mainY=main?.scrollTop||0;
    const tableLeft=root.querySelector(".monitor-list .table-scroll")?.scrollLeft||0;
    refresh();
    requestAnimationFrame(()=>{
     if(!root.isConnected)return;
     if(workspace)workspace.scrollTop=workY;
     if(main)main.scrollTop=mainY;
     const table=root.querySelector(".monitor-list .table-scroll");
     if(table)table.scrollLeft=tableLeft;
     window.scrollTo(0,y);
    });
   }));
  }catch(e){target.innerHTML='<div class="notice danger">'+esc(e.message)+'</div>'}
 }
 refresh();
}
