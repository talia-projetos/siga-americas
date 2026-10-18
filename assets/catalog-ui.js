// Apresentações especializadas dos catálogos contratuais. Somente leitura e filtros locais.
const escapeText=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const money=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value||0));
const parties={proerg:"PROERG",itaipu:"Itaipu",compartilhada:"Compartilhada",a_confirmar:"A confirmar"};
const domains={campo:"Operação de campo",pessoal:"Pessoal e uniformes",seguranca:"Segurança",frota:"Frota",maquinas:"Máquinas",materiais:"Materiais e patrimônio",ambiental:"Ambiental",documentacao:"Documentação"};
const areas={mao_de_obra:"Mão de obra",veiculo:"Veículos",equipamento:"Equipamentos",ferramenta:"Ferramentas",epi:"EPIs",uniforme:"Uniformes","capacitação":"Capacitação",outro:"Outros"};
const stat=(name,val,caption)=>'<div class="catalog-stat"><span>'+escapeText(name)+'</span><strong>'+escapeText(val)+'</strong><small>'+escapeText(caption)+'</small></div>';
const stats=(items)=>'<div class="catalog-stats">'+items.map(x=>stat(...x)).join("")+'</div>';
const explainer=html=>'<div class="catalog-explainer">'+html+'</div>';
const link=(module,label)=>'<button type="button" data-nav="'+module+'" class="table-action">'+escapeText(label)+' ↗</button>';
export function catalogOverview(key,rows){
 if(key==="contract_items"){
  const total=rows.reduce((sum,r)=>sum+Number(r.estimated_total||0),0);
  const top=[...rows].sort((a,b)=>Number(b.estimated_total||0)-Number(a.estimated_total||0)).slice(0,7);
  const max=Math.max(1,...top.map(r=>Number(r.estimated_total||0)));
  const figure=top.map(r=>{
   const percent=Math.max(0,Math.min(100,100*Number(r.estimated_total||0)/max));
   return '<div class="catalog-chart-row"><span class="catalog-chart-label" title="'+escapeText(r.code+" · "+r.name)+'">'+escapeText(r.code+" · "+r.name)+'</span><div class="catalog-chart-track"><span class="catalog-chart-fill" style="width:'+percent.toFixed(2)+'%"></span></div><strong>'+escapeText(money(r.estimated_total))+'</strong></div>';
  }).join("");
  return stats([
   ["Itens da planilha de preços",String(rows.length),"Fonte financeira contratual"],
   ["Valor total estimado",money(total),"Não corresponde à despesa realizada"],
   ["Matriz de campo","73 atividades","Catálogo técnico independente"]
  ])+explainer('<strong>Dois catálogos independentes.</strong> A numeração da matriz técnica não determina o item financeiro correspondente. '+link("activity_catalog","Consultar atividades técnicas"))+
  '<section class="catalog-chart"><div class="catalog-chart-heading"><h2>Maiores valores previstos por item</h2><p>Comparação dos itens de maior valor estimado. Não representa gastos realizados ou medições aprovadas.</p></div>'+(figure||'<div class="analytics-empty">Sem valores para representar.</div>')+'</section>';
 }
 if(key==="activity_catalog"){
  return stats([
    ["Atividades técnicas",String(rows.length),"Matriz interna completa"],
    ["Com interlocutor Itaipu",String(rows.filter(r=>r.itaipu_technical_contact).length),"Responsabilidades a validar"],
    ["Itens financeiros", "53","Tabela separada"]
  ])+explainer('Atividades orientam o planejamento e as ordens de serviço. Os valores, unidades e totais pertencem exclusivamente à tabela de preços. '+link("contract_items","Consultar tabela de preços"));
 }
 if(key==="obligations"){
  const n=k=>rows.filter(r=>r.party_responsible===k).length;
  return stats([
   ["PROERG",String(n("proerg")),"Obrigações da contratada"],
   ["Itaipu",String(n("itaipu")),"Responsabilidades específicas cadastradas"],
   ["Compartilhadas / a confirmar",String(n("compartilhada")+n("a_confirmar")),"Conferir atribuição documental"]
  ])+explainer('<strong>Pendente ≠ descumprimento.</strong> Esse status indica uma verificação aberta. A propriedade de bens da Itaipu não significa que a obrigação de guarda seja da Itaipu.');
 }
 if(key==="contract_resource_requirements"){
  const count=rows.filter(r=>r.validation_status==="a_conferir").length;
  return stats([
   ["Exigências cadastradas",String(rows.length),"Materiais, pessoal e equipamentos"],
   ["A conferir em campo",String(count),"Disponibilidade não verificada"],
   ["Fornecimento Itaipu",String(rows.filter(r=>r.provider_party==="itaipu").length),"Condições específicas identificadas"]
  ])+explainer('<strong>Exigido não significa entregue.</strong> Utilize a quantidade observada para o inventário e preserve em branco os campos ainda não conferidos.');
 }
 return "";
}
export function catalogFilters(key,rows){
 const defs=key==="obligations"
  ?[{key:"party_responsible",label:"Parte responsável",labels:parties},{key:"domain",label:"Assunto",labels:domains},{key:"status",label:"Situação"}]
  :key==="contract_resource_requirements"
  ?[{key:"provider_party",label:"Quem fornece",labels:parties},{key:"category",label:"Categoria",labels:areas},{key:"validation_status",label:"Conferência"}]
  :key==="contract_items" ?[{key:"unit",label:"Unidade"}]
  :key==="activity_catalog" ?[{key:"technical_lead",label:"Responsável técnico"}]
  :[];
 return defs.map(f=>{
  const values=[...new Set(rows.map(x=>x[f.key]).filter(v=>v!==null&&v!==undefined&&v!==""))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
  return '<label class="catalog-filter"><span>'+escapeText(f.label)+'</span><select class="catalog-filter-select" data-list-filter="'+f.key+'"><option value="">Todos</option>'+values.map(v=>'<option value="'+escapeText(v)+'">'+escapeText(f.labels?.[v]||String(v).replaceAll("_"," "))+'</option>').join("")+'</select></label>';
 }).join("");
}
export function catalogTableTitle(key){
 return ({
  contract_items:"Itens de preços contratuais",
  activity_catalog:"Atividades técnicas e responsáveis",
  obligations:"Obrigações por parte responsável e assunto",
  contract_resource_requirements:"Recursos previstos por categoria e fornecedor"
 })[key]||"Registros cadastrados";
}
export const isCatalogPage=key=>["contract_items","activity_catalog","obligations","contract_resource_requirements"].includes(key);
export const partyLabels=parties;
export const domainLabels=domains;
export const categoryLabels=areas;
