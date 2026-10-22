import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
import {groups,modules} from "./modules.js?v=22";
import {iconMarkup} from "./icons.js?v=5";
import {renderDashboardAnalytics} from "./analytics.js?v=6";
import {catalogOverview,catalogFilters,catalogTableTitle,isCatalogPage,partyLabels,domainLabels,categoryLabels} from "./catalog-ui.js?v=2";
import {mountInventoryCheck} from "./resource-check.js?v=6";
import {mountUniformManager} from "./uniform-bulk.js?v=10";
import {mountFieldReport} from "./field-forms.js?v=6";
import {mountFieldMonitor} from "./field-monitor.js?v=4";
import {renderFinancialIndicator} from "./execution-metrics.js?v=6";
import {initRoutinePhotoField} from "./routine-photos.js?v=2";
import {mountDocumentCenter} from "./document-center.js?v=8";
import {mountCoverageMap} from "./coverage-map.js?v=7";
import {mountContractSuggestions} from "./contract-suggestions.js?v=5";
import {mountMonthlyFinancialPlanner} from "./monthly-financial-planner.js?v=11";
import {mountWeatherAdvisory} from "./climate-planner.js?v=5";
import {mountQuickVehicle} from "./quick-vehicle.js?v=1";
import {mountCategoryQuantities} from "./category-quantities.js?v=1";
import {generateListPDF,downloadDocument} from "./document-output.js?v=9";

const el=id=>document.getElementById(id);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app={db:null,user:null,role:null,teamId:null,page:"inicio",rows:[],refs:{},editing:null,search:"",filters:{},sort:{key:null,descending:false},busy:false,pendingPage:null,prefillActivity:null};
const privileged=()=>["admin","gestao","supervisao"].includes(app.role);
// Estado de consulta por módulo, mantido apenas durante a sessão na interface.
// Não afeta dados contratuais nem filtros usados em outras telas.
const listViews=new Map();
// Estado documental separado: nunca filtrar registros com dados da transcrição.
const executionNoteFilterState={search:"",date:"",quantity:"missing"};
function rememberListView(key=app.page){
 if(!modules[key]?.table||key==="uniform_deliveries"||key!==app.page||!el("list-search"))return;
 const main=el("main"),workspace=document.querySelector(".workspace");
 listViews.set(key,{
  search:app.search,
  filters:{...app.filters},
  sort:{...app.sort},
  windowScroll:window.scrollY,
  workspaceScroll:workspace?.scrollTop||0,
  mainScroll:main?.scrollTop||0,
  tableScroll:main?.querySelector(".catalog-table .table-scroll")?.scrollLeft||0
 });
}
function restoreListViewPosition(key){
 const saved=listViews.get(key);
 if(!saved)return;
 requestAnimationFrame(()=>{
  if(app.page!==key)return;
  const main=el("main"),workspace=document.querySelector(".workspace");
  if(workspace)workspace.scrollTop=saved.workspaceScroll;
  if(main)main.scrollTop=saved.mainScroll;
  const table=main?.querySelector(".catalog-table .table-scroll");
  if(table)table.scrollLeft=saved.tableScroll;
  window.scrollTo(0,saved.windowScroll);
 });
}
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
 const docsVisible=canView("document_center")&&(!query||norm(nameFor("document_center")).includes(query)||norm("documentos").includes(query));
 const docsShortcut=docsVisible?'<button type="button" class="nav-home nav-standalone '+(app.page==="document_center"?"active":"")+'" data-nav="document_center" title="Central de documentos" '+(app.page==="document_center"?'aria-current="page"':"")+'><span class="nav-home-icon">'+iconMarkup("file")+'</span><span>Central de documentos</span></button>':"";
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
 root.innerHTML=home+docsShortcut+sections||'<p class="nav-no-results">Nenhum módulo encontrado.</p>';
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
function title(key,subtitle,actions=""){return '<div class="page-heading"><div><span class="eyebrow">'+escapeHTML(groupFor(key)?.label||(key==="document_center"?"DOCUMENTAÇÃO":"GESTÃO INTEGRADA"))+' · PROERG EM ITAIPU</span><h1>'+escapeHTML(nameFor(key))+'</h1><p>'+escapeHTML(subtitle)+'</p></div><div class="heading-actions">'+actions+'</div></div>'}
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
 listViews.clear();
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
 const shortcuts=["document_center","work_orders","field_monitor","field_programs","resource_check","coverage"].filter(canView);
 const quick=shortcuts.map(key=>
  '<button type="button" data-nav="'+key+'" class="quick-link"><span class="quick-link-label">'+iconMarkup(key)+escapeHTML(nameFor(key))+'</span><span class="quick-link-arrow" aria-hidden="true">'+iconMarkup("arrow")+'</span></button>'
 ).join("");
 const hero='<div class="page-heading dashboard-page-heading"><h1>'+escapeHTML(nameFor("inicio"))+'</h1></div>';
 const body=
  hero+
  '<section class="dashboard-overview" aria-label="Situação da operação">'+
   '<div class="dashboard-section-head"><div><span class="eyebrow">PAINEL OPERACIONAL</span><h2>O que precisa de atenção</h2><p>Indicadores atualizados com os registros disponíveis no sistema.</p></div></div>'+
   '<div class="metric-grid dashboard-metrics">'+metricsHTML(["—","—","—","—"])+'</div>'+
  '</section>'+
  '<div id="dashboard-field-alerts" class="dashboard-field-alerts" aria-live="polite"></div>'+
  '<div class="panel-grid dashboard-utility-grid">'+
    '<section class="panel dashboard-workspace-panel"><div class="panel-inner"><span class="eyebrow">ROTINA DE GESTÃO</span><h2>Continuar de onde você precisa</h2><p>Acesse rapidamente as funções usadas na supervisão e no planejamento.</p><div class="quick-grid dashboard-quick-grid">'+quick+'</div></div></section>'+
    '<section class="panel dashboard-activity-panel"><div class="panel-inner"><span class="eyebrow">ACOMPANHAMENTO</span><div class="dashboard-recent-head"><h2>Ordens de serviço recentes</h2><button class="table-action" type="button" data-nav="work_orders">Ver todas '+iconMarkup("arrow")+'</button></div><div id="dashboard-recent-orders" class="dashboard-recent-orders"><p class="dashboard-subtle">Buscando movimentações...</p></div></div></section>'+
  '</div>'+
  '<section class="dashboard-insights" aria-label="Visões complementares da operação">'+
   '<div class="dashboard-insights-heading"><div><span class="eyebrow">ANÁLISE GERENCIAL</span>'+
   '<h2>Aprofundar a operação</h2><p>Consulte uma visão por vez. Os dados e módulos continuam disponíveis.</p></div></div>'+
   '<div class="dashboard-insights-frame">'+
    '<div class="dashboard-insights-tabs" role="tablist" aria-label="Visões gerenciais">'+
     '<button type="button" role="tab" id="dashboard-tab-finance" aria-controls="dashboard-execution-finance" aria-selected="true" tabindex="0" data-dashboard-insight="finance">'+iconMarkup("assets")+' Produção e meta</button>'+
     '<button type="button" role="tab" id="dashboard-tab-map" aria-controls="dashboard-coverage-map" aria-selected="false" tabindex="-1" data-dashboard-insight="map">'+iconMarkup("layers")+' Mapa de cobertura</button>'+
     '<button type="button" role="tab" id="dashboard-tab-analytics" aria-controls="dashboard-analytics" aria-selected="false" tabindex="-1" data-dashboard-insight="analytics">'+iconMarkup("dashboard")+' Indicadores por área</button>'+
    '</div>'+
    '<div id="dashboard-execution-finance" class="dashboard-insight-panel" data-insight-panel="finance" role="tabpanel" aria-labelledby="dashboard-tab-finance"></div>'+
    '<div id="dashboard-coverage-map" class="dashboard-insight-panel" data-insight-panel="map" role="tabpanel" aria-labelledby="dashboard-tab-map" hidden></div>'+
    '<section id="dashboard-analytics" class="dashboard-insight-panel dashboard-analytics" data-insight-panel="analytics" role="tabpanel" aria-labelledby="dashboard-tab-analytics" hidden></section>'+
   '</div>'+
  '</section>';
 el("main").innerHTML=body;
 const metrics=el("main").querySelector(".dashboard-metrics");
 const orders=el("dashboard-recent-orders");
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
 // Pendências reportadas pelas equipes, ainda sem inferir entrega ou aceite.
 const fieldAlerts=el("dashboard-field-alerts");
 if(fieldAlerts)Promise.all([
  getCount("field_daily_report_items",{result:"parcial"}),
  getCount("field_daily_report_items",{result:"impedida"})
 ]).then(([partial,impeded])=>{
  if(app.page!=="inicio"||!fieldAlerts)return;
  if(!partial&&!impeded){fieldAlerts.innerHTML="";return;}
  fieldAlerts.innerHTML='<div class="dashboard-field-alert-card">'+
   '<div><span class="eyebrow">ATENÇÃO NA EXECUÇÃO</span>'+
   '<strong>Ocorrências que exigem acompanhamento</strong>'+
   '<p>'+escapeHTML(partial)+' atividades informadas como parciais · '+escapeHTML(impeded)+' impedidas. Confira pendências e evidências antes de considerar qualquer entrega.</p></div>'+
   '<button class="btn btn-secondary" type="button" data-nav="field_monitor">Revisar relatórios '+iconMarkup("arrow")+'</button></div>';
 }).catch(()=>{if(app.page==="inicio")fieldAlerts.innerHTML=""});
 const insightTabs=[...el("main").querySelectorAll("[data-dashboard-insight]")];
 const panels=[...el("main").querySelectorAll("[data-insight-panel]")];
 const loaded={finance:false,map:false,analytics:false};
 const selectInsight=name=>{
  if(app.page!=="inicio")return;
  insightTabs.forEach(button=>{
   const active=button.dataset.dashboardInsight===name;
   button.setAttribute("aria-selected",String(active));
   button.setAttribute("tabindex",active?"0":"-1");
  });
  panels.forEach(panel=>{panel.hidden=panel.dataset.insightPanel!==name;});
  if(name==="finance"&&!loaded.finance){
   loaded.finance=true;
   const finance=el("dashboard-execution-finance");
   finance.innerHTML='<p class="dashboard-insight-loading">Consultando produção informada e meta mensal...</p>';
   (async()=>{
    const month=new Date().toISOString().slice(0,7);
    try{
     const [executions,goals,matrix]=await Promise.all([
      app.db.from("field_execution_entries").select("activity_id,performed_on,estimated_amount,validation_status,execution_status")
       .gte("performed_on",month+"-01")
       .lt("performed_on",new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)).limit(1200),
      app.db.from("finance_goals").select("period_month,target_amount").eq("period_month",month+"-01"),
      app.db.from("activity_catalog").select("id").limit(100)
     ]);
     for(const item of [executions,goals,matrix])if(item.error)throw item.error;
     if(app.page==="inicio"&&finance.isConnected)finance.innerHTML=
      renderFinancialIndicator(executions.data||[],goals.data||[],month,true,matrix.data||[])+
      '<p class="execution-dashboard-link"><button class="table-action" type="button" data-nav="coverage">Conferir lançamentos na Cobertura '+iconMarkup("arrow")+'</button></p>';
    }catch(error){
     if(app.page==="inicio"&&finance.isConnected)finance.innerHTML=
      '<p class="dashboard-insight-loading">Métricas financeiras indisponíveis neste momento.</p>';
    }
   })();
  }
  if(name==="map"&&!loaded.map){
   loaded.map=true;
   const mapHolder=el("dashboard-coverage-map");
   mapHolder.innerHTML='<p class="dashboard-insight-loading">Carregando áreas georreferenciadas...</p>';
   mountCoverageMap(mapHolder,app.db,{canWrite:privileged(),notify}).catch(error=>{
    if(app.page==="inicio"&&mapHolder.isConnected)mapHolder.innerHTML=
     '<div class="notice">Mapa indisponível: '+escapeHTML(friendlyError(error))+'</div>';
   });
  }
  if(name==="analytics"&&!loaded.analytics){
   loaded.analytics=true;
   const charts=el("dashboard-analytics");
   renderDashboardAnalytics(charts,app.db,{privileged:privileged()}).catch(error=>{
    if(app.page==="inicio"&&charts.isConnected)charts.innerHTML=
     '<div class="notice">Indicadores detalhados indisponíveis neste momento.</div>';
   });
  }
 };
 insightTabs.forEach((button,index)=>{
  button.addEventListener("click",()=>selectInsight(button.dataset.dashboardInsight));
  button.addEventListener("keydown",event=>{
   const keys=["ArrowLeft","ArrowRight","Home","End"];
   if(!keys.includes(event.key))return;
   event.preventDefault();
   const to=event.key==="Home"?0:event.key==="End"?insightTabs.length-1:
    (index+(event.key==="ArrowLeft"?-1:1)+insightTabs.length)%insightTabs.length;
   insightTabs[to].focus();
   selectInsight(insightTabs[to].dataset.dashboardInsight);
  });
 });
 selectInsight("finance");
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
 if(table==="vehicles")return [x.plate||x.chassis||x.asset_tag||"Sem identificação",x.description].filter(Boolean).join(" · ");
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
 if(app.page==="teams"&&key==="name"){
  const members=(app.refs.teamWorkers||[]).filter(person=>person.team_id===app.rows.find(team=>team.name===value)?.id);
  // Técnico de Segurança do Trabalho permanece na equipe como apoio,
  // mas não é confundido com o Técnico Agrícola que lidera a frente.
  const technicians=members.filter(p=>/t[eé]cnico\s+agr[ií]cola/i.test(p.job_title||""));
  const names=technicians.map(p=>p.name);
  return '<div class="team-search-cell"><strong>'+escapeHTML(value||"Equipe")+'</strong>'+
   (names.length?'<small>'+ (names.length===1?"Técnico de campo: ":"Técnicos de campo: ")+
     escapeHTML(names.join(", "))+'</small>':
    '<small>Técnico de campo ainda não identificado no cadastro</small>')+'</div>';
 }
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
    normal:"Normal",alta:"Alta",critica:"Crítica",bom:"Bom",conferido:"Conferido",divergente:"Divergente",a_conferir:"A conferir",requer_atencao:"Requer atenção",
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
  const teamMembers=app.page==="teams"?(app.refs.teamWorkers||[]).filter(person=>person.team_id===row.id):[];
  const matches=!term||Object.values(row).some(v=>norm(v).includes(term))||
   modules[app.page].fields.some(f=>f.type==="ref"&&norm(optionLabel(f.table,row[f.key],f.display)).includes(term))||
   teamMembers.some(person=>norm(person.name+" "+(person.job_title||"")).includes(term));
  const validKeys=new Set(modules[app.page].fields.map(field=>field.key));
  const selections=Object.entries(app.filters||{}).every(([key,value])=>!validKeys.has(key)||!value||String(row[key]??"")===String(value));
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
   if(marker)marker.innerHTML=iconMarkup(active?(app.sort.descending?"sortdown":"sortup"):"sort");
 });
 if(!rows.length){
  const fleetEmpty=app.page==="vehicles"&&app.rows.length===0;
  table.innerHTML='<tr><td colspan="'+(m.columns.length+1)+'">'+(fleetEmpty?
   '<div class="empty-state fleet-empty-state"><div class="empty-symbol">'+iconMarkup("truck")+'</div><strong>Nenhum veículo individualizado</strong><p>A lista contratual está acima. Clique em <strong>Identificar veículo</strong> no tipo correspondente para cadastrar as unidades reais com placa, chassi, lacre ou patrimônio.</p></div>':
   '<div class="empty-state"><div class="empty-symbol">'+iconMarkup("search")+'</div><strong>'+(app.rows.length?"Nenhum registro corresponde aos filtros":"Ainda não há registros cadastrados")+'</strong><p>'+(app.rows.length?"Limpe a pesquisa ou os filtros para voltar a visualizar os registros.":"Nenhum lançamento foi encontrado nesta base.")+'</p></div>')+'</td></tr>';
  return;
 }
 table.innerHTML=rows.map(row=>'<tr>'+m.columns.map(key=>{
  if(app.page==="ppe_items"&&key==="contract_required"){
   const req=app.ppeRequirementMap?.get(row.contract_resource_requirement_id);
   if(!req)return '<td><span class="muted">Não vinculado</span></td>';
   const text=req.required_quantity==null?'A dimensionar':
    new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(Number(req.required_quantity))+' '+String(req.unit||"un");
   return '<td><span class="ppe-contract-unit">'+escapeHTML(text)+'</span></td>';
  }
  if(app.page==="stock_items"&&key==="ledger_balance")return '<td>'+(row.ledger_balance==null?'<span class="muted">Sem movimentações</span>':escapeHTML(new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(row.ledger_balance)))+'</td>';
  if(app.page==="stock_items"&&key==="counted_quantity")return '<td><div class="stock-count-cell"><input type="number" min="0" step="any" inputmode="decimal" data-stock-count="'+escapeHTML(row.id)+'" aria-label="Quantidade física de '+escapeHTML(row.name)+'" placeholder="A conferir" value="'+escapeHTML(row.counted_quantity??"")+'" '+(!privileged()?"disabled":"")+'><input type="text" maxlength="250" data-stock-evidence="'+escapeHTML(row.id)+'" aria-label="Local e evidência de '+escapeHTML(row.name)+'" placeholder="Local e evidência" value="'+escapeHTML(row.count_evidence||"")+'" '+(!privileged()?"disabled":"")+'></div></td>';
  if(app.page==="stock_items"&&key==="counted_at")return '<td>'+escapeHTML(row.counted_at?new Date(row.counted_at).toLocaleDateString("pt-BR"):"Não conferido")+'</td>';
  if(app.page==="field_execution_entries"&&key==="activity_id"&&row.activity_id==null)return '<td><span class="tag gray">Modalidade de poda a definir</span><small>Quantidade anotada, ainda sem rubrica</small></td>';
  if(financial&&key==="code")return '<td data-label="Código"><span class="catalog-code">'+escapeHTML(row.code)+'</span></td>';
  if(financial&&key==="name")return '<td data-label="Atividade / serviço"><span class="catalog-name" title="'+escapeHTML(row.name)+'">'+escapeHTML(row.name)+'</span></td>';
  const klass=financial&&["estimated_quantity","unit_price","estimated_total"].includes(key)?' class="numeric-cell"':"";
  const mobileLabel=financial?({unit:"Unidade contratual",estimated_quantity:"Quantidade estimada",unit_price:"Valor unitário",estimated_total:"Total estimado"}[key]||key):null;
  return '<td'+(mobileLabel?' data-label="'+escapeHTML(mobileLabel)+'"':'')+klass+'>'+fieldValue(key,row[key])+'</td>';
 }).join("")+'<td'+(financial?' data-label="Ações"':'')+'>'+(privileged()?'<button class="table-action" data-edit="'+escapeHTML(row.id)+'">'+iconMarkup('file')+' Editar</button>'+(app.page==="stock_items"?'<button class="table-action" data-save-stock="'+escapeHTML(row.id)+'">Salvar contagem</button>':""):'<span class="muted">Consulta</span>')+'</td></tr>').join("");
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
   metricsRoot.innerHTML=renderFinancialIndicator(recorded,monthlyGoals,month,false,a.data||[])+
    '<p class="execution-dashboard-link"><button type="button" class="table-action" data-nav="field_execution_entries">'+iconMarkup("file")+' Abrir Execuções registradas</button></p>';
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
// Transcrições do caderno são evidências preliminares, não medições nem receitas.
async function executionSourceNotesPanel(){
 const [raw,split,priced]=await Promise.all([
  app.db.from("field_execution_source_notes")
   .select("source_key,performed_on,activity_text,location_text,quantity_text,raw_excerpt,photo_refs,review_status")
   .order("performed_on",{ascending:false,nullsFirst:false}).limit(200),
  app.db.from("field_execution_note_locations")
   .select("source_key,line_key,performed_on,location_name,service_name,quantity_reported,contract_unit,candidate_price_codes,original_quantity_note,allocation_status,verification_status,review_note")
   .order("performed_on",{ascending:false,nullsFirst:false}).order("location_name",{ascending:true}).limit(500),
  app.db.from("contract_items")
   .select("code,unit,source_type").eq("source_type","precos").limit(100)
 ]);
 if(raw.error)return '<div class="notice warning">Não foi possível consultar os apontamentos do caderno: '+escapeHTML(friendlyError(raw.error))+'</div>';
 if(split.error)return '<div class="notice warning">Não foi possível consultar a separação dos locais: '+escapeHTML(friendlyError(split.error))+'</div>';
 if(priced.error)return '<div class="notice warning">A tabela de custeio não pôde ser consultada. Os apontamentos não foram exibidos para evitar associação de unidades incorretas.</div>';
 const notes=raw.data||[],lines=split.data||[],prices=priced.data||[];
 const missingQuantification=lines.filter(line=>line.quantity_reported==null).length;
 const quantifiedWithoutDate=lines.filter(line=>line.quantity_reported!=null&&!line.performed_on).length;
 const noteMap=new Map(notes.map(n=>[n.source_key,n]));
 const priceMap=new Map(prices.map(p=>[p.code,p]));
 const date=x=>x?new Date(x+"T12:00:00").toLocaleDateString("pt-BR"):"Data a conferir";
 const formatQty=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(Number(n));
 const sourceStatus=x=>x==="a_conferir"?"A conferir":x==="classificado"?"Classificado":"Descartado";
 const entries=lines.map(line=>{
  const codes=(line.candidate_price_codes||[]).filter(x=>priceMap.has(x));
  const uniqueUnits=[...new Set(codes.map(code=>priceMap.get(code)?.unit).filter(Boolean))];
  const refUnit=uniqueUnits.length===1?uniqueUnits[0]:null;
  const consistent=Boolean(refUnit)&&(!line.contract_unit||refUnit.toLocaleLowerCase("pt-BR")===line.contract_unit.toLocaleLowerCase("pt-BR"));
  const unit=consistent?refUnit:null;
  const hasQty=line.quantity_reported!==null&&line.quantity_reported!==undefined;
  const indicatedUnit=String(line.contract_unit||"").trim();
  const quantity=hasQty?formatQty(line.quantity_reported)+(unit?" "+unit:indicatedUnit?" "+indicatedUnit+" (rubrica pendente)":" (unidade a conferir)"):"—";
  const status=!hasQty?"Quantificação pendente":!line.performed_on?"Data a informar":line.verification_status==="conferido"?"Conferido documentalmente":"Quantidade transcrita";
  const source=noteMap.get(line.source_key);
  const candidateText=codes.length?"Rubricas possíveis: "+codes.join(", "):"Rubrica a identificar";
  const note=[line.original_quantity_note,line.review_note].filter(Boolean).join(" · ");
  const searchable=[line.location_name,line.service_name,line.original_quantity_note,source?.photo_refs,source?.raw_excerpt].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
  return '<tr data-exec-note-date="'+escapeHTML(line.performed_on||"sem_data")+'" data-exec-note-query="'+escapeHTML(searchable)+'" data-exec-note-has-quantity="'+(hasQty?"1":"0")+'">'+
   '<td>'+escapeHTML(date(line.performed_on))+'</td>'+
   '<td><strong>'+escapeHTML(line.location_name)+'</strong></td>'+
   '<td><strong>'+escapeHTML(line.service_name)+'</strong><small>'+escapeHTML(candidateText)+'</small></td>'+
   '<td class="execution-note-qty"><strong>'+escapeHTML(quantity)+'</strong><small>'+escapeHTML(status)+'</small></td>'+
   '<td><strong>'+escapeHTML(unit||"A classificar")+'</strong><small>'+escapeHTML(source?.photo_refs||"")+'</small></td>'+
   '<td><details><summary>Conferir origem</summary><p>'+escapeHTML(note||"Sem observação")+'</p></details></td></tr>';
 }).join("");
 // Exiba cada quantitativo junto do seu local, nunca como cadeia corrida entre frentes.
 // O texto manuscrito original continua preservado na área "Ver transcrição".
 const linesBySource=new Map();
 lines.forEach(line=>{
  const group=linesBySource.get(line.source_key)||[];
  group.push(line);
  linesBySource.set(line.source_key,group);
 });
 const breakdownFor=n=>{
  const group=linesBySource.get(n.source_key)||[];
  if(!group.length)return '<span class="execution-source-empty">A individualizar; consultar anotação original</span>';
  const repeatedNotes=new Set();
  return '<div class="execution-source-breakdown">'+group.map(line=>{
   const hasNumber=line.quantity_reported!==null&&line.quantity_reported!==undefined;
   const codes=(line.candidate_price_codes||[]).filter(code=>priceMap.has(code));
   const uniqueUnits=[...new Set(codes.map(code=>priceMap.get(code)?.unit).filter(Boolean))];
   const compatible=uniqueUnits.length===1&&(!line.contract_unit||uniqueUnits[0].toLowerCase()===line.contract_unit.toLowerCase());
   const amount=hasNumber?
    formatQty(Math.ceil(Number(line.quantity_reported)))+' '+(compatible?uniqueUnits[0]:line.contract_unit?line.contract_unit+' (rubrica pendente)':'(unidade a conferir)'):
    'Medida pendente';
   const literal=String(line.original_quantity_note||"").trim();
   const displayLiteral=!hasNumber&&literal&&!/sem (área|quantidade|medida|volume)|não apurad/i.test(literal);
   // Um total compartilhado por várias localidades (ex.: 5 cargas) só pode
   // aparecer uma vez por anotação: nunca replicar como se fosse a soma de cada área.
   const showLiteral=displayLiteral&&!repeatedNotes.has(literal);
   if(showLiteral)repeatedNotes.add(literal);
   return '<div class="execution-source-split-item">'+
    '<strong>'+escapeHTML(amount)+'</strong>'+
    '<span>'+escapeHTML(line.service_name||"Serviço não identificado")+' · '+escapeHTML(line.location_name||"Local a confirmar")+'</span>'+
    (showLiteral?'<small>Nota de campo: '+escapeHTML(literal)+'</small>':'')+
    '</div>';
  }).join("")+'</div>';
 };
 const original=notes.map(n=>'<tr>'+
  '<td>'+escapeHTML(date(n.performed_on))+'</td>'+
  '<td><strong>'+escapeHTML(n.activity_text||"")+'</strong><small>'+escapeHTML(n.location_text||"")+'</small></td>'+
  '<td>'+breakdownFor(n)+'</td>'+
  '<td><strong>'+escapeHTML(sourceStatus(n.review_status))+'</strong><small>'+escapeHTML(n.photo_refs||"")+'</small></td>'+
  '<td><details><summary>Ver transcrição literal</summary><p>'+escapeHTML(n.quantity_text||"")+'</p><p>'+escapeHTML(n.raw_excerpt||"")+'</p></details></td></tr>').join("");
 const selectedDate=executionNoteFilterState.date||"",selectedKind=executionNoteFilterState.quantity||"missing";
 const days=[...new Set(lines.map(x=>x.performed_on).filter(Boolean))].sort().reverse();
 const dates='<option value="">Todas as datas</option>'+days.map(d=>'<option value="'+escapeHTML(d)+'"'+(d===selectedDate?" selected":"")+'>'+escapeHTML(date(d))+'</option>').join("")+
  '<option value="sem_data"'+(selectedDate==="sem_data"?" selected":"")+'>Sem data</option>';
 return '<section class="execution-sources-panel"><details class="execution-sources-details">'+
  '<summary><span><span class="eyebrow">CONFERÊNCIA DOCUMENTAL</span><strong>Pendências de quantificação dos apontamentos</strong><small>'+missingQuantification+' sem quantidade · '+quantifiedWithoutDate+' com quantidade, mas sem data · '+notes.length+' conjuntos de origem</small></span><span class="execution-sources-chevron" aria-hidden="true"></span></summary>'+
  '<div class="execution-sources-content"><p><strong>Registros quantificados com data estão em Registros cadastrados. Aqui, o filtro inicial destaca apenas os sem quantificação. Use “Com quantitativo, sem data” para corrigir a data sem duplicar lançamentos.</strong> Unidades vinculadas exclusivamente à tabela de preços do contrato vigente.</p><p> Quantitativos aqui são apenas os escritos no caderno, sem medição, confirmação de escopo ou precificação. Áreas de roçada e corte de gramado exigem ha; cargas de entulho precisam de m³; horas de equipe não são automaticamente H/h. As 73 atividades da matriz permanecem separadas para o contrato subsequente.</p>'+
  '<div class="execution-location-filters"><label>Buscar local ou serviço<input id="execution-location-search" type="search" placeholder="Local, serviço ou foto..." value="'+escapeHTML(executionNoteFilterState.search||"")+'"></label>'+
  '<label>Data<select id="execution-location-date">'+dates+'</select></label>'+
  '<label>Quantidade<select id="execution-location-quantity"><option value="all"'+(selectedKind==="all"?" selected":"")+'>Todas</option><option value="reported"'+(selectedKind==="reported"?" selected":"")+'>Com quantitativo (todas)</option><option value="undated"'+(selectedKind==="undated"?" selected":"")+'>Com quantitativo, sem data</option><option value="missing"'+(selectedKind==="missing"?" selected":"")+'>Sem quantificação</option></select></label>'+
  '<span id="execution-locations-shown">'+lines.length+' linhas</span></div>'+
  '<div class="table-scroll execution-locations-scroll"><table class="execution-sources-table execution-locations-table"><thead><tr><th>Data</th><th>Local</th><th>Serviço</th><th>Quantitativo</th><th>Unidade / fonte</th><th>Conferência</th></tr></thead><tbody>'+entries+'</tbody></table></div>'+
  '<details class="execution-original-notes"><summary>Consultar as '+notes.length+' anotações de origem (quantitativos separados por local)</summary>'+
  '<p class="execution-original-warning">Quantidades transcritas, ainda não confirmadas em campo. Volumes e cargas sem data ou sem localização específica não são medição. Um total anotado para vários locais não deve ser somado novamente em cada local.</p>'+ 
  '<div class="table-scroll"><table class="execution-sources-table"><thead><tr><th>Data</th><th>Serviço</th><th>Quantitativos por local e serviço</th><th>Fonte / situação</th><th>Detalhamento</th></tr></thead><tbody>'+original+'</tbody></table></div></details>'+
  '</div></details></section>';
}
// A cláusula 6.5 reúne EPI, EPC e acessórios; não confundir referência com estoque conferido.
async function ppeContractOverview(rows){
 const {data,error}=await app.db.from("contract_resource_requirements")
  .select("id,required_quantity,unit,source_ref").eq("category","epi").eq("source_ref","6.5").limit(100);
 app.ppeRequirementMap=new Map((data||[]).map(r=>[r.id,r]));
 for(const row of rows){
  const req=app.ppeRequirementMap.get(row.contract_resource_requirement_id);
  row.contract_required=req?.required_quantity!=null?Number(req.required_quantity):null;
 }
 if(error)return '<div class="notice warning">A relação de EPIs foi carregada, mas a quantidade contratual não pôde ser consultada.</div>';

 const linked=rows.filter(item=>item.contract_resource_requirement_id);
 const personal=linked.filter(item=>/^EPI \/|^Conjunto de proteção/.test(item.category||"")).length;
 const others=linked.length-personal;
 const knownCA=linked.filter(item=>item.ca_number).length;
 return '<section class="ppe-contract-overview" aria-label="Referência contratual de proteção">'+
  '<div><span class="eyebrow">CONTRATO EMERGENCIAL IBCE2026 · ITEM 6.5</span>'+
  '<h2>Relação contratual de proteção</h2>'+
  '<p>Itens da lista orientativa, classificados para facilitar a consulta. <strong>Cadastro não comprova entrega, estoque disponível ou CA válido.</strong></p></div>'+
  '<div class="ppe-contract-metrics">'+
   '<div><strong>'+linked.length+'</strong><span>itens vinculados ao contrato</span></div>'+
   '<div><strong>'+personal+'</strong><span>EPI / conjuntos protetivos</span></div>'+
   '<div><strong>'+others+'</strong><span>EPC, acessórios e apoio</span></div>'+
   '<div><strong>'+knownCA+'</strong><span>CA informado no catálogo</span></div>'+
  '</div><p class="ppe-contract-note">As quantidades, os tamanhos, o CA quando exigível e a adequação ao risco dependem de levantamento pelo SST. As três exigências de fardamento estão na categoria contratual própria e não foram duplicadas aqui.</p>'+
  '</section>';
}
async function modulePage(key){
 const saved=listViews.get(key);
 app.page=key;
 app.search=saved?.search??"";
 app.filters={...(saved?.filters||{})};
 app.sort={key:saved?.sort?.key??null,descending:Boolean(saved?.sort?.descending)};
 nav();header(key);
 const m=modules[key];
 el("main").innerHTML=title(key,m.description)+'<div class="loading-page"><div class="loader"></div><p>Consultando registros...</p></div>';
 try{
  await ensureRefs(key);
  if(key==="teams"){
   const staff=await app.db.from("employees")
    .select("id,name,team_id,job_title,active").eq("active",true).limit(500);
   app.refs.teamWorkers=staff.error?[]:staff.data||[];
  }
  let query=app.db.from(m.table).select("*").order("created_at",{ascending:false});
  if(key==="contract_items")query=query.eq("source_type","precos");
  if(key==="employees")query=query.eq("active",true);
  const {data,error}=await query.limit(500);
  if(error)throw error;
  app.rows=data||[];
  if(key==="stock_items"){
   const movements=await app.db.from("stock_movements").select("stock_item_id,movement_type,quantity").limit(3000);
   if(movements.error)throw movements.error;
   const balance=new Map(),have=new Set();
   for(const r of movements.data||[]){
    have.add(r.stock_item_id);
    balance.set(r.stock_item_id,(balance.get(r.stock_item_id)||0)+(r.movement_type==="entrada"?1:-1)*Number(r.quantity||0));
   }
   app.rows=app.rows.map(r=>({...r,ledger_balance:have.has(r.id)?balance.get(r.id):null}));
  }
  // As rubricas não operacionais permanecem no banco e na matriz completa, mas não nesta tela nem no CSV.
  if(key==="field_plan_items"){
   const allowed=new Set((app.refs.activity_catalog||[]).map(item=>item.id));
   app.rows=app.rows.filter(row=>allowed.has(row.activity_id));
  }
  if(["contract_items","activity_catalog"].includes(key))app.rows.sort((a,b)=>referenceOrder.compare(String(a.code),String(b.code)));
  if(key==="service_posts")app.rows.sort((a,b)=>String(a.code||"").localeCompare(String(b.code||""),"pt-BR",{numeric:true}));
  const buttons=(privileged()
    ?key==="uniform_deliveries"
      ?'<button class="btn btn-primary" data-action="uniformBatch">'+iconMarkup("people")+' Registrar em lote</button>'+
        '<button class="btn btn-secondary" data-action="create">'+iconMarkup("plus")+' Entrega individual</button>'
      :'<button class="btn btn-primary" data-action="create">'+iconMarkup("plus")+' Novo registro</button>'
    :"")+
   '<div class="export-dropdown"><button type="button" class="btn btn-ghost" data-action="exportToggle" aria-expanded="false" aria-haspopup="true">'+iconMarkup("download")+' Exportar ▾</button>'+
   '<div class="export-options" hidden><button type="button" data-action="exportCSV">Baixar CSV</button><button type="button" data-action="exportPDF">Baixar PDF em lote</button></div></div>';
  const special=isCatalogPage(key);
  const assetOverview=key==="equipment"?
   '<div class="asset-data-summary"><strong>'+app.rows.length+' registros de máquinas</strong><span>'+app.rows.filter(r=>r.seal_number&&r.serial_number).length+' com lacre e número de máquina · '+app.rows.filter(r=>r.verification_status==="a_conferir").length+' aguardam verificação física</span><small>Importação baseada em termos históricos; não comprova disponibilidade atual.</small></div>':"";
  const fleetOverview="";
  const ppeOverview=key==="ppe_items"?(()=>{
   const total=app.rows.length,ca=app.rows.filter(r=>String(r.ca_number||"").trim()).length,
    validity=app.rows.filter(r=>r.ca_expires_on).length,
    expired=app.rows.filter(r=>r.ca_expires_on&&String(r.ca_expires_on)<new Date().toISOString().slice(0,10)).length;
   return '<div class="notice ppe-readiness"><strong>Conferência de segurança · EPI</strong><p>'+total+
    ' itens cadastrados · '+ca+' com CA informado · '+validity+' com validade registrada · '+expired+
    ' com validade vencida no cadastro.</p><p>CA, validade, estado físico, disponibilidade e entrega precisam ser confirmados documentalmente. Ausência de CA no cadastro não significa que o produto esteja dispensado dessa exigência.</p></div>';
  })():"";
  if(key==="ppe_items")await ppeContractOverview(app.rows); // Carrega mapa de quantitativos sem painel duplicado.
  const notesOverview=key==="field_execution_entries"?await executionSourceNotesPanel():"";
  const climateOverview=key==="field_programs"?'<div id="planning-climate-live"></div>':"";
  const quantityScope=({vehicles:["veiculo"],equipment:["ferramenta","equipamento"],ppe_items:["epi"],uniform_deliveries:["uniforme"]})[key];
  const quantityOverview=quantityScope?'<div id="category-quantity-slot"></div>':"";
  const stockOverview=key==="stock_items"?'<p class="notice stock-stocknote"><strong>Conferência de estoque:</strong> informe a quantidade física e a evidência nesta aba. O saldo por movimentações só usa entradas e saídas documentadas; sem registros, permanece indisponível. A contagem não cria movimentação.</p>':"";
  const overview=(special?catalogOverview(key,app.rows):"")+quantityOverview+stockOverview+assetOverview+fleetOverview+ppeOverview+climateOverview;
 const afterTable=key==="field_execution_entries"?notesOverview:"";
  const filters=special?catalogFilters(key,app.rows):"";
  el("main").innerHTML=title(key,m.description,buttons)+overview+
  '<section class="table-panel catalog-table '+(key==="employees"?'people-table':key==="contract_items"?'price-table':'')+'"><div class="table-head"><div><h2>'+escapeHTML(key==="vehicles"?"Veículos individualizados":catalogTableTitle(key))+'</h2><span id="records-shown">'+app.rows.length+' registros</span></div><div class="table-toolbar"><input class="searchbox" id="list-search" type="search" aria-label="Pesquisar registros" placeholder="'+(key==="teams"?"Buscar equipe, código ou nome do técnico":"Pesquisar...")+'" autocomplete="off">'+
   ((special||key==="field_execution_entries")?'<button type="button" class="btn btn-ghost filter-clear" id="clear-list-filters">'+iconMarkup("close")+' Limpar filtros</button>':"")+
  '</div></div>'+
  (filters?'<div class="catalog-filters">'+filters+'</div>':"")+
  '<div class="table-scroll"><table class="data-table">'+(key==="contract_items"?'<colgroup><col class="price-col-code"><col class="price-col-name"><col class="price-col-unit"><col class="price-col-quantity"><col class="price-col-price"><col class="price-col-total"><col class="price-col-actions"></colgroup>':'')+'<thead><tr>'+m.columns.map(col=>{
    const numeric=["unit_price","estimated_quantity","estimated_total","required_quantity","observed_quantity"].includes(col);
    const label=m.fields.find(f=>f.key===col)?.label||{unit:"Unidade",unit_price:"Preço unitário (R$)",estimated_amount:"Valor estimado (R$)",contract_required:"Quantidade contratual",ledger_balance:"Saldo movimentado",counted_quantity:"Contagem física",counted_at:"Data da contagem"}[col]||col;
    return '<th class="'+(numeric?"numeric-cell":"")+'" aria-sort="none"><button type="button" class="table-sort" data-sort-col="'+escapeHTML(col)+'" title="Ordenar por '+escapeHTML(label)+'"><span class="sort-label">'+escapeHTML(label)+'</span><span class="sort-arrow" aria-hidden="true">'+iconMarkup("sort")+'</span></button></th>';
  }).join("")+'<th>Ações</th></tr></thead><tbody id="table-body"></tbody></table></div>'+
  '<div class="filter-note">Você pode pesquisar, filtrar ou clicar nos títulos das colunas para ordenar. O CSV contém somente os registros exibidos.</div></section>'+afterTable;
  if(quantityScope)await mountCategoryQuantities(el("category-quantity-slot"),app.db,{categories:quantityScope,canWrite:privileged(),notify,individuals:app.rows.length});
  if(key==="field_programs")mountWeatherAdvisory(el("planning-climate-live"),app.db);
  // Identificação de veículo usa delegação global para funcionar após salvar a conferência.
  // Repõe os controles visuais antes de instalar eventos; não apenas o predicado da lista.
  if(key==="field_execution_entries"){
   const term=el("execution-location-search"),day=el("execution-location-date"),amount=el("execution-location-quantity");
   const showLocations=()=>{
    executionNoteFilterState.search=term.value;
    executionNoteFilterState.date=day.value;
    executionNoteFilterState.quantity=amount.value;
    const q=term.value.toLocaleLowerCase("pt-BR").trim();
    let count=0;
    el("main").querySelectorAll("[data-exec-note-query]").forEach(row=>{
     const matches=(!q||row.dataset.execNoteQuery.includes(q))&&
      (!day.value||row.dataset.execNoteDate===day.value)&&
      (amount.value==="all"||(amount.value==="reported"&&row.dataset.execNoteHasQuantity==="1")||(amount.value==="undated"&&row.dataset.execNoteHasQuantity==="1"&&row.dataset.execNoteDate==="sem_data")||(amount.value==="missing"&&row.dataset.execNoteHasQuantity==="0"));
     row.hidden=!matches;
     if(matches)count++;
    });
    el("execution-locations-shown").textContent=count+" linha(s)";
   };
   [term,day,amount].forEach(input=>input?.addEventListener(input===term?"input":"change",showLocations));
   showLocations();
  }
  el("list-search").value=app.search;
  el("main").querySelectorAll("[data-list-filter]").forEach(filter=>{
   filter.value=app.filters[filter.dataset.listFilter]??"";
  });
  el("list-search").addEventListener("input",event=>{app.search=event.target.value;renderRows()});
  el("main").querySelectorAll("[data-sort-col]").forEach(button=>button.addEventListener("click",()=>{
   const key=button.dataset.sortCol;
   app.sort=app.sort.key===key?{key,descending:!app.sort.descending}:{key,descending:false};
   renderRows();
  }));
  const reset=el("clear-list-filters");
  if(reset)reset.addEventListener("click",()=>{
   app.search="";app.filters={};app.sort={key:null,descending:false};
   el("list-search").value="";
   el("main").querySelectorAll("[data-list-filter]").forEach(select=>select.value="");
   renderRows();
  });
  el("main").querySelectorAll("[data-list-filter]").forEach(filter=>filter.addEventListener("change",event=>{app.filters[event.target.dataset.listFilter]=event.target.value;renderRows()}));
  renderRows();
  restoreListViewPosition(key);
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
 // Guardar a consulta da página de origem antes de mudar de módulo.
 rememberListView();
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
 else if(next==="financial_planning"){
   nav();header(next);
   el("main").innerHTML=title(next,modules[next].description)+'<div id="monthly-financial-planner"></div>';
   await mountMonthlyFinancialPlanner(el("monthly-financial-planner"),app.db,{role:app.role,notify});
 }
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
// Ordenação natural: 3.1, 3.2 ... 3.9, 3.10; também nomes e placas.
const referenceOrder=new Intl.Collator("pt-BR",{numeric:true,sensitivity:"base"});
function sortedReferenceOptions(items){
 return [...items].sort((a,b)=>{
  const first=v=>String(v.code||v.name||v.item_name||v.plate||v.asset_tag||v.description||"");
  return referenceOrder.compare(first(a),first(b));
 });
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
  const options=sortedReferenceOptions((app.refs[f.table]||[]).filter(o=>o.active!==false||selected.includes(o.id)));
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
  const options=sortedReferenceOptions((app.refs[f.table]||[]).filter(o=>
   (f.key!=="contract_resource_requirement_id"||(app.page==="vehicles"?o.category==="veiculo":app.page==="equipment"?["ferramenta","equipamento"].includes(o.category):true))&&
   (app.page!=="ppe_deliveries"||f.table!=="ppe_items"||/^EPI \/|^Conjunto de proteção/.test(o.category||"")||o.id===value)
  ));
  const noVehicle=f.table==="vehicles"&&!options.length;
  inp='<select'+attr+'><option value="">'+(noVehicle?'Nenhum veículo individual cadastrado':'Selecione...')+'</option>'+options.map(o=>'<option value="'+escapeHTML(o.id)+'"'+(o.id===value?' selected':'')+'>'+escapeHTML(optionLabel(f.table,o.id,f.display))+'</option>').join("")+'</select>';
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
 const m=modules[app.page];if(!m?.table)return;
 if(app.page==="responsibility_terms")delete app.refs.vehicles;
 try{await ensureRefs(app.page)}catch(e){notify(friendlyError(e),true);return;}
 const row=id?app.rows.find(x=>x.id===id):null;
 app.editing=row?.id??null;
 el("modal-title").textContent=(row?"Editar":"Novo registro · ")+m.title;
 if(routineEvidence){routineEvidence.destroy();routineEvidence=null;}
 el("modal-fields").innerHTML=(app.page==="field_execution_entries"?'<div class="execution-form-section-heading"><strong>Identificação e quantidade</strong><small>Informe a execução; a rubrica determina a referência de valor.</small></div>'+m.fields.slice(0,7).map(f=>fieldInput(f,row)).join("")+'<div class="execution-form-section-heading"><strong>Situação e conferência</strong><small>Resultado informado e conferência são informações distintas.</small></div>'+m.fields.slice(7,9).map(f=>fieldInput(f,row)).join("")+'<details class="execution-form-extras"'+(row?.id?" open":"")+'> <summary>Origem, evidências e observações <span>Complementar</span></summary><div class="execution-form-extras-fields">'+m.fields.slice(9).map(f=>fieldInput(f,row)).join("")+'</div></details>':m.fields.map(f=>fieldInput(f,row)).join(""))+
  (app.page==="field_execution_entries"?'<div class="field wide execution-valuation-preview" id="execution-valuation-preview" role="status"></div>':"")+
  (app.page==="field_routine_records"?'<div class="field wide" id="routine-photo-root"></div>':"");
 if(app.page==="field_routine_records"){
  routineEvidence=initRoutinePhotoField(el("routine-photo-root"),app.db,{recordId:row?.id||null,notify});
 }
 if(app.page==="responsibility_terms")mountQuickVehicle(el("modal-fields"),{db:app.db,notify,onCreated:vehicle=>{app.refs.vehicles=[...new Map([...(app.refs.vehicles||[]),vehicle].map(v=>[v.id,v])).values()];}});
 if(app.page==="work_orders"){
  const fields=el("modal-fields");
  const priceSelect=fields.querySelector("#fld-contract_item_id");
  const unitInput=fields.querySelector("#fld-unit");
  if(unitInput){
   const hint=document.createElement("small");
   hint.className="work-order-unit-hint";
   hint.setAttribute("aria-live","polite");
   unitInput.closest(".field")?.appendChild(hint);
   let lastContractUnit="";
   const syncUnit=()=>{
    const selected=(app.refs.contract_items||[]).find(item=>item.id===priceSelect?.value&&item.source_type==="precos");
    const contractUnit=String(selected?.unit??"").trim();
    if(contractUnit){
     unitInput.value=contractUnit;
     unitInput.readOnly=true;
     lastContractUnit=contractUnit;
     unitInput.classList.add("work-order-unit-derived");
     hint.textContent="Unidade definida pelo item "+(selected.code||"")+" da planilha de preços.";
    }else{
     if(lastContractUnit&&unitInput.value===lastContractUnit)unitInput.value="";
     lastContractUnit="";
     unitInput.readOnly=false;
     unitInput.classList.remove("work-order-unit-derived");
     unitInput.placeholder="Informe a unidade da atividade";
     hint.textContent=priceSelect?.value?"Item sem unidade contratual cadastrada; confirme antes de emitir a OS.":"Selecione um item de preços para preencher automaticamente ou informe a unidade aplicável.";
    }
   };
   priceSelect?.addEventListener("change",syncUnit);
   syncUnit();
  }
 }
 if(app.page==="field_execution_entries"){
  const fields=el("modal-fields");
  const activitySelect=fields.querySelector("#fld-activity_id");
  const description=fields.querySelector("#fld-activity_label");
  const priceSelect=fields.querySelector("#fld-contract_item_id");
  const quantityInput=fields.querySelector("#fld-quantity");
  const quantityWrap=quantityInput?.closest(".field");
  const unitHint=document.createElement("small");
  unitHint.className="execution-unit-hint";
  unitHint.setAttribute("aria-live","polite");
  quantityWrap?.appendChild(unitHint);
  const calculate=()=>{
   const price=(app.refs.contract_items||[]).find(x=>x.id===priceSelect?.value&&x.source_type==="precos");
   const quantity=Number(quantityInput?.value);
   const preview=el("execution-valuation-preview");
   if(!preview)return;
   unitHint.textContent=price?"Unidade contratual: "+(price.unit||"un"):"A unidade será definida pela rubrica selecionada.";
   const rate=price&&Number(price.unit_price);
   preview.textContent=price&&Number.isFinite(rate)&&quantity>0?
    "Preço contratual: "+currency(rate)+" / "+(price.unit||"un")+" · Valor potencial: "+currency(rate*quantity)+" · Medição pendente de conferência.":
    "Selecione a rubrica da planilha de preços e informe a quantidade para calcular o valor potencial.";
  };
  activitySelect?.addEventListener("change",()=>{
   const activity=(app.refs.activity_catalog||[]).find(x=>x.id===activitySelect.value);
   if(activity&&description&&(!description.value.trim()||description.dataset.autofilled==="1")){
    description.value=[activity.code,activity.name].filter(Boolean).join(" · ");
    description.dataset.autofilled="1";
   }
  });
  description?.addEventListener("input",()=>{description.dataset.autofilled="0";});
  priceSelect?.addEventListener("change",calculate);
  quantityInput?.addEventListener("input",calculate);
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
 if(["vehicles","equipment"].includes(app.page)){
  if(app.page==="vehicles"&&![payload.plate,payload.chassis,payload.asset_tag].some(v=>String(v||"").trim())){
   notify("Informe placa, chassi ou outra identificação inequívoca do veículo.",true);return;
  }
  if(payload.verification_status!=="a_conferir"&&(!payload.verified_on||!payload.verification_ref)){
   notify("Para declarar conferência ou divergência, registre data e referência da evidência.",true);return;
  }
 }
 if(app.page==="purchases"){
  const sectors=payload.sector_team_ids||[];
  // Compatibilidade: mantém team_id apenas quando um único setor foi selecionado.
  payload.team_id=sectors.length===1?sectors[0]:null;
 }
 if(app.page==="contract_items"&&payload.source_type!=="precos"){notify("Use exclusivamente a planilha de preços neste módulo.",true);return;}
 if(app.page==="work_orders"){
  const item=(app.refs.contract_items||[]).find(x=>x.id===payload.contract_item_id&&x.source_type==="precos");
  if(payload.contract_item_id&&!item){
   notify("Item da planilha de preços inválido para esta OS.",true);return;
  }
  if(item&&String(item.unit??"").trim())payload.unit=String(item.unit).trim();
  if(payload.quantity!==null&&payload.quantity!==undefined&&payload.quantity!==""&&!String(payload.unit??"").trim()){
   notify("Informe a unidade de medição da OS ou vincule um item da planilha de preços.",true);return;
  }
 }
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
  rememberListView();
  closeForm(true);app.prefillActivity=null;notify("Registro salvo com sucesso.");app.refs={};if(app.page==="uniform_deliveries")await uniformPage();else await modulePage(app.page);
 }catch(e){notify(friendlyError(e),true)}finally{app.busy=false;btn.disabled=false;btn.textContent="Salvar registro";}
}
function exportCSV(){
 const m=modules[app.page];if(!m?.table)return;
 const cols=[...new Set([...m.fields.map(f=>f.key),...m.columns,...(app.page==="stock_items"?["count_evidence"]:[])])];
 const header=key=>m.fields.find(f=>f.key===key)?.label||({contract_required:"Quantidade contratual",ledger_balance:"Saldo por movimentações",counted_quantity:"Contagem física",counted_at:"Data da contagem",count_evidence:"Evidência da contagem"})[key]||key;
 const cell=(row,key)=>key==="contract_required"?(app.ppeRequirementMap?.get(row.contract_resource_requirement_id)?.required_quantity??"A dimensionar"):
 app.page==="purchases"&&key==="sector_team_ids"&&Array.isArray(row[key])?row[key].map(id=>optionLabel("teams",id,"name")).join(", "):row[key];
 const protect=value=>{let str=String(value??"");if(/^[=+@-]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"'};
 const output=[cols.map(k=>protect(header(k))).join(";"),...filteredRows().map(r=>cols.map(k=>protect(cell(r,k))).join(";"))].join("\r\n");
 const link=document.createElement("a"),url=URL.createObjectURL(new Blob(["\ufeff"+output],{type:"text/csv;charset=utf-8"}));link.href=url;link.download=m.table+"_"+new Date().toISOString().slice(0,10)+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener("click",async e=>{
 document.querySelectorAll(".export-dropdown .export-options").forEach(list=>{
  if(!e.target.closest(".export-dropdown")){list.hidden=true;list.previousElementSibling?.setAttribute("aria-expanded","false")}
 });
 const menu=el("profile-menu");
 if(menu?.open&&!e.target.closest("#profile-menu"))menu.open=false;
 const navButton=e.target.closest("[data-nav]");if(navButton){await navigate(navButton.dataset.nav);return;}
 const fleetButton=e.target.closest("[data-fleet-add]");if(fleetButton&&app.page==="vehicles"){
  await openForm();
  const field=el("modal-fields").querySelector("#fld-contract_resource_requirement_id");
  if(field)field.value=fleetButton.dataset.fleetAdd;
  return;
 }
 const edit=e.target.closest("[data-edit]");if(edit){await openForm(edit.dataset.edit);return;}
 const action=e.target.closest("[data-action]")?.dataset.action;
 if(action==="create")await openForm();
 if(action==="uniformBatch"&&app.page==="uniform_deliveries"&&privileged())await uniformPage();
 if(action==="exportToggle"){
  const group=e.target.closest(".export-dropdown"),list=group?.querySelector(".export-options"),button=group?.querySelector('[data-action="exportToggle"]');
  if(list){list.hidden=!list.hidden;button?.setAttribute("aria-expanded",String(!list.hidden))}
 }
 if(action==="exportCSV"){
  exportCSV();const menu=e.target.closest(".export-options");if(menu)menu.hidden=true;
 }
 if(action==="exportPDF"){
  const btn=e.target.closest('[data-action="exportPDF"]');
  if(btn&&!btn.disabled){
   const page=app.page,m=modules[page],rows=filteredRows();
   const cols=m.columns.map(key=>({
    key,label:m.fields.find(f=>f.key===key)?.label||
      ({unit:"Unidade",unit_price:"Preço unitário (R$)",estimated_amount:"Valor estimado (R$)",contract_required:"Quantidade contratual",ledger_balance:"Saldo movimentado",counted_quantity:"Contagem física",counted_at:"Data da contagem"})[key]||key
   }));
   const values=rows.map(r=>cols.map(c=>{
    if(c.key==="contract_required"){
     const req=app.ppeRequirementMap?.get(r.contract_resource_requirement_id);
     return req?.required_quantity==null?"A dimensionar":String(req.required_quantity)+" "+(req.unit||"un");
    }
    const def=m.fields.find(f=>f.key===c.key);
    if(def?.type==="ref")return optionLabel(def.table,r[c.key],def.display);
    const v=r[c.key];
    if(v==null||v==="")return "—";
    if(def?.type==="date"||c.key==="counted_at")return dateBR(v);
    if(["unit_price","estimated_amount","estimated_total","cost","total_cost"].includes(c.key))return currency(v);
    if(typeof v==="boolean")return v?"Sim":"Não";
    return Array.isArray(v)?v.join(", "):typeof v==="object"?JSON.stringify(v):String(v);
   }));
   btn.disabled=true;btn.textContent="Gerando PDF…";
   try{
    const pdf=await generateListPDF({title:m.title,subtitle:rows.length+" registro(s) conforme pesquisa e filtros · gerado em "+new Date().toLocaleString("pt-BR"),columns:cols,rows:values});
    downloadDocument(pdf,m.table+"_"+new Date().toISOString().slice(0,10)+".pdf");
    notify("PDF em lote gerado com os registros exibidos.");
   }catch(err){notify("Falha no PDF: "+friendlyError(err),true);}
   finally{btn.disabled=false;btn.textContent="Baixar PDF em lote";const menu=btn.closest(".export-options");if(menu)menu.hidden=true}
  }
 }
 const saveStock=e.target.closest("[data-save-stock]");
 if(saveStock&&app.page==="stock_items"){
  const row=app.rows.find(r=>r.id===saveStock.dataset.saveStock);
  if(!row||!privileged())return;
  const raw=el("main").querySelector('[data-stock-count="'+row.id+'"]')?.value.trim()||"";
  const evidence=el("main").querySelector('[data-stock-evidence="'+row.id+'"]')?.value.trim()||"";
  const amount=Number(raw.replace(",","."));
  if(!raw||!Number.isFinite(amount)||amount<0){notify("Informe uma quantidade válida.",true);return}
  if(evidence.length<5){notify("Informe local e evidência da contagem.",true);return}
  saveStock.disabled=true;
  try{
   const counted_at=new Date().toISOString();
   const {error}=await app.db.from("stock_items").update({counted_quantity:amount,counted_at,count_evidence:evidence}).eq("id",row.id);
   if(error)throw error;
   Object.assign(row,{counted_quantity:amount,counted_at,count_evidence:evidence});
   renderRows();notify("Contagem física salva sem alterar as movimentações.");
  }catch(err){notify(friendlyError(err),true)}
  finally{saveStock.disabled=false}
 }
 if(action==="planActivity"){const id=e.target.closest("[data-activity-id]")?.dataset.activityId;if(id){app.prefillActivity=id;await navigate("field_plan_items");await openForm();}}
 if(action==="editExecution"){const id=e.target.closest("[data-execution-id]")?.dataset.executionId;if(id&&privileged()){await navigate("field_execution_entries");await openForm(id);}}
 if(action==="logout")await logout();
 if(action==="login"){app.pendingPage=null;login()}
 
});
// Identifica cada campo em telas estreitas, sem criar barras de rolagem.
function labelResponsiveTables(){
 el("main").querySelectorAll("table.data-table,table.inventory-table").forEach(table=>{
  const labels=[...table.querySelectorAll("thead th")].map(th=>th.textContent.trim());
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
 app.db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){listViews.clear();app.user=null;app.role=null;app.teamId=null;app.pendingPage=null;login();}});
 }catch(e){el("main").innerHTML=errorBanner("Erro ao iniciar o sistema: "+friendlyError(e))}
}
init();
