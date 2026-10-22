// SIGA Américas · propostas de escala por manhã e tarde para validação do gestor.
// Postos fixos: item 3.40 de periodicidade mensal; nenhuma medição diária presumida.
import {generatePDF,downloadDocument} from "./document-output.js?v=9";
const d=v=>v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"Data não informada";
const pretty=x=>String(x??"").trim()||"A definir";
const shortService=x=>String(x??"").replace(/\s*·\s*programação diária.*$/i,"").trim();
const shiftList=[["manha","MANHÃ"],["tarde","TARDE"]];
const planFor=(plans,kind,id,date,shift)=>plans?.get(kind+":"+id+":"+date+":"+shift);
const shiftText=(plans,kind,id,date,shift)=>{
 const p=planFor(plans,kind,id,date,shift);
 return p?pretty(p.planned_activity)+"\nLocal: "+pretty(p.planned_location)+(p.supervisor_note?"\nObservação: "+p.supervisor_note:""):"ATIVIDADE PENDENTE DE DEFINIÇÃO.\nLocal: a confirmar.";
};
const footer="Proposta sujeita à validação expressa do gestor contratual, vistoria, segurança e disponibilidade. A impressão não comprova aprovação, OS autorizada, execução ou medição. Postos do item 3.40 são rotinas mensais, não faturamento adicional por dia.";
const signers=[["ELABORAÇÃO / SUPERVISÃO","Nome, data e assinatura"],["GESTOR DO CONTRATO · VALIDAÇÃO","Nome, data, assinatura e referência documental"]];
const basic=(heading,reference,meta,fields,sections)=>({
 kind:"programacao",reference,heading,subheading:"Documento para análise e aprovação",badge:"PROPOSTA · NÃO APROVADA",
 meta,fields,sections,notice:footer,signers
});
export function buildDailyScheduleDocument(entry,team,area,price,catalog=[],plans){
 const date=d(entry.work_date),item=[price?.code,price?.name].filter(Boolean).join(" · ");
 return basic("PROGRAMAÇÃO DIÁRIA · EQUIPE","PLANO-"+entry.work_date+"-"+pretty(team?.code),
  [["Data operacional",date],["Equipe",pretty(team?.code)+" · "+pretty(team?.name)],
   ["Situação","Proposta de programação; aprovação documental pendente"]],
  [["Frente operacional",pretty(area?.code)+" · "+pretty(area?.name)],
   ["Rubrica de referência",pretty(item)],["Local diário de referência",pretty(entry.planned_location)],
   ["Unidade contratual",pretty(price?.unit)]],
  [["01  MANHÃ",shiftText(plans,"equipe",entry.id,entry.work_date,"manha")],
   ["02  TARDE",shiftText(plans,"equipe",entry.id,entry.work_date,"tarde")],
   ["03  REFERÊNCIA E CONTINGÊNCIA",
    "Atividade diária de referência: "+pretty(shortService(entry.planned_service))+
    "\nAlternativa condicionada à segurança: "+pretty(entry.climate_alternative)+
    (entry.blocker_reason?"\nImpedimento registrado: "+entry.blocker_reason:"")],
   ["04  ANÁLISE DO GESTOR","Decisão: (  ) Aprovar  (  ) Devolver para ajustes\nObservações: ______________________________________________\nReferência da aprovação: __________________________________"]]);
}
export function buildFixedPostDocument(post,date,plans,routines=[]){
 const daily=routines.filter(r=>r.service_post_id===post.id&&r.frequency==="diaria");
 return basic("PROGRAMAÇÃO DIÁRIA · POSTO FIXO","POSTO-"+date+"-"+post.code,
  [["Data operacional",d(date)],["Posto fixo",post.code+" · "+post.name],
   ["Referência contratual",post.contractual_reference||"3.40"]],
  [["Posições previstas",String(post.fixed_positions||1)+" (não equivalem a equipes adicionais)"],
   ["Conferência de pessoal","Alocação nominal e presença a verificar"],
   ["Periodicidade de referência","Posto mensal, sem medição diária adicional"]],
  [["01  MANHÃ",shiftText(plans,"posto",post.id,date,"manha")],
   ["02  TARDE",shiftText(plans,"posto",post.id,date,"tarde")],
   ["03  ROTINAS CONTRATUAIS","Referência: "+(daily.map(r=>r.routine_code+" · "+r.title).join("; ")||"Rotinas a conferir")],
   ["04  ANÁLISE DO GESTOR","Decisão: (  ) Aprovar  (  ) Devolver para ajustes\nObservações: ______________________________________________\nReferência da aprovação: __________________________________"]]);
}
export async function downloadDailySchedules(entries,teams,areas,prices,posts=[],plans=new Map(),routines=[],approval=null){
 if(!entries?.length&&!posts?.length)throw Error("Nenhuma equipe ou posto para exportar.");
 const date=entries[0]?.work_date;
 if(!date)throw Error("Selecione um dia com escala de equipes para incluir os postos.");
 const models=entries.slice().sort((a,b)=>String(teams.get(a.team_id)?.code||"").localeCompare(String(teams.get(b.team_id)?.code||""),"pt-BR",{numeric:true}))
  .map(entry=>buildDailyScheduleDocument(entry,teams.get(entry.team_id),areas.get(entry.area_id),prices.get(entry.contract_item_id),[],plans));
 for(const post of posts.slice().sort((a,b)=>a.code.localeCompare(b.code,"pt-BR",{numeric:true})))
  models.push(buildFixedPostDocument(post,date,plans,routines));
 if(approval){
  for(const model of models){
   model.badge="PROGRAMAÇÃO · APROVAÇÃO DOCUMENTAL REGISTRADA";
   model.meta.push(["Aprovação do gestor",String(approval.manager_name||"Gestor")+
     " · "+String(approval.approval_reference||"Sem referência")+
     " · "+String(approval.approved_on||"Data não informada")]);
   model.notice+=" A aprovação da programação consta no registro documental. Não atesta execução nem autoriza medição sem a conferência contratual.";
  }
 }
 const pdf=await generatePDF(models);
 const iso=date.replaceAll("-","");
 const suffix=entries.length===1&&!posts.length?"_"+pretty(teams.get(entries[0].team_id)?.code):"_completo";
 const filename="SIGA_Proposta_Diaria_"+iso+suffix+".pdf";
 downloadDocument(pdf,filename);
 return filename;
}
const monthLabels=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const compactLine=(p,kind,id,date)=>{
 const summary=shiftList.map(([shift,label])=>{
  const x=planFor(p,kind,id,date,shift);
  return label+": "+(x?pretty(x.planned_activity)+" | "+pretty(x.planned_location):"PENDENTE");
 }).join("\n");
 return d(date)+"\n"+summary;
};
export function buildMonthlyScheduleDocuments(entries,teams,areas,prices,month,posts=[],plans=new Map(),routines=[]){
 const [year,mon]=month.split("-").map(Number);
 if(!year||mon<1||mon>12)throw Error("Competência inválida.");
 const label=monthLabels[mon-1]+"/"+year,models=[];
 const dates=[...new Set(entries.map(e=>e.work_date))].sort();
 const teamIds=[...new Set(entries.map(e=>e.team_id))].sort((a,b)=>
  String(teams.get(a)?.code||"").localeCompare(String(teams.get(b)?.code||""),"pt-BR",{numeric:true}));
 for(const teamId of teamIds){
  const team=teams.get(teamId)||{},subset=entries.filter(e=>e.team_id===teamId).sort((a,b)=>a.work_date.localeCompare(b.work_date));
  const missing=subset.filter(e=>shiftList.some(([shift])=>!planFor(plans,"equipe",e.id,e.work_date,shift)));
  models.push(basic("PROGRAMAÇÃO MENSAL · EQUIPE","PROPOSTA-"+month+"-"+pretty(team.code),
   [["Competência",label],["Equipe",pretty(team.code)+" · "+pretty(team.name)],
    ["Turnos pendentes",String(missing.length)+" dia(s) com detalhamento incompleto"]],
   [["Dias previstos",String(subset.length)],["Medidas e serviços","A validar; sem medição presumida"]],
   [["01  MANHÃ E TARDE POR DIA",subset.map(e=>compactLine(plans,"equipe",e.id,e.work_date)).join("\n\n")],
    ["02  CONDIÇÕES DE APROVAÇÃO","Validar locais, disponibilidade, clima, pessoal, rubricas e execução por equipe antes de emitir OS."],
    ["04  DECISÃO DO GESTOR","(  ) Aprovar a programação    (  ) Solicitar ajustes\nReferência documental: __________________________"]]));
 }
 for(const post of posts.slice().sort((a,b)=>a.code.localeCompare(b.code,"pt-BR",{numeric:true}))){
  const missing=dates.filter(date=>shiftList.some(([shift])=>!planFor(plans,"posto",post.id,date,shift)));
  const daily=routines.filter(r=>r.service_post_id===post.id&&r.frequency==="diaria");
  models.push(basic("PROGRAMAÇÃO MENSAL · POSTO FIXO","POSTO-"+month+"-"+post.code,
   [["Competência",label],["Posto",post.code+" · "+post.name],["Referência","Item 3.40 · postos de jardinagem"]],
   [["Posições contratuais",String(post.fixed_positions||1)],["Dias previstos",String(dates.length)],
    ["Turnos pendentes",String(missing.length)+" dia(s)"],["Unidade de custeio","mês · sem cobrança extra por turno"]],
   [["01  MANHÃ E TARDE POR DIA",dates.map(date=>compactLine(plans,"posto",post.id,date)).join("\n\n")],
    ["02  ROTINAS DE REFERÊNCIA",daily.map(r=>r.routine_code+" · "+r.title).join("; ")||"Consultar rotinas cadastradas"],
    ["04  DECISÃO DO GESTOR","(  ) Aprovar a programação    (  ) Solicitar ajustes\nReferência documental: __________________________"]]));
 }
 return models;
}
export async function downloadMonthlySchedules(entries,teams,areas,prices,month,posts=[],plans=new Map(),routines=[]){
 if(!entries?.length)throw Error("Nenhuma equipe programada na competência.");
 const models=buildMonthlyScheduleDocuments(entries,teams,areas,prices,month,posts,plans,routines);
 const pdf=await generatePDF(models);
 const filename="SIGA_Proposta_Mensal_"+month.replace("-","")+"_Equipes_Postos.pdf";
 downloadDocument(pdf,filename);
 return filename;
}
