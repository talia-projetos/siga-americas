// SIGA Américas · direcionamento gerencial por matriz de 73 itens.
// Dados reais: catálogo, preços e apontamentos; recorrência e bloqueios são hipóteses técnicas.
// A tela não programa automaticamente e não afirma previsão meteorológica.
// Não vincular itens por número de código: matriz e planilha possuem numeração diferente.
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
const number=v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(Number(v||0));
const text=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalized=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")
  .replace(/[–—]/g,"-").replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim();
const numericCode=v=>Number(String(v||"").split(".")[1])||0;
const dateBR=v=>v?String(v).slice(8,10)+"/"+String(v).slice(5,7):"—";
const isAction=code=>{const n=numericCode(code);return n>=1&&n<=57};
const fixedServices=new Set(["3.7","3.9","3.10"]);
const priorityNames={high:"Inspeção prioritária",medium:"Avaliar demanda",low:"Planejar sob demanda",blocked:"Bloqueio crítico",support:"Rubrica de apoio",fixed:"Rotina contratual fixa"};
function analysis(activity){
 const n=normalized(activity.name),code=activity.code;
 const lawn=/corte de gramados|rocada geral|remocao de aparas|manutencao de jardins|controle manual de plantas daninhas|capina seletiva/.test(n);
 const irrigation=/irrigac/.test(n);
 const trees=/poda de arvore|poda de palmeira|corte de arvore|transplante de palmeira|arvores em faixas/.test(n);
 const felling=/corte de arvore/.test(n);
 const machinery=/operacao de trator|gramados|rocada|controle quimico|regularizacao.*superficie/.test(n);
 const heavy=/corte de arvore|transplante|trator|plantio de grama|rocada geral|remocao mecanica/.test(n);
 const waste=/remocao.*entulho|limpeza de cerca|remocao de aparas/.test(n);
 const perennial=/manutencao de jardins|corte de gramados|rocada geral|remocao de aparas|controle manual de plantas daninhas/.test(n);
 const recurrence=perennial?3:waste||irrigation||/poda de arvore.*limpeza|poda de palmeira.*limpeza|poda de cerca viva/.test(n)?2:1;
 const situation=fixedServices.has(code)?"fixed":isAction(code)?"action":"support";
 const motivation=perennial?"Recorrência potencial alta na manutenção de áreas verdes. Vistoriar e medir a área antes de programar."
  :waste?"A demanda pode reaparecer. Conferir acúmulo, acesso e medição por unidade contratual."
  :irrigation?"Executar conforme necessidade hídrica observada; chuva pode tornar o serviço dispensável."
  :felling?"Só considerar após vistoria, diâmetro, autorizações aplicáveis e avaliação de segurança."
  :trees?"Serviço condicionado à avaliação técnica, local, segurança e eventual autorização."
  :fixedServices.has(code)?"Serviço de rotina mensal. Não somar novamente à receita eventual sem previsão contratual."
  :situation==="support"?"Item integrante da matriz, mas não é uma ação operacional autônoma para programação."
  :"Ocorrência depende de demanda real, vistoria e autorização, quando exigível.";
 return {lawn,irrigation,trees,felling,machinery,heavy,waste,recurrence,situation,motivation};
}
function weatherRisk(type,scenario,window){
 if(type.situation==="support")return {status:"support",blocker:"Rubrica de apoio: verificar vínculo a serviço/OS."};
 if(type.situation==="fixed")return {status:"fixed",blocker:"Rotina mensal: verificar cobertura do posto e evitar duplicidade de cobrança."};
 if(scenario==="vento"&&(type.trees||type.machinery||type.heavy))
   return {status:"blocked",blocker:"Vento forte/temporal: não programar corte, poda ou operação insegura."};
 if(scenario==="chuva"&&(type.machinery||type.trees||type.irrigation||type.heavy))
   return {status:"blocked",blocker:type.irrigation?"Chuva: confirmar se há necessidade real de irrigar."
    :"Chuva/solo molhado: adiar ou reavaliar segurança e condições operacionais."};
 if(type.felling)return {status:"blocked",blocker:"Conferir autorização exigível, diâmetro e avaliação de segurança antes de programar."};
 if(scenario==="incerto"&&(type.trees||type.machinery||type.irrigation))
   return {status:"warning",blocker:"Tempo não confirmado: checar previsão e condições reais antes da liberação."};
 if(window==="curta"&&type.heavy)
   return {status:"warning",blocker:"Janela operacional reduzida: definir duração, equipe e execução por etapas."};
 if(type.trees)return {status:"warning",blocker:"Conferir segurança, localização, autorizações aplicáveis e equipe capacitada."};
 if(type.irrigation)return {status:"warning",blocker:"Verificar umidade do solo e necessidade hídrica antes da mobilização."};
 return {status:"ready",blocker:"Sem bloqueador presumido; confirmar vistoria, OS, equipe, clima e acesso."};
}
function assignPrice(activity,priceByName,entries,priceById){
 const direct=priceByName.get(normalized(activity.name));
 if(direct)return {price:direct,source:"Correspondência exata do serviço"};
 const used=new Set(entries.filter(e=>e.activity_id===activity.id&&e.contract_item_id).map(e=>e.contract_item_id));
 if(used.size===1){const p=priceById.get([...used][0]);if(p)return {price:p,source:"Vínculo registrado nos apontamentos"};}
 return {price:null,source:used.size>1?"Mais de uma rubrica vinculada: conferir":"Sem equivalência contratual confirmada"};
}
export function buildSuggestions(matrix,prices,executions,{scenario="incerto",window="normal"}={}){
 const named=new Map(prices.filter(p=>p.source_type==="precos").map(p=>[normalized(p.name),p]));
 const priced=new Map(prices.filter(p=>p.source_type==="precos").map(p=>[p.id,p]));
 return matrix.map(activity=>{
  const profile=analysis(activity),mapping=assignPrice(activity,named,executions,priced);
  const own=executions.filter(e=>e.activity_id===activity.id&&e.execution_status!=="cancelada"&&e.validation_status!=="glosada");
  const days=new Set(own.map(e=>String(e.performed_on).slice(0,10))).size;
  const sum=own.reduce((s,e)=>s+Number(e.estimated_amount||0),0);
  const qty=own.reduce((s,e)=>s+Number(e.quantity||0),0);
  const blocker=weatherRisk(profile,scenario,window);
  // Ranking explicável: recorrência é heurística, dias e valores são registros reais.
  // Preços unitários não são comparados como se unidades diferentes fossem equivalentes.
  const score=profile.recurrence*25+Math.min(days,5)*12+Math.min(27,Math.log10(1+sum)*6)+(mapping.price?4:0);
  const stop=blocker.status==="blocked"||blocker.status==="fixed"||blocker.status==="support";
  const tier=stop?blocker.status:score>=78?"high":score>=49?"medium":"low";
  return {activity,profile,mapping,days,sum,qty,blocker,score,tier};
 });
}
const rank=(a,b)=>{
 const order={high:0,medium:1,low:2,fixed:3,support:4,blocked:5};
 return (order[a.tier]-order[b.tier])||b.score-a.score||numericCode(a.activity.code)-numericCode(b.activity.code);
};
// Visualização proporcional de valores REGISTRADOS (não medidos nem faturados).
// Os valores são comparados apenas em R$, nunca entre unidades físicas distintas.
export function renderRegisteredValueChart(all){
 const rows=all.filter(x=>Number(x.sum)>0).sort((a,b)=>b.sum-a.sum).slice(0,7);
 if(!rows.length)return '<p class="suggest-chart-empty">Ainda não há valores registrados para construir o gráfico.</p>';
 const peak=Math.max(...rows.map(x=>Number(x.sum)),1);
 const total=rows.reduce((sum,x)=>sum+Number(x.sum),0);
 return '<figure class="suggest-value-chart" aria-label="Comparação de valores estimados já registrados por item da matriz de atividades">'+
  '<div class="suggest-chart-scale"><span>R$ 0</span><span>Maior item: '+money(peak)+'</span></div>'+
  '<div class="suggest-chart-rows">'+rows.map((x,index)=>{
   const value=Number(x.sum),pct=100*value/peak;
   const label=x.activity.code+' · '+x.activity.name;
   const kind=x.profile.situation==="support"?"Rubrica de apoio":x.profile.situation==="fixed"?"Rotina mensal":"Serviço apontado";
   return '<div class="suggest-chart-row"><div class="suggest-chart-item"><strong title="'+text(label)+'">'+text(label)+'</strong><small>'+text(kind)+' · '+x.days+' dia(s) com registro</small></div>'+
    '<div class="suggest-chart-viz"><div class="suggest-chart-track" role="progressbar" aria-label="'+text(label)+'" aria-valuemin="0" aria-valuemax="'+peak.toFixed(2)+'" aria-valuenow="'+value.toFixed(2)+'" aria-valuetext="'+text(money(value))+'">'+
     '<span class="suggest-chart-bar'+(index===0?' is-largest':'')+'" style="width:'+pct.toFixed(2)+'%"></span></div></div>'+
    '<strong class="suggest-chart-amount">'+money(value)+'</strong></div>';
  }).join('')+'</div>'+
  '<figcaption class="suggest-chart-caption">Valores estimados dos registros vinculados aos itens; incluem apontamentos ainda pendentes de conferência. '+rows.length+' itens exibidos. Não representam faturamento, medição aceita nem previsão de receita.</figcaption></figure>';
}

const iso=x=>String(x||"").slice(0,10);
const shiftDay=(s,n)=>{const d=new Date(iso(s)+"T12:00:00");d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const monday=day=>{const d=new Date(iso(day)+"T12:00:00");return shiftDay(iso(day),-((d.getDay()+6)%7))};
const nowBR=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
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
 const receivedTeams=new Set(submitted.map(x=>x.team_id));
 const validatedTeams=new Set(submitted.filter(x=>x.status==="validado").map(x=>x.team_id));
 return {week,end,teamsShown,weeklyReports,submitted,weeklyItems,weeklyPlans,programTeams,receivedTeams,validatedTeams,
  informed:new Set(weeklyItems.map(x=>x.activity_id)),
  confirmed:new Set(weeklyItems.filter(x=>x.report.status==="validado").map(x=>x.activity_id)),
  planned:new Set(weeklyPlans.map(x=>x.activity_id)),
  pendingReview:submitted.filter(x=>x.status==="enviado").length};
}
export async function mountContractSuggestions(root,db,{onPlan=()=>{},notify=()=>{}}={}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Carregando dados semanais…</p></div>';
 const initial=await Promise.all([
  db.from("activity_catalog").select("id,code,name,category").order("code").limit(150),
  db.from("teams").select("id,code,name,active").eq("active",true).order("code"),
  db.from("field_programs").select("id,team_id").limit(300),
  db.from("field_plan_items").select("id,program_id,activity_id,planned_for,planned_quantity,action_status").limit(800)
 ]);
 for(const r of initial)if(r.error)throw r.error;
 const [matrix,teams,programs,plans]=initial.map(x=>x.data||[]);
 const byActivity=new Map(matrix.map(x=>[x.id,x])),byTeam=new Map(teams.map(x=>[x.id,x]));
 let week=monday(nowBR()),team="",search="",reports=[],items=[],lastUpdate="",requestId=0,loading=false;
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
  '<div id="weekly-feedback" aria-live="polite"></div><div id="weekly-counters"></div><div id="weekly-work"></div>'+
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
  const stats=[
    ["Equipes com relatório enviado",d.receivedTeams.size+" / "+d.teamsShown.length,
     "Cobertura de envio, não taxa de cumprimento"],
    ["Atividades informadas",d.informed.size,"Conforme relatórios enviados"],
    ["Atividades validadas",d.confirmed.size,"Em relatórios validados pela supervisão"],
    ["Atividades programadas",d.planned.size,"Com data e equipe vinculadas à semana"]
  ];
  el("#weekly-counters").innerHTML='<div class="weekly-stats">'+stats.map(([label,value,detail])=>
    '<div class="weekly-stat"><small>'+text(label)+'</small><strong>'+text(value)+'</strong><span>'+text(detail)+'</span></div>').join("")+'</div>';
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
    taskButton(a.id)+'</div>').join("")+'</div>'+
   '<p class="weekly-method">CAPE: Contrato (atividade elegível) → Aptidão (demanda e condições) → Programação (data/equipe) → '+
   'Evidência (relatório enviado, conferência e medição separadas). A falta de relatório não representa comprovação de descumprimento.</p>';
 }
 async function refresh(){
  const token=++requestId,selected=week;loading=true;el("#weekly-reload").disabled=true;
  el("#weekly-feedback").textContent="Consultando os relatórios da semana…";
  try{
   const rep=await db.from("field_daily_reports").select("id,team_id,report_period,period_start,period_end,status,submitted_at,reviewed_at")
    .eq("report_period","semanal").eq("period_start",selected).limit(300);
   if(rep.error)throw rep.error;
   const localReports=rep.data||[],ids=localReports.map(x=>x.id);
   let localItems=[];
   if(ids.length){
    for(let i=0;i<ids.length;i+=100){
     const r=await db.from("field_daily_report_items").select("id,report_id,activity_id,field_plan_item_id,result,notes,quantity").in("report_id",ids.slice(i,i+100)).limit(1000);
     if(r.error)throw r.error;
     localItems.push(...(r.data||[]));
    }
   }
   if(token!==requestId||selected!==week)return;
   reports=localReports;items=localItems;
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
