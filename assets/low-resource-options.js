// Alternativas de baixa mobilização com fundamento EXCLUSIVO na tabela de custeio vigente.
// Baixa mobilização é hipótese operacional, NÃO estimativa de lucro ou emissão de OS.
export const lowMobilizationRules=[
 {code:"3.39",condition:"Manutenção localizada de jardins com equipe no próprio posto",requirements:"Jardins existentes, equipe presente, segurança e H/h demonstradas"},
 {code:"3.41",condition:"Serviço eventual compatível no expediente normal",requirements:"Demanda extraordinária efetiva, enquadramento contratual e H/h comprovadas"},
 {code:"3.13",condition:"Regularização manual de superfície",requirements:"Trecho acessível, área em m² medida e ferramentas manuais"},
 {code:"3.15",condition:"Coroamento",requirements:"Indivíduos elegíveis, contagem em un e orientação técnica"},
 {code:"3.32",condition:"Limpeza de cerca",requirements:"Trecho de cerca existente, medição em metros e acesso seguro"},
 {code:"3.33",condition:"Controle manual de plantas daninhas",requirements:"Área indicada e medida em ha, compatibilidade operacional e esforço humano disponível"}
];
const fmt=n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const listLowMobilization=prices=>{
 const table=new Map((prices||[]).filter(p=>p.source_type==="precos"&&Number.isFinite(Number(p.unit_price))).map(p=>[p.code,p]));
 return lowMobilizationRules.flatMap(rule=>table.has(rule.code)?[{...rule,...table.get(rule.code)}]:[]);
};
export function secondaryCandidates(prices,entry,area){
 const items=listLowMobilization(prices);
 const location=(String(entry?.planned_location||"")+" "+String(area?.name||"")).toLocaleLowerCase("pt-BR");
 const gardens=/jardim|praça|gramado|ecomuseu|mirante|crv|centro executivo|viveiro/.test(location);
 const primary=(prices||[]).find(p=>p.id===entry?.contract_item_id)?.code;
 const preferred=gardens?["3.39","3.15","3.13","3.41","3.32"]:["3.41","3.32","3.13","3.33"];
 return items.filter(p=>p.code!==primary&&preferred.includes(p.code)).sort((a,b)=>preferred.indexOf(a.code)-preferred.indexOf(b.code)).slice(0,2);
}
export function priceLabel(p){
 return p.code+" · "+p.name+" · "+fmt(p.unit_price)+" / "+String(p.unit||"un");
}
