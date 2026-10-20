// SIGA Américas · Central de documentos corporativos.
// Gera PDF, Word e lotes diretamente dos cadastros existentes.
// O log comprova emissão de arquivo, NUNCA impressão física ou assinatura.
import {buildOperationalDocument,generateWord,generatePDF,generateBatchWordZip,
 generateCompletePack,downloadDocument,safeFilename} from "./document-output.js?v=5";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=d=>d?new Date(String(d).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const labelKind=k=>k==="os"?"Ordem de serviço":"Termo de responsabilidade";
const idKey=(type,id)=>type+":"+id;
function lookup(data,table,id,fn){return (data[table]||[]).find(r=>r.id===id)?fn((data[table]||[]).find(r=>r.id===id)):"Não informado";}
export async function mountDocumentCenter(root,db,{notify=()=>{},onCreate=()=>{},onEdit=()=>{},canWrite=false}={}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Preparando os cadastros e modelos de impressão...</p></div>';
 const tables=["work_orders","responsibility_terms","employees","vehicles","equipment",
  "teams","operational_areas","activity_catalog","contract_items"];
 const results=await Promise.all(tables.map(async table=>{
  let query=db.from(table).select("*");
  if(table==="employees")query=query.eq("active",true);
  if(table==="contract_items")query=query.eq("source_type","precos");
  const response=await query.limit(600);
  if(response.error)throw new Error("Falha ao consultar "+table+": "+response.error.message);
  return response.data||[];
 }));
 const state={data:Object.fromEntries(tables.map((table,i)=>[table,results[i]])),
  view:"todos",query:"",selected:new Set(),busy:false,issues:[],previewOpen:false};
 const records=()=>[
  ...(state.data.work_orders||[]).map(r=>({kind:"os",r})),
  ...(state.data.responsibility_terms||[]).map(r=>({kind:"termo",r}))
 ];
 const label=x=>x.kind==="os"?x.r.reference:x.r.term_code;
 const details=x=>x.kind==="os"?
  {sub:x.r.description||"Sem descrição",second:lookup(state.data,"operational_areas",x.r.area_id,a=>a.name),
   moment:dateBR(x.r.due_on),status:x.r.status}:
  {sub:lookup(state.data,"employees",x.r.employee_id,a=>a.name),
   second:x.r.vehicle_id?lookup(state.data,"vehicles",x.r.vehicle_id,v=>v.plate):
    lookup(state.data,"equipment",x.r.equipment_id,e=>e.asset_tag+" · "+e.name),
   moment:dateBR(x.r.assigned_on),status:x.r.status};
 const filtered=()=>records().filter(x=>(state.view==="todos"||state.view===x.kind)&&
  [label(x),x.kind,details(x).sub,details(x).second].some(v=>
   String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .includes(state.query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase())));
 const selected=()=>records().filter(x=>state.selected.has(idKey(x.kind,x.r.id)));
 function printPreview(){
  return '<div class="doc-templates-preview">'+
   '<div class="doc-preview-card"><div class="doc-preview-top"><span class="doc-preview-company"><img src="./assets/proerg-official-white.svg?v=1" alt="Logotipo oficial da PROERG" loading="lazy" decoding="async"></span><span class="doc-preview-system">SIGA Américas</span></div>'+
    '<div class="doc-preview-divider"></div><small>SISTEMA DE GESTÃO DA PROERG EM ITAIPU</small><h3>ORDEM DE SERVIÇO</h3>'+
    '<p>Identificação · Frente operacional · Item contratual · Quantidade prevista · Unidade de medição · Registro posterior da execução</p>'+
    '<div class="doc-preview-lines"></div><div class="doc-preview-sign">____________________　　____________________<br>Supervisão　　　　　　　Equipe / responsável</div></div>'+
   '<div class="doc-preview-card"><div class="doc-preview-top"><span class="doc-preview-company"><img src="./assets/proerg-official-white.svg?v=1" alt="Logotipo oficial da PROERG" loading="lazy" decoding="async"></span><span class="doc-preview-system">SIGA Américas</span></div>'+
    '<div class="doc-preview-divider"></div><small>SISTEMA DE GESTÃO DA PROERG EM ITAIPU</small><h3>TERMO DE RESPONSABILIDADE</h3>'+
    '<p>Responsável · Bem designado · Condições · Guarda e devolução · Assinaturas</p>'+
    '<div class="doc-preview-lines"></div><div class="doc-preview-sign">____________________　　____________________<br>Responsável　　　　　　　Representante</div></div>'+
   '</div>';
 }
 function refreshUI(){
  if(!root.isConnected)return;
  const rows=filtered(),chosen=selected(),totals=records();
  root.innerHTML='<section class="document-guide"><div class="document-guide-head"><div><span class="eyebrow">SIGA AMÉRICAS · GESTÃO DA PROERG EM ITAIPU</span>'+
   '<h2>Central de documentos e impressões</h2><p>Registre a OS ou o termo no cadastro, selecione os documentos e emita Word e PDF para assinatura física. Impressão e assinaturas não são presumidas.</p></div>'+
   '<div class="document-total">'+totals.length+'<small>documentos cadastrados</small></div></div>'+
   '<div class="document-actions"><button type="button" class="btn btn-primary" data-doc-new="os" '+(canWrite?"":"disabled")+'>+ Nova ordem de serviço</button>'+
   '<button type="button" class="btn btn-secondary" data-doc-new="termo" '+(canWrite?"":"disabled")+'>+ Novo termo</button>'+
   '<span>Utiliza os módulos já existentes, sem duplicar o cadastro.</span></div></section>'+
   '<section class="document-workspace"><div class="document-workspace-head"><h3>Documentos para emissão</h3><span>'+state.selected.size+' selecionado(s)</span></div>'+
   '<div class="document-filters"><label>Tipo de documento<select id="doc-kind"><option value="todos"'+(state.view==="todos"?" selected":"")+'>Todos</option>'+
   '<option value="os"'+(state.view==="os"?" selected":"")+'>Ordens de serviço</option>'+
   '<option value="termo"'+(state.view==="termo"?" selected":"")+'>Termos de responsabilidade</option></select></label>'+
   '<label>Pesquisar<input type="search" id="doc-search" placeholder="Identificação, pessoa ou local" value="'+esc(state.query)+'"></label>'+
   '<button type="button" class="btn btn-ghost" data-doc-select-all>Selecionar todos os visíveis</button>'+
   '<button type="button" class="btn btn-ghost" data-doc-clear>Limpar seleção</button></div>'+
   '<div class="document-batch-actions">'+
    '<div><strong>'+chosen.length+' selecionado(s)</strong><small>Limite: 60 por lote · Word individual em .docx · Word em lote em .zip</small></div>'+
    '<button class="btn btn-secondary" type="button" data-doc-batch="pdf" '+(!chosen.length||state.busy?"disabled":"")+'>Gerar PDF para impressão</button>'+
    '<button class="btn btn-secondary" type="button" data-doc-batch="docx" '+(!chosen.length||state.busy?"disabled":"")+'>Gerar Word em lote</button>'+
    '<button class="btn btn-primary" type="button" data-doc-batch="both" '+(!chosen.length||state.busy?"disabled":"")+'>Pacote PDF + Word</button></div>'+
   '<div class="document-rows">'+(rows.map(x=>{
    const key=idKey(x.kind,x.r.id),d=details(x);
    return '<article class="document-record">'+
     '<label class="document-choice"><input type="checkbox" data-doc-id="'+esc(key)+'"'+(state.selected.has(key)?" checked":"")+'><span></span></label>'+
     '<div class="document-record-title"><strong>'+esc(label(x))+'</strong><small>'+esc(labelKind(x.kind))+'</small></div>'+
     '<div class="document-record-detail"><strong>'+esc(d.sub)+'</strong><small>'+esc(d.second)+' · '+esc(d.moment)+'</small></div>'+
     '<span class="document-record-status status-chip" data-status="'+esc(d.status||"")+'">'+esc(String(d.status||"").replaceAll("_"," "))+'</span>'+
     '<div class="document-record-buttons"><button type="button" class="table-action" data-doc-edit="'+esc(key)+'">Editar cadastro</button>'+
     '<button type="button" class="table-action" data-doc-single="pdf" data-doc-row="'+esc(key)+'">PDF</button>'+
     '<button type="button" class="table-action" data-doc-single="docx" data-doc-row="'+esc(key)+'">Word</button></div>'+
     '</article>';
   }).join("")||'<div class="document-empty"><strong>Nenhum documento encontrado.</strong><p>Cadastre uma ordem de serviço ou termo de responsabilidade para preencher os modelos automaticamente.</p></div>')+'</div></section>'+
   '<details class="document-workspace doc-models-collapsible" id="doc-models-preview"'+(state.previewOpen?' open':'')+'>'+
    '<summary class="document-workspace-head doc-models-summary"><span class="doc-models-summary-title"><h3>Padrão visual dos modelos</h3><small>Prévia da Ordem de Serviço e do Termo de Responsabilidade</small></span>'+
    '<span class="doc-models-summary-meta">Formato A4 · campos de assinatura <span class="doc-models-chevron" aria-hidden="true"></span></span></summary>'+
    '<div class="doc-models-content">'+printPreview()+
    '<p class="document-legal-note">Os modelos são administrativos e devem ser conferidos antes do uso oficial. Não constituem laudo, autorização ambiental, assinatura digital, comprovante de entrega ou aprovação de medição. As responsabilidades por danos devem ser apuradas, nunca presumidas.</p></div></details>'+
   '<section class="document-workspace"><div class="document-workspace-head"><h3>Emissões recentes</h3><span>Registro de geração, não de assinatura</span></div>'+
   '<div class="document-issues">'+(state.issues.length?
     state.issues.slice(0,12).map(x=>'<div><strong>'+esc(x.source_reference)+'</strong><span>'+esc(labelKind(x.document_kind))+'</span><small>'+new Date(x.issued_at).toLocaleString("pt-BR")+' · '+esc(x.issue_format.toUpperCase())+'</small></div>').join(""):
     '<p class="document-muted">Nenhuma emissão registrada.</p>')+'</div></section>';
  root.querySelector("#doc-models-preview").addEventListener("toggle",e=>{state.previewOpen=e.currentTarget.open;});
  root.querySelector("#doc-kind").addEventListener("change",e=>{state.view=e.target.value;refreshUI();});
  root.querySelector("#doc-search").addEventListener("input",e=>{
   const pos=e.target.selectionStart;
   state.query=e.target.value;refreshUI();
   const input=root.querySelector("#doc-search");input?.focus();input?.setSelectionRange(pos,pos);
  });
 }
 async function loadIssues(){
  const {data,error}=await db.from("document_issue_logs").select("document_kind,source_reference,issue_format,issued_at")
   .order("issued_at",{ascending:false}).limit(20);
  if(error)throw error;state.issues=data||[];
 }
 async function logIssue(chosen,format){
  const batch=crypto.randomUUID();
  const logs=chosen.map(x=>({document_kind:x.kind,source_record_id:x.r.id,source_reference:label(x),
    issue_format:format,batch_id:batch,printed_status:"emitido_para_assinatura"}));
  const {error}=await db.from("document_issue_logs").insert(logs);
  if(error)throw error;
  await loadIssues();
 }
 async function emit(items,format){
  if(state.busy)return;
  if(!items.length){notify("Selecione ao menos um documento.",true);return;}
  if(items.length>60){notify("O limite por lote é de 60 documentos. Divida a impressão em dois lotes.",true);return;}
  if(!canWrite){notify("É necessário perfil autorizado para emitir documentos.",true);return;}
  state.busy=true;refreshUI();
  try{
   const models=items.map(x=>buildOperationalDocument(x.kind,x.r,state.data));
   let blob,filename,logFormat;
   if(format==="pdf"){
    blob=await generatePDF(models);filename=items.length===1?safeFilename(models[0])+".pdf":"SIGA_documentos_para_assinatura.pdf";logFormat="pdf";
   }else if(format==="docx"){
    if(models.length===1){blob=await generateWord(models[0]);filename=safeFilename(models[0])+".docx";logFormat="docx";}
    else{blob=await generateBatchWordZip(models);filename="SIGA_modelos_Word_lote.zip";logFormat="zip";}
   }else{
    blob=await generateCompletePack(models);filename="SIGA_documentos_PDF_e_Word.zip";logFormat="zip";
   }
   downloadDocument(blob,filename);
   try{await logIssue(items,logFormat);}
   catch(error){notify("Arquivo gerado, mas o histórico de emissão não pôde ser salvo: "+error.message,true);return;}
   notify(items.length+" documento(s) gerado(s). Imprima, confira os dados e colete as assinaturas físicas.");
  }catch(error){notify("Falha na geração: "+(error.message||String(error))+". Verifique a conexão com as bibliotecas Word/PDF.",true);}
  finally{state.busy=false;refreshUI();}
 }
 root.addEventListener("click",e=>{
  const fresh=e.target.closest("[data-doc-new]");
  if(fresh){if(canWrite)onCreate(fresh.dataset.docNew);return;}
  const edit=e.target.closest("[data-doc-edit]");
  if(edit){const [kind,id]=edit.dataset.docEdit.split(":");onEdit(kind,id);return;}
  if(e.target.closest("[data-doc-select-all]")){
   filtered().forEach(x=>state.selected.add(idKey(x.kind,x.r.id)));refreshUI();return;
  }
  if(e.target.closest("[data-doc-clear]")){state.selected.clear();refreshUI();return;}
  const batch=e.target.closest("[data-doc-batch]");
  if(batch){emit(selected(),batch.dataset.docBatch);return;}
  const single=e.target.closest("[data-doc-single]");
  if(single){const found=records().find(x=>idKey(x.kind,x.r.id)===single.dataset.docRow);
   if(found)emit([found],single.dataset.docSingle);return;
  }
 });
 root.addEventListener("change",e=>{
  const box=e.target.closest("[data-doc-id]");if(!box)return;
  if(box.checked)state.selected.add(box.dataset.docId);else state.selected.delete(box.dataset.docId);
  refreshUI();
 });
 try{await loadIssues();}catch(error){notify("Histórico de emissão indisponível: "+error.message,true);}
 refreshUI();
 return ()=>{};
}
