// Veículos reais devem ser individualizados antes de vinculados a Termos.
// Quantidades da tabela contratual não geram identificações fictícias.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const desc=v=>[v.plate||v.chassis||v.asset_tag||"Sem identificação",v.description].filter(Boolean).join(" · ");
export function mountQuickVehicle(root,{db,notify,onCreated,knownVehicles=[]}){
 const select=root.querySelector("#fld-vehicle_id"),equipment=root.querySelector("#fld-equipment_id");
 if(!select)return;
 const field=select.closest(".field");
 const box=document.createElement("div");
 box.className="responsibility-vehicle-helper";
 box.innerHTML='<div class="responsibility-vehicle-help-copy"><strong>Veículo não encontrado?</strong>'+
 '<p>O termo utiliza cadastros <b>individuais</b> com placa, chassi ou patrimônio. Quantidades informadas na lista contratual não equivalem a veículos identificados.</p></div>'+
 '<button type="button" class="btn btn-secondary" data-quick-vehicle-toggle aria-controls="quick-vehicle-fields" aria-expanded="false">Cadastrar veículo individual</button>'+
 '<div class="responsibility-vehicle-quick-form" id="quick-vehicle-fields" hidden>'+
 '<p>Informe os dados existentes. O veículo permanecerá <b>pendente de conferência</b>.</p>'+
 '<div class="responsibility-vehicle-quick-grid">'+
 '<label>Modelo / descrição *<input type="text" data-qv="description" placeholder="Ex.: Caminhonete 4×4"></label>'+
 '<label>Placa<input type="text" data-qv="plate" placeholder="ABC1D23"></label>'+
 '<label>Chassi / série<input type="text" data-qv="chassis"></label>'+
 '<label>Patrimônio<input type="text" data-qv="asset_tag"></label>'+
 '<label>Lacre (opcional)<input type="text" data-qv="seal_number"></label>'+
 '</div><p class="responsibility-vehicle-validation">Informe ao menos placa, chassi ou patrimônio. Lacre isolado não é identificação suficiente.</p>'+
 '<button type="button" class="btn btn-primary" data-qv-save>Cadastrar e selecionar</button></div>';
 field?.insertAdjacentElement("afterend",box);
 const fields=box.querySelector("#quick-vehicle-fields"),toggle=box.querySelector("[data-quick-vehicle-toggle]"),btn=box.querySelector("[data-qv-save]");
 toggle.onclick=()=>{
  fields.hidden=!fields.hidden;
  toggle.setAttribute("aria-expanded",String(!fields.hidden));
  if(!fields.hidden)fields.querySelector('[data-qv="description"]')?.focus();
 };
 // Um Termo associa OU veículo OU equipamento, não ambos.
 select.onchange=()=>{if(select.value&&equipment)equipment.value="";};
 if(equipment)equipment.onchange=()=>{if(equipment.value)select.value="";};
 btn.onclick=async()=>{
  const read=key=>fields.querySelector('[data-qv="'+key+'"]')?.value.trim()||"";
  const description=read("description"),plate=read("plate").toUpperCase(),chassis=read("chassis").toUpperCase(),asset_tag=read("asset_tag"),seal_number=read("seal_number");
  if(!description){notify("Informe modelo ou descrição do veículo.",true);return;}
  if(![plate,chassis,asset_tag].some(Boolean)){notify("Informe placa, chassi ou patrimônio para individualizar o veículo.",true);return;}
  btn.disabled=true;btn.textContent="Conferindo cadastro...";
  try{
   let existing=null;
   for(const [key,value] of [["plate",plate],["chassis",chassis],["asset_tag",asset_tag]]){
    if(!value)continue;
    const {data,error}=await db.from("vehicles").select("*").eq(key,value).limit(1);
    if(error)throw error;
    if(data?.length){existing=data[0];break;}
   }
   const record=existing||await (async()=>{
    const {data,error}=await db.from("vehicles").insert({
     description,plate:plate||null,chassis:chassis||null,asset_tag:asset_tag||null,
     seal_number:seal_number||null,status:"a_conferir",verification_status:"a_conferir"
    }).select("*").single();
    if(error)throw error;
    return data;
   })();
   onCreated?.(record);
   if(!select.querySelector('option[value="'+record.id+'"]')){
    const opt=document.createElement("option");opt.value=record.id;opt.textContent=desc(record);select.add(opt);
   }
   if(select.options[0])select.options[0].textContent="Selecione...";
   select.value=record.id;
   if(equipment)equipment.value="";
   fields.hidden=true;toggle.setAttribute("aria-expanded","false");
   notify(existing?"Veículo já cadastrado selecionado. Confira os dados.":"Veículo cadastrado como pendente de conferência e selecionado no termo.");
  }catch(e){notify("Erro ao individualizar veículo: "+String(e?.message||e),true);}
  finally{btn.disabled=false;btn.textContent="Cadastrar e selecionar";}
 };
}
