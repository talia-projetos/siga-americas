// Fluxo documental do planejamento diário: aprovação EXTERNA registrada antes de OS.
// Cada OS de posto fixo é operacional, sem medição adicional do item mensal 3.40.
import {buildOperationalDocument,generatePDF,downloadDocument} from "./document-output.js?v=9";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function mountDailyApproval(root,db,{date,approval,issued=[],expected=0,completed=0,canManage=false,
 notify=()=>{},onApproved=()=>{},onIssued=()=>{},teams=new Map(),areas=new Map(),prices=new Map()}={}){
 if(!root||!date)return;
 const ready=expected>0&&completed===expected;
 root.innerHTML='<section class="daily-approval-panel" aria-label="Aprovação contratual e emissão de ordens de serviço">'+
  '<div class="daily-approval-head"><div><span class="eyebrow">FLUXO DOCUMENTAL · GESTOR CONTRATUAL</span>'+
  '<h3>Aprovação formal e emissão de OS em lote</h3>'+
  '<p>1. Detalhar manhã/tarde de todas as equipes e postos. 2. Compartilhar PDF para análise. '+
  '3. Registrar aprovação documental recebida. 4. Gerar OS em lote, sem duplicidade.</p></div>'+
  '<span class="daily-approval-status '+(approval?'approved':'pending')+'">'+
  (approval?'Aprovação formal registrada':'Aguardando validação')+'</span></div>'+
  (approval?
   '<p><strong>Gestor:</strong> '+esc(approval.manager_name)+' · <strong>Documento:</strong> '+esc(approval.approval_reference)+
   ' · <strong>Data:</strong> '+esc(approval.approved_on)+'</p>'+
   '<p><strong>Ordens de serviço:</strong> '+issued.length+' de '+expected+' vinculadas. '+
   'Uma OS por equipe/dia e uma OS operacional por posto/dia, sem medição adicional do item mensal 3.40.</p>'+
   (canManage?'<div class="daily-approval-actions"><button type="button" class="btn btn-primary" data-issue-approved-batch '+
    (issued.length>=expected?'disabled':'')+'>'+
    (issued.length>=expected?'Lote já emitido':'Gerar OS em lote da data aprovada')+'</button>'+
    (issued.length?'<button type="button" class="btn btn-secondary" data-export-day-os>Baixar PDF das OS</button>':'')+'</div>':
    '<p>Para gerar as OS, é necessário acesso de supervisão, gestão ou administração.</p>'):
   '<p class="daily-approval-help">Este campo só deve ser preenchido depois que o gestor do contrato tiver aprovado '+
    '<strong>formalmente</strong> a programação. Registro do sistema não substitui a aprovação documental.</p>'+
   (canManage?'<div class="daily-approval-fields">'+
    '<label>Gestor que aprovou<input id="daily-approval-manager" maxlength="150" placeholder="Nome do gestor contratual"></label>'+
    '<label>Referência do documento de aprovação<input id="daily-approval-reference" maxlength="250" placeholder="Ofício, e-mail formal ou referência verificável"></label>'+
    '<label>Data da aprovação<input id="daily-approval-date" type="date"></label></div>'+
    '<button type="button" class="btn btn-secondary" data-register-day-approval '+(!ready?'disabled':'')+'>Registrar aprovação recebida</button>'+
    (!ready?'<small>Há turnos sem atividade/local: '+completed+' de '+expected+' equipes/postos com manhã e tarde completos.</small>':''):'') )+
  '<small>OS programadas não comprovam execução, medição, aceite ou disponibilização de pessoal.</small>'+
 '</section>';
 const dateInput=root.querySelector("#daily-approval-date");
 if(dateInput){const now=new Date();dateInput.value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");}
 let busy=false;
 root.querySelector("[data-register-day-approval]")?.addEventListener("click",async e=>{
  if(busy||!ready||approval)return;
  const manager=root.querySelector("#daily-approval-manager")?.value.trim()||"",
   reference=root.querySelector("#daily-approval-reference")?.value.trim()||"",
   approvedOn=dateInput?.value||"";
  if(manager.length<3||reference.length<5||!approvedOn){
   notify("Preencha gestor, data e referência documental da aprovação formal.",true);return;
  }
  if(!window.confirm("O gestor aprovou formalmente a programação de manhã e tarde de todas as equipes e postos nesta data? Confirme somente com documento efetivo. Após registrar, os turnos ficarão bloqueados para edição."))return;
  busy=true;const button=e.currentTarget;button.disabled=true;
  try{
   const {data,error}=await db.rpc("register_daily_plan_approval",{
    p_work_date:date,p_manager_name:manager,p_approval_reference:reference,p_approved_on:approvedOn
   });
   if(error)throw error;
   notify("Aprovação externa registrada. Ainda não foram criadas OS; use a ação de emissão em lote.");
   onApproved({id:data,work_date:date,manager_name:manager,approval_reference:reference,approved_on:approvedOn});
  }catch(error){notify("Não foi possível registrar aprovação: "+(error.message||error),true);button.disabled=false}
  finally{busy=false}
 });
 root.querySelector("[data-issue-approved-batch]")?.addEventListener("click",async e=>{
  if(busy||!approval)return;
  if(!window.confirm("Gerar OS em lote para esta data aprovada? Serão criadas OS por equipe e ordens operacionais por posto fixo, sem cobrança diária adicional."))return;
  busy=true;const button=e.currentTarget;button.disabled=true;
  try{
   const {data,error}=await db.rpc("issue_approved_daily_work_orders",{p_work_date:date});
   if(error)throw error;
   const result=await db.from("daily_plan_order_links")
    .select("id,work_date,work_order_id,team_assignment_id,service_post_id").eq("work_date",date);
   if(result.error)throw result.error;
   notify("Lote processado: "+data.created+" OS novas e "+data.already_existing+
    " já existentes. Nenhuma medição de serviço foi registrada.");
   onIssued(result.data||[]);
  }catch(error){notify("Não foi possível emitir o lote: "+(error.message||error),true);button.disabled=false}
  finally{busy=false}
 });
 root.querySelector("[data-export-day-os]")?.addEventListener("click",async e=>{
  if(busy)return;
  const ids=issued.map(x=>x.work_order_id);
  if(!ids.length)return;
  busy=true;const button=e.currentTarget;button.disabled=true;
  try{
   const {data,error}=await db.from("work_orders").select("*").in("id",ids);
   if(error)throw error;
   if((data||[]).length!==ids.length)throw Error("Não foi possível consultar todas as OS do lote.");
   const refs={activity_catalog:[],operational_areas:[...areas.values()],
    teams:[...teams.values()],contract_items:[...prices.values()]};
   const models=data.slice().sort((a,b)=>String(a.reference).localeCompare(String(b.reference),"pt-BR",{numeric:true}))
    .map(row=>buildOperationalDocument("os",row,refs));
   const pdf=await generatePDF(models);
   downloadDocument(pdf,"SIGA_OS_Lote_"+date.replaceAll("-","")+".pdf");
   notify("PDF com "+models.length+" OS emitidas gerado.");
  }catch(error){notify("Erro ao exportar o lote de OS: "+(error.message||error),true)}
  finally{busy=false;button.disabled=false}
 });
}
