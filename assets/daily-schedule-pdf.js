// Impressão da escala diária com a mesma identidade e biblioteca da OS.
import {generatePDF,downloadDocument} from "./document-output.js?v=9";
import {secondaryCandidates,priceLabel} from "./low-resource-options.js?v=1";
const d=v=>v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"Data não informada";
const pretty=x=>String(x??"").trim()||"A confirmar";
const labels={programada:"Programada",remanejada:"Remanejada",impedida:"Impedida",informada:"Execução informada",validada:"Validada"};
const shortService=x=>String(x??"").replace(/\s*·\s*programação diária.*$/i,"").trim();
export function buildDailyScheduleDocument(entry,team,area,price,catalog=[]){
 const date=d(entry.work_date),item=[price?.code,price?.name].filter(Boolean).join(" · ");
 const alternatives=secondaryCandidates(catalog,entry,area);
 const blocker=entry.block_status==="impedida"
  ?"Bloqueio informado: "+pretty(entry.blocker_reason)
  :entry.block_status==="remanejada"
  ?"Remanejamento informado: "+pretty(entry.blocker_reason)
  :"Não há impedimento registrado na escala até a emissão deste documento.";
 return {
  kind:"programacao",
  reference:"PROGRAMACAO-"+entry.work_date+"-"+pretty(team?.code),
  heading:"PROGRAMAÇÃO DIÁRIA DE EQUIPE",
  subheading:"",
  badge:"",
  meta:[
   ["Data operacional",date],
   ["Equipe",pretty(team?.code)+" · "+pretty(team?.name)]
  ],
  fields:[
   ["Frente operacional",pretty(area?.code)+" · "+pretty(area?.name)],
   ["Rubrica da tabela de custeio",pretty(item)],
   ["Unidade de medição contratual",pretty(price?.unit)],
   ["Local previsto / trecho a confirmar",pretty(entry.planned_location)]
  ],
  sections:[
   ["01  ATIVIDADE PREVISTA",shortService(entry.planned_service)||pretty(price?.name)],
   ["02  ALTERNATIVA / IMPEDIMENTO",
    "Atividade alternativa condicionada à segurança: "+pretty(entry.climate_alternative)+"\n"+
    "Situação: "+pretty(labels[entry.block_status]||entry.block_status)+". "+blocker+"\n"+
    "Rubricas alternativas, sujeitas a necessidade e medição: "+(alternatives.map(priceLabel).join(" | ")||"Não confirmadas")],
   ["03  REGISTRO POSTERIOR DA EQUIPE",
    "Atividade executada: _______________________________________________________\n"+
    "Local / trecho: _____________________________________________________________\n"+
    "Início: ________    Término: ________\n"+
    "Quantidade executada: ___________    Unidade: "+pretty(price?.unit)+"\n"+
    "Ocorrências / evidências: ____________________________________________________"]
  ],
  notice:"Programação preliminar para ciência. Não é OS autorizada, comprovação de execução ou medição aprovada. Conferir condições de segurança, autorização e local antes da atividade.",
  signers:[
   ["SUPERVISÃO / PROGRAMAÇÃO","Nome e assinatura"],
   ["CIÊNCIA DO RESPONSÁVEL PELA EQUIPE","Nome e assinatura"]
  ]
 };
}
export async function downloadDailySchedules(entries,teams,areas,prices){
 if(!entries?.length)throw new Error("Selecione uma data com equipe programada.");
 const models=entries.slice().sort((a,b)=>String(teams.get(a.team_id)?.code||"").localeCompare(String(teams.get(b.team_id)?.code||""))).map(entry=>
  buildDailyScheduleDocument(entry,teams.get(entry.team_id),areas.get(entry.area_id),prices.get(entry.contract_item_id),[...prices.values()])
 );
 const pdf=await generatePDF(models);
 const iso=String(entries[0].work_date||"data").replaceAll("-","");
 const only=entries.length===1?"_"+String(teams.get(entries[0].team_id)?.code||"equipe"):"_todas_as_equipes";
 const filename="SIGA_Programacao_Diaria_"+iso+only+".pdf";
 downloadDocument(pdf,filename);
 return filename;
}


export function buildMonthlyScheduleDocuments(entries,teams,areas,prices,selectedMonth){
 const monthNames=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
 const [year,mon]=selectedMonth.split("-").map(Number);
 if(!year||mon<1||mon>12)throw new Error("Competência mensal inválida.");
 const monthLabel=monthNames[mon-1].replace(/^./,c=>c.toUpperCase())+"/"+year;
 const teamIds=[...new Set(entries.map(e=>e.team_id))].sort((a,b)=>
  String(teams.get(a)?.code||"").localeCompare(String(teams.get(b)?.code||""),"pt-BR",{numeric:true}));
 return teamIds.map(teamId=>{
  const team=teams.get(teamId)||{},subset=entries.filter(e=>e.team_id===teamId).sort((a,b)=>a.work_date.localeCompare(b.work_date));
  const area=areas.get(subset[0]?.area_id)||{};
  const alternatives=secondaryCandidates([...prices.values()],subset[0],area);
  const lines=subset.map(e=>{
   const price=prices.get(e.contract_item_id)||{};
   const date=String(e.work_date).slice(8,10)+"/"+String(e.work_date).slice(5,7);
   const location=String(e.planned_location||"Local a conferir").slice(0,100);
   const service=shortService(e.planned_service||price.name||"Atividade a definir");
   const status=labels[e.block_status]||"Programada";
   const warning=e.blocker_reason?" | Motivo: "+e.blocker_reason:"";
   return date+" · "+String(price.code||"—")+" · "+service+" | "+location+" | "+status+warning;
  });
  return {
   kind:"programacao",
   reference:"PROGRAMAÇÃO-MENSAL-"+selectedMonth+"-"+String(team.code||teamId),
   heading:"PROGRAMAÇÃO MENSAL DE EQUIPE",
   subheading:"",badge:"",
   meta:[["Competência",monthLabel],["Equipe",String(team.code||"—")+" · "+String(team.name||"Equipe")]],
   fields:[["Frente operacional",String(area.code||"—")+" · "+String(area.name||"A confirmar")],
           ["Dias de programação",String(subset.length)],
           ["Referência financeira","Tabela de custeio do contrato vigente; valores não medidos"]],
   sections:[
    ["01  ATIVIDADES POR DATA",lines.join("\n")],
    ["02  ALTERNATIVAS E BLOQUEADORES",
     "Rubricas alternativas possíveis nesta frente: "+(alternatives.map(priceLabel).join(" | ")||"A avaliar")+".\n"+
     "Atividades alternativas e condições de segurança devem ser conferidas diariamente no SIGA. Dias remanejados ou impedidos estão identificados na relação acima.\n"+
     "O técnico registra a execução real e informa serviços não previstos; a supervisão verifica e valida."],
    ["03  CONFERÊNCIA OPERACIONAL",
     "Alterações de datas, locais ou frentes: ________________________________________\n"+
     "Impedimentos e justificativas: _______________________________________________\n"+
     "Referência dos registros / fotos: ______________________________________________"]
   ],
   notice:"Programação gerencial preliminar de "+monthLabel+". Não constitui OS emitida, execução comprovada, quantidade medida nem aceite contratual. Serviços e frentes sujeitos à liberação técnica e à segurança do campo.",
   signers:[["SUPERVISÃO","Nome e assinatura"],["CIÊNCIA DO RESPONSÁVEL PELA EQUIPE","Nome e assinatura"]]
  };
 });
}
export async function downloadMonthlySchedules(entries,teams,areas,prices,month){
 if(!entries?.length)throw new Error("Nenhuma equipe programada nesta competência.");
 const models=buildMonthlyScheduleDocuments(entries,teams,areas,prices,month);
 const pdf=await generatePDF(models);
 const filename="SIGA_Programacao_Mensal_"+month.replace("-","")+".pdf";
 downloadDocument(pdf,filename);
 return filename;
}
