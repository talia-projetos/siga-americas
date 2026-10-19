// SIGA Américas · Fardamentos em lote.
// Interface de conferência; tamanhos e entregas são ações distintas.
// RPC transacional no Supabase bloqueia duplicações e exige perfil de gestão.
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=date=>date?new Date(String(date).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const isoToday=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const addMonths=(iso,n)=>{
 const [year,month]=iso.split("-").map(Number);
 const d=new Date(Date.UTC(year,month-1+n,1,12));
 return d.toISOString().slice(0,10);
};
const inCycle=(date,start)=>date>=start&&date<addMonths(start,6);
const overlappingCycle=(start,other)=>start<addMonths(other,6)&&other<addMonths(start,6);
const choices=(rows,selected)=>rows.map(row=>'<option value="'+esc(row.id)+'"'+(row.id===selected?" selected":"")+'>'+esc([row.code,row.name].filter(Boolean).join(" · "))+'</option>').join("");
const monthOptions=()=>{
 const today=isoToday(),y=Number(today.slice(0,4)),m=Number(today.slice(5,7)),opts=[];
 for(let i=0;i<24;i++){
  const d=new Date(Date.UTC(y,m-1-i,1,12));
  const v=d.toISOString().slice(0,7);
  opts.push('<option value="'+v+'">'+esc(new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(d))+'</option>');
 }
 return opts.join("");
};
const maybeErr=r=>{if(r?.error)throw r.error;return r?.data||[]};
export async function openUniformBatch({db,notify,afterSave}){
 if(document.querySelector("#uniform-batch-overlay"))return;
 const originalFocus=document.activeElement;
 const overlay=document.createElement("div");
 overlay.id="uniform-batch-overlay";
 overlay.className="uniform-batch-overlay";
 overlay.innerHTML='<div class="uniform-batch-dialog" role="dialog" aria-modal="true" aria-labelledby="uniform-batch-title"><div class="uniform-batch-header"><div><span class="eyebrow">PESSOAS E SEGURANÇA · FARDAMENTOS</span><h2 id="uniform-batch-title">Conferência em lote</h2><p>Selecione a equipe, confira os tamanhos e registre os kits entregues de uma só vez.</p></div><button type="button" class="icon-btn" data-uniform-close aria-label="Fechar">✕</button></div><div class="uniform-batch-content" id="uniform-batch-content"><div class="loading-page"><div class="loader"></div><p>Preparando colaboradores...</p></div></div></div>';
 document.body.appendChild(overlay);
 document.body.classList.add("uniform-dialog-open");
 let disposed=false,busy=false,rows=[],teams=[],staff=new Map(),team="all",query="",cycle=isoToday().slice(0,7),day=isoToday(),receipt="",notes="",confirmed=false,history=[],deliveryHistory=[],historyLoading=false,requestToken=crypto.randomUUID();
 const get=selector=>overlay.querySelector(selector);
 function close(){
  if(busy||disposed)return;
  disposed=true;overlay.remove();document.body.classList.remove("uniform-dialog-open");
  document.removeEventListener("keydown",escKey);
  originalFocus?.focus?.();
 }
 const escKey=e=>{if(e.key==="Escape"){e.preventDefault();close()}};
 document.addEventListener("keydown",escKey);
 overlay.addEventListener("click",event=>{
  if(event.target===overlay||event.target.closest("[data-uniform-close]"))close();
 });
 try{
  const [staffRows,teamRows]=await Promise.all([
   db.from("employees").select("id,name,team_id,shirt_size,pants_size,active").order("name").limit(300),
   db.from("teams").select("id,code,name,active").order("code").limit(30)
  ]);
  rows=maybeErr(staffRows).filter(x=>x.active!==false);
  teams=maybeErr(teamRows).filter(x=>x.active!==false);
  if(disposed)return;
  rows.forEach(r=>staff.set(r.id,{selected:false,shirt:r.shirt_size||"",pants:r.pants_size||""}));
  if(!rows.length){get("#uniform-batch-content").innerHTML='<div class="empty-state">Ainda não há colaboradores ativos para selecionar.</div>';return}
  await loadHistory();
  draw();
 }catch(error){
  if(disposed)return;
  get("#uniform-batch-content").innerHTML='<div class="notice danger">Não foi possível preparar a conferência: '+esc(error.message)+'</div>';
 }
 function visible(){return rows.filter(r=>(team==="all"||r.team_id===team)&&(!query||r.name.toLocaleLowerCase("pt-BR").includes(query)))}
 function selectedRows(){return rows.filter(r=>staff.get(r.id)?.selected)}
 function duplicate(r){
  const c=cycle+"-01";
  return history.some(x=>x.employee_id===r.id&&overlappingCycle(c,x.cycle_start))
   ||deliveryHistory.some(x=>x.employee_id===r.id&&inCycle(x.delivered_on,c)&&["camisa_uv","camisa_polo","calca_tatica"].includes(x.item_type));
 }
 function metrics(){
  const all=selectedRows(),duplicateRows=all.filter(duplicate);
  const missing=all.filter(r=>{
    const f=staff.get(r.id);return !f.shirt.trim()||!f.pants.trim();
  });
  return {all,duplicateRows,missing,ready:all.length>0&&!duplicateRows.length&&!missing.length&&!historyLoading};
 }
 function hint(){
  const {all,missing,duplicateRows,ready}=metrics();
  const warn=duplicateRows.length
   ?'Há '+duplicateRows.length+' colaborador(es) com registro anterior no período. Retire-os da seleção.'
   :missing.length
    ?'Informe os tamanhos de camisa e calça de '+missing.length+' colaborador(es).'
    :!all.length?'Selecione os colaboradores que receberam o kit.'
    :'Dados prontos. Confira a data e confirme que a entrega ocorreu.';
  return {warn,ready,all};
 }
 function draw(){
  if(disposed)return;
  const visibleRows=visible(),stats=hint();
  const allVisible=visibleRows.length>0&&visibleRows.every(r=>staff.get(r.id).selected);
  const content=get("#uniform-batch-content");
  content.innerHTML=
   '<div class="uniform-intro"><div class="uniform-kit-label"><span>Composição prevista por trabalhador</span><div class="uniform-kit-chips"><strong>4</strong> camisas UV <span>+</span> <strong>1</strong> polo <span>+</span> <strong>4</strong> calças táticas <span>=</span> <strong>9 peças</strong></div></div><p>Essa é a referência contratual, não uma entrega presumida. O sistema só registra peças após sua confirmação.</p></div>'+
   '<div class="uniform-batch-controls">'+
     '<label><span>Equipe</span><select id="uniform-team"><option value="all">Todas as equipes</option>'+choices(teams,team)+'</select></label>'+
     '<label><span>Ciclo de fornecimento</span><select id="uniform-cycle">'+monthOptions()+'</select></label>'+
     '<label><span>Data da entrega efetiva</span><input id="uniform-date" type="date" value="'+esc(day)+'" max="'+isoToday()+'"></label>'+
   '</div>'+
   '<div class="uniform-batch-toolbar"><label class="uniform-search"><span class="sr-only">Pesquisar colaboradores</span><input type="search" id="uniform-search" placeholder="Buscar colaborador..." value="'+esc(query)+'"></label><label class="uniform-check-all"><input type="checkbox" id="uniform-select-all" '+(allVisible?"checked":"")+'><span>Selecionar exibidos</span></label><span class="uniform-staff-count">'+visibleRows.length+' colaborador(es) exibido(s)</span></div>'+
   '<div class="uniform-staff-scroll"><table class="uniform-staff-table"><thead><tr><th scope="col">Selecionar</th><th scope="col">Colaborador</th><th scope="col">Camisa</th><th scope="col">Calça</th><th scope="col">Situação</th></tr></thead><tbody>'+
   (visibleRows.length?visibleRows.map(r=>{
    const entry=staff.get(r.id),dup=duplicate(r);
    return '<tr data-uniform-person="'+esc(r.id)+'"><td><input type="checkbox" data-uniform-select aria-label="Selecionar '+esc(r.name)+'" '+(entry.selected?"checked":"")+(dup?" disabled":"")+'></td><td><strong>'+esc(r.name)+'</strong><small>'+esc(teams.find(t=>t.id===r.team_id)?.code||"Sem equipe")+'</small></td><td><label class="sr-only" for="uniform-shirt-'+esc(r.id)+'">Tamanho de camisa de '+esc(r.name)+'</label><input id="uniform-shirt-'+esc(r.id)+'" type="text" maxlength="12" data-uniform-shirt list="uniform-shirt-options" placeholder="Ex.: M" value="'+esc(entry.shirt)+'"></td><td><label class="sr-only" for="uniform-pants-'+esc(r.id)+'">Tamanho de calça de '+esc(r.name)+'</label><input id="uniform-pants-'+esc(r.id)+'" type="text" maxlength="12" data-uniform-pants list="uniform-pants-options" placeholder="Ex.: 42" value="'+esc(entry.pants)+'"></td><td><span class="uniform-staff-status '+(dup?"blocked":entry.shirt.trim()&&entry.pants.trim()?"ready":"missing")+'">'+(dup?"Já registrado":entry.shirt.trim()&&entry.pants.trim()?"Tamanhos OK":"Falta tamanho")+'</span></td></tr>';
   }).join(""):'<tr><td colspan="5"><p class="empty-state">Nenhum colaborador encontrado.</p></td></tr>')+
   '</tbody></table></div>'+
   '<datalist id="uniform-shirt-options">'+["PP","P","M","G","GG","XG","XXG","G1","G2","G3"].map(x=>'<option value="'+x+'"></option>').join("")+'</datalist>'+
   '<datalist id="uniform-pants-options">'+Array.from({length:16},(_,i)=>32+i*2).map(x=>'<option value="'+x+'"></option>').join("")+'</datalist>'+
   '<div class="uniform-size-tools"><div><strong>Preencher vários tamanhos de uma vez</strong><span>Aplica apenas aos colaboradores selecionados</span></div><input id="uniform-shared-shirt" list="uniform-shirt-options" maxlength="12" placeholder="Camisa"><input id="uniform-shared-pants" list="uniform-pants-options" maxlength="12" placeholder="Calça"><button type="button" class="btn btn-ghost" id="uniform-apply-sizes">Aplicar</button></div>'+
   '<div class="uniform-batch-extras"><label><span>Comprovante ou termo de entrega</span><input id="uniform-receipt" maxlength="240" value="'+esc(receipt)+'" placeholder="Número ou referência do termo (recomendado)"></label><label><span>Observações opcionais</span><input id="uniform-notes" maxlength="1500" value="'+esc(notes)+'" placeholder="Informação pertinente à entrega"></label></div>'+
   '<div class="uniform-confirm"><label><input id="uniform-confirm" type="checkbox" '+(confirmed?"checked":"")+'><span>Confirmo que os kits completos selecionados foram efetivamente entregues nesta data.</span></label></div>'+
   '<div class="uniform-batch-footer"><div class="uniform-batch-status"><strong id="uniform-batch-summary">'+stats.all.length+' colaboradores · '+stats.all.length*9+' peças</strong><span id="uniform-batch-hint">'+esc(stats.warn)+'</span></div><div class="uniform-batch-actions"><button type="button" class="btn btn-ghost" id="uniform-save-sizes">Salvar somente tamanhos</button><button type="button" class="btn btn-primary" id="uniform-submit">Registrar entregas em lote</button></div></div>';
  get("#uniform-cycle").value=cycle;
  connect();
  sync();
 }
 function sync(){
  if(disposed)return;
  const {ready,all}=hint();
  const {missing,duplicateRows}=metrics();
  const summary=get("#uniform-batch-summary"),note=get("#uniform-batch-hint");
  if(summary)summary.textContent=all.length+" colaboradores · "+all.length*9+" peças";
  if(note)note.textContent=hint().warn;
  const saveSizes=get("#uniform-save-sizes"),submit=get("#uniform-submit");
  const valid=all.length>0&&!missing.length&&!historyLoading;
  if(saveSizes)saveSizes.disabled=busy||!valid;
  if(submit)submit.disabled=busy||!ready||!confirmed||!day||day>isoToday()||!inCycle(day,cycle+"-01");
  get("#uniform-confirm").disabled=busy;
  for(const r of visible()){
   const tr=get('[data-uniform-person="'+r.id+'"]');
   if(!tr)continue;
   const status=tr.querySelector(".uniform-staff-status"),entry=staff.get(r.id);
   const dup=duplicate(r);
   status.textContent=dup?"Já registrado":entry.shirt.trim()&&entry.pants.trim()?"Tamanhos OK":"Falta tamanho";
   status.className="uniform-staff-status "+(dup?"blocked":entry.shirt.trim()&&entry.pants.trim()?"ready":"missing");
  }
 }
 function connect(){
  get("#uniform-team").addEventListener("change",e=>{team=e.target.value;draw()});
  get("#uniform-cycle").addEventListener("change",async e=>{
   cycle=e.target.value;confirmed=false;historyLoading=true;draw();
   await loadHistory();if(!disposed)draw();
  });
  get("#uniform-date").addEventListener("change",e=>{day=e.target.value;confirmed=false;get("#uniform-confirm").checked=false;sync()});
  get("#uniform-search").addEventListener("input",e=>{query=e.target.value.toLocaleLowerCase("pt-BR");draw();get("#uniform-search").focus()});
  get("#uniform-receipt").addEventListener("input",e=>receipt=e.target.value);
  get("#uniform-notes").addEventListener("input",e=>notes=e.target.value);
  get("#uniform-confirm").addEventListener("change",e=>{confirmed=e.target.checked;sync()});
  get("#uniform-select-all").addEventListener("change",e=>{
   for(const r of visible())if(!duplicate(r))staff.get(r.id).selected=e.target.checked;
   draw();
  });
  get(".uniform-staff-scroll").addEventListener("input",e=>{
   const tr=e.target.closest("[data-uniform-person]");if(!tr)return;
   const entry=staff.get(tr.dataset.uniformPerson);
   if(e.target.matches("[data-uniform-shirt]"))entry.shirt=e.target.value.toUpperCase();
   if(e.target.matches("[data-uniform-pants]"))entry.pants=e.target.value.toUpperCase();
   sync();
  });
  get(".uniform-staff-scroll").addEventListener("change",e=>{
   if(!e.target.matches("[data-uniform-select]"))return;
   const tr=e.target.closest("[data-uniform-person]");
   staff.get(tr.dataset.uniformPerson).selected=e.target.checked;
   sync();
  });
  get("#uniform-apply-sizes").addEventListener("click",()=>{
   const shirt=get("#uniform-shared-shirt").value.toUpperCase().trim();
   const pants=get("#uniform-shared-pants").value.toUpperCase().trim();
   if(!shirt&&!pants){notify("Informe pelo menos um tamanho para aplicar.",true);return}
   for(const r of selectedRows()){
    const entry=staff.get(r.id);
    if(shirt)entry.shirt=shirt;
    if(pants)entry.pants=pants;
   }
   draw();
   notify("Tamanhos aplicados aos colaboradores selecionados.");
  });
  get("#uniform-save-sizes").addEventListener("click",()=>save(false));
  get("#uniform-submit").addEventListener("click",()=>save(true));
 }
 async function loadHistory(){
  try{
   const beginning=cycle+"-01";
   const [batchRows,individualRows]=await Promise.all([
    db.from("uniform_delivery_batch_recipients").select("employee_id,cycle_start").limit(1000),
    db.from("uniform_deliveries").select("employee_id,item_type,delivered_on").gte("delivered_on",beginning).lt("delivered_on",addMonths(beginning,6)).limit(1200)
   ]);
   history=maybeErr(batchRows);
   deliveryHistory=maybeErr(individualRows);
  }catch(error){
   history=[];deliveryHistory=[];
   notify("Não foi possível carregar o histórico para pré-conferência. O banco ainda verificará duplicações ao salvar.",true);
  }finally{historyLoading=false}
 }
 async function save(delivery){
  if(busy)return;
  const {all,missing,duplicateRows}=metrics();
  if(!all.length||missing.length){notify("Selecione colaboradores e informe os dois tamanhos de cada um.",true);return}
  if(delivery&&(duplicateRows.length||!confirmed||!inCycle(day,cycle+"-01")||day>isoToday())){notify("Confira o período, os registros anteriores e a confirmação de entrega.",true);return}
  busy=true;sync();
  try{
   const recipients=all.map(r=>{
    const entry=staff.get(r.id);
    return {employee_id:r.id,shirt_size:entry.shirt.toUpperCase().trim(),pants_size:entry.pants.toUpperCase().trim()};
   });
   const {data,error}=delivery?await db.rpc("create_uniform_bulk_delivery",{
    p_request_token:requestToken,p_cycle_start:cycle+"-01",p_delivered_on:day,
    p_receipt_ref:receipt.trim()||null,p_notes:notes.trim()||null,p_workers:recipients
   }):await db.rpc("save_uniform_sizes",{p_workers:recipients});
   if(error)throw error;
   if(delivery){
    const info=Array.isArray(data)?data[0]:data;
    notify("Entrega registrada: "+(info?.recipient_count||all.length)+" colaboradores e "+(info?.piece_count||all.length*9)+" peças.");
    busy=false;close();
    await afterSave?.();
   }else{
    notify("Tamanhos atualizados para "+all.length+" colaborador(es). Nenhuma entrega foi registrada.");
    for(const row of all){const item=staff.get(row.id);const source=rows.find(x=>x.id===row.id);source.shirt_size=item.shirt;source.pants_size=item.pants}
   }
  }catch(error){
   notify("Não foi possível salvar: "+(error.message||String(error)),true);
  }finally{busy=false;if(!disposed)sync()}
 }
}
