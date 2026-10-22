// Manutenção global: carteira operacional prioritária, sem inferir execução.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const names={a_verificar:"A verificar",planejada:"Planejada",aguardando_insumo:"Aguardando insumo",em_andamento:"Em andamento",concluida:"Concluída",impedida:"Impedida"};
const periodOrder={transicao:0,diaria:1,semanal:2,mensal:3,eventual:4};
const periodLabel={transicao:"Novembro · ações preparatórias",diaria:"Rotina diária",semanal:"Rotina semanal",mensal:"Rotina mensal",eventual:"Demanda eventual"};
export async function mountMaintenanceActionPanel(root,db,{role,notify}={}){
 if(!root)return;
 const canWrite=["gestao","admin","supervisao"].includes(role);
 const response=await db.from("maintenance_action_register")
  .select("id,action_code,title,workstream,cadence,priority,phase,condition_for_execution,status,evidence_reference")
  .order("action_code").limit(40);
 if(!root.isConnected)return;
 if(response.error){root.textContent="Carteira de manutenção indisponível: "+response.error.message;return;}
 let rows=response.data||[];
 const draw=()=>{
  const complete=rows.filter(x=>x.status==="concluida").length,verified=rows.filter(x=>x.status!=="a_verificar").length;
  root.innerHTML='<section class="maintenance-workplan"><div class="finance-panel-heading"><div>'+
   '<span class="eyebrow">RBV · MANUTENÇÃO GLOBAL</span><h3>Programa preventivo e ações priorizadas</h3>'+
   '<p>Novembro: ações preparatórias e adequações por prioridade. Dezembro/janeiro: rotina diária, semanal e mensal, com capacidade para demandas eventuais autorizadas.</p></div>'+
   '<div class="maintenance-stats"><strong>'+verified+' / '+rows.length+'</strong><small>ações com situação informada</small>'+
   '<strong>'+complete+'</strong><small>conclusões documentadas</small></div></div>'+
   '<p class="finance-scenario-alert">Atividade programada não equivale a serviço executado. Dependências de insumos, liberação técnica, segurança e destinação devem ser conferidas antes de alterar a situação.</p>'+
   '<div class="maintenance-workplan-list">'+rows.slice().sort((a,b)=>periodOrder[a.cadence]-periodOrder[b.cadence]||a.action_code.localeCompare(b.action_code)).map(r=>
    '<article class="maintenance-workplan-row" data-maintenance="'+esc(r.id)+'">'+
     '<div><small>'+esc(r.action_code+' · '+periodLabel[r.cadence]+' · '+r.workstream)+'</small>'+
     '<strong>'+esc(r.title)+'</strong><p>'+esc(r.condition_for_execution)+'</p>'+
     '<small>Janela de referência: '+esc(r.phase)+' · Prioridade: '+esc(r.priority)+'</small></div>'+
     '<div class="maintenance-controls">'+
      (canWrite?'<label>Situação<select data-maintenance-status>'+Object.entries(names).map(([value,label])=>
       '<option value="'+value+'"'+(r.status===value?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label>'+
       '<label>Referência da vistoria / evidência<input data-maintenance-evidence maxlength="400" value="'+esc(r.evidence_reference||"")+'" placeholder="Registro, relatório ou material disponível"></label>'+
       '<button class="btn btn-secondary" type="button" data-save-maintenance>Atualizar</button>':
       '<span>'+esc(names[r.status]||r.status)+'</span><small>'+esc(r.evidence_reference||"Sem referência informada")+'</small>')+
      '</div></article>').join("")+'</div></section>';
  root.querySelectorAll("[data-save-maintenance]").forEach(button=>button.onclick=async()=>{
   const card=button.closest("[data-maintenance]"),r=rows.find(x=>x.id===card.dataset.maintenance);
   if(!r)return;const status=card.querySelector("[data-maintenance-status]").value,
    evidence=card.querySelector("[data-maintenance-evidence]").value.trim();
   if(["concluida","em_andamento"].includes(status)&&evidence.length<8){
    notify("Para informar andamento ou conclusão, registre referência documental verificável.",true);return;
   }
   button.disabled=true;
   const user=await db.auth.getUser();
   if(user.error||!user.data?.user?.id){notify("A sessão precisa estar autenticada.",true);button.disabled=false;return;}
   const write=await db.from("maintenance_action_register").update({
    status,evidence_reference:evidence||null,updated_by:user.data.user.id,updated_at:new Date().toISOString()
   }).eq("id",r.id).select("id,status,evidence_reference").single();
   if(write.error){notify("Erro ao atualizar: "+write.error.message,true);button.disabled=false;return;}
   Object.assign(r,write.data);notify("Ação de manutenção atualizada, com rastreabilidade.");draw();
  });
 };
 draw();
}
