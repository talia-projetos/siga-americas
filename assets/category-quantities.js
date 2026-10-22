// Conferência de quantidades no contexto de cada categoria, sem duplicar fontes.
const html=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>v==null||v===""?"—":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:3});
const toNumber=v=>String(v).trim()===""?null:Number(String(v).replace(",","."));
const sections={veiculo:"Frota contratual",ferramenta:"Ferramentas",equipamento:"Equipamentos",epi:"Proteção e segurança"};
const refSort=(a,b)=>{
 const x=Number((String(a.source_ref).match(/(?:nº\s*|n.º\s*|Tabela 05\s*nº\s*)(\d+)/i)||[])[1]);
 const y=Number((String(b.source_ref).match(/(?:nº\s*|n.º\s*|Tabela 05\s*nº\s*)(\d+)/i)||[])[1]);
 return Number.isFinite(x)&&Number.isFinite(y)?x-y:String(a.item_name).localeCompare(String(b.item_name),"pt-BR",{numeric:true});
};
const counted=row=>row.observed_quantity!==null&&row.observed_quantity!==undefined;
export async function mountCategoryQuantities(root,db,{categories,canWrite=false,notify,individuals=0}){
 const requested=categories||[];
 root.innerHTML='<div class="loading-page"><div class="loader"></div><p>Carregando referência contratual…</p></div>';
 const {data,error}=await db.from("contract_resource_requirements")
  .select("id,item_name,category,required_quantity,observed_quantity,unit,source_ref,provider_party,inventory_note,validation_status,review_status,quantity_checked_at")
  .in("category",requested).limit(300);
 if(error){root.innerHTML='<div class="notice warning">Não foi possível consultar os quantitativos: '+html(error.message)+'</div>';return}
 const rows=(data||[]).sort((a,b)=>a.category.localeCompare(b.category)||refSort(a,b));
 let search="";
 const moneyWarning="Os valores encontrados são registros declarados. Somente uma conferência física marcada e documentada indica vistoria; não altera a obrigação contratual.";
 const isFleet=requested.length===1&&requested[0]==="veiculo";
 const draw=()=>{
  const informed=rows.filter(counted).length,verified=rows.filter(r=>r.quantity_checked_at&&counted(r)).length;
  const noQty=rows.length-informed;
  const list=rows.filter(r=>(r.item_name+" "+r.source_ref+" "+r.category).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const open=isFleet||requested.includes("equipamento");
  root.innerHTML='<section class="category-quantity-overview" aria-label="Quantidades da categoria">'+
   '<div class="category-quantity-summary"><div><span class="eyebrow">REFERÊNCIA CONTRATUAL · CONFERÊNCIA POR ÁREA</span><h2>'+html(requested.map(k=>sections[k]).join(" e "))+'</h2>'+
   '<p>Quantidades previstas, informadas e verificadas em campo, sem duplicar o cadastro de bens ou as movimentações de estoque.</p></div>'+
   '<div class="category-quantity-kpis"><div><strong>'+rows.length+'</strong><small>tipos previstos</small></div><div><strong>'+informed+'</strong><small>com quantidade informada</small></div><div><strong>'+verified+'</strong><small>conferências documentadas</small></div><div><strong>'+noQty+'</strong><small>sem quantidade informada</small></div></div></div>'+
   (isFleet?'<p class="category-quantity-context">Veículos individualizados: <strong>'+num(individuals)+'</strong>. A quantidade informada por tipo não substitui placa, chassi ou patrimônio.</p>':"")+
   '<details class="category-quantity-details"'+(open?' open':'')+'><summary>Verificar quantidades por tipo e registrar conferência ('+rows.length+' itens)</summary>'+
   '<div class="category-quantity-controls"><input class="searchbox" type="search" data-quantity-search value="'+html(search)+'" placeholder="Buscar item contratual…" aria-label="Buscar item da conferência"><span>'+list.length+' de '+rows.length+' itens</span></div>'+
   '<div class="table-scroll"><table class="category-quantity-table"><thead><tr><th>Referência e item</th><th>Previsto</th><th>Informado</th><th>Conferência</th><th>Observações / evidência</th>'+(canWrite?'<th>Ação</th>':"")+'</tr></thead><tbody>'+
   (list.length?list.map(r=>'<tr data-qrow="'+html(r.id)+'">'+
    '<td><strong>'+html(r.item_name)+'</strong><small>'+html(r.source_ref||"—")+' · '+html(sections[r.category]||r.category)+'</small></td>'+
    '<td class="numeric-cell">'+num(r.required_quantity)+' <small>'+html(r.unit||"un")+'</small></td>'+
    '<td><input type="number" min="0" step="any" inputmode="decimal" data-quantity-observed aria-label="Quantidade informada de '+html(r.item_name)+'" placeholder="A informar" value="'+(counted(r)?html(r.observed_quantity):"")+'" '+(canWrite?"":"disabled")+'></td>'+
    '<td><label class="quantity-confirm-label"><input type="checkbox" data-quantity-verify '+(canWrite?"":"disabled")+'><span>'+(r.quantity_checked_at?"Reconfirmar vistoria":"Conferi fisicamente")+'</span></label>'+
     '<small>'+(r.quantity_checked_at?'Última conferência: '+new Date(r.quantity_checked_at).toLocaleDateString("pt-BR"):'Não comprovada')+'</small></td>'+
    '<td><input data-quantity-note maxlength="450" aria-label="Observações de '+html(r.item_name)+'" placeholder="Local, data, referência da evidência" value="'+html(r.inventory_note||"")+'" '+(canWrite?"":"disabled")+'></td>'+
    (canWrite?'<td><button type="button" class="btn btn-secondary" data-save-quantity="'+html(r.id)+'">Salvar</button>'+
       (isFleet?'<button type="button" class="table-action" data-fleet-add="'+html(r.id)+'">Identificar veículo</button>':"")+'</td>':"")+
    '</tr>').join(""):'<tr><td colspan="'+(canWrite?6:5)+'">Nenhum item corresponde à pesquisa.</td></tr>')+
   '</tbody></table></div><p class="category-quantity-foot">'+moneyWarning+'</p></details></section>';
  const searchInput=root.querySelector("[data-quantity-search]");
  searchInput?.addEventListener("input",e=>{
   search=e.target.value;
   const start=searchInput.selectionStart;
   draw();
   const next=root.querySelector("[data-quantity-search]");
   next?.focus();try{next?.setSelectionRange(start,start)}catch{}
  });
  root.querySelectorAll("[data-save-quantity]").forEach(b=>b.onclick=async()=>{
   const entry=rows.find(r=>r.id===b.dataset.saveQuantity),tr=b.closest("tr");
   const raw=tr.querySelector("[data-quantity-observed]").value;
   const observed_quantity=toNumber(raw),check=tr.querySelector("[data-quantity-verify]").checked;
   const inventory_note=tr.querySelector("[data-quantity-note]").value.trim();
   if(observed_quantity!==null&&(!Number.isFinite(observed_quantity)||observed_quantity<0)){notify("Informe quantidade válida e não negativa.",true);return}
   if(check&&observed_quantity===null){notify("Informe a quantidade encontrada antes de confirmar vistoria.",true);return}
   if(check&&inventory_note.length<5){notify("Descreva a evidência ou o local da vistoria para confirmar a quantidade.",true);return}
   const changed=String(entry.observed_quantity??"")!==String(observed_quantity??"");
   const payload={
    observed_quantity,inventory_note:inventory_note||null,
    quantity_checked_at:check?new Date().toISOString():changed?null:entry.quantity_checked_at,
    review_status:check?"validado":"a_conferir",
    validation_status:check&&entry.required_quantity!=null?(observed_quantity<Number(entry.required_quantity)?"faltante":"conforme"):"a_conferir"
   };
   b.disabled=true;
   try{
    const {error}=await db.from("contract_resource_requirements").update(payload).eq("id",entry.id);
    if(error)throw error;
    Object.assign(entry,payload);notify("Quantidade salva na categoria. "+(check?"Vistoria registrada.":"Pendente de confirmação física."));
    const sc=window.scrollY;draw();window.scrollTo({top:sc});
   }catch(e){notify("Erro ao salvar: "+(e.message||String(e)),true)}finally{b.disabled=false}
  });
 };
 draw();
}
