// Clima operacional do SIGA: INMET (API de curto prazo) e tendência sazonal oficial Simepar.
const html=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=d=>{const date=new Date(d+"T12:00:00");return Number.isNaN(date.valueOf())?d:date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",weekday:"short"});};
const nr=n=>typeof n==="number"&&Number.isFinite(n)?Math.round(n)+" °C":"—";
export async function mountWeatherAdvisory(root,db){
 if(!root)return;
 root.innerHTML='<section class="climate-planner-panel"><div class="climate-panel-head"><div><span class="eyebrow">CLIMA E SEGURANÇA</span><h2>Condições para programação de campo</h2><p>Referência: Foz do Iguaçu/PR. Condições por frente dependem de conferência local.</p></div><a href="https://www.simepar.br/simepar/forecast_by_counties/4108304" target="_blank" rel="noopener noreferrer">Previsão Simepar ↗</a></div>'+
 '<div class="climate-seasonal"><div><strong>Novembro/2026</strong><span>Chuva acima da média provável no Oeste do Paraná; planejar janelas secas e reserva técnica.</span></div>'+
 '<div><strong>Dezembro/2026</strong><span>Risco de temporais, calor e redução de dias de trabalho por feriados. Reprogramar frentes expostas.</span></div>'+
 '<div><strong>Janeiro/2027</strong><span>Cenário sazonal de verão, não previsão diária. Atualizar prognóstico antes da emissão das OS.</span></div></div>'+
 '<div id="climate-live-result" class="climate-live-result" aria-live="polite">Consultando a API oficial de curto prazo do INMET…</div>'+
 '<p class="climate-disclaimer">A previsão diária é válida apenas no horizonte divulgado pelo INMET. Não equivale a liberação de campo. Suspender ou reprogramar operações sob raios, tempestades, ventos fortes ou solo sem condições seguras, conforme avaliação do responsável.</p>'+
 '<div class="climate-sources">Fontes: <a href="https://previsao.inmet.gov.br/4108304" target="_blank" rel="noopener noreferrer">INMET</a> · <a href="https://www.simepar.br/simepar/post/79386" target="_blank" rel="noopener noreferrer">Simepar: El Niño e chuva até dezembro</a> · <a href="https://portal.inmet.gov.br/normais" target="_blank" rel="noopener noreferrer">Normais climatológicas</a></div></section>';
 const result=root.querySelector("#climate-live-result");
 try{
  const response=await db.functions.invoke("siga-clima-oficial",{method:"GET"});
  if(response.error||response.data?.unavailable||!Array.isArray(response.data?.days)||!response.data.days.length)throw new Error(response.data?.message||response.error?.message||"Sem dados oficiais");
  const data=response.data;
  const days=data.days.slice(0,7);
  result.innerHTML='<p class="climate-label">Previsão oficial INMET (curto prazo) · consulta '+html(new Date(data.retrieved_at).toLocaleString("pt-BR"))+'</p>'+
   '<div class="climate-live-days">'+days.map(day=>'<div><strong>'+html(fmt(day.date))+'</strong><span>'+html(nr(day.min))+' a '+html(nr(day.max))+'</span><small>'+html(day.description)+'</small></div>').join("")+'</div>';
 }catch(e){
  result.innerHTML='<p class="climate-live-warning">Previsão automática indisponível neste momento. Consulte diretamente o <a href="https://previsao.inmet.gov.br/4108304" target="_blank" rel="noopener noreferrer">INMET</a> ou o <a href="https://www.simepar.br/simepar/forecast_by_counties/4108304" target="_blank" rel="noopener noreferrer">Simepar</a>. Não há dados simulados.</p>';
 }
}
