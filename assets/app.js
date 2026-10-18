import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
import {groups,modules} from "./modules.js";

const el=id=>document.getElementById(id);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app={db:null,user:null,role:null,page:"inicio",rows:[],refs:{},editing:null,search:"",busy:false};
const privileged=()=>["admin","gestao","supervisao"].includes(app.role);
const currency=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0));
const dateBR=s=>s?new Date(String(s).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const nameFor=key=>modules[key]?.title||key;
const allModules=Object.keys(modules);
const tableOf=key=>modules[key]?.table||key;
function notify(message,error=false){const root=el("toast");root.innerHTML='<div class="toast-item'+(error?' error':'')+'">'+escapeHTML(message)+'</div>';clearTimeout(notify.timer);notify.timer=setTimeout(()=>root.innerHTML="",4800)}
function canView(key){return modules[key]&&(!modules[key].private||privileged())}
function nav(){el("navigation").innerHTML=groups.map(group=>{
 const items=group.items.filter(canView);
 return items.length?'<div class="nav-group">'+escapeHTML(group.label)+'</div>'+items.map(key=>'<button class="nav-link '+(key===app.page?'active':'')+'" data-nav="'+key+'"><span class="nav-icon" aria-hidden="true">'+escapeHTML(modules[key].icon)+'</span>'+escapeHTML(nameFor(key))+'</button>').join(""):"";
}).join("")}
function header(key){el("breadcrumb-current").textContent=nameFor(key);el("current-user").textContent=app.user?.email||"";el("logout").hidden=!app.user}
function title(key,subtitle,actions=""){return '<div class="page-heading"><div><span class="eyebrow">GESTÃO CONTRATUAL · PROERG / ITAIPU</span><h1>'+escapeHTML(nameFor(key))+'</h1><p>'+escapeHTML(subtitle)+'</p></div><div class="heading-actions">'+actions+'</div></div>'}
function errorBanner(message){return '<div class="notice danger">'+escapeHTML(message)+'</div>'}
function friendlyError(e){const msg=String(e?.message||e||"Erro inesperado.");if(/permission denied|row-level security|policy/i.test(msg))return "Acesso não autorizado. Confira o perfil e as políticas RLS do Supabase.";return msg}
function setup(){nav();header("inicio");el("main").innerHTML='<section class="auth-wrap"><div class="auth-card"><span class="eyebrow">CONFIGURAÇÃO INICIAL</span><h1>Conecte seu projeto Supabase</h1><p>A interface foi reconstruída e ainda não possui credenciais públicas de conexão. Execute a migração SQL e configure <code>assets/config.js</code> com o <strong>Project URL</strong> e a <strong>publishable key</strong> do seu projeto.</p><div class="notice warning">Não publique senhas, service_role, secret keys ou dados de trabalhadores no repositório. O acesso aos dados exige autenticação e políticas RLS.</div><p>Leia o <a href="https://github.com/talia-projetos/siga-americas#configuracao-inicial" target="_blank" rel="noopener noreferrer"><strong>README de implantação ↗</strong></a>.</p></div></section>'}
function login(){nav();header("inicio");el("main").innerHTML='<section class="auth-wrap"><div class="auth-card"><span class="eyebrow">AMBIENTE RESTRITO</span><h1>Acessar SIGA Américas</h1><p>Plataforma de gestão operacional e conformidade do contrato. Utilize o acesso previamente autorizado pela administração.</p><form id="login-form" class="auth-form"><div class="field"><label for="auth-email">E-mail</label><input id="auth-email" type="email" name="email" autocomplete="username" required></div><div class="field"><label for="auth-password">Senha</label><input id="auth-password" type="password" name="password" autocomplete="current-password" required></div><button type="submit" class="btn btn-primary">Entrar no sistema</button></form><p>Se você ainda não possui acesso, solicite o cadastro ao administrador. O sistema não permite autorregistro.</p></div></section>';
 el("login-form").addEventListener("submit",async event=>{event.preventDefault();const btn=event.target.querySelector("button");btn.disabled=true;try{const fd=new FormData(event.target);const {error}=await app.db.auth.signInWithPassword({email:String(fd.get("email")).trim(),password:String(fd.get("password"))});if(error)throw error;await establishSession()}catch(e){notify(friendlyError(e),true)}finally{btn.disabled=false}});
}
function pending(){nav();header("inicio");el("main").innerHTML='<section class="auth-wrap"><div class="auth-card"><span class="eyebrow">ACESSO PENDENTE</span><h1>Seu usuário ainda não foi autorizado</h1><p>O login foi reconhecido, mas não existe um perfil ativo de acesso ao SIGA Américas para este usuário.</p><div class="notice warning">O administrador deve registrar o usuário em <code>public.app_memberships</code> após criar seu cadastro no Supabase Auth.</div><button class="btn btn-secondary" data-action="logout">Sair desta conta</button></div></section>'}
async function establishSession(){
 const {data:{user},error}=await app.db.auth.getUser();if(error||!user){app.user=null;app.role=null;login();return;}
 app.user=user;const {data,error:membershipError}=await app.db.from("app_memberships").select("role,enabled").eq("user_id",user.id).maybeSingle();
 if(membershipError){el("main").innerHTML=errorBanner(friendlyError(membershipError));return;}
 app.role=data?.enabled?data.role:null;
 if(!app.role){pending();return;}
 const hash=decodeURIComponent(location.hash.replace("#",""));app.page=canView(hash)?hash:"inicio";await navigate(app.page);
}
async function logout(){if(app.db)await app.db.auth.signOut();app.user=null;app.role=null;app.rows=[];login()}
async function getCount(table,filter){let query=app.db.from(table).select("id",{count:"exact",head:true});if(filter)for(const [key,val] of Object.entries(filter))query=query.eq(key,val);const {count,error}=await query;if(error)throw error;return count??0;}
async function dashboard(){
 app.page="inicio";nav();header("inicio");el("main").innerHTML='<div class="loading-page"><div class="loader"></div><p>Consultando os indicadores do contrato...</p></div>';
 try{
  const defs=[["Ordens em aberto","work_orders",{status:"aberta"},"▤"],["Obrigações pendentes","contract_obligations",{status:"pendente"},"✓"],["Veículos cadastrados","vehicles",null,"▣"],["Equipamentos inventariados","equipment",null,"⚒"]];
  const numbers=await Promise.all(defs.map(async d=>{try{return await getCount(d[1],d[2])}catch{return "—"}}));
  const {data:recent,error}=await app.db.from("work_orders").select("reference,description,status,created_at").order("created_at",{ascending:false}).limit(5);if(error)throw error;
  const metrics=defs.map((d,i)=>'<div class="metric"><div class="metric-header">'+escapeHTML(d[0])+'<span class="metric-icon">'+d[3]+'</span></div><strong>'+escapeHTML(numbers[i])+'</strong><small>Dados reais do banco de dados</small></div>').join("");
  const recentItems=(recent||[]).length?'<ul class="info-list">'+recent.map(r=>'<li><strong>'+escapeHTML(r.reference)+'</strong> · '+escapeHTML(r.description.slice(0,110))+' <span class="tag">'+escapeHTML(r.status)+'</span></li>').join("")+'</ul>':'<p style="margin-top:18px">Ainda não há ordens de serviço registradas.</p>';
  el("main").innerHTML=title("inicio","Um único ambiente para os serviços contratados, os recursos da operação e as evidências de conformidade.")+
    '<div class="metric-grid">'+metrics+'</div><div class="panel-grid"><section class="panel"><div class="panel-inner"><span class="eyebrow">ACESSO RÁPIDO</span><h2>Gestão das frentes operacionais</h2><p>Comece pelo cadastro do contrato, registre os recursos e acompanhe a execução. Os indicadores serão gerados apenas a partir dos registros efetivos.</p><div class="quick-grid">'+["obligations","work_orders","vehicles","equipment","ppe_items","stock_items"].filter(canView).map(key=>'<button data-nav="'+key+'" class="quick-link">'+escapeHTML(nameFor(key))+' <span aria-hidden="true">↗</span></button>').join("")+'</div></div></section><section class="panel"><div class="panel-inner"><span class="eyebrow">MOVIMENTAÇÃO RECENTE</span><h2>Ordens de serviço</h2>'+recentItems+'</div></section></div>'+
    '<div class="notice" style="margin-top:22px">As seis equipes e as oito frentes operacionais são entidades diferentes. A numeração da especificação técnica também é separada da planilha de preços.</div>';
 }catch(e){el("main").innerHTML=title("inicio","Visão geral") + errorBanner(friendlyError(e))}
}
async function ensureRefs(key){
 const mod=modules[key];if(!mod?.fields)return;
 const tables=[...new Set(mod.fields.filter(f=>f.type==="ref").map(f=>f.table))];
 const fetches=tables.filter(table=>!app.refs[table]).map(async table=>{
  const {data,error}=await app.db.from(table).select("*").order("created_at",{ascending:false}).limit(500);
  if(error)throw error;app.refs[table]=data||[];
 });
 await Promise.all(fetches);
}
function optionLabel(table,id,display){if(!id)return "—";const x=(app.refs[table]||[]).find(v=>v.id===id);if(!x)return "Registro vinculado";if(display==="code_name")return [x.code,x.name].filter(Boolean).join(" · ");return String(x[display]??x.name??x.code??x.description??"Registro");}
function fieldValue(key,value){
 if(value===null||value===undefined||value==="")return '<span class="muted">—</span>';
 const f=modules[app.page]?.fields?.find(x=>x.key===key);
 if(f?.type==="ref")return escapeHTML(optionLabel(f.table,value,f.display));
 if(f?.type==="boolean")return value?'<span class="tag">Sim</span>':'<span class="tag gray">Não</span>';
 if(f?.type==="date")return escapeHTML(dateBR(value));
 if(["cost","total_cost","estimated_cost"].includes(key))return escapeHTML(currency(value));
 if(["status","priority","condition"].includes(key)){const v=String(value),style=/imped|pendente|critica|indisponivel/.test(v)?"warn":/cancelada|inutilizavel/.test(v)?"red":"gray";return '<span class="tag '+style+'">'+escapeHTML(v.replaceAll("_"," "))+'</span>'}
 return '<span class="truncate" title="'+escapeHTML(value)+'">'+escapeHTML(value)+'</span>';
}
function filteredRows(){
 const text=app.search.toLocaleLowerCase("pt-BR");
 return app.rows.filter(row=>!text||Object.values(row).some(v=>String(v??"").toLocaleLowerCase("pt-BR").includes(text))||modules[app.page].fields.some(f=>f.type==="ref"&&optionLabel(f.table,row[f.key],f.display).toLocaleLowerCase("pt-BR").includes(text)));
}
function renderRows(){
 const table=el("table-body");if(!table)return;const m=modules[app.page],rows=filteredRows();
 if(!rows.length){table.innerHTML='<tr><td colspan="'+(m.columns.length+1)+'"><div class="empty-state"><div class="empty-symbol">◌</div><strong>'+ (app.search?"Nenhum resultado encontrado":"Nenhum registro cadastrado")+'</strong>'+(app.search?"Altere os termos da pesquisa.":"Use o botão Novo registro para começar.")+'</div></td></tr>';return;}
 table.innerHTML=rows.map(row=>'<tr>'+m.columns.map(key=>'<td>'+fieldValue(key,row[key])+'</td>').join("")+'<td>'+(privileged()?'<button class="table-action" data-edit="'+escapeHTML(row.id)+'">Editar</button>':'<span class="muted">Leitura</span>')+'</td></tr>').join("");
}
async function modulePage(key){
 app.page=key;app.search="";nav();header(key);const m=modules[key];
 el("main").innerHTML=title(key,m.description)+'<div class="loading-page"><div class="loader"></div><p>Consultando registros...</p></div>';
 try{
  await ensureRefs(key);
  const {data,error}=await app.db.from(m.table).select("*").order("created_at",{ascending:false}).limit(200);if(error)throw error;
  app.rows=data||[];
  const buttons=(privileged()?'<button class="btn btn-primary" data-action="create">+ Novo registro</button>':'')+'<button class="btn btn-ghost" data-action="export">Exportar CSV</button>';
  el("main").innerHTML=title(key,m.description,buttons)+
  '<section class="table-panel"><div class="table-head"><div><h2>Registros cadastrados</h2><span>'+app.rows.length+' registro(s) carregado(s)</span></div><div class="table-toolbar"><input class="searchbox" id="list-search" type="search" aria-label="Buscar registros" placeholder="Buscar nesta lista..." autocomplete="off"></div></div>'+
  '<div class="table-scroll"><table class="data-table"><thead><tr>'+m.columns.map(col=>'<th>'+escapeHTML(m.fields.find(f=>f.key===col)?.label||col)+'</th>').join("")+'<th>Ações</th></tr></thead><tbody id="table-body"></tbody></table></div><div class="filter-note">Exibição limitada aos 200 registros mais recentes. Os dados são consultados diretamente no Supabase. O CSV exporta somente os registros carregados.</div></section>';
  el("list-search").addEventListener("input",event=>{app.search=event.target.value;renderRows()});renderRows();
 }catch(e){el("main").innerHTML=title(key,m.description)+errorBanner(friendlyError(e))}
}
async function navigate(key){
 if(!app.role)return;
 const next=canView(key)?key:"inicio";app.page=next;app.refs={};app.rows=[];app.search="";location.hash=next;
 el("sidebar").classList.remove("open");
 if(next==="inicio")await dashboard();else await modulePage(next);
}
function fieldInput(f,row){
 const value=row?.[f.key]??f.default??"";
 const required=f.required?" required":"";
 const htmlId="fld-"+f.key;
 const attr=' id="'+htmlId+'" name="'+escapeHTML(f.key)+'"'+required;
 const label='<label for="'+htmlId+'">'+escapeHTML(f.label)+(f.required?' *':'')+'</label>';
 let inp="";
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
async function openForm(id=null){
 if(!privileged())return;
 const m=modules[app.page];if(!m?.table)return;try{await ensureRefs(app.page)}catch(e){notify(friendlyError(e),true);return;}
 const row=id?app.rows.find(x=>x.id===id):null;
 app.editing=row?.id??null;
 el("modal-title").textContent=(row?"Editar":"Novo registro · ")+m.title;
 el("modal-fields").innerHTML=m.fields.map(f=>fieldInput(f,row)).join("");
 el("modal-root").hidden=false;
 el("modal-fields").querySelector("input,select,textarea")?.focus();
}
function closeForm(){el("modal-root").hidden=true;app.editing=null}
async function saveRecord(e){
 e.preventDefault();if(app.busy)return;
 const m=modules[app.page],fd=new FormData(e.target),payload={};
 for(const f of m.fields){if(f.type==="boolean"){payload[f.key]=Boolean(e.target.elements[f.key].checked);continue;}
  let value=String(fd.get(f.key)??"").trim();if(f.required&&!value){notify("Preencha o campo: "+f.label,true);return;}
  if(value===""){payload[f.key]=null;continue;}
  payload[f.key]=f.type==="number"?Number(value):value;
  if(f.type==="number"&&!Number.isFinite(payload[f.key])){notify("Valor numérico inválido: "+f.label,true);return;}
 }
 if(["responsibility_terms","maintenance"].includes(app.page)){
  const a=Boolean(payload.vehicle_id),b=Boolean(payload.equipment_id);
  if(a===b){notify("Selecione somente um: veículo OU equipamento.",true);return;}
 }
 const btn=el("modal-submit");app.busy=true;btn.disabled=true;btn.textContent="Salvando...";
 try{
  const query=app.editing?app.db.from(m.table).update(payload).eq("id",app.editing):app.db.from(m.table).insert(payload);
  const {error}=await query.select("id").single();if(error)throw error;
  closeForm();notify("Registro salvo com sucesso.");app.refs={};await modulePage(app.page);
 }catch(e){notify(friendlyError(e),true)}finally{app.busy=false;btn.disabled=false;btn.textContent="Salvar registro";}
}
function exportCSV(){
 const m=modules[app.page];if(!m?.table)return;
 const cols=m.fields.map(f=>f.key);
 const protect=value=>{let str=String(value??"");if(/^[=+@-]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"'};
 const output=[m.fields.map(f=>protect(f.label)).join(";"),...filteredRows().map(r=>cols.map(k=>protect(r[k])).join(";"))].join("\r\n");
 const link=document.createElement("a"),url=URL.createObjectURL(new Blob(["\ufeff"+output],{type:"text/csv;charset=utf-8"}));link.href=url;link.download=m.table+"_"+new Date().toISOString().slice(0,10)+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener("click",async e=>{
 const navButton=e.target.closest("[data-nav]");if(navButton){await navigate(navButton.dataset.nav);return;}
 const edit=e.target.closest("[data-edit]");if(edit){await openForm(edit.dataset.edit);return;}
 const action=e.target.closest("[data-action]")?.dataset.action;
 if(action==="create")await openForm();
 if(action==="export")exportCSV();
 if(action==="logout")await logout();
});
el("menu-toggle").addEventListener("click",()=>el("sidebar").classList.toggle("open"));
el("logout").addEventListener("click",logout);
el("modal-close").addEventListener("click",closeForm);
el("modal-cancel").addEventListener("click",closeForm);
el("modal-root").addEventListener("click",event=>{if(event.target===el("modal-root"))closeForm()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!el("modal-root").hidden)closeForm()});
el("record-form").addEventListener("submit",saveRecord);
window.addEventListener("hashchange",()=>{if(app.role&&location.hash.replace("#","")!==app.page)navigate(location.hash.replace("#",""))});
async function init(){
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){setup();return;}
 try{app.db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
 await establishSession();
 app.db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){app.user=null;app.role=null;login();}});
 }catch(e){el("main").innerHTML=errorBanner("Erro ao iniciar o sistema: "+friendlyError(e))}
}
init();
