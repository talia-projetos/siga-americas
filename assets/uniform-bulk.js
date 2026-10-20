// SIGA Américas · conferência de tamanhos e entrega semestral de fardamentos em lote.
// Dados somente após autenticação; operações transacionais via RPC com validação RLS/perfil.
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const humanDate=value=>value?new Date(String(value).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const formMonth=v=>String(v||"").slice(0,7);
const sixMonths=start=>{const [y,m]=String(start).slice(0,7).split("-").map(Number);const d=new Date(Date.UTC(y,m-1+6,1));return d.toISOString().slice(0,10)};
const oneDay=date=>{const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)};
const number=n=>new Intl.NumberFormat("pt-BR").format(Number(n||0));
const validSize=value=>/^[\p{L}\p{N}./ +\-]{1,24}$/u.test(String(value||"").trim());
// Ajuste de barra registrado junto ao tamanho na base de setembro.
function pantsInfo(value){
 const raw=String(value||"").trim();
 const match=raw.match(/^(.*?)\s*\+\s*(\d+)\s*cm\s*barra\s*$/i);
 return match?{size:match[1].trim(),note:"Calça: +"+match[2]+" cm na barra",suffix:" + "+match[2]+" CM BARRA"}:{size:raw,note:"",suffix:""};
}
const opt=(value,label,active)=>'<option value="'+safe(value)+'"'+(String(value)===String(active)?' selected':'')+'>'+safe(label)+'</option>';
const kitItems=[["Camisas UV manga longa",4],["Camisa polo",1],["Calças táticas",4]];
export async function mountUniformManager(root,db,{notify,onSingle}={}){
 const state={
  employees:[],teams:[],batches:[],recipients:[],deliveries:[],
  team:"all",search:"",selected:new Set(),sizes:new Map(),dirty:new Set(),
  cycle:formMonth(dateLocal()),day:dateLocal(),receipt:"",notes:"",
  tab:"prepare",historySearch:"",preview:false,busy:false,requestToken:null
 };
 const table=(name,cols,limit=1200)=>{
  const query=db.from(name).select(cols);
  return query.limit(limit).then(({data,error})=>{if(error)throw error;return data||[]});
 };
 function allFiltered(){
  const q=state.search.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  return state.employees.filter(e=>(state.team==="all"||e.team_id===state.team)&&
    (!q||String(e.name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(q)));
 }
 function alreadyReceived(id){
  const start=state.cycle+"-01",end=sixMonths(start);
  return state.recipients.some(r=>r.employee_id===id&&
    r.cycle_start<end&&start<sixMonths(r.cycle_start)) ||
    state.deliveries.some(r=>r.employee_id===id&&["camisa_uv","camisa_polo","calca_tatica"].includes(r.item_type)&&
      r.delivered_on>=start&&r.delivered_on<end);
 }
 function eligibleVisible(){return allFiltered().filter(e=>!alreadyReceived(e.id));}
 function itemSizes(e){return state.sizes.get(e.id)||{shirt_size:e.shirt_size||"",pants_size:e.pants_size||"",shoe_size:e.shoe_size||"",jacket_size:e.jacket_size||""}}
 function complete(e){const sizes=itemSizes(e);return validSize(sizes.shirt_size)&&validSize(sizes.pants_size)}
 function prepared(){return state.employees.filter(e=>state.selected.has(e.id))}
 function chosenReady(){return prepared().filter(e=>!alreadyReceived(e.id)&&complete(e))}
 function readiness(){const all=prepared();return {all,ready:chosenReady(),incomplete:all.filter(e=>!complete(e)),blocked:all.filter(e=>alreadyReceived(e.id))}}
 function textStats(){
  const picked=prepared().length,ready=chosenReady().length;
  const checked=state.employees.filter(complete).length;
  const delivered=state.employees.filter(e=>alreadyReceived(e.id)).length;
  return '<div class="catalog-stats uniform-stats">'+[
    ["Colaboradores ativos",number(state.employees.length),"Base de pessoal"],
    ["Tamanhos informados",number(checked),"Camisa e calça conferidas"],
    ["Selecionados",number(picked),"Para esta entrega"],
    ["Kits no ciclo",number(delivered),"Já registrados no histórico"]
  ].map(([label,value,help])=>'<div class="catalog-stat"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong><small>'+safe(help)+'</small></div>').join("")+'</div>';
 }
 const names=()=>'<datalist id="uniform-shirt-sizes"><option value="PP"><option value="P"><option value="M"><option value="G"><option value="GG"><option value="XGG"><option value="EXG"></datalist>'+
 '<datalist id="uniform-pants-sizes">'+[34,36,38,40,42,44,46,48,50,52,54,56,58,60].map(i=>'<option value="'+i+'">').join("")+'</datalist>';
 function kitCard(){
  return '<section class="uniform-kit-card"><div class="uniform-kit-emblem" aria-hidden="true">9</div><div><span class="eyebrow">KIT SEMESTRAL · PADRÃO CONTRATUAL</span><h2>9 peças por colaborador</h2><div class="uniform-kit-items">'+kitItems.map(([name,qty])=>'<span><strong>'+qty+'×</strong> '+safe(name)+'</span>').join("")+'</div><p>O tamanho das camisas é reutilizado para UV e polo; a calça utiliza o tamanho próprio do colaborador.</p></div></section>';
 }
 function teamOptions(){
  return '<option value="all">Todas as equipes</option>'+state.teams.map(t=>opt(t.id,(t.code?t.code+" · ":"")+t.name,state.team)).join("");
 }
 function controls(){
  const picked=prepared().length,ready=chosenReady().length;
  const counter=ready?ready*9:0;
  return '<section class="uniform-controls panel"><div class="uniform-section-head"><div><span class="eyebrow">SELEÇÃO DE COLABORADORES</span><h2>Prepare a distribuição</h2><p>Filtre a equipe e selecione quem recebeu o kit completo.</p></div><span class="uniform-selection-count">'+number(picked)+' selecionado(s)</span></div>'+
  '<div class="uniform-filter-grid"><label>Equipe<select id="uniform-team">'+teamOptions()+'</select></label>'+
  '<label>Buscar colaborador<input type="search" id="uniform-search" placeholder="Digite um nome…" value="'+safe(state.search)+'"></label>'+
  '<button type="button" class="btn btn-secondary" data-uniform-action="select-visible">Selecionar elegíveis</button>'+
  '<button type="button" class="btn btn-ghost" data-uniform-action="clear-selection">Limpar seleção</button></div>'+
  '<div class="uniform-selection-summary"><span><strong>'+number(picked)+'</strong> pessoas selecionadas</span><span><strong>'+number(counter)+'</strong> peças para a entrega</span>'+
  '<button type="button" class="btn btn-secondary" data-uniform-action="save-sizes" '+(state.dirty.size?'':'disabled')+'>Salvar tamanhos'+(state.dirty.size?' ('+state.dirty.size+')':'')+'</button></div></section>';
 }
 function roster(){
  const people=allFiltered();
  const next=state.cycle+"-01";
  let rows=people.map(e=>{
   const sizes=itemSizes(e),already=alreadyReceived(e.id),isSelected=state.selected.has(e.id);
   const team=state.teams.find(t=>t.id===e.team_id);
   const label=already?'<span class="uniform-tag completed">Kit já registrado</span>':complete(e)?'<span class="uniform-tag complete">Pronto</span>':'<span class="uniform-tag pending">Conferir tamanhos</span>';
   return '<tr data-uniform-worker="'+safe(e.id)+'">'+
    '<td><label class="uniform-person-checkbox"><input type="checkbox" data-uniform-select="'+safe(e.id)+'" '+(isSelected?'checked ':'')+(already?'disabled ':'')+' aria-label="Selecionar '+safe(e.name)+'"><span class="uniform-person-name">'+safe(e.name)+'</span></label><small class="uniform-person-team">'+safe(team?team.code+" · "+team.name:"Equipe não informada")+'</small></td>'+
    '<td><input type="text" class="uniform-size" data-uniform-shirt="'+safe(e.id)+'" list="uniform-shirt-sizes" maxlength="12" placeholder="PP, P, M, G…" value="'+safe(sizes.shirt_size)+'" aria-label="Tamanho de camisa de '+safe(e.name)+'"></td>'+
    '<td><input type="text" class="uniform-size" data-uniform-pants="'+safe(e.id)+'" list="uniform-pants-sizes" maxlength="24" placeholder="Ex.: 42" value="'+safe(pantsInfo(sizes.pants_size).size)+'" aria-label="Tamanho de calça de '+safe(e.name)+'"></td>'+
    '<td><input type="text" class="uniform-size" data-uniform-shoe="'+safe(e.id)+'" maxlength="12" placeholder="Ex.: 40" value="'+safe(sizes.shoe_size)+'" aria-label="Número de botina de '+safe(e.name)+'"></td>'+
    '<td><input type="text" class="uniform-size" data-uniform-jacket="'+safe(e.id)+'" maxlength="12" placeholder="Ex.: G" value="'+safe(sizes.jacket_size)+'" aria-label="Tamanho de jaqueta de '+safe(e.name)+'"></td>'+
    '<td><span class="uniform-observation">'+safe(pantsInfo(sizes.pants_size).note||"—")+'</span></td>'+
    '<td>'+label+'</td></tr>';
  }).join("");
  return '<section class="table-panel uniform-roster"><div class="table-head"><div><h2>Tamanhos por colaborador</h2><span>'+number(people.length)+' exibido(s) · Camisa, calça, botina e jaqueta editáveis nesta tabela. Salvar tamanhos não registra entrega.</span></div></div>'+
  '<div class="table-scroll"><table class="data-table"><thead><tr><th>Colaborador</th><th>Camisa</th><th>Calça</th><th>Botina</th><th>Jaqueta</th><th>Observação</th><th>Situação no ciclo</th></tr></thead><tbody>'+
   (rows||'<tr><td colspan="7" class="uniform-empty">Nenhum colaborador encontrado.</td></tr>')+'</tbody></table></div></section>';
 }
 function distribution(){
  const {all,ready,incomplete,blocked}=readiness();
  const start=state.cycle+"-01";
  return '<section class="uniform-distribution panel"><div class="uniform-section-head"><div><span class="eyebrow">CONFIRMAÇÃO DE ENTREGA</span><h2>Registrar kits realmente entregues</h2><p>Um lançamento coletivo gera três itens por pessoa no histórico individual.</p></div></div>'+
   '<div class="uniform-delivery-form">'+
    '<label>Início do ciclo semestral<input id="uniform-cycle" type="month" value="'+safe(state.cycle)+'" required></label>'+
    '<label>Data em que a entrega ocorreu<input id="uniform-date" type="date" max="'+dateLocal()+'" value="'+safe(state.day)+'" required></label>'+
    '<label>Comprovante / recibo (referência)<input id="uniform-receipt" maxlength="240" value="'+safe(state.receipt)+'" placeholder="Nº termo ou arquivo, se houver"></label>'+
    '<label class="uniform-notes">Observações (opcional)<input id="uniform-notes" maxlength="1500" value="'+safe(state.notes)+'" placeholder="Informações sobre a distribuição"></label>'+
   '</div>'+
   '<p class="uniform-cycle-note">Período de referência: <strong>'+humanDate(start)+' a '+humanDate(oneDay(sixMonths(start)))+'</strong>. Entregas em ciclos anteriores permanecem no histórico.</p>'+
   (blocked.length?'<div class="notice warning">'+blocked.length+' colaborador(es) já possui(em) entrega neste ciclo. Retire-os da seleção.</div>':'')+
   (incomplete.length?'<div class="notice warning">'+incomplete.length+' selecionado(s) estão sem tamanho completo. Informe camisa e calça antes de registrar o kit.</div>':'')+
   '<div class="uniform-distribution-actions"><span>'+number(ready.length)+' kits aptos · <strong>'+number(ready.length*9)+' peças</strong></span>'+
   '<button type="button" class="btn btn-primary" data-uniform-action="review" '+(!all.length||incomplete.length||blocked.length||state.busy?'disabled':'')+'>Revisar entrega →</button></div>'+
  '</section>';
 }
 function history(){
  const batchList=[...state.batches].sort((a,b)=>String(b.delivered_on).localeCompare(String(a.delivered_on)));
  const rows=batchList.map(b=>{
   const count=state.recipients.filter(r=>r.batch_id===b.id).length;
   return '<tr><td>'+humanDate(b.delivered_on)+'</td><td>'+humanDate(b.cycle_start)+' a '+humanDate(oneDay(sixMonths(b.cycle_start)))+'</td><td>'+number(count)+'</td><td>'+number(count*9)+'</td><td>'+safe(b.receipt_ref||"—")+'</td></tr>';
  }).join("");
  const search=state.historySearch.toLocaleLowerCase("pt-BR");
  const workerName=id=>state.employees.find(e=>e.id===id)?.name||"Colaborador não localizado";
  const entries=[...state.deliveries].sort((a,b)=>String(b.delivered_on).localeCompare(String(a.delivered_on)));
  const filtered=entries.filter(d=>!search||workerName(d.employee_id).toLocaleLowerCase("pt-BR").includes(search));
  const pieceName={camisa_uv:"Camisa UV",camisa_polo:"Camisa polo",calca_tatica:"Calça tática",outro:"Outro"};
  const detailRows=filtered.slice(0,100).map(d=>
   '<tr><td>'+safe(workerName(d.employee_id))+'</td><td>'+safe(pieceName[d.item_type]||d.item_type)+'</td><td>'+safe(d.size||"—")+'</td><td>'+number(d.quantity)+'</td><td>'+humanDate(d.delivered_on)+'</td><td><span class="uniform-tag '+(d.batch_id?"complete":"pending")+'">'+(d.batch_id?"Kit":"Avulsa")+'</span></td></tr>'
  ).join("");
  return '<section class="uniform-history"><div class="uniform-section-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Distribuições registradas</h2><p>Confira cada lote e todas as peças associadas a cada colaborador.</p></div>'+
   '<button type="button" class="btn btn-ghost" data-uniform-action="single">Entrega complementar</button></div>'+
   '<div class="catalog-stats uniform-history-stats">'+[
     ["Lotes",batchList.length,"Entregas coletivas"],
     ["Colaboradores em lotes",state.recipients.length,"Participações registradas"],
     ["Peças entregues",entries.reduce((sum,x)=>sum+Number(x.quantity||0),0),"Kits e entregas avulsas"]
   ].map(([name,value,help])=>'<div class="catalog-stat"><span>'+safe(name)+'</span><strong>'+number(value)+'</strong><small>'+safe(help)+'</small></div>').join("")+'</div>'+
   '<div class="table-panel"><div class="table-head"><h2>Entregas coletivas</h2></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Ciclo</th><th>Colaboradores</th><th>Peças</th><th>Comprovante</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="5" class="uniform-empty">Nenhum lote registrado até agora.</td></tr>')+'</tbody></table></div></div>'+
   '<div class="table-panel uniform-history-details"><div class="table-head"><div><h2>Histórico por colaborador</h2><span>'+number(filtered.length)+' lançamento(s)'+(filtered.length>100?" · primeiros 100 exibidos":"")+'</span></div>'+
   '<div class="table-toolbar"><input id="uniform-history-search" class="searchbox" type="search" placeholder="Buscar colaborador…" value="'+safe(state.historySearch)+'">'+
   '<button type="button" class="btn btn-ghost" data-uniform-action="export-history">Baixar CSV</button></div></div>'+
   '<div class="table-scroll"><table class="data-table"><thead><tr><th>Colaborador</th><th>Peça</th><th>Tamanho</th><th>Quantidade</th><th>Entrega</th><th>Tipo</th></tr></thead><tbody>'+
   (detailRows||'<tr><td colspan="6" class="uniform-empty">Nenhuma entrega localizada.</td></tr>')+'</tbody></table></div></div>'+
   '<p class="uniform-history-help">O histórico mostra entregas confirmadas. Quantidades e tamanhos devem corresponder ao recibo ou à conferência física.</p></section>';
 }
 function downloadHistory(){
  const workerName=id=>state.employees.find(e=>e.id===id)?.name||"Colaborador não localizado";
  const headers=["Colaborador","Peça","Tamanho","Quantidade","Data da entrega","Modalidade"];
  const names={camisa_uv:"Camisa UV",camisa_polo:"Camisa polo",calca_tatica:"Calça tática",outro:"Outro"};
  const rows=state.deliveries.map(d=>[workerName(d.employee_id),names[d.item_type]||d.item_type,d.size||"",d.quantity,d.delivered_on,d.batch_id?"Kit":"Avulsa"]);
  const clean=v=>{
   let x=String(v??"");if(/^[=+@-]/.test(x.trim()))x="'"+x;
   return '"'+x.replaceAll('"','""')+'"';
  };
  const csv="\uFEFF"+[headers,...rows].map(c=>c.map(clean).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download="SIGA_fardamentos_historico.csv";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 function preview(){
  const workers=prepared(),day=state.day;
  const display=workers.slice(0,6).map(e=>'<span>'+safe(e.name)+'</span>').join("");
  return '<div class="uniform-confirm-backdrop" role="presentation"><section class="uniform-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="uniform-confirm-title">'+
   '<span class="eyebrow">CONFERÊNCIA FINAL</span><h2 id="uniform-confirm-title">Confirmar entrega coletiva?</h2>'+
   '<p>Confirme somente se todos os kits abaixo foram efetivamente entregues aos colaboradores.</p>'+
   '<div class="uniform-confirm-stat"><strong>'+number(workers.length)+'</strong><span>colaboradores</span><strong>'+number(workers.length*9)+'</strong><span>peças</span></div>'+
   '<p class="uniform-confirm-details"><strong>Data:</strong> '+humanDate(day)+' · <strong>Ciclo:</strong> '+humanDate(state.cycle+"-01")+' a '+humanDate(oneDay(sixMonths(state.cycle+"-01")))+'</p>'+
   '<div class="uniform-confirm-people">'+display+(workers.length>6?'<small>e outros '+(workers.length-6)+' colaboradores</small>':'')+'</div>'+
   (state.receipt?'<p class="uniform-confirm-details"><strong>Comprovante:</strong> '+safe(state.receipt)+'</p>':'<p class="uniform-proof-warning">Nenhuma referência de comprovante foi informada.</p>')+
   '<label class="uniform-confirm-check"><input type="checkbox" id="uniform-physical-confirm"><span>Confirmo que a entrega física destes kits já foi realizada.</span></label>'+
   '<div class="uniform-confirm-actions"><button type="button" class="btn btn-ghost" data-uniform-action="cancel-preview">Revisar dados</button>'+
   '<button type="button" class="btn btn-primary" data-uniform-action="submit" '+(state.busy?'disabled':'')+'>Confirmar '+number(workers.length)+' kits</button></div>'+
   '</section></div>';
 }
 function draw(){
  root.innerHTML='<div class="uniform-manager">'+
   '<div class="uniform-intro"><div><span class="eyebrow">PESSOAS E SEGURANÇA · DISTRIBUIÇÃO</span><h2>Entregas simples, histórico completo</h2><p>Selecione uma equipe, confira os tamanhos e registre os kits sem repetir o mesmo formulário para cada peça.</p></div>'+
   '<button type="button" class="btn btn-ghost" data-uniform-action="single">Entrega avulsa</button></div>'+
   kitCard()+
   '<div class="uniform-tabs"><button type="button" data-uniform-tab="prepare" class="'+(state.tab==="prepare"?"active":"")+'">Preparar entrega</button>'+
   '<button type="button" data-uniform-tab="history" class="'+(state.tab==="history"?"active":"")+'">Histórico de entregas</button></div>'+
   (state.tab==="prepare"?textStats()+controls()+names()+roster()+distribution():history())+
   (state.preview?preview():'')+'</div>';
 }
 function collectFields(){
  const x=root.querySelector("#uniform-cycle"),day=root.querySelector("#uniform-date");
  if(x)state.cycle=x.value;
  if(day)state.day=day.value;
  if(root.querySelector("#uniform-receipt"))state.receipt=root.querySelector("#uniform-receipt").value.trim();
  if(root.querySelector("#uniform-notes"))state.notes=root.querySelector("#uniform-notes").value.trim();
 }
 async function refresh(){
  const [employees,teams,batches,recipients,deliveries]=await Promise.all([
   table("employees","id,name,team_id,shirt_size,pants_size,shoe_size,jacket_size,active",600),
   table("teams","id,code,name,active",60),
   table("uniform_delivery_batches","id,request_token,cycle_start,delivered_on,receipt_ref,notes,created_at",700),
   table("uniform_delivery_batch_recipients","id,batch_id,employee_id,cycle_start",1800),
   table("uniform_deliveries","id,employee_id,item_type,size,quantity,delivered_on,batch_id",1800)
  ]);
  state.employees=employees.filter(e=>e.active!==false).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  state.teams=teams.filter(t=>t.active!==false).sort((a,b)=>String(a.code).localeCompare(String(b.code),"pt-BR"));
  state.batches=batches;state.recipients=recipients;state.deliveries=deliveries;
  for(const employee of state.employees){if(!state.dirty.has(employee.id))state.sizes.set(employee.id,{shirt_size:employee.shirt_size||"",pants_size:employee.pants_size||"",shoe_size:employee.shoe_size||"",jacket_size:employee.jacket_size||""})}
  for(const id of [...state.selected])if(!state.employees.some(e=>e.id===id))state.selected.delete(id);
  draw();
 }
 function validateCycle(){
  if(!/^\d{4}-\d{2}$/.test(state.cycle)||!/^\d{4}-\d{2}-\d{2}$/.test(state.day))return "Informe o início do semestre e a data da entrega.";
  const start=state.cycle+"-01",end=sixMonths(start);
  if(state.day<start||state.day>=end||state.day>dateLocal())return "A entrega deve ter ocorrido dentro do semestre selecionado e não pode ter data futura.";
  return "";
 }
 async function saveSizes(){
  const changed=state.employees.filter(e=>state.dirty.has(e.id));
  if(!changed.length)return notify("Nenhuma alteração de tamanho a salvar.");
  const incomplete=changed.filter(e=>!complete(e));
  if(incomplete.length)return notify("Preencha ambos os tamanhos das "+incomplete.length+" pessoas alteradas antes de salvar.",true);
  state.busy=true;
  try{
   const workers=changed.map(e=>({employee_id:e.id,shirt_size:itemSizes(e).shirt_size.trim().toUpperCase(),pants_size:itemSizes(e).pants_size.trim().toUpperCase()}));
   const {data,error}=await db.rpc("save_uniform_sizes",{p_workers:workers});
   if(error)throw error;
   for(const e of changed){
    const size=itemSizes(e);
    const result=await db.from("employees").update({shoe_size:size.shoe_size||null,jacket_size:size.jacket_size||null}).eq("id",e.id);
    if(result.error)throw result.error;
   }
   changed.forEach(e=>state.dirty.delete(e.id));
   notify("Tamanhos de "+number(data??changed.length)+" colaborador(es) atualizados. Nenhuma entrega foi registrada.");
   await refresh();
  }catch(err){notify(err.message||"Não foi possível salvar os tamanhos.",true)}
  finally{state.busy=false;}
 }
 async function submit(){
  if(state.busy)return;
  if(!root.querySelector("#uniform-physical-confirm")?.checked)return notify("Confirme que os kits já foram entregues fisicamente.",true);
  const valid=validateCycle();if(valid)return notify(valid,true);
  const {all,ready,incomplete,blocked}=readiness();
  if(!all.length||incomplete.length||blocked.length||ready.length!==all.length)return notify("Confira a seleção, as entregas anteriores e todos os tamanhos.",true);
  state.busy=true;draw();
  try{
   if(!state.requestToken)state.requestToken=crypto.randomUUID();
   const args={
    p_request_token:state.requestToken,
    p_cycle_start:state.cycle+"-01",
    p_delivered_on:state.day,
    p_receipt_ref:state.receipt||null,
    p_notes:state.notes||null,
    p_workers:ready.map(e=>({employee_id:e.id,shirt_size:itemSizes(e).shirt_size.trim().toUpperCase(),pants_size:itemSizes(e).pants_size.trim().toUpperCase()}))
   };
   const {data,error}=await db.rpc("create_uniform_bulk_delivery",args);
   if(error)throw error;
   const res=Array.isArray(data)?data[0]:data;
   const howMany=Number(res?.recipient_count??all.length);
   state.preview=false;state.selected.clear();state.dirty.clear();state.requestToken=null;state.tab="history";
   notify("Entrega registrada: "+howMany+" kits e "+number(howMany*9)+" peças vinculadas aos colaboradores.");
   await refresh();
  }catch(err){notify(err.message||"A entrega não pôde ser registrada. Nenhum lote foi confirmado.",true)}
  finally{state.busy=false;}
 }
 function updateSize(id,kind,value){
  const old=state.sizes.get(id)||{shirt_size:"",pants_size:"",shoe_size:"",jacket_size:""};
  state.sizes.set(id,{...old,[kind]:value.trim().toUpperCase()+(kind==="pants_size"?pantsInfo(old.pants_size).suffix:"")});
  state.dirty.add(id);state.preview=false;
 }
 root.addEventListener("input",event=>{
  const target=event.target;
  if(target.matches("[data-uniform-shirt]")){updateSize(target.dataset.uniformShirt,"shirt_size",target.value);return}
  if(target.matches("[data-uniform-pants]")){updateSize(target.dataset.uniformPants,"pants_size",target.value);return}
  if(target.matches("[data-uniform-shoe]")){updateSize(target.dataset.uniformShoe,"shoe_size",target.value);return}
  if(target.matches("[data-uniform-jacket]")){updateSize(target.dataset.uniformJacket,"jacket_size",target.value);return}
  if(target.id==="uniform-search"){
   const caret=target.selectionStart;
   state.search=target.value;
   draw();
   const input=root.querySelector("#uniform-search");
   input?.focus();
   if(input&&caret!==null)input.setSelectionRange(caret,caret);
   return;
  }
  if(target.id==="uniform-history-search"){
   const pos=target.selectionStart;state.historySearch=target.value;draw();
   const field=root.querySelector("#uniform-history-search");
   field?.focus();if(field&&pos!==null)field.setSelectionRange(pos,pos);
   return;
  }
  if(target.id==="uniform-receipt")state.receipt=target.value;
  if(target.id==="uniform-notes")state.notes=target.value;
 });
 root.addEventListener("change",event=>{
  const t=event.target;
  if(t.matches("[data-uniform-select]")){
   if(t.checked)state.selected.add(t.dataset.uniformSelect);else state.selected.delete(t.dataset.uniformSelect);
   state.preview=false;state.requestToken=null;draw();return;
  }
  if(t.matches("[data-uniform-shirt],[data-uniform-pants],[data-uniform-shoe],[data-uniform-jacket]")){draw();return}
  if(t.id==="uniform-team"){state.team=t.value;state.preview=false;draw();return}
  if(t.id==="uniform-cycle"){state.cycle=t.value;state.selected.clear();state.preview=false;state.requestToken=null;draw();return}
  if(t.id==="uniform-date"){state.day=t.value;return}
 });
 root.addEventListener("keydown",event=>{
  if(event.key==="Enter"&&event.target.id==="uniform-search")event.preventDefault();
 });
 root.addEventListener("click",async event=>{
  const tab=event.target.closest("[data-uniform-tab]");
  if(tab){collectFields();state.tab=tab.dataset.uniformTab;state.preview=false;draw();return}
  const button=event.target.closest("[data-uniform-action]");
  if(!button||state.busy)return;
  const action=button.dataset.uniformAction;
  if(action==="single"){onSingle?.();return}
  if(action==="export-history"){downloadHistory();return}
  if(action==="select-visible"){
   const eligible=eligibleVisible();
   if(!eligible.length)return notify("Não há colaboradores elegíveis neste filtro.",true);
   eligible.forEach(e=>state.selected.add(e.id));state.preview=false;state.requestToken=null;draw();return;
  }
  if(action==="clear-selection"){state.selected.clear();state.preview=false;state.requestToken=null;draw();return}
  if(action==="save-sizes"){await saveSizes();return}
  if(action==="review"){
   collectFields();
   const problem=validateCycle();if(problem)return notify(problem,true);
   const {all,incomplete,blocked}=readiness();
   if(!all.length)return notify("Selecione ao menos um colaborador.",true);
   if(incomplete.length)return notify("Confira os tamanhos de "+incomplete.length+" colaborador(es).",true);
   if(blocked.length)return notify("Retire "+blocked.length+" colaborador(es) com entrega registrada.",true);
   state.preview=true;state.requestToken=crypto.randomUUID();draw();return;
  }
  if(action==="cancel-preview"){state.preview=false;state.requestToken=null;draw();return}
  if(action==="submit"){await submit();return}
 });
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Preparando conferência de fardamentos…</p></div>';
 try{await refresh()}catch(err){root.innerHTML='<div class="notice danger">Não foi possível carregar os registros de fardamento: '+safe(err.message)+'</div>'}
}
