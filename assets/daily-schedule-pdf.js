// Impressão da escala diária com a mesma identidade e biblioteca da OS.
import {generatePDF,downloadDocument} from "./document-output.js?v=5";
const d=v=>v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"Data não informada";
const pretty=x=>String(x??"").trim()||"A confirmar";
const labels={programada:"Programada",remanejada:"Remanejada",impedida:"Impedida",informada:"Execução informada",validada:"Validada"};
const shortService=x=>String(x??"").replace(/\s*·\s*programação diária.*$/i,"").trim();
export function buildDailyScheduleDocument(entry,team,area,price){
 const date=d(entry.work_date),item=[price?.code,price?.name].filter(Boolean).join(" · ");
 const blocker=entry.block_status==="impedida"
  ?"Bloqueio informado: "+pretty(entry.blocker_reason)
  :entry.block_status==="remanejada"
  ?"Remanejamento informado: "+pretty(entry.blocker_reason)
  :"Não há impedimento registrado na escala até a emissão deste documento.";
 return {
  kind:"programacao",
  reference:"PROGRAMACAO-"+entry.work_date+"-"+pretty(team?.code),
  heading:"PROGRAMAÇÃO DIÁRIA DE EQUIPE",
  subheading:"Orientação preliminar de trabalho · layout institucional das OS",
  badge:"PROGRAMAÇÃO · NÃO É ORDEM DE SERVIÇO",
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
    "Situação: "+pretty(labels[entry.block_status]||entry.block_status)+". "+blocker],
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
  buildDailyScheduleDocument(entry,teams.get(entry.team_id),areas.get(entry.area_id),prices.get(entry.contract_item_id))
 );
 const pdf=await generatePDF(models);
 const iso=String(entries[0].work_date||"data").replaceAll("-","");
 const only=entries.length===1?"_"+String(teams.get(entries[0].team_id)?.code||"equipe"):"_todas_as_equipes";
 const filename="SIGA_Programacao_Diaria_"+iso+only+".pdf";
 downloadDocument(pdf,filename);
 return filename;
}
