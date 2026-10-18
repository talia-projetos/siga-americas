// Gráficos gerenciais do SIGA Américas. HTML/SVG nativos, sem dependências externas.
// Indicadores calculados exclusivamente de dados reais consultados com as regras RLS do usuário.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0));
const fmt=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(Number(n||0));
const palette=["#15826c","#6ebda3","#b6d8bd","#e5a94f","#adc6d2","#8e9c91","#9b7dbe"];
const statusLabels={candidata:"Oportunidades",a_validar:"A validar",programada:"Programadas",em_execucao:"Em execução",executada:"Executadas",inviavel:"Inviáveis",nao_aplicavel:"Não aplicáveis",aberta:"Abertas",impedida:"Impedidas",concluida:"Concluídas",pendente:"Pendentes de verificação",conforme:"Conformes",em_adequacao:"Em adequação",a_conferir:"A conferir",validado:"Validados",em_revisao:"Em revisão",realizada:"Realizadas"};
const partyLabels={proerg:"PROERG",itaipu:"Itaipu",compartilhada:"Compartilhada",a_confirmar:"A confirmar"};
const categoryLabels={mao_de_obra:"Mão de obra",veiculo:"Veículos",equipamento:"Equipamentos",ferramenta:"Ferramentas",epi:"EPIs",uniforme:"Uniformes","capacitação":"Capacitação",outro:"Outros"};
const cnt=(list,key)=>list.reduce((out,item)=>{const code=item[key]||"a_confirmar";out[code]=(out[code]||0)+1;return out},{});
const sortedValues=(map,labels)=>Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([key,value])=>({name:labels?.[key]||key.replaceAll("_"," "),value}));
async function getRows(db,table,columns="*",filter=null){
 let q=db.from(table).select(columns);
 if(filter)for(const [key,value] of Object.entries(filter))q=q.eq(key,value);
 const {data,error}=await q.limit(1000);
 if(error)throw error;
 return data||[];
}
function figureBar(items,{max=undefined,format=fmt,limit=5}={}){
 const arr=items.slice(0,limit),top=max??Math.max(1,...arr.map(x=>Number(x.value||0)));
 if(!arr.length||!arr.some(x=>Number(x.value)>0))return '<div class="analytics-empty">Ainda não há lançamentos suficientes para este gráfico.</div>';
 return '<div class="analytics-bars" role="img" aria-label="'+esc(arr.map(x=>x.name+': '+format(x.value)).join('; '))+'">'+arr.map((item,i)=>{
  const percent=Math.min(100,Math.max(0,100*Number(item.value||0)/top));
  return '<div class="analytics-bar-row"><div class="analytics-bar-label" title="'+esc(item.name)+'">'+esc(item.name)+'</div><div class="analytics-bar-track"><span class="analytics-bar-fill" style="width:'+percent.toFixed(2)+'%;background:'+palette[i%palette.length]+'"></span></div><strong class="analytics-bar-value">'+esc(format(item.value))+'</strong></div>';
 }).join("")+'</div>';
}
function figureDonut(items){
 const filtered=items.filter(x=>Number(x.value)>0);const total=filtered.reduce((sum,x)=>sum+Number(x.value),0);
 if(!total)return '<div class="analytics-empty">Sem registros para distribuição neste período.</div>';
 let from=0;const circum=2*Math.PI*38;
 const ring=filtered.map((x,i)=>{const size=Number(x.value)/total;const dash=(size*circum).toFixed(3);const offset=(from*circum).toFixed(3);from+=size;return '<circle cx="52" cy="52" r="38" stroke="'+palette[i%palette.length]+'" stroke-width="13" stroke-dasharray="'+dash+' '+circum.toFixed(3)+'" stroke-dashoffset="-'+offset+'" />'}).join("");
 const legend=filtered.slice(0,6).map((x,i)=>'<div class="analytics-legend-row"><span class="analytics-dot" style="background:'+palette[i%palette.length]+'"></span><span>'+esc(x.name)+'</span><strong>'+fmt(x.value)+'</strong></div>').join("");
 return '<div class="analytics-donut-layout"><svg viewBox="0 0 104 104" class="analytics-donut" role="img" aria-label="'+esc(filtered.map(x=>x.name+': '+x.value).join('; '))+'"><g transform="rotate(-90 52 52)" fill="none">'+ring+'</g><text x="52" y="53" dominant-baseline="middle" text-anchor="middle" class="analytics-donut-number">'+fmt(total)+'</text><text x="52" y="68" text-anchor="middle" class="analytics-donut-caption">registros</text></svg><div class="analytics-legend">'+legend+'</div></div>';
}
function panel(title,kicker,body,module,foot=""){
 return '<article class="analytics-panel"><div class="analytics-panel-head"><div><span class="analytics-kicker">'+esc(kicker)+'</span><h3>'+esc(title)+'</h3></div><button type="button" data-nav="'+esc(module)+'" class="analytics-panel-action" title="Abrir '+esc(title)+'" aria-label="Abrir '+esc(title)+'">↗</button></div><div class="analytics-panel-body">'+body+'</div>'+(foot?'<p class="analytics-panel-foot">'+esc(foot)+'</p>':'')+'</article>';
}
const note=(label,value)=>'<div class="analytics-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
export async function renderDashboardAnalytics(root,db,{privileged=false}={}){
 root.innerHTML='<div class="analytics-loading">Atualizando indicadores de gestão…</div>';
 const defs=[
  ["plans","field_plan_items","action_status"],["programs","field_programs","status"],
  ["orders","work_orders","status"],["dailyReports","field_daily_reports","status,team_id,report_date"],["routines","field_routine_records","status"],
  ["templates","field_routine_templates","id"],["obligations","contract_obligations","party_responsible,status,domain"],
  ["resources","contract_resource_requirements","category,provider_party,validation_status"],
  ["prices","contract_items","code,name,source_type,estimated_total",{source_type:"precos"}],
  ["vehicles","vehicles","id"],["equipment","equipment","id"],
  ["fuel","fuel_logs","total_cost"],["repairs","maintenance_events","cost"],
  ["employees","employees","review_status"],["ppe","ppe_deliveries","id"],["uniforms","uniform_deliveries","id"]
 ];
 const requested=defs.filter(d=>privileged||!["fuel","repairs","employees","ppe","uniforms"].includes(d[0]));
 const results=await Promise.allSettled(requested.map(d=>getRows(db,d[1],d[2],d[3])));
 const data={};
 results.forEach((result,i)=>{data[requested[i][0]]=result.status==="fulfilled"?result.value:null});
 const fail=k=>data[k]===null||data[k]===undefined;
 const unavailable='<div class="analytics-empty">Não foi possível consultar os registros com este perfil.</div>';
 const plan=fail("plans")?unavailable:figureDonut(sortedValues(cnt(data.plans,"action_status"),statusLabels));
 const planningInfo=fail("programs")?"":'<div class="analytics-footline">'+note("Programações mensais",fmt(data.programs.length))+note("Itens na triagem",fmt(data.plans.length))+'</div>';
 const work=fail("dailyReports")?unavailable:figureBar(sortedValues(cnt(data.dailyReports,"status"),{
  rascunho:"Rascunhos",enviado:"Aguardam análise",validado:"Validados",devolvido:"Devolvidos"
 }));
 const fieldInfo=fail("dailyReports")?"":'<div class="analytics-footline">'+note("Relatórios enviados",fmt(data.dailyReports.filter(x=>x.status!=="rascunho").length))+note("Validados",fmt(data.dailyReports.filter(x=>x.status==="validado").length))+'</div>';
 const obligations=fail("obligations")?unavailable:figureDonut(sortedValues(cnt(data.obligations,"party_responsible"),partyLabels));
 const obligationInfo=fail("obligations")?"":'<div class="analytics-footline">'+note("Itens com verificação pendente",fmt(data.obligations.filter(x=>x.status==="pendente").length))+note("Total cadastrado",fmt(data.obligations.length))+'</div>';
 const monetary=fail("prices")?unavailable:figureBar([...data.prices].sort((a,b)=>Number(b.estimated_total||0)-Number(a.estimated_total||0)).slice(0,5).map(x=>({name:x.code+" · "+x.name,value:Number(x.estimated_total||0)})),{format:money});
 const moneyInfo=fail("prices")?"":'<div class="analytics-footline">'+note("Itens remunerados",fmt(data.prices.length))+note("Valor estimado total",money(data.prices.reduce((a,x)=>a+Number(x.estimated_total||0),0)))+'</div>';
 const resource=fail("resources")?unavailable:figureBar(sortedValues(cnt(data.resources,"category"),categoryLabels),{limit:7});
 const resourceInfo=fail("resources")?"":'<div class="analytics-footline">'+note("Requisitos a conferir",fmt(data.resources.filter(x=>x.validation_status==="a_conferir").length))+note("Bens inventariados",(!fail("vehicles")&&!fail("equipment"))?fmt(data.vehicles.length+data.equipment.length):"—")+'</div>';
 const staff=!privileged?'<div class="analytics-empty">Indicadores individuais restritos à gestão autorizada.</div>':fail("employees")?unavailable:figureDonut(sortedValues(cnt(data.employees,"review_status"),statusLabels));
 const staffInfo=!privileged?"":fail("employees")?"":'<div class="analytics-footline">'+note("Colaboradores",fmt(data.employees.length))+note("Entregas EPI / uniforme",(fail("ppe")||fail("uniforms"))?"—":fmt(data.ppe.length)+" / "+fmt(data.uniforms.length))+'</div>';
 root.innerHTML='<div class="analytics-intro"><div><span class="eyebrow">GESTÃO EM NÚMEROS</span><h2>Indicadores por área</h2><p>Visão executiva dos registros do contrato. Cada gráfico permite acessar o módulo correspondente.</p></div><span class="analytics-live">● Dados do Supabase</span></div>'+
 '<div class="analytics-grid">'+
 panel("Planejamento","COBERTURA E PROGRAMAÇÃO",plan+planningInfo,"coverage","Candidaturas não representam execução nem aprovação.")+
 panel("Campo e execução","RELATÓRIOS DOS TÉCNICOS",work+fieldInfo,"field_monitor","Relatórios não validam automaticamente serviços ou medições.")+
 panel("Contrato e obrigações","PARTE RESPONSÁVEL",obligations+obligationInfo,"obligations","Pendente significa verificação em aberto, não infração comprovada.")+
 panel("Financeiro","MAIORES ITENS PREVISTOS",monetary+moneyInfo,"contract_items","Valores contratuais previstos, não custos efetivamente pagos.")+
 panel("Patrimônio e materiais","EXIGÊNCIAS POR CATEGORIA",resource+resourceInfo,"contract_resource_requirements","Quantidades contratadas não equivalem a estoque comprovado.")+
 panel("Pessoas e segurança","SITUAÇÃO DOS CADASTROS",staff+staffInfo,"employees","Entregas de EPIs e uniformes exigem registro individual.")+
 '</div>';
}
