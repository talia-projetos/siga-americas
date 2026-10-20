// SIGA · Conferência simplificada de quantitativos da especificação técnica.
// Quantidade contratual somente leitura; o inventário observado é registrado separadamente.
const html=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pt=v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(Number(v||0));
const tabs=[
 {id:"ferramenta",title:"Ferramentas",ref:"Tabela 05 · item 6.4"},
 {id:"veiculo",title:"Veículos",ref:"Item 6.1"},
 {id:"equipamento",title:"Equipamentos",ref:"Item 6.2 e fornecimento Itaipu"}
];
const order=rows=>rows.sort((a,b)=>{
 const ta=Number((String(a.source_ref).match(/(?:nº |n.º |Tabela 05 nº )(\d+)/)||[])[1]);
 const tb=Number((String(b.source_ref).match(/(?:nº |n.º |Tabela 05 nº )(\d+)/)||[])[1]);
 if(Number.isFinite(ta)&&Number.isFinite(tb))return ta-tb;
 return String(a.item_name).localeCompare(String(b.item_name),"pt-BR");
});
function classification(row){
 if(row.observed_quantity===null||row.observed_quantity===undefined)return {label:"A conferir",kind:"pending",difference:null};
 const delta=Number(row.observed_quantity)-Number(row.required_quantity||0);
 if(delta<0)return {label:"Faltam "+pt(-delta),kind:"missing",difference:delta};
 if(delta>0)return {label:"+"+pt(delta)+" excedentes",kind:"extra",difference:delta};
 return {label:"Igual à referência",kind:"match",difference:0};
}
export async function mountInventoryCheck(root,db,{notify}){
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Consultando quantitativos previstos...</p></div>';
 const {data,error}=await db.from("contract_resource_requirements")
 .select("id,category,item_name,required_quantity,observed_quantity,unit,source_ref,provider_party,inventory_note,quantity_checked_at")
 .in("category",["ferramenta","veiculo","equipamento"]).limit(400);
 if(error){root.textContent="Não foi possível carregar a conferência: "+error.message;return}
 const details=await Promise.allSettled([
  db.from("vehicles").select("id,plate,chassis,seal_number,description,verification_status,contract_resource_requirement_id").limit(500),
  db.from("equipment").select("id,asset_tag,seal_number,serial_number,name,verification_status,contract_resource_requirement_id").limit(500)
 ]);
 const individual={
  veiculo:details[0].status==="fulfilled"&&!details[0].value.error?details[0].value.data||[]:null,
  equipamento:details[1].status==="fulfilled"&&!details[1].value.error?details[1].value.data||[]:null
 };
 let rows=data||[],active="ferramenta",query="",provider="all",modified=new Set();
 const sorted=()=>order(rows.filter(r=>r.category===active&&(provider==="all"||r.provider_party===provider)&&[r.item_name,r.source_ref].some(s=>String(s||"").toLocaleLowerCase("pt-BR").includes(query))));
 function draw(){
  const group=rows.filter(r=>r.category===active&&(provider==="all"||r.provider_party===provider));
  const visible=sorted();
  const types=group.length,checked=group.filter(r=>r.observed_quantity!==null&&r.observed_quantity!==undefined).length;
  const expected=group.reduce((v,r)=>v+Number(r.required_quantity||0),0);
  const observed=group.reduce((v,r)=>v+Number(r.observed_quantity||0),0);
  const missing=group.filter(r=>classification(r).kind==="missing").length;
  const tabsHTML=tabs.map(t=>'<button type="button" class="inventory-tab '+(active===t.id?'active':'')+'" data-inventory-tab="'+t.id+'">'+html(t.title)+' <small>'+rows.filter(r=>r.category===t.id).length+'</small></button>').join("");
  const assets=individual[active];
  const assetSummary=active==="ferramenta"?"":assets===null?'<div class="notice">Identificação individual indisponível com o perfil atual.</div>':
   '<section class="inventory-asset-section"><div class="inventory-asset-heading"><div><span class="eyebrow">RASTREABILIDADE</span><h3>Identificação individual dos '+(active==="veiculo"?"veículos":"equipamentos")+'</h3><p>'+assets.length+' cadastro(s) individualizados; não confundir com quantidade declarada. A indicação de conferido exige data e referência da evidência.</p></div><button type="button" class="btn btn-secondary" data-nav="'+(active==="veiculo"?"vehicles":"equipment")+'">Abrir cadastro individual ↗</button></div>'+
   (assets.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Bem</th><th>'+(active==="veiculo"?"Placa / chassi":"Patrimônio / série")+'</th><th>Lacre</th><th>Verificação</th></tr></thead><tbody>'+assets.map(a=>'<tr><td>'+html(a.description||a.name||"Não informado")+'</td><td>'+html([a.plate||a.asset_tag,a.chassis||a.serial_number].filter(Boolean).join(" · ")||"A conferir")+'</td><td>'+html(a.seal_number||"—")+'</td><td>'+html(a.verification_status==="conferido"?"Conferido":a.verification_status==="divergente"?"Divergente":"A conferir")+'</td></tr>').join("")+'</tbody></table></div>':
   '<p class="inventory-asset-empty">Ainda não há bens cadastrados individualmente nesta categoria. Os quantitativos declarados acima não comprovam identificação, disponibilidade ou vistoria.</p>')+'</section>';
  root.innerHTML='<div class="inventory-intro"><div><span class="eyebrow">INVENTÁRIO · CONFERÊNCIA INICIAL</span><h2>Quantitativos previstos × encontrados</h2><p>Valores contratuais e quantitativos declarados. Registre separadamente a identificação de cada veículo ou máquina e sua conferência física.</p></div></div>'+
  '<div class="inventory-tabs">'+tabsHTML+'</div>'+
  '<div class="catalog-stats inventory-kpis">'+
  '<div class="catalog-stat"><span>Tipos previstos</span><strong>'+types+'</strong><small>'+checked+' com quantidade informada</small></div>'+
  '<div class="catalog-stat"><span>Unidades previstas</span><strong>'+pt(expected)+'</strong><small>Indicativo contratual</small></div>'+
  '<div class="catalog-stat"><span>Unidades contabilizadas</span><strong>'+pt(observed)+'</strong><small>Valores declarados até agora</small></div>'+
  '<div class="catalog-stat"><span>Tipos com quantidade inferior</span><strong>'+missing+'</strong><small>Somente entre os já conferidos</small></div></div>'+
  '<div class="inventory-progress" role="meter" aria-label="Tipos com quantidade informada" aria-valuemin="0" aria-valuemax="'+types+'" aria-valuenow="'+checked+'"><div class="inventory-progress-bar" style="width:'+(types?100*checked/types:0).toFixed(1)+'%"></div></div>'+
  '<div class="notice inventory-note">A coluna <strong>quantidade contratual</strong> não pode ser alterada nesta tela. Quantidades declaradas não comprovam vistoria, funcionamento, regularidade documental ou conformidade técnica. Faça a conferência individual em Veículos e Frota ou Ferramentas e Máquinas.</div>'+
  '<div class="inventory-controls"><input id="inventory-search" class="searchbox" type="search" placeholder="Buscar item da relação…" value="'+html(query)+'" aria-label="Buscar recurso"><label>Fornecimento <select id="inventory-provider"><option value="all"'+(provider==="all"?" selected":"")+'>Todos</option><option value="proerg"'+(provider==="proerg"?" selected":"")+'>PROERG</option><option value="itaipu"'+(provider==="itaipu"?" selected":"")+'>Itaipu</option></select></label><span class="muted">'+visible.length+' item(ns)</span></div>'+
  '<div class="table-panel inventory-table-wrap"><div class="table-scroll"><table class="data-table inventory-table"><thead><tr><th>Nº / item</th><th>Descrição</th><th>Exigido</th><th>Encontrado</th><th>Diferença</th><th>Notas da conferência</th><th>Ação</th></tr></thead><tbody>'+
  (visible.length?visible.map(r=>{
   const state=classification(r),number=r.category==="ferramenta"?(String(r.source_ref).match(/\d+$/)||[""])[0]:r.source_ref;
   return '<tr data-inventory-row="'+html(r.id)+'"><td><span class="catalog-code">'+html(number)+'</span></td><td><div class="inventory-resource-name">'+html(r.item_name)+'</div><span class="inventory-source">'+html(r.provider_party==="itaipu"?"Itaipu":r.provider_party==="proerg"?"PROERG":"A confirmar")+'</span></td><td><strong>'+html(pt(r.required_quantity))+'</strong><small>'+html(r.unit||"un")+'</small></td><td><label class="sr-only" for="qty-'+html(r.id)+'">Quantidade encontrada de '+html(r.item_name)+'</label><input id="qty-'+html(r.id)+'" class="inventory-qty" data-qty type="number" min="0" step="1" placeholder="—" value="'+(r.observed_quantity===null||r.observed_quantity===undefined?"":html(r.observed_quantity))+'"></td><td><span class="inventory-status '+state.kind+'">'+html(state.label)+'</span></td><td><label class="sr-only" for="note-'+html(r.id)+'">Observações de '+html(r.item_name)+'</label><input class="inventory-row-note" id="note-'+html(r.id)+'" data-note maxlength="450" value="'+html(r.inventory_note||"")+'" placeholder="Opcional"></td><td><button type="button" class="btn btn-secondary inventory-save" data-save-resource="'+html(r.id)+'">Salvar</button></td></tr>';
  }).join(""):'<tr><td colspan="7"><div class="empty-state">Nenhum item corresponde aos filtros selecionados.</div></td></tr>')+
  '</tbody></table></div></div>'+assetSummary+'<p class="inventory-footer">As quantidades indicativas e as especificações dos equipamentos podem ter observações ou condições complementares nos itens 6.1, 6.2 e 6.4 do contrato. Consulte também os documentos de vistoria e patrimônio.</p>';
  root.querySelectorAll("[data-inventory-tab]").forEach(btn=>btn.addEventListener("click",()=>{active=btn.dataset.inventoryTab;query="";draw()}));
  root.querySelector("#inventory-search").addEventListener("input",e=>{query=e.target.value.toLocaleLowerCase("pt-BR");const focus=e.target.selectionStart;draw();const inp=root.querySelector("#inventory-search");inp.focus();inp.setSelectionRange(focus,focus)});
  root.querySelector("#inventory-provider").addEventListener("change",e=>{provider=e.target.value;draw()});
  root.querySelectorAll("[data-save-resource]").forEach(btn=>btn.addEventListener("click",async()=>{
   const rowNode=btn.closest("[data-inventory-row]"),item=rows.find(x=>x.id===btn.dataset.saveResource);
   const inp=rowNode.querySelector("[data-qty]"),value=inp.value.trim(),note=rowNode.querySelector("[data-note]").value.trim();
   if(value===""||!Number.isInteger(Number(value))||Number(value)<0){notify("Informe uma quantidade inteira de 0 ou mais. Para não conferido, deixe o registro como está.",true);return;}
   btn.disabled=true;btn.textContent="Salvando…";
   const payload={observed_quantity:Number(value),inventory_note:note||null,quantity_checked_at:new Date().toISOString()};
   const result=await db.from("contract_resource_requirements").update(payload).eq("id",item.id).select("id,observed_quantity,inventory_note,quantity_checked_at").single();
   if(result.error){notify(result.error.message,true);btn.disabled=false;btn.textContent="Salvar";return;}
   Object.assign(item,result.data);notify("Quantidade de "+item.item_name+" registrada.");redrawKeepingPosition();
  }));
 }
 // Ao atualizar uma linha, manter aba, pesquisa, fornecedor e posição na lista.
 function redrawKeepingPosition(){
  const workspace=root.closest(".workspace"),main=root.closest("#main");
  const winY=window.scrollY,workY=workspace?.scrollTop||0,mainY=main?.scrollTop||0;
  const left=root.querySelector(".inventory-table-wrap .table-scroll")?.scrollLeft||0;
  draw();
  requestAnimationFrame(()=>{
   if(!root.isConnected)return;
   if(workspace)workspace.scrollTop=workY;
   if(main)main.scrollTop=mainY;
   const table=root.querySelector(".inventory-table-wrap .table-scroll");
   if(table)table.scrollLeft=left;
   window.scrollTo(0,winY);
  });
 }
 draw();
}
