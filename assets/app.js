import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
import {groups,modules} from "./modules.js?v=14";
import {iconMarkup} from "./icons.js?v=4";
import {renderDashboardAnalytics} from "./analytics.js?v=4";
import {catalogOverview,catalogFilters,catalogTableTitle,isCatalogPage,partyLabels,domainLabels,categoryLabels} from "./catalog-ui.js?v=2";
import {mountInventoryCheck} from "./resource-check.js?v=2";
import {mountUniformManager} from "./uniform-bulk.js?v=9";
import {mountFieldReport} from "./field-forms.js?v=3";
import {mountFieldMonitor} from "./field-monitor.js?v=3";
import {renderFinancialIndicator,renderExecutionTable} from "./execution-metrics.js?v=4";
import {initRoutinePhotoField} from "./routine-photos.js?v=2";
import {mountDocumentCenter} from "./document-center.js?v=2";
import {mountCoverageMap} from "./coverage-map.js?v=2";
import {mountContractSuggestions} from "./contract-suggestions.js?v=3";

const el=id=>document.getElementById(id);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app={db:null,user:null,role:null,teamId:null,page:"inicio",rows:[],refs:{},editing:null,search:"",filters:{},sort:{key:null,descending:false},busy:false,pendingPage:null,prefillActivity:null};
const privileged=()=>["admin","gestao","supervisao"].includes(app.role);
const currency=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0));
const dateBR=s=>s?new Date(String(s).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const nameFor=key=>modules[key]?.title||key;
const allModules=Object.keys(modules);
const tableOf=key=>modules[key]?.table||key;
function notify(message,error=false){const root=el("toast");root.innerHTML='<div class="toast-item'+(error?' error':'')+'">'+escapeHTML(message)+'</div>';clearTimeout(notify.timer);notify.timer=setTimeout(()=>root.innerHTML="",4800)}
function canView(key){
 if(!app.role||!modules[key])return false;
 if(app.role==="tecnico")return ["inicio","field_report"].includes(key);
 if(["field_report","field_monitor","resource_check"].includes(key))return privileged();
 return !modules[key].private||privileged();
}
function groupFor(key){return groups.find(group=>group.items.includes(key))||null}
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
// Matriz técnica contratual: 3.1–3.57 são ações executáveis; 3.58–3.73 são rubricas de postos,
// serviços eventuais, diárias, máquinas e insumos, preservadas no catálogo de 73 itens.
function isProgrammableAction(code){
 const m=String(code??"").trim().match(/^3\.(\d+)$/);
 return Boolean(m&&Number(m[1])>=1&&Number(m[1])<=57);
}
function nav(){
 const root=el("navigation");
 if(!app.role){root.innerHTML="";return;}
 const query=norm(el("nav-search")?.value?.trim());
 const homeVisible=!query||norm(nameFor("inicio")).includes(query);
 const home=homeVisible?'<button type="button" class="nav-home '+(app.page==="inicio"?'active':'')+'" data-nav="inicio" title="Visão geral" '+(app.page==="inicio"?'aria-current="page"':'')+'><span class="nav-home-icon">'+iconMarkup("inicio")+'</span><span>'+escapeHTML(nameFor("inicio"))+'</span></button>':"";
 const sections=groups.map((group,i)=>{
  const all=group.items.filter(canView);
  const groupMatch=norm(group.label).includes(query);
  const items=all.filter(key=>!query||groupMatch||norm(nameFor(key)).includes(query));
  if(!items.length)return "";
  const active=items.includes(app.page);
  const open=Boolean(query)||active;
  const entries=items.map(key=>'<button type="button" class="nav-link '+(app.page===key?'active':'')+'" data-nav="'+key+'" '+(app.page===key?'aria-current="page"':'')+' title="'+escapeHTML(nameFor(key))+'"><span class="nav-icon">'+iconMarkup(key)+'</span><span class="nav-link-text">'+escapeHTML(nameFor(key))+'</span></button>').join("");
  return '<details class="nav-section '+(active?'contains-active':'')+'" data-nav-group="'+i+'" '+(open?'open':'')+'><summary class="nav-section-toggle" title="'+escapeHTML(group.label)+'" aria-label="'+escapeHTML(group.label)+'"><span class="nav-section-icon">'+iconMarkup(group.icon)+'</span><span class="nav-section-title">'+escapeHTML(group.label)+'</span><span class="nav-chevron">'+iconMarkup("chevron")+'</span></summary><div class="nav-section-items">'+entries+'</div></details>';
 }).join("");
 root.innerHTML=home+sections||'<p class="nav-no-results">Nenhum módulo encontrado.</p>';
}
function mobileSidebar(){return window.matchMedia("(max-width: 800px)").matches}
function syncSidebarToggle(){
 const toggle=el("menu-toggle");
 const expanded=mobileSidebar()?el("sidebar").classList.contains("open"):!el("app").classList.contains("sidebar-collapsed");
 toggle.setAttribute("aria-expanded",String(expanded));
 const label=mobileSidebar()?(expanded?"Fechar menu":"Abrir menu"):(expanded?"Recolher menu lateral":"Expandir menu lateral");
 toggle.setAttribute("aria-label",label);
 toggle.setAttribute("title",label);
}
function closeSidebar(){
 const menu=el("profile-menu");if(menu)menu.open=false;
 el("sidebar").classList.remove("open");
 document.body.classList.remove("sidebar-visible");
 syncSidebarToggle();
}
function header(key){
 el("breadcrumb-current").textContent=nameFor(key);
 const context=el("breadcrumb-context"),group=groupFor(key);
 context.hidden=!group;
 context.textContent=group?" / "+group.label.charAt(0)+group.label.slice(1).toLocaleLowerCase("pt-BR"):"";
 const user=app.user;
 const menu=el("profile-menu");
 menu.hidden=!user;
 if(!user)menu.open=false;
 const email=user?.email||"";
 el("current-user").textContent=email;
 el("profile-email-secondary").textContent=email;
 const initial=email?.charAt(0).toLocaleUpperCase("pt-BR")||"U";
 el("user-avatar").textContent=initial;
 const roleNames={admin:"Administração",gestao:"Gestão",supervisao:"Supervisão",consulta:"Consulta",tecnico:"Equipe de campo"};
 el("profile-role").textContent=roleNames[app.role]||"Usuário autorizado";
 el("logout").hidden=!user;
 el("login").hidden=!!user;
}
function title(key,subtitle,actions=""){return '<div class="page-heading"><div><span class="eyebrow">'+escapeHTML(groupFor(key)?.label||"GESTÃO INTEGRADA")+' · PROERG EM ITAIPU</span><h1>'+escapeHTML(nameFor(key))+'</h1><p>'+escapeHTML(subtitle)+'</p></div><div class="heading-actions">'+actions+'</div></div>'}
function errorBanner(message){return '<div class="notice danger">'+escapeHTML(message)+'</div>'}
function friendlyError(e){const msg=String(e?.message||e||"Erro inesperado.");if(/permission denied|row-level security|policy/i.test(msg))return "Acesso não autorizado. Confira o perfil e as políticas RLS do Supabase.";return msg}
function setup(){nav();header("inicio");el("main").innerHTML='<section class="auth-wrap"><div class="auth-card"><span class="eyebrow">CONFIGURAÇÃO INICIAL</span><h1>Conecte seu projeto Supabase</h1><p>A interface foi reconstruída e ainda não possui credenciais públicas de conexão. Execute a migração SQL e configure <code>assets/config.js</code> com o <strong>Project URL</strong> e a <strong>publishable key</strong> do seu projeto.</p><div class="notice warning">Não publique senhas, service_role, secret keys ou dados de trabalhadores no repositório. O acesso aos dados exige autenticação e políticas RLS.</div><p>Leia o <a href="https://github.com/talia-projetos/siga-americas#configuracao-inicial" target="_blank" rel="noopener noreferrer"><strong>README de implantação ↗</strong></a>.</p></div></section>'}
function login(){app.page="inicio";document.body.classList.add("auth-locked");nav();header("inicio");el("main").innerHTML='<section class="auth-wrap"><div class="auth-card"><div class="auth-brand-stack"><div class="auth-company" aria-label="Identidade PROERG"><img src="./assets/proerg-official-white.svg?v=1" alt="Logotipo oficial da PROERG" width="320" height="160" decoding="async"></div><div class="auth-brand"><img src="./assets/siga-logo-original-1.svg" alt="SIGA Américas — sistema de gestão da PROERG em Itaipu" class="auth-logo"></div></div><span class="eyebrow">ÁREA RESTRITA</span><h1>Bem-vindo(a)!</h1><p>Sistema de gestão da PROERG em Itaipu. Acompanhe equipes, registros e indicadores da operação.</p><form id="login-form" class="auth-form"><div class="field"><label for="auth-email">E-mail</label><input id="auth-email" type="email" name="email" autocomplete="username" required></div><div class="field"><label for="auth-password">Senha</label><input id="auth-password" type="password" name="password" autocomplete="current-password" required></div><button type="submit" class="btn btn-primary">Entrar no sistema</button></form><p>Se você ainda não possui acesso, solicite o cadastro ao administrador. O sistema não permite autorregistro.</p></div></section>';
 el("login-form").addEventListener("submit",async event=>{event.preventDefault();const btn=event.target.querySelector("button");btn.disabled=true;try{const fd=new FormData(event.target);const {error}=await app.db.auth.signInWithPassword({email:String(fd.get("email")).trim(),password:String(fd.get("password"))});if(error)throw error;await establishSession()}catch(e){notify(friendlyError(e),true)}finally{btn.disabled=false}});
}
function pending(){document.body.classList.add("auth-locked");nav();header("inicio");el("main").innerHTML='<section class="auth-wrap"><div class="auth-card"><span class="eyebrow">ACESSO PENDENTE</span><h1>Seu usuário ainda não foi autorizado</h1><p>O login foi reconhecido, mas não existe um perfil ativo de acesso ao SIGA Américas para este usuário.</p><div class="notice warning">O administrador deve registrar o usuário em <code>public.app_memberships</code> após criar seu cadastro no Supabase Auth.</div><button class="btn btn-secondary" data-action="logout">Sair desta conta</button></div></section>'}
async function establishSession(){
 const {data:{user},error}=await app.db.auth.getUser();
 if(error||!user){
  app.user=null;app.role=null;
  const hash=decodeURIComponent(location.hash.replace("#",""));
  app.pendingPage=modules[hash]&&hash!=="inicio"?hash:null;
  login();
  return;
 }
 app.user=user;
 const {data,error:membershipError}=await app.db.from("app_memberships").select("role,enabled,team_id").eq("user_id",user.id).maybeSingle();
 if(membershipError){el("main").innerHTML=errorBanner(friendlyError(membershipError));return;}
 app.role=data?.enabled?data.role:null;
 app.teamId=data?.enabled?data.team_id:null;
 if(!app.role){pending();return;}
 document.body.classList.remove("auth-locked");
 const hash=decodeURIComponent(location.hash.replace("#",""));
 const target=app.pendingPage||hash;
 app.pendingPage=null;
 await navigate(canView(target)?target:(app.role==="tecnico"?"field_report":"inicio"));
}
async function logout(){
 app.pendingPage=null;
 if(app.db)await app.db.auth.signOut();
 app.user=null;app.role=null;app.teamId=null;app.rows=[];app.refs={};
 login();
}
async function getCount(table,filter){let query=app.db.from(table).select("id",{count:"exact",head:true});if(filter)for(const [key,val] of Object.entries(filter))query=query.eq(key,val);const {count,error}=await query;if(error)throw error;return count??0;}
async function dashboard(){
 if(!app.role){login();return;}
 if(app.role==="tecnico"){await navigate("field_report");return;}
 app.page="inicio";nav();header("inicio");
 el("main").innerHTML='<div class="loading-page"><div class="loader"></div><p>Atualizando indicadores...</p></div>';
 const defs=[
  {title:"Relatórios para validar",table:"field_daily_reports",filter:{status:"enviado"},icon:"field_monitor",nav:"field_monitor",hint:"Enviados pelas equipes"},
  {title:"Ordens em aberto",table:"work_orders",filter:{status:"aberta"},icon:"work_orders",nav:"work_orders",hint:"Acompanhar serviços"},
  {title:"Recursos a conferir",table:"contract_resource_requirements",filter:{validation_status:"a_conferir"},icon:"resource_check",nav:"resource_check",hint:"Verificação dos itens exigidos"},
  {title:"Obrigações a verificar",table:"contract_obligations",filter:{status:"pendente"},icon:"obligations",nav:"obligations",hint:"Conferência documental"}
 ];
 const metricsHTML=values=>defs.map((d,i)=>{
  const value=values[i];
  const detail=value==="—"?"Consulta indisponível":value===0?"Nenhum registro neste estado":d.hint;
  return '<button type="button" data-nav="'+d.nav+'" class="metric dashboard-metric" aria-label="'+escapeHTML(d.title)+': '+escapeHTML(value)+'. Abrir '+escapeHTML(nameFor(d.nav))+'">'+
    '<div class="metric-header"><span>'+escapeHTML(d.title)+'</span><span class="metric-icon">'+iconMarkup(d.icon)+'</span></div>'+
    '<strong>'+escapeHTML(value)+'</strong><small>'+escapeHTML(detail)+'</small>'+
    '<span class="metric-open" aria-hidden="true">'+iconMarkup("arrow")+'</span></button>';
 }).join("");
 const shortcuts=["field_monitor","field_programs","resource_check","coverage"].filter(canView);
 const quick=shortcuts.map(key=>
  '<button type="button" data-nav="'+key+'" class="quick-link"><span class="quick-link-label">'+iconMarkup(key)+escapeHTML(nameFor(key))+'</span><span class="quick-link-arrow" aria-hidden="true">'+iconMarkup("arrow")+'</span></button>'
 ).join("");
 const hero=title("inicio","Acompanhe as equipes, os recursos e as prioridades do contrato, em um só lugar.",
   '<button type="button" class="btn btn-secondary" data-nav="field_programs">'+iconMarkup("calendar")+' Planejamento</button>'+
   '<button type="button" class="btn btn-primary" data-nav="field_monitor">'+iconMarkup("field_monitor")+' Acompanhar equipes</button>');
 const body=
  hero+
  '<section class="dashboard-overview" aria-label="Situação da operação">'+
   '<div class="dashboard-section-head"><div><span class="eyebrow">PAINEL OPERACIONAL</span><h2>O que precisa de atenção</h2><p>Indicadores atualizados com os registros disponíveis no sistema.</p></div></div>'+
   '<div class="metric-grid dashboard-metrics">'+metricsHTML(["—","—","—","—"])+'</div>'+
  '</section>'+
  '<div id="dashboard-execution-finance"></div>'+ 
  '<div id="dashboard-coverage-map"></div>'+ 
  '<div class="panel-grid dashboard-utility-grid">'+
    '<section class="panel dashboard-workspace-panel"><div class="panel-inner"><span class="eyebrow">ROTINA DE GESTÃO</span><h2>Continuar de onde você precisa</h2><p>Acesse rapidamente as funções usadas na supervisão e no planejamento.</p><div class="quick-grid dashboard-quick-grid">'+quick+'</div></div></section>'+
    '<section class="panel dashboard-activity-panel"><div class="panel-inner"><span class="eyebrow">ACOMPANHAMENTO</span><div class="dashboard-recent-head"><h2>Ordens de serviço recentes</h2><button class="table-action" type="button" data-nav="work_orders">Ver todas '+iconMarkup("arrow")+'</button></div><div id="dashboard-recent-orders" class="dashboard-recent-orders"><p class="dashboard-subtle">Buscando movimentações...</p></div></div></section>'+
  '</div>'+
  '<section id="dashboard-analytics" class="dashboard-analytics" aria-label="Indicadores por área"></section>';
 el("main").innerHTML=body;
 const metrics=el("main").querySelector(".dashboard-metrics");
 const orders=el("dashboard-recent-orders"),charts=el("dashboard-analytics");
 // Atualiza cada bloco sem impedir que os demais funcionem.
 Promise.all(defs.map(d=>getCount(d.table,d.filter).catch(()=> "—"))).then(values=>{
  if(app.page==="inicio"&&metrics)metrics.innerHTML=metricsHTML(values);
 }).catch(()=>{});
 (async()=>{
  try{
   const {data,error}=await app.db.from("work_orders")
    .select("reference,description,status,created_at").order("created_at",{ascending:false}).limit(4);
   if(error)throw error;
   if(app.page!=="inicio"||!orders)return;
   orders.innerHTML=(data||[]).length?
    '<ul class="dashboard-recent-list">'+data.map(row=>{
     const title=String(row.reference||"Ordem de serviço");
     const description=String(row.description||"Sem descrição cadastrada").slice(0,115);
     const status=String(row.status||"Não informado").replaceAll("_"," ");
     return '<li><div><strong>'+escapeHTML(title)+'</strong><p>'+escapeHTML(description)+'</p></div><span class="tag">'+escapeHTML(status)+'</span></li>';
    }).join("")+'</ul>':
    '<div class="dashboard-empty-state">'+iconMarkup("clipboard")+'<div><strong>Nenhuma ordem registrada</strong><span>Quando houver movimentações, elas aparecerão aqui.</span></div></div>';
  }catch(error){
    if(orders&&app.page==="inicio")orders.innerHTML='<p class="dashboard-subtle">As ordens não puderam ser consultadas agora.</p>';
  }
 })();
 const mapHolder=el("dashboard-coverage-map");
 if(mapHolder)mountCoverageMap(mapHolder,app.db,{canWrite:privileged(),notify}).catch(error=>{
  if(app.page==="inicio")mapHolder.innerHTML='<div class="notice">Mapa de cobertura indisponível: '+escapeHTML(friendlyError(error))+'</div>';
 });
 const finance=el("dashboard-execution-finance");
 if(finance)(async()=>{
  const month=new Date().toISOString().slice(0,7);
  try{
   const [executions,goals,matrix]=await Promise.all([
    app.db.from("field_execution_entries").select("activity_id,performed_on,estimated_amount,validation_status,execution_status").gte("performed_on",month+"-01").lt("performed_on",new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)).limit(1200),
    app.db.from("finance_goals").select("period_month,target_amount").eq("period_month",month+"-01"),
    app.db.from("activity_catalog").select("id").limit(100)
   ]);
   for(const item of [executions,goals,matrix])if(item.error)throw item.error;
   if(app.page==="inicio")finance.innerHTML=renderFinancialIndicator(executions.data||[],goals.data||[],month,true,matrix.data||[])+
    '<p class="execution-dashboard-link"><button class="table-action" type="button" data-nav="coverage">Conferir lançamentos e preços na Cobertura ↗</button></p>';
  }catch(error){if(app.page==="inicio")finance.innerHTML='<p class="muted">Métricas de produção financeira indisponíveis neste momento.</p>';}
 })();
 if(charts)renderDashboardAnalytics(charts,app.db,{privileged:privileged()}).catch(error=>{
  if(app.page==="inicio")charts.innerHTML='<div class="notice">Os gráficos não puderam ser atualizados neste momento. Os demais módulos continuam disponíveis.</div>';
 });
}
async function ensureRefs(key){
 const mod=modules[key];if(!mod?.fields)return;
 const tables=[...new Set([...mod.fields.filter(f=>["ref","multi_ref"].includes(f.type)).map(f=>f.table),...(key==="field_plan_items"?["operational_areas"]:[]),...(key==="field_routine_records"?["service_posts"]:[])])];
 const fetches=tables.filter(table=>!app.refs[table]).map(async table=>{
  let lookup=app.db.from(table).select("*").order("created_at",{ascending:false});
  if(table==="contract_items")lookup=lookup.eq("source_type","precos");
  if(table==="employees")lookup=lookup.eq("active",true);
  const {data,error}=await lookup.limit(500);
  if(error)throw error;app.refs[table]=data||[];
 });
 await Promise.all(fetches);
 // No formulário de Ações programadas, selecionar somente atividades operacionais.
 if(key==="field_plan_items"&&app.refs.activity_catalog){
  app.refs.activity_catalog=app.refs.activity_catalog.filter(item=>isProgrammableAction(item.code));
 }
}
function optionLabel(table,id,display){
 if(!id)return "—";
 const x=(app.refs[table]||[]).find(v=>v.id===id);
 if(!x)return "Registro vinculado";
 if(display==="code_name")return [x.code,x.name].filter(Boolean).join(" · ");
 if(display==="routine_label"){const p=(app.refs.service_posts||[]).find(v=>v.id===x.service_post_id);return [p?.code,p?.name,x.title].filter(Boolean).join(" · ");}
 if(display==="program_label"){
  const a=(app.refs.operational_areas||[]).find(o=>o.id===x.area_id);
  const label=a?[a.code,a.name].filter(Boolean).join(" · "):"Frente a consultar";
  return String(x.period_month||"").slice(0,7)+" · "+label;
 }
 return String(x[display]??x.name??x.code??x.description??"Registro");
}
function fieldValue(key,value){
 if(value===null||value===undefined||value==="")return '<span class="muted">—</span>';
 const f=modules[app.page]?.fields?.find(x=>x.key===key);
 if(app.page==="employees"&&key==="name")return '<strong class="employee-name">'+escapeHTML(value)+'</strong>';
 if(app.page==="employees"&&key==="operational_role"){
   const label=String(value).toLocaleLowerCase("pt-BR").replace(/(^|\s)\p{L}/gu,s=>s.toLocaleUpperCase("pt-BR"));
   return '<span class="employee-role">'+escapeHTML(label)+'</span>';
 }
 if(app.page==="purchases"&&key==="sector_team_ids"){
  const ids=Array.isArray(value)?value:[];
  if(!ids.length)return '<span class="muted">Não informado</span>';
  const active=(app.refs.teams||[]).filter(t=>t.active!==false);
  if(active.length&&active.every(t=>ids.includes(t.id))&&ids.length===active.length)
    return '<span class="tag positive">Todos os setores ('+active.length+')</span>';
  return '<span class="truncate" title="'+escapeHTML(ids.map(id=>optionLabel("teams",id,"name")).join(", "))+'">'+
   escapeHTML(ids.map(id=>optionLabel("teams",id,"name")).join(", "))+'</span>';
 }
 if(f?.type==="ref")return escapeHTML(optionLabel(f.table,value,f.display));
 if(f?.type==="boolean")return value?'<span class="tag">Sim</span>':'<span class="tag gray">Não</span>';
 if(f?.type==="date")return escapeHTML(dateBR(value));
 if(["cost","total_cost","estimated_cost","unit_price","estimated_total","estimated_amount"].includes(key))return escapeHTML(currency(value));
 if(["estimated_quantity","required_quantity","observed_quantity"].includes(key))return escapeHTML(new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(Number(value)));
 if(["party_responsible","provider_party"].includes(key))return '<span class="tag">'+escapeHTML(partyLabels[value]||value)+'</span>';
 if(key==="domain")return escapeHTML(domainLabels[value]||value);
 if(key==="category")return escapeHTML(categoryLabels[value]||String(value).replaceAll("_"," "));
 if(["status","priority","condition","validation_status","review_status","action_status","execution_status"].includes(key)){
   const v=String(value);
   const labels={
    a_conferir:"A conferir",a_validar:"A validar",pendente:"Pendente",pendente_assinatura:"Aguardando assinatura",
    em_execucao:"Em execução",em_analise:"Em análise",em_revisao:"Em revisão",em_adequacao:"Em adequação",
    sem_programacao:"Sem programação",nao_aplicavel:"Não aplicável",devolvido:"Devolvido",
    validado:"Validado",validada:"Validada",conforme:"Conforme",aprovado:"Aprovado",aprovada:"Aprovada",
    programada:"Programada",concluida:"Concluída",concluido:"Concluído",executada:"Execução registrada",
    candidata:"Oportunidade",contemplada:"Contemplada",inviavel:"Inviável",cancelada:"Cancelada",
    impedida:"Impedida",impedido:"Impedido",glosada:"Glosada",ativo:"Ativo",encerrado:"Encerrado",
    aberta:"Aberta",em_aberto:"Em aberto",disponivel:"Disponível",atrasada:"Atrasada",
    normal:"Normal",alta:"Alta",critica:"Crítica",bom:"Bom",requer_atencao:"Requer atenção",
    em_manutencao:"Em manutenção",inutilizavel:"Inutilizável"
   };
   const display=v==="executada"&&app.page==="field_plan_items"?"Contemplada":labels[v]||v.replaceAll("_"," ");
   return '<span class="tag status-chip" data-status="'+escapeHTML(v)+'">'+escapeHTML(display)+'</span>';
 }
 return '<span class="truncate" title="'+escapeHTML(value)+'">'+escapeHTML(value)+'</span>';
}
function filteredRows(){
 const term=norm(app.search);
 const rows=app.rows.filter(row=>{
  const matches=!term||Object.values(row).some(v=>norm(v).includes(term))||modules[app.page].fields.some(f=>f.type==="ref"&&norm(optionLabel(f.table,row[f.key],f.display)).includes(term));
  const selections=Object.entries(app.filters||{}).every(([key,value])=>!value||String(row[key]??"")===String(value));
  return matches&&selections;
 });
 const {key,descending}=app.sort||{};
 if(!key)return rows;
 const collator=new Intl.Collator("pt-BR",{sensitivity:"base",numeric:true});
 rows.sort((a,b)=>{
  let av=a[key],bv=b[key];
  if(av==null||av==="")return bv==null||bv===""?0:1;
  if(bv==null||bv==="")return -1;
  const result=typeof av==="number"&&typeof bv==="number"?av-bv:collator.compare(String(av),String(bv));
  return descending?-result:result;
 });
 return rows;
}
function renderRows(){
 const table=el("table-body");if(!table)return;
 const m=modules[app.page],rows=filteredRows(),financial=app.page==="contract_items";
 const count=el("records-shown");
 if(count)count.textContent=rows.length+" de "+app.rows.length+" registros";
 el("main").querySelectorAll("[data-sort-col]").forEach(button=>{
   const active=button.dataset.sortCol===app.sort?.key;
   const direction=active?(app.sort.descending?"descending":"ascending"):"none";
   button.closest("th")?.setAttribute("aria-sort",direction);
   button.classList.toggle("active",active);
   const marker=button.querySelector(".sort-arrow");
   if(marker)marker.textContent=active?(app.sort.descending?"↓":"↑"):"↕";
 });
 if(!rows.length){
  table.innerHTML='<tr><td colspan="'+(m.columns.length+1)+'"><div class="empty-state"><div class="empty-symbol">◌</div><strong>Nenhum registro encontrado</strong>Revise a pesquisa ou os filtros.</div></td></tr>';
  return;
 }
 table.innerHTML=rows.map(row=>'<tr>'+m.columns.map(key=>{
  if(financial&&key==="code")return '<td><span class="catalog-code">'+escapeHTML(row.code)+'</span></td>';
  if(financial&&key==="name")return '<td><span class="catalog-name" title="'+escapeHTML(row.name)+'">'+escapeHTML(row.name)+'</span></td>';
  const klass=financial&&["estimated_quantity","unit_price","estimated_total"].includes(key)?' class="numeric-cell"':"";
  return '<td'+klass+'>'+fieldValue(key,row[key])+'</td>';
 }).join("")+'<td>'+(privileged()?'<button class="table-action" data-edit="'+escapeHTML(row.id)+'">'+iconMarkup('file')+' Editar</button>':'<span class="muted">Consulta</span>')+'</td></tr>').join("");
}
async function coveragePage(){
 app.page="coverage";app.search="";nav();header("coverage");
 el("main").innerHTML=title("coverage",modules.coverage.description)+'<div class="loading-page"><div class="loader"></div><p>Calculando cobertura das 73 atividades...</p></div>';
 try{
  const [a,b,executions,goals]=await Promise.all([
   app.db.from("activity_catalog").select("id,code,name,technical_lead,itaipu_technical_contact,contact_validation").order("code"),
   app.db.from("field_plan_items").select("activity_id,action_status,planned_quantity,executed_quantity").limit(1000),
   app.db.from("field_execution_entries").select("*").order("performed_on",{ascending:false}).limit(1000),
   app.db.from("finance_goals").select("period_month,target_amount").limit(100)
  ]);
  for(const result of [a,b,executions,goals])if(result.error)throw result.error;
  const recorded=executions.data||[],monthlyGoals=goals.data||[];
  const actual=new Set(recorded.filter(item=>item.execution_status==="executada"&&item.validation_status!=="glosada").map(item=>item.activity_id).filter(Boolean));
  const sorted=(a.data||[]).sort((x,y)=>Number(x.code.split(".")[1])-Number(y.code.split(".")[1]));
  const mapped=new Map();
  for(const item of b.data||[]){if(!item.activity_id)continue;const group=mapped.get(item.activity_id)||[];group.push(item);mapped.set(item.activity_id,group);}
  const prio=["executada","em_execucao","programada","a_validar","candidata","inviavel","nao_aplicavel"];
  const records=sorted.map(activity=>{
   const list=mapped.get(activity.id)||[];
   const status=actual.has(activity.id)?"executada":prio.find(s=>list.some(x=>x.action_status===s))||"sem_programacao";
   return {...activity,status,entries:list.length};
  });
  const covered=records.filter(x=>["programada","em_execucao","executada","inviavel","nao_aplicavel"].includes(x.status)).length;
  const candidates=records.filter(x=>x.status==="candidata"||x.status==="a_validar").length;
  const scheduled=records.filter(x=>["programada","em_execucao","executada"].includes(x.status)).length;
  const contemplated=records.filter(x=>x.status==="executada").length;
  const label=x=>({sem_programacao:"Sem avaliação",candidata:"Oportunidade",a_validar:"A validar",programada:"Programada",em_execucao:"Em execução",executada:"Contemplada",inviavel:"Inviável",nao_aplicavel:"Não aplicável"})[x]||x;
  const pct=records.length?Math.round(covered/records.length*100):0;
  const cards=[
   ["Atividades no catálogo",records.length,candidates+" oportunidades aguardam análise"],
   ["Com decisão registrada",covered,pct+"% da matriz triada"],
   ["Em programação / execução",scheduled,"Atividades distintas"],
   ["Atividades contempladas",contemplated+" / "+records.length,recorded.filter(x=>x.execution_status==="executada").length+" registros de execução · não significa encerramento"]
  ].map(d=>'<div class="metric"><div class="metric-header">'+d[0]+'<span class="metric-icon">'+iconMarkup("coverage")+'</span></div><strong>'+d[1]+'</strong><small>'+d[2]+'</small></div>').join("");
  el("main").innerHTML=title("coverage","O objetivo é analisar o aproveitamento tecnicamente aplicável de cada atividade, sem forçar execução de serviços desnecessários.",
    '<button class="btn btn-secondary" data-nav="field_programs">'+iconMarkup("calendar")+' Planejamento mensal</button><button class="btn btn-primary" data-nav="field_plan_items">'+iconMarkup("clipboard")+' Ações programadas</button>')+
    '<div class="metric-grid">'+cards+'</div>'+
    '<p class="catalog-context-note">'+iconMarkup("check")+' Cobertura identifica o alcance da matriz de 73 itens. <strong>Contemplada</strong> indica registro de execução, sem significar encerramento do serviço ou aprovação da medição.</p>'+
    '<div id="coverage-execution-metrics"></div>'+
    '<section class="table-panel"><div class="table-head"><div><h2>Diagnóstico das 73 atividades</h2><span>Atividades, responsáveis e situação de planejamento</span></div><div class="table-toolbar"><input type="search" id="coverage-search" class="searchbox" placeholder="Buscar atividade ou responsável..." aria-label="Pesquisar catálogo"></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Item</th><th>Atividade</th><th>PROERG</th><th>Itaipu</th><th>Planejamento</th><th>Ação</th></tr></thead><tbody id="coverage-body"></tbody></table></div></section>';
  const tbody=el("coverage-body");
  const draw=(term="")=>{
   const found=records.filter(x=>[x.code,x.name,x.technical_lead,x.itaipu_technical_contact].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))));
   tbody.innerHTML=found.length?found.map(r=>'<tr><td><strong>'+escapeHTML(r.code)+'</strong></td><td><span class="truncate" title="'+escapeHTML(r.name)+'">'+escapeHTML(r.name)+'</span></td><td>'+escapeHTML(r.technical_lead||"A confirmar")+'</td><td>'+escapeHTML(r.itaipu_technical_contact||"A confirmar")+'</td><td><span class="tag coverage-status coverage-status--'+escapeHTML(r.status)+'" title="'+escapeHTML(r.status==="executada"?"Existe registro de execução. Não significa serviço encerrado nem medição aprovada.":label(r.status))+'">'+label(r.status)+'</span></td><td>'+(isProgrammableAction(r.code)?'<button class="table-action" data-action="planActivity" data-activity-id="'+escapeHTML(r.id)+'">Programar ↗</button>':'<span class="muted">Rubrica contratual</span>')+'</td></tr>').join(""):'<tr><td colspan="6"><div class="empty-state">Nenhuma atividade localizada.</div></td></tr>';
  };
  draw();el("coverage-search").addEventListener("input",e=>draw(e.target.value));
  const metricsRoot=el("coverage-execution-metrics");
  const renderMonth=month=>{
   metricsRoot.innerHTML=renderFinancialIndicator(recorded,monthlyGoals,month,false,a.data||[])+renderExecutionTable(recorded,month);
   const monthField=metricsRoot.querySelector("#execution-month");
   if(monthField)monthField.addEventListener("change",event=>{
    if(/^\\d{4}-\\d{2}$/.test(event.target.value))renderMonth(event.target.value);
   });
  };
  renderMonth(new Date().toISOString().slice(0,7));
 }catch(e){el("main").innerHTML=title("coverage","Matriz de cobertura")+errorBanner(friendlyError(e))}
}
async function contractSuggestionsPage(){
 app.page="contract_suggestions";app.search="";nav();header("contract_suggestions");
 el("main").innerHTML=title("contract_suggestions",modules.contract_suggestions.description)+
  '<div id="contract-suggestions-root"></div>';
 try{
  await mountContractSuggestions(el("contract-suggestions-root"),app.db,{
   notify,
   onPlan:async activityId=>{
    if(!privileged()){notify("Sua conta não possui permissão para programar atividades.",true);return;}
    app.prefillActivity=activityId;
    await navigate("field_plan_items");
    await openForm();
   }
  });
 }catch(error){
  if(app.page==="contract_suggestions")el("contract-suggestions-root").innerHTML=errorBanner(friendlyError(error));
 }
}
async function documentCenterPage(){
 app.page="document_center";app.search="";nav();header("document_center");
 el("main").innerHTML=title("document_center",modules.document_center.description)+
  '<div id="document-center-root"></div>';
 try{
  await mountDocumentCenter(el("document-center-root"),app.db,{
   notify,canWrite:privileged(),
   onCreate:async kind=>{
    const target=kind==="os"?"work_orders":"responsibility_terms";
    await navigate(target);await openForm();
   },
   onEdit:async(kind,id)=>{
    const target=kind==="os"?"work_orders":"responsibility_terms";
    await navigate(target);await openForm(id);
   }
  });
 }catch(error){if(app.page==="document_center")
   el("document-center-root").innerHTML=errorBanner(friendlyError(error));}
}
async function modulePage(key){
 app.page=key;app.search="";app.filters={};app.sort={key:null,descending:false};nav();header(key);
 const m=modules[key];
 el("main").innerHTML=title(key,m.description)+'<div class="loading-page"><div class="loader"></div><p>Consultando registros...</p></div>';
 try{
  await ensureRefs(key);
  let query=app.db.from(m.table).select("*").order("created_at",{ascending:false});
  if(key==="contract_items")query=query.eq("source_type","precos");
  if(key==="employees")query=query.eq("active",true);
  const {data,error}=await query.limit(500);
  if(error)throw error;
  app.rows=data||[];
  // As rubricas não operacionais permanecem no banco e na matriz completa, mas não nesta tela nem no CSV.
  if(key==="field_plan_items"){
   const allowed=new Set((app.refs.activity_catalog||[]).map(item=>item.id));
   app.rows=app.rows.filter(row=>allowed.has(row.activity_id));
  }
  if(["contract_items","activity_catalog"].includes(key))app.rows.sort((a,b)=>Number(String(a.code).split(".")[1])-Number(String(b.code).split(".")[1]));
  const buttons=(privileged()
    ?key==="uniform_deliveries"
      ?'<button class="btn btn-primary" data-action="uniformBatch">'+iconMarkup("people")+' Registrar em lote</button>'+
        '<button class="btn btn-secondary" data-action="create">'+iconMarkup("plus")+' Entrega individual</button>'
      :'<button class="btn btn-primary" data-action="create">'+iconMarkup("plus")+' Novo registro</button>'
    :"")+
   '<button class="btn btn-ghost" data-action="export">'+iconMarkup("download")+' Baixar CSV</button>';
  const special=isCatalogPage(key);
  const overview=special?catalogOverview(key,app.rows):"";
  const filters=special?catalogFilters(key,app.rows):"";
  el("main").innerHTML=title(key,m.description,buttons)+overview+
  '<section class="table-panel catalog-table '+(key==="employees"?'people-table':'')+'"><div class="table-head"><div><h2>'+escapeHTML(catalogTableTitle(key))+'</h2><span id="records-shown">'+app.rows.length+' registros</span></div><div class="table-toolbar"><input class="searchbox" id="list-search" type="search" aria-label="Pesquisar registros" placeholder="Pesquisar..." autocomplete="off">'+
   (special?'<button type="button" class="btn btn-ghost filter-clear" id="clear-list-filters">'+iconMarkup("close")+' Limpar</button>':"")+
  '</div></div>'+
  (filters?'<div class="catalog-filters">'+filters+'</div>':"")+
  '<div class="table-scroll"><table class="data-table"><thead><tr>'+m.columns.map(col=>{
    const numeric=["unit_price","estimated_quantity","estimated_total","required_quantity","observed_quantity"].includes(col);
    const label=m.fields.find(f=>f.key===col)?.label||{unit:"Unidade",unit_price:"Preço unitário (R$)",estimated_amount:"Valor estimado (R$)"}[col]||col;
    return '<th class="'+(numeric?"numeric-cell":"")+'" aria-sort="none"><button type="button" class="table-sort" data-sort-col="'+escapeHTML(col)+'" title="Ordenar por '+escapeHTML(label)+'">'+escapeHTML(label)+' <span class="sort-arrow" aria-hidden="true">↕</span></button></th>';
  }).join("")+'<th>Ações</th></tr></thead><tbody id="table-body"></tbody></table></div>'+
  '<div class="filter-note">Você pode pesquisar, filtrar ou clicar nos títulos das colunas para ordenar. O CSV contém somente os registros exibidos.</div></section>';
  el("list-search").addEventListener("input",event=>{app.search=event.target.value;renderRows()});
  el("main").querySelectorAll("[data-sort-col]").forEach(button=>button.addEventListener("click",()=>{
   const key=button.dataset.sortCol;
   app.sort=app.sort.key===key?{key,descending:!app.sort.descending}:{key,descending:false};
   renderRows();
  }));
  const reset=el("clear-list-filters");
  if(special&&reset)reset.addEventListener("click",()=>{
   app.search="";app.filters={};app.sort={key:null,descending:false};
   el("list-search").value="";
   el("main").querySelectorAll("[data-list-filter]").forEach(select=>select.value="");
   renderRows();
  });
  el("main").querySelectorAll("[data-list-filter]").forEach(filter=>filter.addEventListener("change",event=>{app.filters[event.target.dataset.listFilter]=event.target.value;renderRows()}));
  renderRows();
 }catch(e){el("main").innerHTML=title(key,m.description)+errorBanner(friendlyError(e))}
}
async function uniformPage(){
 app.page="uniform_deliveries";nav();header("uniform_deliveries");
 el("main").innerHTML=title("uniform_deliveries","Distribua os kits por equipe, confira tamanhos e acompanhe cada entrega.")+
  '<div id="uniform-bulk-root"></div>';
 try{
  await ensureRefs("uniform_deliveries");
  const root=el("uniform-bulk-root");
  if(!root)return;
  await mountUniformManager(root,app.db,{
   notify,
   onSingle:()=>openForm()
  });
 }catch(error){
  const root=el("uniform-bulk-root");
  if(root)root.innerHTML=errorBanner(friendlyError(error));
 }
}
async function navigate(key){
 const requested=modules[key]?key:"inicio";
 if(!app.role){
  app.pendingPage=requested!=="inicio"?requested:null;
  app.page="inicio";app.refs={};app.rows=[];app.search="";
  if(location.hash!=="#inicio")location.hash="inicio";
  closeSidebar();
  login();
  return;
 }
 document.body.classList.remove("auth-locked");
 const next=canView(requested)?requested:"inicio";
 app.page=next;app.refs={};app.rows=[];app.search="";location.hash=next;
 if(el("nav-search"))el("nav-search").value="";
 closeSidebar();
 if(next==="inicio")await dashboard();
 else if(next==="coverage")await coveragePage();
 else if(next==="contract_suggestions")await contractSuggestionsPage();
 else if(next==="document_center")await documentCenterPage();
 else if(next==="uniform_deliveries")await uniformPage();
 else if(["field_report","field_monitor","resource_check"].includes(next)){
   nav();header(next);
   const slot=next==="field_report"?"daily-field-slot":next==="field_monitor"?"monitor-field-slot":"inventory-slot";
   el("main").innerHTML=title(next,modules[next].description)+'<div id="'+slot+'"></div>';
   try{
     if(next==="field_report")await mountFieldReport(el(slot),app.db,{user:app.user,role:app.role,teamId:app.teamId,notify});
     else if(next==="field_monitor")await mountFieldMonitor(el(slot),app.db,{user:app.user,notify});
     else await mountInventoryCheck(el(slot),app.db,{notify});
   }catch(error){el("main").innerHTML=title(next,modules[next].description)+errorBanner(friendlyError(error));}
 }
 else await modulePage(next);
}
function fieldInput(f,row){
 const value=row?.[f.key]??(f.key==="activity_id"?app.prefillActivity:null)??f.default??"";
 const required=f.required?" required":"";
 const htmlId="fld-"+f.key;
 const attr=' id="'+htmlId+'" name="'+escapeHTML(f.key)+'"'+required;
 const label='<label for="'+htmlId+'">'+escapeHTML(f.label)+(f.required?' *':'')+'</label>';
 let inp="";
 if(f.type==="multi_ref"){
  const stored=Array.isArray(value)?value:[];
  const selected=stored.length?stored:(row?.team_id?[row.team_id]:[]);
  const options=(app.refs[f.table]||[]).filter(o=>o.active!==false||selected.includes(o.id));
  const all=options.length>0&&options.every(o=>selected.includes(o.id));
  const checklist=options.map(o=>'<label class="purchase-sector-option"><input type="checkbox" name="'+escapeHTML(f.key)+'" data-purchase-sector value="'+escapeHTML(o.id)+'"'+(selected.includes(o.id)?' checked':'')+'><span>'+escapeHTML([o.code,o.name].filter(Boolean).join(" · "))+'</span></label>').join("");
  return '<fieldset class="field wide purchase-sector-field"><legend>'+escapeHTML(f.label)+'</legend>'+
   '<label class="purchase-sector-all"><input type="checkbox" data-purchase-select-all'+(all?' checked':'')+(options.length?'':' disabled')+'><span>Selecionar todos os setores</span></label>'+
   '<div class="purchase-sector-grid">'+(checklist||'<span class="muted">Nenhum setor cadastrado.</span>')+'</div>'+
   '<small class="purchase-sector-counter" data-purchase-sector-counter>'+selected.length+' de '+options.length+' setores selecionados</small></fieldset>';
 }
 if(f.type==="select"){
  inp='<select'+attr+'><option value="">Selecione...</option>'+f.options.map(o=>'<option value="'+escapeHTML(o.value)+'"'+(String(o.value)===String(value)?' selected':'')+'>'+escapeHTML(o.label)+'</option>').join("")+'</select>';
 }else if(f.type==="ref"){
  const options=app.refs[f.table]||[];
  inp='<select'+attr+'><option value="">Selecione...</option>'+options.map(o=>'<option value="'+escapeHTML(o.id)+'"'+(o.id===value?' selected':'')+'>'+escapeHTML(optionLabel(f.table,o.id,f.display))+'</option>').join("")+'</select>';
 }else if(f.type==="textarea"){
  inp='<textarea'+attr+'>'+escapeHTML(value)+'</textarea>';
 }else if(f.type==="boolean"){
  inp='<input type="checkbox"'+attr+(value?' checked':'')+' style="width:auto;align-self:flex-start">';
 }else{
  inp='<input'+attr+' type="'+(f.type==="number"?"number":f.type==="date"?"date":"text")+'" value="'+escapeHTML(value)+'"'+(f.step?' step="'+escapeHTML(f.step)+'"':'')+'>';
 }
 return '<div class="field '+(f.wide?"wide":"")+'">'+label+inp+'</div>';
}
let routineEvidence=null;
async function openForm(id=null){
 if(!privileged())return;
 const m=modules[app.page];if(!m?.table)return;try{await ensureRefs(app.page)}catch(e){notify(friendlyError(e),true);return;}
 const row=id?app.rows.find(x=>x.id===id):null;
 app.editing=row?.id??null;
 el("modal-title").textContent=(row?"Editar":"Novo registro · ")+m.title;
 if(routineEvidence){routineEvidence.destroy();routineEvidence=null;}
 el("modal-fields").innerHTML=m.fields.map(f=>fieldInput(f,row)).join("")+
  (app.page==="field_execution_entries"?'<div class="field wide execution-valuation-preview" id="execution-valuation-preview" role="status"></div>':"")+
  (app.page==="field_routine_records"?'<div class="field wide" id="routine-photo-root"></div>':"");
 if(app.page==="field_routine_records"){
  routineEvidence=initRoutinePhotoField(el("routine-photo-root"),app.db,{recordId:row?.id||null,notify});
 }
 if(app.page==="field_execution_entries"){
  const calculate=()=>{
   const productId=el("modal-fields").querySelector("#fld-contract_item_id")?.value;
   const quantity=Number(el("modal-fields").querySelector("#fld-quantity")?.value);
   const price=(app.refs.contract_items||[]).find(x=>x.id===productId);
   const preview=el("execution-valuation-preview");
   if(!preview)return;
   const rate=price&&Number(price.unit_price);
   preview.textContent=price&&Number.isFinite(rate)&&quantity>0?
    "Preço contratual: "+currency(rate)+" / "+(price.unit||"un")+" · Valor potencial: "+currency(rate*quantity)+" · Medição pendente de conferência.":
    "Selecione a rubrica da planilha de preços e informe a quantidade para calcular o valor potencial.";
  };
  el("modal-fields").querySelector("#fld-contract_item_id")?.addEventListener("change",calculate);
  el("modal-fields").querySelector("#fld-quantity")?.addEventListener("input",calculate);
  calculate();
 }
 el("modal-root").hidden=false;
 el("modal-fields").querySelector("input,select,textarea")?.focus();
}
function closeForm(force=false){if(app.busy&&force!==true)return;if(routineEvidence){routineEvidence.destroy();routineEvidence=null;}el("modal-root").hidden=true;app.editing=null}
async function saveRecord(e){
 e.preventDefault();if(app.busy)return;
 const m=modules[app.page],fd=new FormData(e.target),payload={};
 for(const f of m.fields){
  if(f.type==="multi_ref"){
   const ids=fd.getAll(f.key).map(String);
   const valid=(app.refs[f.table]||[]).map(t=>t.id);
   if(ids.length!==new Set(ids).size||ids.some(id=>!valid.includes(id))){
    notify("Seleção de setores inválida. Confira os setores cadastrados.",true);return;
   }
   payload[f.key]=ids;
   continue;
  }
  if(f.type==="boolean"){payload[f.key]=Boolean(e.target.elements[f.key].checked);continue;}
  let value=String(fd.get(f.key)??"").trim();if(f.required&&!value){notify("Preencha o campo: "+f.label,true);return;}
  if(value===""){payload[f.key]=null;continue;}
  payload[f.key]=f.type==="number"?Number(value):value;
  if(f.type==="number"&&!Number.isFinite(payload[f.key])){notify("Valor numérico inválido: "+f.label,true);return;}
 }
 if(app.page==="field_routine_records"&&routineEvidence?.hasPending()){
  try{routineEvidence.validate();}catch(error){notify(error.message,true);return;}
 }
 if(app.page==="purchases"){
  const sectors=payload.sector_team_ids||[];
  // Compatibilidade: mantém team_id apenas quando um único setor foi selecionado.
  payload.team_id=sectors.length===1?sectors[0]:null;
 }
 if(app.page==="contract_items"&&payload.source_type!=="precos"){notify("Use exclusivamente a planilha de preços neste módulo.",true);return;}
 if(app.page==="field_execution_entries"){
  const item=(app.refs.contract_items||[]).find(x=>x.id===payload.contract_item_id);
  if(!item||item.source_type!=="precos"||!Number.isFinite(Number(item.unit_price))){
   notify("Selecione um item válido da planilha contratual de preços.",true);return;
  }
  if(!(Number(payload.quantity)>0)){notify("Informe quantidade maior que zero.",true);return;}
  // O valor é sempre derivado da rubrica contratual, não digitado livremente.
  payload.unit_price=Number(item.unit_price);
  payload.unit=item.unit||"un";
 }
 if(app.page==="field_plan_items"&&!(app.refs.activity_catalog||[]).some(item=>item.id===payload.activity_id&&isProgrammableAction(item.code))){
  notify("Selecione uma ação contratual executável. Máquinas, diárias, postos e fornecimentos não entram nesta programação.",true);return;
 }
 if(["responsibility_terms","maintenance"].includes(app.page)){
  const a=Boolean(payload.vehicle_id),b=Boolean(payload.equipment_id);
  if(a===b){notify("Selecione somente um: veículo OU equipamento.",true);return;}
 }
 const btn=el("modal-submit");app.busy=true;btn.disabled=true;btn.textContent="Salvando...";
 try{
  const query=app.editing?app.db.from(m.table).update(payload).eq("id",app.editing):app.db.from(m.table).insert(payload);
  const {data,error}=await query.select("id").single();if(error)throw error;
  if(app.page==="field_routine_records"&&routineEvidence?.hasPending()){
   try{await routineEvidence.savePhotos(data.id);}
   catch(photoError){
    // O registro já existe. Manter o formulário e o ID permite novo envio sem duplicar a rotina.
    app.editing=data.id;
    notify("Rotina salva, mas o envio das fotos não foi concluído: "+photoError.message+". Confira a conexão e tente salvar novamente.",true);
    return;
   }
  }
  closeForm(true);app.prefillActivity=null;notify("Registro salvo com sucesso.");app.refs={};if(app.page==="uniform_deliveries")await uniformPage();else await modulePage(app.page);
 }catch(e){notify(friendlyError(e),true)}finally{app.busy=false;btn.disabled=false;btn.textContent="Salvar registro";}
}
function exportCSV(){
 const m=modules[app.page];if(!m?.table)return;
 const cols=m.fields.map(f=>f.key);
 const protect=value=>{let str=String(value??"");if(/^[=+@-]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"'};
 const output=[m.fields.map(f=>protect(f.label)).join(";"),...filteredRows().map(r=>cols.map(k=>protect(app.page==="purchases"&&k==="sector_team_ids"&&Array.isArray(r[k])?r[k].map(id=>optionLabel("teams",id,"name")).join(", "):r[k])).join(";"))].join("\r\n");
 const link=document.createElement("a"),url=URL.createObjectURL(new Blob(["\ufeff"+output],{type:"text/csv;charset=utf-8"}));link.href=url;link.download=m.table+"_"+new Date().toISOString().slice(0,10)+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener("click",async e=>{
 const menu=el("profile-menu");
 if(menu?.open&&!e.target.closest("#profile-menu"))menu.open=false;
 const navButton=e.target.closest("[data-nav]");if(navButton){await navigate(navButton.dataset.nav);return;}
 const edit=e.target.closest("[data-edit]");if(edit){await openForm(edit.dataset.edit);return;}
 const action=e.target.closest("[data-action]")?.dataset.action;
 if(action==="create")await openForm();
 if(action==="uniformBatch"&&app.page==="uniform_deliveries"&&privileged())await uniformPage();
 if(action==="export")exportCSV();
 if(action==="planActivity"){const id=e.target.closest("[data-activity-id]")?.dataset.activityId;if(id){app.prefillActivity=id;await navigate("field_plan_items");await openForm();}}
 if(action==="editExecution"){const id=e.target.closest("[data-execution-id]")?.dataset.executionId;if(id&&privileged()){await navigate("field_execution_entries");await openForm(id);}}
 if(action==="logout")await logout();
 if(action==="login"){app.pendingPage=null;login()}
 
});
// Identifica cada campo em telas estreitas, sem criar barras de rolagem.
function labelResponsiveTables(){
 el("main").querySelectorAll("table.data-table,table.inventory-table").forEach(table=>{
  const labels=[...table.querySelectorAll("thead th")].map(th=>th.textContent.replace(/[↕↑↓]/g,"").trim());
  table.querySelectorAll("tbody tr").forEach(tr=>{
   [...tr.children].forEach((td,i)=>{if(td.tagName==="TD"&&!td.dataset.label)td.dataset.label=labels[i]||"";});
  });
 });
}
new MutationObserver(labelResponsiveTables).observe(el("main"),{childList:true,subtree:true});
el("menu-toggle").addEventListener("click",()=>{
 if(mobileSidebar()){
  const expanded=el("sidebar").classList.toggle("open");
  document.body.classList.toggle("sidebar-visible",expanded);
 }else{
  const collapsed=el("app").classList.toggle("sidebar-collapsed");
  try{window.localStorage.setItem("siga-sidebar-collapsed",collapsed?"1":"0");}catch(_){}
  el("sidebar").classList.remove("open");
  document.body.classList.remove("sidebar-visible");
 }
 syncSidebarToggle();
});
el("sidebar-overlay").addEventListener("click",closeSidebar);
window.addEventListener("resize",()=>{
 if(!mobileSidebar()){el("sidebar").classList.remove("open");document.body.classList.remove("sidebar-visible")}
 syncSidebarToggle();
});
syncSidebarToggle();
el("nav-search").addEventListener("input",nav);
el("navigation").addEventListener("click",event=>{
 const summary=event.target.closest("summary");
 const details=summary?.parentElement;
 if(details?.matches("details.nav-section")){
  if(!mobileSidebar()&&el("app").classList.contains("sidebar-collapsed")){
   // Ícone de grupo recolhido abre a primeira opção acessível, sem expandir a barra.
   event.preventDefault();
   const groupIndex=Number(details.dataset.navGroup);
   const target=groups[groupIndex]?.items.find(canView);
   if(target&&target!==app.page)navigate(target);
   return;
  }
  if(!details.open){
   el("navigation").querySelectorAll("details.nav-section[open]").forEach(other=>{if(other!==details)other.open=false});
  }
 }
});

el("logout").addEventListener("click",logout);
el("login").addEventListener("click",()=>{app.pendingPage=null;login()});
el("modal-close").addEventListener("click",closeForm);
el("modal-cancel").addEventListener("click",closeForm);
el("modal-root").addEventListener("click",event=>{if(event.target===el("modal-root"))closeForm()});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"){
  if(el("profile-menu").open)el("profile-menu").open=false;
  if(!el("modal-root").hidden)closeForm();
  else closeSidebar();
 }
 if(event.key==="/"&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey){
  const tag=document.activeElement?.tagName;
  if(!["INPUT","TEXTAREA","SELECT"].includes(tag)&&app.role){
   event.preventDefault();el("nav-search").focus();
  }
 }
});
el("modal-fields").addEventListener("change",event=>{
 const target=event.target;
 if(!target.matches("[data-purchase-select-all],[data-purchase-sector]"))return;
 const area=el("modal-fields");
 const boxes=[...area.querySelectorAll("[data-purchase-sector]")];
 const all=area.querySelector("[data-purchase-select-all]");
 if(target.matches("[data-purchase-select-all]"))boxes.forEach(box=>{box.checked=target.checked;});
 const selected=boxes.filter(box=>box.checked).length;
 if(all){all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;}
 const counter=area.querySelector("[data-purchase-sector-counter]");
 if(counter)counter.textContent=selected+" de "+boxes.length+" setores selecionados";
});
el("record-form").addEventListener("submit",saveRecord);
window.addEventListener("hashchange",()=>{const key=decodeURIComponent(location.hash.replace("#",""));if(app.role&&modules[key]&&key!==app.page)navigate(key)});
async function init(){
 try{el("app").classList.toggle("sidebar-collapsed",window.localStorage.getItem("siga-sidebar-collapsed")==="1");}catch(_){}
 syncSidebarToggle();
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){setup();return;}
 try{app.db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
 await establishSession();
 app.db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){app.user=null;app.role=null;app.teamId=null;app.pendingPage=null;login();}});
 }catch(e){el("main").innerHTML=errorBanner("Erro ao iniciar o sistema: "+friendlyError(e))}
}
init();
