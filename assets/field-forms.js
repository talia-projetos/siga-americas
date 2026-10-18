// SIGA Américas · Formulário de campo para técnicos das equipes
// Reproduz os campos do 05_Execucao e agrega presença, OS, local e itens da matriz 73.
// O envio de um relatório não encerra ordens de serviço nem gera medições automáticas.
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const label=(obj,kind)=>kind==="activity"?[obj.code,obj.name].filter(Boolean).join(" · "):kind==="team"?[obj.code,obj.name].filter(Boolean).join(" · "):[obj.code,obj.name].filter(Boolean).join(" · ");
const BRtoday=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dateBR=x=>x?new Date(String(x).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const statuses={rascunho:"Rascunho",enviado:"Aguardando validação",validado:"Validado",devolvido:"Devolvido para ajuste"};
const results={executada:"Executada",parcial:"Parcial",impedida:"Impedida",nao_aplicavel:"Não aplicável"};
const escOpt=(value,text,active)=>'<option value="'+esc(value)+'"'+(String(value)===String(active)?" selected":"")+'>'+esc(text)+'</option>';
async function list(db,table,cols="*",limit=600){
 const {data,error}=await db.from(table).select(cols).limit(limit);if(error)throw error;return data||[];
}
function optList(items,kind,chosen="",empty="Selecione…"){
 return '<option value="">'+esc(empty)+'</option>'+items.map(x=>escOpt(x.id,label(x,kind),chosen)).join("");
}
export async function mountFieldReport(root,db,{user,role,teamId,notify}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Preparando formulário de campo…</p></div>';
 const isTech=role==="tecnico";
 let teams,areas,activities,workers,orders,reports,programs,planItems;
 try{
  [teams,areas,activities,workers,orders,reports,programs,planItems]=await Promise.all([
   list(db,"teams","id,code,name,active"),
   list(db,"operational_areas","id,code,name,active"),
   list(db,"activity_catalog","id,code,name"),
   list(db,"employees","id,name,team_id,active"),
   list(db,"work_orders","id,reference,team_id,area_id,status",400),
   list(db,"field_daily_reports","id,team_id,area_id,report_date,shift,status,reported_by,team_leader,weather,field_conditions,equipment_used,team_size,general_notes,impediments,created_at",200),
   list(db,"field_programs","id,area_id,period_month,status",150),
   list(db,"field_plan_items","id,program_id,activity_id",500)
  ]);
 }catch(e){root.innerHTML='<div class="notice danger">Falha ao consultar dados do formulário: '+esc(e.message)+'</div>';return;}
 activities.sort((a,b)=>Number(String(a.code).split(".")[1])-Number(String(b.code).split(".")[1]));
 teams=teams.filter(t=>t.active!==false);areas=areas.filter(x=>x.active!==false);
 workers=workers.filter(w=>w.active!==false);
 if(isTech&&(!teamId||!teams.some(x=>x.id===teamId))){
  root.innerHTML='<div class="notice warning">Este usuário está no perfil de técnico, mas ainda não está associado a uma das seis equipes. Solicite ao administrador que informe a equipe no seu cadastro de acesso.</div>';
  return;
 }
 let tab="novo",draftId=null,currentReport=null,detailId=null;
 let selectedTeam=isTech?teamId:"";
 let formState={report_date:BRtoday(),team_id:selectedTeam,area_id:"",shift:"integral",team_leader:"",
    weather:"nao_informado",field_conditions:"",equipment_used:"",general_notes:"",impediments:""};
 let attendance={};let items=[newItem()];
 function newItem(){return {id:null,activity_id:"",work_order_id:"",field_plan_item_id:null,result:"executada",location:"",quantity:"",unit:"",hours_worked:"",notes:"",evidence_ref:"",workers:[]}}
 function workersForTeam(){return workers.filter(x=>x.team_id===selectedTeam).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"))}
 function capture(){
  const f=root.querySelector("#field-entry-form");if(!f)return;
  for(const key of Object.keys(formState)){const input=f.elements.namedItem(key);if(input)formState[key]=input.value;}
  selectedTeam=formState.team_id;
  root.querySelectorAll("[data-presence-id]").forEach(row=>{
   const id=row.dataset.presenceId,select=row.querySelector("[data-presence]");
   if(select)attendance[id]=select.value;
  });
  items=[...root.querySelectorAll("[data-report-item]")].map(card=>({
   id:card.dataset.itemId||null,
   activity_id:card.querySelector("[data-field-activity]")?.value||"",
   work_order_id:card.querySelector("[data-field-order]")?.value||"",
   result:card.querySelector("[data-field-result]")?.value||"executada",
   location:card.querySelector("[data-field-location]")?.value?.trim()||"",
   quantity:card.querySelector("[data-field-quantity]")?.value||"",
   unit:card.querySelector("[data-field-unit]")?.value?.trim()||"",
   hours_worked:card.querySelector("[data-field-hours]")?.value||"",
   notes:card.querySelector("[data-field-notes]")?.value?.trim()||"",
   evidence_ref:card.querySelector("[data-field-evidence]")?.value?.trim()||"",
   workers:[...card.querySelectorAll("[data-field-worker]:checked")].map(el=>el.value)
  }));
 }
 const topbar=()=>'<div class="field-header"><div><span class="eyebrow">APONTAMENTO DE CAMPO · PROERG / ITAIPU</span><h2>Registro da rotina da equipe</h2><p>Os técnicos informam diariamente o que ocorreu em campo; a supervisão revisa e valida. Nenhuma informação é considerada executada antes do envio.</p></div><span class="field-secure">✓ Acesso autenticado</span></div><div class="field-view-tabs"><button type="button" data-field-tab="novo" class="'+(tab==="novo"?"active":"")+'">Preencher relatório</button><button type="button" data-field-tab="historico" class="'+(tab==="historico"?"active":"")+'">Registros anteriores <small>'+reports.length+'</small></button></div>';
 function attendanceHTML(){
  const staff=workersForTeam();
  if(!staff.length)return '<div class="notice warning">Nenhum colaborador ativo vinculado a esta equipe no cadastro. Confira os dados antes de registrar presença.</div>';
  return '<p class="field-muted">Indique quem esteve em campo. Não registre motivos médicos de ausência. Os nomes e a equipe foram carregados do cadastro de colaboradores.</p><div class="field-attendance-grid">'+staff.map(w=>{
   const v=attendance[w.id]||"";
   return '<div class="field-attendance-row" data-presence-id="'+esc(w.id)+'"><span>'+esc(w.name)+'</span><select data-presence aria-label="Presença de '+esc(w.name)+'"><option value="">Não informado</option>'+[
     ["presente","Presente"],["ausente","Ausente"],["folga","Folga"],["outro","Outro"]
   ].map(x=>escOpt(x[0],x[1],v)).join("")+'</select></div>';
  }).join("")+'</div>';
 }
 function itemCard(item,i){
  const own=workersForTeam();
  const ordersForTeam=orders.filter(o=>o.team_id===selectedTeam);
  return '<section class="field-activity-card" data-report-item="'+i+'" data-item-id="'+esc(item.id||"")+'"><div class="field-card-heading"><strong>Atividade '+(i+1)+'</strong><button type="button" data-remove-field-item="'+i+'" class="field-remove" '+(items.length===1?'disabled':'')+' aria-label="Remover atividade '+(i+1)+'">×</button></div>'+
  '<div class="field-form-grid">'+
   '<label class="field-input wide"><span>Atividade contratual (73 itens) *</span><select data-field-activity required>'+optList(activities,"activity",item.activity_id,"Selecione a atividade…")+'</select></label>'+
   '<label class="field-input wide"><span>OS relacionada (se houver)</span><select data-field-order><option value="">Sem OS vinculada</option>'+ordersForTeam.map(o=>escOpt(o.id,o.reference+" · "+o.status,item.work_order_id)).join("")+'</select></label>'+
   '<label class="field-input"><span>Resultado *</span><select data-field-result>'+Object.entries(results).map(([k,v])=>escOpt(k,v,item.result)).join("")+'</select></label>'+
   '<label class="field-input"><span>Local/setor específico</span><input data-field-location maxlength="160" placeholder="Setor atendido" value="'+esc(item.location)+'"></label>'+
   '<label class="field-input"><span>Quantidade executada</span><input data-field-quantity type="number" min="0" step="0.001" placeholder="0,000" value="'+esc(item.quantity)+'"></label>'+
   '<label class="field-input"><span>Unidade de medida</span><input data-field-unit maxlength="30" placeholder="m², un, h, km…" value="'+esc(item.unit)+'"></label>'+
   '<label class="field-input"><span>Horas de atividade</span><input data-field-hours type="number" min="0" max="24" step="0.25" placeholder="Ex.: 3,5" value="'+esc(item.hours_worked)+'"></label>'+
   '<label class="field-input"><span>Referência da evidência</span><input data-field-evidence maxlength="250" placeholder="Foto/arquivo ou protocolo" value="'+esc(item.evidence_ref)+'"></label>'+
   '<label class="field-input wide"><span>Observações / impedimentos</span><textarea data-field-notes rows="2" placeholder="Restrições, problemas e resultados relevantes">'+esc(item.notes)+'</textarea></label>'+
  '</div>'+
  '<details class="field-worker-details"><summary>Trabalhadores envolvidos na atividade <small>('+(item.workers||[]).length+' marcados)</small></summary><div class="field-worker-picks">'+
  (own.length?own.map(w=>'<label class="field-worker-check"><input type="checkbox" data-field-worker value="'+esc(w.id)+'" '+((item.workers||[]).includes(w.id)?"checked":"")+'><span>'+esc(w.name)+'</span></label>').join(""):'<p class="field-muted">Cadastre os trabalhadores na equipe.</p>')+
  '</div></details></section>';
 }
 function drawForm(){
  root.innerHTML=topbar()+'<form id="field-entry-form" class="field-main-form">'+
  '<div class="field-section"><div class="field-section-head"><span class="field-step">01</span><div><h3>Identificação do trabalho</h3><p>Equipe, frente e condições de execução</p></div></div>'+
  '<div class="field-form-grid">'+
  '<label class="field-input"><span>Data da atividade *</span><input name="report_date" type="date" required value="'+esc(formState.report_date)+'"></label>'+
  '<label class="field-input"><span>Equipe *</span><select name="team_id" required '+(isTech?'disabled':'')+'>'+optList(teams,"team",selectedTeam,"Selecione uma equipe")+'</select></label>'+
  '<label class="field-input"><span>Frente / área de execução *</span><select name="area_id" required>'+optList(areas,"area",formState.area_id,"Selecione uma frente")+'</select></label>'+
  '<label class="field-input"><span>Período de trabalho</span><select name="shift">'+[["manha","Manhã"],["tarde","Tarde"],["integral","Dia inteiro"],["outro","Outro"]].map(([k,v])=>escOpt(k,v,formState.shift)).join("")+'</select></label>'+
  '<label class="field-input"><span>Técnico / responsável</span><input name="team_leader" maxlength="140" value="'+esc(formState.team_leader)+'" placeholder="Quem presta as informações"></label>'+
  '<label class="field-input"><span>Condições meteorológicas</span><select name="weather">'+[["nao_informado","Não informado"],["ensolarado","Ensolarado"],["nublado","Nublado"],["chuva","Chuva"],["temporal","Temporal"],["variavel","Variável"]].map(([k,v])=>escOpt(k,v,formState.weather)).join("")+'</select></label>'+
  '<label class="field-input wide"><span>Equipamentos e veículos utilizados</span><input name="equipment_used" maxlength="800" placeholder="Identificação, patrimônio, placa ou descrição" value="'+esc(formState.equipment_used)+'"></label>'+
  '<label class="field-input wide"><span>Condições gerais da jornada e segurança</span><input name="field_conditions" maxlength="500" placeholder="Acesso, liberação, risco, condições de solo…" value="'+esc(formState.field_conditions)+'"></label>'+
  '</div></div>'+
  '<div class="field-section"><div class="field-section-head"><span class="field-step">02</span><div><h3>Trabalhadores da equipe</h3><p>Presença e composição diária, sem registrar dados médicos</p></div></div>'+attendanceHTML()+'</div>'+
  '<div class="field-section"><div class="field-section-head"><span class="field-step">03</span><div><h3>Atividades realizadas ou impedidas</h3><p>Associe cada serviço a uma das 73 atividades técnicas</p></div></div>'+
  '<div class="field-activities">'+items.map(itemCard).join("")+'</div><button type="button" class="btn btn-secondary" id="field-add-activity">+ Adicionar atividade</button></div>'+
  '<div class="field-section"><div class="field-section-head"><span class="field-step">04</span><div><h3>Fechamento do dia</h3><p>Registre pendências e contexto para a supervisão</p></div></div><div class="field-form-grid">'+
  '<label class="field-input wide"><span>Impedimentos e atividades não concluídas</span><textarea name="impediments" rows="3" maxlength="2500" placeholder="Clima, segurança, acesso, equipamento, autorização…">'+esc(formState.impediments)+'</textarea></label>'+
  '<label class="field-input wide"><span>Resumo e observações adicionais</span><textarea name="general_notes" rows="3" maxlength="2500" placeholder="Informações complementares para a supervisão">'+esc(formState.general_notes)+'</textarea></label>'+
  '</div></div>'+
  '<div class="field-form-actions"><button class="btn btn-ghost" type="button" id="field-save-draft">Salvar rascunho</button><button class="btn btn-primary" type="submit" id="field-submit">Enviar à supervisão →</button></div>'+
  '<p class="field-help">O relatório é enviado para análise da supervisão. Não conclui OS, não gera faturamento e não substitui o controle oficial de jornada.</p></form>';
  root.querySelectorAll("[data-field-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.fieldTab)));
  root.querySelector('[name="team_id"]').addEventListener("change",e=>{capture();selectedTeam=e.target.value;formState.team_id=selectedTeam;attendance={};items=items.map(x=>({...x,workers:[]}));drawForm()});
  root.querySelector("#field-add-activity").addEventListener("click",()=>{capture();items.push(newItem());drawForm();root.querySelectorAll("[data-report-item]")[items.length-1]?.scrollIntoView({behavior:"smooth",block:"center"})});
  root.querySelectorAll("[data-remove-field-item]").forEach(b=>b.addEventListener("click",()=>{capture();items.splice(Number(b.dataset.removeFieldItem),1);drawForm()}));
  root.querySelector("#field-save-draft").addEventListener("click",()=>save(false));
  root.querySelector("#field-entry-form").addEventListener("submit",e=>{e.preventDefault();save(true)});
 }
 async function switchTab(key){
  if(tab==="novo")capture();
  tab=key;
  if(key==="novo")drawForm();else await drawHistory();
 }
 function fmtStatus(code){return '<span class="field-status '+esc(code)+'">'+esc(statuses[code]||code)+'</span>'}
 async function drawHistory(){
  try{reports=await list(db,"field_daily_reports","id,team_id,area_id,report_date,shift,status,reported_by,team_leader,weather,field_conditions,equipment_used,team_size,general_notes,impediments,created_at",300)}
  catch(e){notify(e.message,true);return}
  reports.sort((a,b)=>String(b.report_date).localeCompare(String(a.report_date)));
  const own=reports.filter(r=>!isTech||r.team_id===teamId);
  root.innerHTML=topbar()+'<div class="field-history"><div class="field-history-head"><h3>Histórico de relatórios</h3><p>Relatórios enviados pelos técnicos, com status de revisão da supervisão.</p></div>'+
  (own.length?own.map(r=>{
   const team=teams.find(x=>x.id===r.team_id),area=areas.find(x=>x.id===r.area_id);
   return '<article class="field-history-item"><div><strong>'+esc(dateBR(r.report_date))+' · '+esc(team?.name||"Equipe")+'</strong><p>'+esc(area?.name||"Frente não identificada")+'</p></div>'+fmtStatus(r.status)+'<div class="field-history-buttons"><button type="button" class="table-action" data-view-report="'+esc(r.id)+'">Detalhes ↗</button>'+
   (["rascunho","devolvido"].includes(r.status)&&r.reported_by===user.id?'<button type="button" class="table-action" data-resume-report="'+esc(r.id)+'">Retomar</button>':"")+'</div></article>';
  }).join(""):'<div class="empty-state">Ainda não há relatórios de campo cadastrados.</div>')+
  '</div>';
  root.querySelectorAll("[data-field-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.fieldTab)));
  root.querySelectorAll("[data-view-report]").forEach(b=>b.addEventListener("click",()=>showDetails(b.dataset.viewReport)));
  root.querySelectorAll("[data-resume-report]").forEach(b=>b.addEventListener("click",()=>resume(b.dataset.resumeReport)));
 }
 async function showDetails(id){
  try{
   const report=reports.find(r=>r.id===id);if(!report)return;
   const [i,a]=await Promise.all([
    list(db,"field_daily_report_items","id,activity_id,result,quantity,unit,hours_worked,location,notes,evidence_ref,work_order_id,report_id",500),
    list(db,"field_daily_attendance","id,employee_id,presence_status,report_id",500)
   ]);
   const parts=i.filter(r=>r.report_id===id);const pres=a.filter(x=>x.report_id===id);
   const reportLine=parts.map(x=>{const activity=activities.find(y=>y.id===x.activity_id);return '<li><strong>'+esc(activity?.code||"—")+' · '+esc(activity?.name||"Atividade")+'</strong> — '+esc(results[x.result]||x.result)+(x.quantity!==null?' · '+esc(x.quantity||"")+' '+esc(x.unit||""):"")+' · '+esc(x.location||"Local não informado")+'</li>'}).join("");
   root.innerHTML='<div class="field-history-detail"><button class="btn btn-ghost" id="field-back-history">← Histórico</button><h2>Relatório · '+esc(dateBR(report.report_date))+'</h2><p>'+fmtStatus(report.status)+'</p><h3>Atividades</h3><ul>'+reportLine+'</ul><h3>Trabalhadores</h3><p>'+pres.filter(x=>x.presence_status==="presente").length+' presentes; '+pres.filter(x=>x.presence_status==="ausente").length+' ausentes; '+pres.filter(x=>x.presence_status==="folga").length+' em folga.</p><h3>Impedimentos</h3><p>'+esc(report.impediments||"Não informados")+'</p><h3>Observações</h3><p>'+esc(report.general_notes||"Não informadas")+'</p></div>';
   root.querySelector("#field-back-history").addEventListener("click",drawHistory);
  }catch(e){notify(e.message,true)}
 }
 async function resume(id){
  try{
   const report=reports.find(r=>r.id===id);
   if(!report||report.reported_by!==user.id||!["rascunho","devolvido"].includes(report.status))return;
   const [i,a,participants]=await Promise.all([
    list(db,"field_daily_report_items","*",600),list(db,"field_daily_attendance","*",600),list(db,"field_daily_item_workers","*",800)
   ]);
   draftId=report.id;currentReport=report;
   selectedTeam=report.team_id;
   formState={report_date:report.report_date,team_id:report.team_id,area_id:report.area_id||"",shift:report.shift||"integral",team_leader:report.team_leader||"",weather:report.weather||"nao_informado",field_conditions:report.field_conditions||"",equipment_used:report.equipment_used||"",general_notes:report.general_notes||"",impediments:report.impediments||""};
   attendance=Object.fromEntries(a.filter(x=>x.report_id===id).map(x=>[x.employee_id,x.presence_status]));
   items=i.filter(x=>x.report_id===id).map(x=>({...x,quantity:x.quantity??"",hours_worked:x.hours_worked??"",work_order_id:x.work_order_id||"",workers:participants.filter(p=>p.report_item_id===x.id).map(x=>x.employee_id)}));
   if(!items.length)items=[newItem()];
   tab="novo";drawForm();notify("Rascunho recuperado para revisão.");
  }catch(e){notify(e.message,true)}
 }
 async function save(send){
  capture();
  const f=formState;
  if(!f.report_date||!selectedTeam||!f.area_id){notify("Informe data, equipe e frente operacional.",true);return}
  if(isTech&&selectedTeam!==teamId){notify("Este usuário só pode informar a própria equipe.",true);return}
  if(!items.length||items.some(x=>!x.activity_id)){notify("Selecione uma atividade da matriz de 73 itens em cada registro.",true);return}
  if(items.some(x=>(x.quantity!==""&&(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<0))||(x.hours_worked!==""&&(!Number.isFinite(Number(x.hours_worked))||Number(x.hours_worked)<0||Number(x.hours_worked)>24)))){notify("Confira as quantidades e horas informadas.",true);return}
  const buttons=[root.querySelector("#field-save-draft"),root.querySelector("#field-submit")].filter(Boolean);
  buttons.forEach(x=>x.disabled=true);
  try{
   const pres=Object.entries(attendance).filter(([id,status])=>status&&workersForTeam().some(w=>w.id===id));
   const report={
    team_id:selectedTeam,area_id:f.area_id,report_date:f.report_date,shift:f.shift,reported_by:user.id,
    team_leader:f.team_leader||null,weather:f.weather||"nao_informado",
    field_conditions:f.field_conditions||null,equipment_used:f.equipment_used||null,
    team_size:pres.filter(([id,status])=>status==="presente").length,
    general_notes:f.general_notes||null,impediments:f.impediments||null,
    status:"rascunho"
   };
   if(draftId){
    const up=await db.from("field_daily_reports").update(report).eq("id",draftId).select("id").single();if(up.error)throw up.error;
    const [delItems,delAtt]=await Promise.all([
      db.from("field_daily_report_items").delete().eq("report_id",draftId),
      db.from("field_daily_attendance").delete().eq("report_id",draftId)
    ]);
    if(delItems.error)throw delItems.error;if(delAtt.error)throw delAtt.error;
   }else{
    const created=await db.from("field_daily_reports").insert(report).select("id").single();
    if(created.error)throw created.error;
    draftId=created.data.id;
   }
   const program=programs.find(p=>p.area_id===f.area_id&&String(p.period_month).slice(0,7)===f.report_date.slice(0,7));
   const payload=items.map(x=>({
     id:crypto.randomUUID(),report_id:draftId,activity_id:x.activity_id,work_order_id:x.work_order_id||null,
     field_plan_item_id:program?(planItems.find(p=>p.program_id===program.id&&p.activity_id===x.activity_id)?.id||null):null,
     result:x.result,location:x.location||null,quantity:x.quantity===""?null:Number(x.quantity),
     unit:x.unit||null,hours_worked:x.hours_worked===""?null:Number(x.hours_worked),
     notes:x.notes||null,evidence_ref:x.evidence_ref||null
   }));
   const createdItems=await db.from("field_daily_report_items").insert(payload).select("id");
   if(createdItems.error)throw createdItems.error;
   for(let ix=0;ix<items.length;ix++){
    const people=items[ix].workers.filter(id=>workersForTeam().some(w=>w.id===id));
    if(!people.length)continue;
    const inserted=await db.from("field_daily_item_workers").insert(people.map(employee_id=>({report_item_id:payload[ix].id,employee_id})));
    if(inserted.error)throw inserted.error;
   }
   if(pres.length){
    const inserted=await db.from("field_daily_attendance").insert(pres.map(([employee_id,presence_status])=>({report_id:draftId,employee_id,presence_status})));
    if(inserted.error)throw inserted.error;
   }
   if(send){
    const submitted=await db.from("field_daily_reports").update({status:"enviado",submitted_at:new Date().toISOString()}).eq("id",draftId).select("id").single();
    if(submitted.error)throw submitted.error;
   }
   notify(send?"Relatório enviado para conferência da supervisão.":"Rascunho salvo com segurança.");
   tab="historico";draftId=null;currentReport=null;await drawHistory();
  }catch(error){
   notify("Não foi possível concluir: "+error.message+". O registro pode ter ficado em rascunho para recuperação.",true);
  }finally{buttons.forEach(x=>x.disabled=false)}
 }
 drawForm();
}
