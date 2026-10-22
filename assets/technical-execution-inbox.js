// Caixa de entrada de relatórios semanais na visão Execuções registradas.
// É leitura operacional: não insere medições nem duplica lançamento financeiro.
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=x=>x?new Date(String(x).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const stateName={rascunho:"Rascunho",enviado:"Aguardando supervisão",validado:"Validado",devolvido:"Devolvido"};
const resultName={nao_informado:"Não informado",executada:"Realizado (relatado)",parcial:"Parcial",impedida:"Impedida",nao_aplicavel:"Não aplicável"};
export async function mountTechnicalExecutionInbox(root,db){
 const startDate=new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 let selectedMonth=startDate.slice(0,7);
 if(!root)return;
 root.innerHTML='<section class="technical-inbox"><div class="technical-inbox-head"><div><span class="eyebrow">ORIGEM · RELATÓRIOS DAS EQUIPES</span><h3>Registros semanais recebidos</h3>'+
  '<p>Relatos dos técnicos disponíveis para conferência. Não são medições financeiras nem OS concluídas.</p></div>'+
  '<div class="technical-inbox-actions"><label>Competência <input type="month" data-tech-month></label><button type="button" class="btn btn-secondary" data-tech-refresh>Atualizar recebimentos</button></div></div>'+
  '<div data-tech-content aria-live="polite"><p>Consultando relatórios…</p></div></section>';
 const content=root.querySelector("[data-tech-content]"),button=root.querySelector("[data-tech-refresh]"),monthInput=root.querySelector("[data-tech-month]");
 monthInput.value=selectedMonth;
 let seq=0;
 async function refresh(){
  const current=++seq;button.disabled=true;content.innerHTML='<p class="technical-inbox-loading">Consultando dados dos técnicos…</p>';
  try{
   const [year,month]=selectedMonth.split("-").map(Number);
   const start=selectedMonth+"-01",end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
   const reports=await db.from("field_daily_reports")
    .select("id,team_id,area_id,service_post_id,period_start,period_end,status,report_period,submitted_at")
    .eq("report_period","semanal").lte("period_start",end).gte("period_end",start)
    .order("period_start",{ascending:false}).limit(500);
   if(reports.error)throw reports.error;
   const all=reports.data||[],ids=all.map(r=>r.id),[teams,activities,posts]=await Promise.all([
    db.from("teams").select("id,code,name").limit(30),
    db.from("activity_catalog").select("id,code,name").limit(110),
    db.from("service_posts").select("id,code,name").limit(20)
   ]);
   for(const r of [teams,activities,posts])if(r.error)throw r.error;
   const t=new Map((teams.data||[]).map(x=>[x.id,x])),
    a=new Map((activities.data||[]).map(x=>[x.id,x])),
    p=new Map((posts.data||[]).map(x=>[x.id,x]));
   let items=[];
   for(let i=0;i<ids.length;i+=60){
    const r=await db.from("field_daily_report_items").select("id,report_id,activity_id,service_post_id,performed_on,quantity,unit,result,work_order_id")
     .in("report_id",ids.slice(i,i+60)).limit(1000);
    if(r.error)throw r.error;
    if((r.data||[]).length>=1000)throw Error("Muitos lançamentos para uma consulta. Reduza o período para não omitir registros.");
    items.push(...(r.data||[]));
   }
   if(current!==seq||!root.isConnected)return;
   const byId=new Map(all.map(r=>[r.id,r]));
   const validated=all.filter(r=>r.status==="validado").length,
    waiting=all.filter(r=>r.status==="enviado").length,
    returned=all.filter(r=>r.status==="devolvido").length;
   items.sort((x,y)=>String(byId.get(y.report_id)?.period_start||"").localeCompare(String(byId.get(x.report_id)?.period_start||"")));
   content.innerHTML='<div class="technical-inbox-stats"><span><strong>'+all.length+'</strong> relatórios consultados</span>'+
    '<span><strong>'+waiting+'</strong> aguardando análise</span><span><strong>'+validated+'</strong> validados</span>'+
    (returned?'<span><strong>'+returned+'</strong> devolvidos</span>':'')+'</div>'+
    (items.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Semana</th><th>Equipe / posto</th><th>Atividade</th><th>Quantidade informada</th><th>Resultado</th><th>Conferência</th></tr></thead><tbody>'+
    items.map(row=>{
     const rep=byId.get(row.report_id),team=t.get(rep?.team_id),act=a.get(row.activity_id),post=p.get(row.service_post_id||rep?.service_post_id);
     return '<tr><td>'+esc(dateBR(rep?.period_start))+(row.performed_on?'<small>Dia: '+esc(dateBR(row.performed_on))+'</small>':'')+'</td>'+
     '<td>'+esc(team?.code||"—")+(post?'<small>Posto '+esc(post.code)+' · '+esc(post.name)+'</small>':'')+'</td>'+
     '<td>'+esc(act?.code||"—")+' · '+esc(act?.name||"Atividade")+'</td>'+
     '<td>'+esc(row.quantity==null?"Não quantificada":String(row.quantity)+" "+(row.unit||""))+'</td>'+
     '<td>'+esc(resultName[row.result]||row.result)+'</td>'+
     '<td>'+esc(stateName[rep?.status]||rep?.status)+'</td></tr>';
    }).join("")+'</tbody></table></div>':
    '<p class="technical-inbox-empty">Ainda não foram cadastradas atividades em relatórios semanais. Os envios dos técnicos aparecerão aqui após o registro.</p>')+
    '<p class="technical-inbox-note">Origem: relatório semanal → revisão da supervisão. Valores financeiros e quantidades aceitas só devem constar na medição após conferência própria. Atualize para consultar novos envios.</p>';
  }catch(error){if(current===seq&&root.isConnected)content.textContent="Não foi possível consultar relatórios: "+(error.message||error);}
  finally{if(current===seq&&root.isConnected)button.disabled=false}
 }
 monthInput.addEventListener("change",e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){selectedMonth=e.target.value;void refresh()}});
 button.addEventListener("click",()=>void refresh());await refresh();
}
