// Clima operacional do SIGA: INMET (API de curto prazo) e tendência sazonal oficial Simepar.
const html=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=d=>{const date=new Date(d+"T12:00:00");return Number.isNaN(date.valueOf())?d:date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",weekday:"short"});};
const nr=n=>typeof n==="number"&&Number.isFinite(n)?Math.round(n)+" °C":"—";
export async function mountWeatherAdvisory(root,db){
 if(!root)return;
 root.innerHTML='<section class="climate-planner-panel"><div class="climate-panel-head"><div><span class="eyebrow">CLIMA E SEGURANÇA</span><h2>Condições para programação de campo</h2><p>Referência: Foz do Iguaçu/PR. Condições por frente dependem de conferência local.</p></div><a href="https://www.simepar.br/simepar/forecast_by_counties/4108304" target="_blank" rel="noopener noreferrer">Previsão Simepar ↗</a></div>'+
 '<p class="climate-disclaimer"><strong>Prognóstico sazonal · Simepar, 09/10/2026:</strong> tendências gerais de precipitação, não previsão por dia, semana ou turno. Atualizar conforme boletins oficiais.</p>'+ 
 '<div class="climate-seasonal"><div><strong>Novembro/2026</strong><span>Maior probabilidade de acumulados acima da média no Oeste paranaense e de episódios intensos; reservar janelas secas para serviços externos e manter alternativas seguras.</span></div>'+
 '<div><strong>Dezembro/2026</strong><span>Simepar indica chuva acima da média no Paraná até dezembro e risco de temporais; prever bloqueios para frentes expostas e ajuste por feriados, sem presumir dias de chuva.</span></div>'+
 '<div><strong>Janeiro/2027</strong><span>Verão sob influência possível do El Niño. Ainda não há prognóstico mensal local verificado nesta consulta; reavaliar os boletins vigentes antes de liberar frentes.</span></div></div>'+
 '<section class="climate-forecast-section" aria-label="Previsão meteorológica de curto prazo">'+
 '<div class="climate-refresh-toolbar"><div class="climate-refresh-caption"><strong>Previsão de curto prazo</strong><small>INMET · CPTEC/INPE · MET Norway/ECMWF</small></div>'+
 '<div class="climate-refresh-actions"><button type="button" class="btn btn-secondary" data-refresh-forecast>Atualizar previsão</button>'+
 '<span data-forecast-last-check aria-live="polite">Aguardando primeira consulta</span></div></div>'+
 '<div id="climate-live-result" class="climate-live-result" aria-live="polite">Consultando as fontes meteorológicas…</div></section>'+
 '<div class="climate-guidance"><span class="climate-guidance-symbol" aria-hidden="true">!</span><p><strong>Segurança operacional:</strong> previsão numérica ou institucional não libera serviço em campo. Conferir alertas locais e suspender/reprogramar operações sob raios, temporais, ventos intensos ou condições inseguras do solo.</p></div>'+
 '<details class="climate-source-disclosure"><summary>Fontes consultadas e referências técnicas</summary><div class="climate-sources">Fontes: <a href="https://previsao.inmet.gov.br/4108304" target="_blank" rel="noopener noreferrer">INMET</a> · <a href="https://servicos.cptec.inpe.br/XML/" target="_blank" rel="noopener noreferrer">CPTEC/INPE</a> · <a href="https://www.simepar.br/simepar/post/79386" target="_blank" rel="noopener noreferrer">Simepar: El Niño e chuva até dezembro</a> · <a href="https://portal.inmet.gov.br/normais" target="_blank" rel="noopener noreferrer">Normais climatológicas</a> · <a href="https://api.met.no/weatherapi/locationforecast/2.0/documentation" target="_blank" rel="noopener noreferrer">MET Norway / ECMWF (modelo)</a></div></details></section>';
 const result=root.querySelector("#climate-live-result");
 const toolbar=root.querySelector(".climate-refresh-toolbar");
 const button=toolbar.querySelector("[data-refresh-forecast]"),checked=toolbar.querySelector("[data-forecast-last-check]");
 let busy=false;
 const loadForecast=async()=>{
  if(busy)return;
  busy=true;button.disabled=true;
  result.innerHTML='<p class="climate-label">Consultando as fontes meteorológicas…</p>';
  try{
   const response=await db.functions.invoke("siga-clima-oficial",{method:"GET"});
   let data=response.data;
   if(response.error){
    try{data=await response.error.context?.json?.()||data}catch{}
   }
   if(response.error||data?.unavailable||!Array.isArray(data?.days)||!data.days.length){
    const diagnostics=Array.isArray(data?.diagnostics)?data.diagnostics:[];
    const detail=diagnostics.length?'<details class="climate-diagnostic"><summary>Diagnóstico das fontes</summary><p>'+html(diagnostics.join(" · "))+'</p></details>':"";
    throw {message:data?.message||response.error?.message||"Sem dados atuais",detail};
   }
   const days=data.days.slice(0,7),retrieved=new Date(data.retrieved_at||Date.now()),isModel=data.forecast_type==='modelo_numerico';
   result.innerHTML='<p class="climate-label">'+(isModel?'Previsão modelada':'Previsão institucional')+' · '+html(data.source||"Fonte meteorológica")+
    ' · Foz do Iguaçu/PR · consulta '+html(retrieved.toLocaleString("pt-BR"))+'</p>'+
    '<div class="climate-live-days">'+days.map(day=>
     '<div><strong>'+html(fmt(day.date))+'</strong><span>'+html(nr(day.min))+' a '+html(nr(day.max))+
     '</span><small>'+html(day.description)+'</small></div>').join("")+'</div>'+ 
    (isModel?'<p class="climate-attribution">Previsão numérica sujeita à incerteza, não é aviso meteorológico oficial brasileiro. '+html(data.attribution||'')+' Consulte o modelo e os boletins locais antes de liberar campo.</p>':'');
  }catch(e){
   result.innerHTML='<p class="climate-live-warning">Não foi possível obter uma previsão atual verificável das fontes consultadas. '+
    'INMET, CPTEC/INPE e MET Norway podem estar indisponíveis (erro 503). Consulte <a href="https://previsao.inmet.gov.br/4108304" target="_blank" rel="noopener noreferrer">INMET</a> ou '+
    '<a href="https://servicos.cptec.inpe.br/XML/" target="_blank" rel="noopener noreferrer">CPTEC/INPE</a>. '+
    'Nenhum dado simulado foi exibido. A ausência de previsão disponível não autoriza automaticamente serviços ao ar livre.</p>'+(e?.detail||"");
  }finally{
   busy=false;button.disabled=false;
   checked.textContent='Última consulta: '+new Date().toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  }
 };
 button.onclick=loadForecast;
 await loadForecast();
}
