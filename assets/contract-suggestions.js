// SIGA Américas · direcionamento gerencial por matriz de 73 itens.
// Dados reais: catálogo, preços e apontamentos; recorrência e bloqueios são hipóteses técnicas.
// A tela não programa automaticamente e não afirma previsão meteorológica.
// Não vincular itens por número de código: matriz e planilha possuem numeração diferente.
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
const number=v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(Number(v||0));
const text=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalized=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")
  .replace(/[–—]/g,"-").replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim();
const numericCode=v=>Number(String(v||"").split(".")[1])||0;
const dateBR=v=>v?String(v).slice(8,10)+"/"+String(v).slice(5,7):"—";
const isAction=code=>{const n=numericCode(code);return n>=1&&n<=57};
const fixedServices=new Set(["3.7","3.9","3.10"]);
const priorityNames={high:"Inspeção prioritária",medium:"Avaliar demanda",low:"Planejar sob demanda",blocked:"Bloqueio crítico",support:"Rubrica de apoio",fixed:"Rotina contratual fixa"};
function analysis(activity){
 const n=normalized(activity.name),code=activity.code;
 const lawn=/corte de gramados|rocada geral|remocao de aparas|manutencao de jardins|controle manual de plantas daninhas|capina seletiva/.test(n);
 const irrigation=/irrigac/.test(n);
 const trees=/poda de arvore|poda de palmeira|corte de arvore|transplante de palmeira|arvores em faixas/.test(n);
 const felling=/corte de arvore/.test(n);
 const machinery=/operacao de trator|gramados|rocada|controle quimico|regularizacao.*superficie/.test(n);
 const heavy=/corte de arvore|transplante|trator|plantio de grama|rocada geral|remocao mecanica/.test(n);
 const waste=/remocao.*entulho|limpeza de cerca|remocao de aparas/.test(n);
 const perennial=/manutencao de jardins|corte de gramados|rocada geral|remocao de aparas|controle manual de plantas daninhas/.test(n);
 const recurrence=perennial?3:waste||irrigation||/poda de arvore.*limpeza|poda de palmeira.*limpeza|poda de cerca viva/.test(n)?2:1;
 const situation=fixedServices.has(code)?"fixed":isAction(code)?"action":"support";
 const motivation=perennial?"Recorrência potencial alta na manutenção de áreas verdes. Vistoriar e medir a área antes de programar."
  :waste?"A demanda pode reaparecer. Conferir acúmulo, acesso e medição por unidade contratual."
  :irrigation?"Executar conforme necessidade hídrica observada; chuva pode tornar o serviço dispensável."
  :felling?"Só considerar após vistoria, diâmetro, autorizações aplicáveis e avaliação de segurança."
  :trees?"Serviço condicionado à avaliação técnica, local, segurança e eventual autorização."
  :fixedServices.has(code)?"Serviço de rotina mensal. Não somar novamente à receita eventual sem previsão contratual."
  :situation==="support"?"Item integrante da matriz, mas não é uma ação operacional autônoma para programação."
  :"Ocorrência depende de demanda real, vistoria e autorização, quando exigível.";
 return {lawn,irrigation,trees,felling,machinery,heavy,waste,recurrence,situation,motivation};
}
function weatherRisk(type,scenario,window){
 if(type.situation==="support")return {status:"support",blocker:"Rubrica de apoio: verificar vínculo a serviço/OS."};
 if(type.situation==="fixed")return {status:"fixed",blocker:"Rotina mensal: verificar cobertura do posto e evitar duplicidade de cobrança."};
 if(scenario==="vento"&&(type.trees||type.machinery||type.heavy))
   return {status:"blocked",blocker:"Vento forte/temporal: não programar corte, poda ou operação insegura."};
 if(scenario==="chuva"&&(type.machinery||type.trees||type.irrigation||type.heavy))
   return {status:"blocked",blocker:type.irrigation?"Chuva: confirmar se há necessidade real de irrigar."
    :"Chuva/solo molhado: adiar ou reavaliar segurança e condições operacionais."};
 if(type.felling)return {status:"blocked",blocker:"Conferir autorização exigível, diâmetro e avaliação de segurança antes de programar."};
 if(scenario==="incerto"&&(type.trees||type.machinery||type.irrigation))
   return {status:"warning",blocker:"Tempo não confirmado: checar previsão e condições reais antes da liberação."};
 if(window==="curta"&&type.heavy)
   return {status:"warning",blocker:"Janela operacional reduzida: definir duração, equipe e execução por etapas."};
 if(type.trees)return {status:"warning",blocker:"Conferir segurança, localização, autorizações aplicáveis e equipe capacitada."};
 if(type.irrigation)return {status:"warning",blocker:"Verificar umidade do solo e necessidade hídrica antes da mobilização."};
 return {status:"ready",blocker:"Sem bloqueador presumido; confirmar vistoria, OS, equipe, clima e acesso."};
}
function assignPrice(activity,priceByName,entries,priceById){
 const direct=priceByName.get(normalized(activity.name));
 if(direct)return {price:direct,source:"Correspondência exata do serviço"};
 const used=new Set(entries.filter(e=>e.activity_id===activity.id&&e.contract_item_id).map(e=>e.contract_item_id));
 if(used.size===1){const p=priceById.get([...used][0]);if(p)return {price:p,source:"Vínculo registrado nos apontamentos"};}
 return {price:null,source:used.size>1?"Mais de uma rubrica vinculada: conferir":"Sem equivalência contratual confirmada"};
}
export function buildSuggestions(matrix,prices,executions,{scenario="incerto",window="normal"}={}){
 const named=new Map(prices.filter(p=>p.source_type==="precos").map(p=>[normalized(p.name),p]));
 const priced=new Map(prices.filter(p=>p.source_type==="precos").map(p=>[p.id,p]));
 return matrix.map(activity=>{
  const profile=analysis(activity),mapping=assignPrice(activity,named,executions,priced);
  const own=executions.filter(e=>e.activity_id===activity.id&&e.execution_status!=="cancelada"&&e.validation_status!=="glosada");
  const days=new Set(own.map(e=>String(e.performed_on).slice(0,10))).size;
  const sum=own.reduce((s,e)=>s+Number(e.estimated_amount||0),0);
  const qty=own.reduce((s,e)=>s+Number(e.quantity||0),0);
  const blocker=weatherRisk(profile,scenario,window);
  // Ranking explicável: recorrência é heurística, dias e valores são registros reais.
  // Preços unitários não são comparados como se unidades diferentes fossem equivalentes.
  const score=profile.recurrence*25+Math.min(days,5)*12+Math.min(27,Math.log10(1+sum)*6)+(mapping.price?4:0);
  const stop=blocker.status==="blocked"||blocker.status==="fixed"||blocker.status==="support";
  const tier=stop?blocker.status:score>=78?"high":score>=49?"medium":"low";
  return {activity,profile,mapping,days,sum,qty,blocker,score,tier};
 });
}
const rank=(a,b)=>{
 const order={high:0,medium:1,low:2,fixed:3,support:4,blocked:5};
 return (order[a.tier]-order[b.tier])||b.score-a.score||numericCode(a.activity.code)-numericCode(b.activity.code);
};
export async function mountContractSuggestions(root,db,{onPlan=()=>{},notify=()=>{}}={}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Consultando a matriz de 73 atividades, preços e execuções...</p></div>';
 const queries=[
  db.from("activity_catalog").select("id,code,name,category").limit(100),
  db.from("contract_items").select("id,code,name,unit,unit_price,source_type").eq("source_type","precos").limit(100),
  db.from("field_execution_entries").select("activity_id,contract_item_id,performed_on,quantity,estimated_amount,execution_status,validation_status").order("performed_on",{ascending:false}).limit(1000)
 ];
 const responses=await Promise.all(queries);
 for(const result of responses)if(result.error)throw result.error;
 const [matrix,prices,executions]=responses.map(x=>x.data||[]);
 if(matrix.length!==73)throw Error("A matriz consultada possui "+matrix.length+" registros, em vez de 73. Verifique a base antes de priorizar.");
 const state={scenario:"incerto",window:"normal",filter:"acoes",sort:"sugerida",query:""};
 const dates=executions.map(e=>String(e.performed_on||"").slice(0,10)).filter(Boolean).sort();
 const datesLabel=dates.length?"Datas extremas dos registros consultados: "+dateBR(dates[0])+" a "+dateBR(dates[dates.length-1])+" (não indica execução diária)":"Ainda não há apontamentos cadastrados";
 root.innerHTML='<section class="suggestions-guide">'+
  '<div class="suggestions-heading"><div><span class="eyebrow">ANÁLISE OPERACIONAL · PROERG / ITAIPU</span><h2>Itens contratuais sugeridos</h2>'+
  '<p>Prioridade por recorrência potencial, execução já observada e relevância financeira registrada. <strong>Bloqueadores de clima, segurança e autorização prevalecem sobre valor.</strong></p></div>'+
  '<div class="suggestions-73">73 <span>itens da matriz</span></div></div>'+
  '<div class="suggestions-controls">'+
   '<label>Cenário meteorológico (simulação)<select id="suggest-weather"><option value="incerto">Tempo ainda não confirmado</option><option value="seco">Tempo favorável / solo seco</option><option value="chuva">Chuva / solo encharcado</option><option value="vento">Vento forte / temporal</option></select></label>'+
   '<label>Janela disponível<select id="suggest-window"><option value="normal">Janela operacional normal</option><option value="curta">Janela operacional reduzida</option></select></label>'+
   '<label>Exibir<select id="suggest-filter"><option value="acoes">Ações executáveis (3.1 a 3.57)</option><option value="recorrentes">Demanda recorrente provável</option><option value="registradas">Com ocorrência registrada</option><option value="todas">Todos os 73 itens</option></select></label>'+
   '<label>Ordenar<select id="suggest-sort"><option value="sugerida">Prioridade operacional sugerida</option><option value="receita">Maior valor já registrado</option><option value="dias">Maior ocorrência em dias</option><option value="recorrencia">Maior recorrência potencial</option><option value="codigo">Código da matriz</option></select></label>'+
   '<label class="suggest-search-label">Buscar item<input type="search" id="suggest-search" placeholder="Ex.: gramados, poda, trator"></label>'+
  '</div>'+
  '<p class="suggestions-disclaimer"><strong>Clima simulado:</strong> esta tela não consulta previsão em tempo real. Prioridades são indicativas, não substituem vistoria, OS, licenças e validação da medição. Preços aparecem apenas quando há vínculo confiável entre matriz e planilha financeira.</p></section>'+
  '<div id="suggest-summary"></div><div id="suggest-shortlist"></div><div id="suggest-table"></div>';
 const items=buildSuggestions(matrix,prices,executions,state);
 const term=(p)=>[p.activity.code,p.activity.name,p.mapping.price?.name,p.blocker.blocker].some(s=>normalized(s).includes(normalized(state.query)));
 const classify=(arr)=>arr.map(item=>{
   const blocker=weatherRisk(item.profile,state.scenario,state.window);
   const tier=blocker.status==="blocked"||blocker.status==="fixed"||blocker.status==="support"?blocker.status:
    item.score>=78?"high":item.score>=49?"medium":"low";
   return {...item,blocker,tier};
 });
 const filtered=(all)=>{
   const pool=all.filter(v=>(state.filter==="todas"||
    state.filter==="acoes"&&v.profile.situation==="action"||
    state.filter==="recorrentes"&&v.profile.recurrence>=3&&v.profile.situation==="action"||
    state.filter==="registradas"&&v.days>0)&&term(v));
   pool.sort((a,b)=>state.sort==="receita"?b.sum-a.sum||rank(a,b):
    state.sort==="dias"?b.days-a.days||rank(a,b):
    state.sort==="recorrencia"?b.profile.recurrence-a.profile.recurrence||rank(a,b):
    state.sort==="codigo"?numericCode(a.activity.code)-numericCode(b.activity.code):rank(a,b));
   return pool;
 };
 function row(x,card=false){
  const a=x.activity,p=x.mapping.price;
  const isBlocked=x.blocker.status==="blocked";
  const price=p?money(p.unit_price)+" / "+text(p.unit||"un"):"Preço não confirmado";
  const note=x.mapping.source;
  const html='<div class="suggestion-main"><strong>'+text(a.code)+' · '+text(a.name)+'</strong>'+
    '<span class="suggestion-hint">'+text(x.profile.motivation)+'</span></div>'+
    '<div><span class="suggest-status '+(isBlocked?"suggest-stopped":x.tier==="high"?"suggest-priority":"")+'">'+text(priorityNames[x.tier]||"Conferir")+'</span>'+
    '<small class="suggestion-hint">'+text(x.blocker.blocker)+'</small></div>'+
    '<div><strong>'+text(price)+'</strong><small class="suggestion-hint">'+text(note)+'</small></div>'+
    '<div><strong>'+x.days+' dia(s)</strong><small class="suggestion-hint">'+text(datesLabel)+'</small></div>'+
    '<div><strong>'+money(x.sum)+'</strong><small class="suggestion-hint">Produção informada; pendente de conferência</small></div>'+
    (x.profile.situation==="action"&&!isBlocked?
      '<button class="btn btn-secondary" type="button" data-suggest-plan="'+text(a.id)+'">Levar ao planejamento</button>':
      '<span class="suggestion-hint">'+(isBlocked?"Reavaliar bloqueador":x.profile.situation==="fixed"?"Acompanhar rotina fixa":"Consultar rubrica")+'</span>');
  return card?'<article class="suggestion-card">'+html+'</article>':
   '<div class="suggestion-row">'+html+'</div>';
 }
 function paint(){
  const all=classify(items);
  const list=filtered(all);
  const eligible=all.filter(v=>v.profile.situation==="action"&&v.tier!=="blocked");
  // Para a reunião, combinar execução recente com manutenção recorrente:
  // o corte de gramados deve ser inspecionado mesmo sem apontamento do preposto.
  const recentTop=eligible.filter(v=>v.days>0).sort(rank).slice(0,3);
  const recurringTop=eligible.filter(v=>v.profile.recurrence>=3&&v.days===0)
   .sort((a,b)=>{
    const focus=x=>/corte de gramados/.test(normalized(x.activity.name))?0:
     /rocada geral/.test(normalized(x.activity.name))?1:
     /manutencao de jardins/.test(normalized(x.activity.name))?2:3;
    return focus(a)-focus(b)||rank(a,b);
   }).slice(0,3);
  const top=[...recentTop,...recurringTop,...eligible.sort(rank)].filter((v,i,arr)=>arr.findIndex(x=>x.activity.id===v.activity.id)===i).slice(0,6);
  const blockers=all.filter(v=>v.profile.situation==="action"&&v.tier==="blocked").length;
  const recent=all.filter(v=>v.days>0).length;
  const priced=all.filter(v=>Boolean(v.mapping.price)).length;
  const critical=state.scenario==="vento"?"Vento forte ou temporal: evite poda, corte de árvores e máquinas expostas até condições seguras.":
   state.scenario==="chuva"?"Chuva e solo encharcado: reprogramar operações de máquinas, roçadas e cortes condicionados à segurança.":
   state.scenario==="seco"?"Tempo favorável é apenas cenário informado; confirme condições reais, autorizações e disponibilidade antes da OS.":
   "Tempo não confirmado: consulte previsão e condições locais antes de liberar roçada, poda e operações com máquinas.";
  root.querySelector("#suggest-summary").innerHTML='<div class="suggestion-critical"><strong>Bloqueador prioritário · clima e segurança</strong><span>'+text(critical)+'</span></div><div class="suggestion-summary">'+[
    ["Matriz de referência",matrix.length,"Todos os itens preservados"],
    ["Com preço identificado",priced,"Equivalência técnica ou apontamento já vinculado"],
    ["Atividades com execução",recent,"Quantidade de itens distintos"],
    ["Bloqueios no cenário",blockers,"Prioridade absoluta: segurança e viabilidade"]
   ].map(([label,value,note])=>'<div class="suggestion-stat"><small>'+text(label)+'</small><strong>'+text(value)+'</strong><span>'+text(note)+'</span></div>').join('')+'</div>';
  root.querySelector("#suggest-shortlist").innerHTML='<section class="suggestion-section"><div class="suggestion-section-header"><div><h3>Sugestões para vistoria e planejamento</h3><p>Seleção automática para conferência técnica. Não constitui reunião agendada, OS autorizada nem medição validada. '+text(datesLabel)+'.</p></div><button type="button" class="btn btn-ghost" id="suggest-export">Exportar os 73 itens (CSV)</button></div>'+
   '<div class="suggestion-list">'+top.map(x=>row(x,true)).join('')+'</div></section>'+
   '<section class="suggestion-section"><div class="suggestion-section-header"><div><h3>Maiores valores registrados · por item da matriz</h3>'+
   '<p>Valores dos apontamentos já cadastrados, sujeitos à conferência. Rubricas de apoio, como SE, não são novas ações executáveis.</p></div></div>'+
   '<div class="suggestion-finance-list">'+all.filter(x=>x.sum>0).sort((a,b)=>b.sum-a.sum).slice(0,6).map(x=>
    '<div><span><strong>'+text(x.activity.code)+' · '+text(x.activity.name)+'</strong><small>'+text(x.profile.situation==="support"?"Rubrica de apoio · conferir regime/OS":x.profile.situation==="fixed"?"Rotina de preço mensal":"Atividade com execução apontada")+'</small></span>'+
    '<strong>'+money(x.sum)+'</strong></div>').join('')+'</div></section>';
  root.querySelector("#suggest-table").innerHTML='<section class="suggestion-section"><div class="suggestion-section-header"><div><h3>Matriz de prioridades</h3><p>'+list.length+' de 73 itens no filtro atual · valores comparáveis apenas com produção registrada na mesma rubrica.</p></div></div>'+
   '<div class="suggestion-list suggestion-list-all">'+(list.map(x=>row(x)).join('')||'<p>Nenhum item encontrado nesse filtro.</p>')+'</div></section>';
  root.querySelector("#suggest-export")?.addEventListener("click",exportCsv);
 }
 function exportCsv(){
  const all=classify(items).sort((a,b)=>numericCode(a.activity.code)-numericCode(b.activity.code));
  const head=["Código matriz","Atividade da matriz","Prioridade gerencial","Bloqueador principal","Recorrência estimada (heurística)","Dias com ocorrência","Valor registrado (R$)","Código planilha de preços","Preço unitário (R$)","Unidade da planilha","Origem da correspondência"];
  const rows=all.map(x=>[
   x.activity.code,x.activity.name,priorityNames[x.tier]||"Conferir",x.blocker.blocker,
   x.profile.recurrence,x.days,x.sum,x.mapping.price?.code||"",x.mapping.price?.unit_price||"",x.mapping.price?.unit||"",x.mapping.source]);
  const safe=v=>{let value=String(v??"");if(/^[=+@-]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};
  const csv=[head,...rows].map(a=>a.map(safe).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="siga_prioridades_matriz_73.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 for(const [id,key] of [["suggest-weather","scenario"],["suggest-window","window"],["suggest-filter","filter"],["suggest-sort","sort"]]){
  root.querySelector("#"+id).addEventListener("change",e=>{state[key]=e.target.value;paint();});
 }
 root.querySelector("#suggest-search").addEventListener("input",e=>{state.query=e.target.value;paint();});
 root.addEventListener("click",event=>{
  const button=event.target.closest("[data-suggest-plan]");
  if(button)onPlan(button.dataset.suggestPlan);
 });
 paint();
 return ()=>{};
}
