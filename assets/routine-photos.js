// SIGA Américas · Evidências fotográficas dos checklists dos postos fixos.
// Cada foto tem metadados explícitos: data/hora, latitude/longitude em graus
// decimais e origem das coordenadas. Nunca deduz GPS ou hora real do EXIF.
const BUCKET="siga-routine-photos";
const MAX_FILE_SIZE=8*1024*1024;
const MAX_PENDING=10;
const MIME=new Set(["image/jpeg","image/png","image/webp"]);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate=date=>{
 const d=new Date(date);
 return Number.isNaN(d.getTime())?"Data não informada":d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
};
function localDatetime(date=new Date()){
 const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return d.toISOString().slice(0,16);
}
function decimal(value){
 const raw=String(value??"").trim().replace(",",".");
 if(!raw)return null;
 const n=Number(raw);
 return Number.isFinite(n)?n:null;
}
export function initRoutinePhotoField(root,db,{recordId=null,notify=()=>{}}={}){
 let linkedId=recordId,removed=false,saved=[],pending=[],busy=false;
 root.innerHTML='<fieldset class="routine-photo-fieldset"><legend>Fotos e localização da rotina</legend>'+
  '<p class="routine-photo-guide">Anexe até '+MAX_PENDING+' fotos por envio (JPG, PNG ou WebP, até 8 MB por foto). Cada imagem recebe <strong>data, hora, latitude e longitude em graus decimais</strong>. Informe a data/hora correspondente à foto; o valor inicial é o momento da seleção do arquivo, não uma leitura automática do EXIF.</p>'+
  '<div class="routine-photo-actions"><label class="btn btn-secondary routine-photo-picker">Adicionar fotos <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple data-routine-photo-select></label>'+
  '<button class="btn btn-secondary" type="button" data-routine-photo-gps>Obter coordenadas do aparelho</button></div>'+
  '<p class="routine-photo-message" data-routine-photo-message>O uso da localização depende da permissão do aparelho. Se não estiver disponível, preencha as coordenadas manualmente. Fotos só serão enviadas quando o checklist for salvo.</p>'+
  '<div class="routine-photo-list" data-routine-pending></div>'+
  '<div class="routine-photo-existing"><strong>Fotos já vinculadas ao checklist</strong><div data-routine-saved>Nenhuma foto vinculada.</div></div>'+
  '</fieldset>';
 const pendingBox=root.querySelector("[data-routine-pending]");
 const savedBox=root.querySelector("[data-routine-saved]");
 const picker=root.querySelector("[data-routine-photo-select]");
 const gps=root.querySelector("[data-routine-photo-gps]");
 const status=root.querySelector("[data-routine-photo-message]");
 function message(text){status.textContent=text;}
 function release(item){if(item.previewUrl)URL.revokeObjectURL(item.previewUrl);}
 function paintPending(){
  pendingBox.innerHTML=pending.map((item,index)=>
   '<div class="routine-photo-entry" data-routine-index="'+index+'">'+
    '<div class="routine-photo-entry-head"><img class="routine-photo-thumb" src="'+esc(item.previewUrl)+'" alt="Pré-visualização da foto">'+
    '<div><strong>'+esc(item.file.name)+'</strong><small>'+esc((item.file.size/1024/1024).toFixed(2))+' MB · aguardando salvamento</small></div>'+
    '<button class="btn btn-ghost" type="button" data-routine-remove="'+index+'" aria-label="Retirar foto '+(index+1)+'">Retirar</button></div>'+
    '<div class="routine-photo-fields">'+
     '<label>Data e hora da foto<input type="datetime-local" data-photo-field="taken" value="'+esc(item.taken)+'" required></label>'+
     '<label>Latitude (graus decimais)<input type="text" inputmode="decimal" data-photo-field="lat" placeholder="Ex.: -25,5112345" value="'+esc(item.lat)+'" required></label>'+
     '<label>Longitude (graus decimais)<input type="text" inputmode="decimal" data-photo-field="lon" placeholder="Ex.: -54,6123456" value="'+esc(item.lon)+'" required></label></div>'+
    '<small class="routine-photo-origin">'+(item.source==="device_gps"?
     'Coordenadas do dispositivo'+(item.accuracy!=null?' · precisão aproximada: '+esc(item.accuracy.toFixed(1))+' m':''):
     'Coordenadas preenchidas manualmente / não obtidas')+'</small></div>'
  ).join("");
 }
 async function load(id){
  linkedId=id;
  const {data,error}=await db.from("field_routine_photos")
   .select("id,storage_path,original_name,photo_at,latitude,longitude,position_source,location_accuracy_m,created_at")
   .eq("routine_record_id",id).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;
  if(removed||linkedId!==id)return;
  saved=data||[];
  const urls=await Promise.all(saved.map(async entry=>{
   const result=await db.storage.from(BUCKET).createSignedUrl(entry.storage_path,3600);
   return result.error?null:result.data?.signedUrl;
  }));
  if(removed||linkedId!==id)return;
  savedBox.innerHTML=saved.length?saved.map((entry,i)=>
   '<div class="routine-saved-photo">'+
    (urls[i]?'<a href="'+esc(urls[i])+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(urls[i])+'" alt="Foto da rotina em '+esc(formatDate(entry.photo_at))+'" loading="lazy"></a>':
    '<span>Imagem indisponível para visualização</span>')+
    '<div><strong>'+esc(entry.original_name)+'</strong><small>Data/hora informadas: '+esc(formatDate(entry.photo_at))+'</small>'+
    '<small>Latitude: '+Number(entry.latitude).toFixed(7)+'° · Longitude: '+Number(entry.longitude).toFixed(7)+'°</small>'+
    '<small>Origem: '+(entry.position_source==="device_gps"?"GPS do aparelho":"Preenchimento manual")+
    (entry.location_accuracy_m!=null?" · precisão aprox. "+Number(entry.location_accuracy_m).toFixed(1)+" m":"")+'</small></div>'+
   '</div>').join(""):"Nenhuma foto vinculada.";
 }
 function validate(){
  if(pending.length>MAX_PENDING)throw Error("Selecione no máximo "+MAX_PENDING+" fotos por envio.");
  for(let i=0;i<pending.length;i++){
   const x=pending[i];
   const when=new Date(x.taken);
   if(!x.taken||Number.isNaN(when.getTime()))throw Error("Informe a data/hora válida da foto "+(i+1)+".");
   const lat=decimal(x.lat),lon=decimal(x.lon);
   if(lat===null||lat<-90||lat>90||lon===null||lon<-180||lon>180)
    throw Error("Informe latitude (-90 a 90) e longitude (-180 a 180) em graus decimais para a foto "+(i+1)+".");
  }
  return true;
 }
 root.addEventListener("input",e=>{
  const field=e.target.closest("[data-photo-field]");
  if(!field)return;
  const row=field.closest("[data-routine-index]");
  const item=pending[Number(row?.dataset.routineIndex)];
  if(!item)return;
  const key=field.dataset.photoField;
  if(key==="taken"){item.taken=field.value;item.timeSource="informed";}
  if(key==="lat"||key==="lon"){item[key]=field.value;item.source="manual";item.accuracy=null;}
 });
 root.addEventListener("click",event=>{
  const remove=event.target.closest("[data-routine-remove]");
  if(!remove||busy)return;
  const index=Number(remove.dataset.routineRemove);
  if(!Number.isInteger(index)||index<0||index>=pending.length)return;
  release(pending[index]);pending.splice(index,1);paintPending();
 });
 picker.addEventListener("change",event=>{
  if(busy)return;
  const files=Array.from(event.target.files||[]);
  if(files.length>MAX_PENDING-pending.length){message("Limite de "+MAX_PENDING+" fotos por envio. Retire fotos para adicionar outras.");picker.value="";return;}
  for(const file of files){
   if(!MIME.has(file.type)){notify("Formato não suportado: "+file.name,true);continue;}
   if(file.size<1||file.size>MAX_FILE_SIZE){notify("A foto "+file.name+" deve ter até 8 MB.",true);continue;}
   pending.push({file,previewUrl:URL.createObjectURL(file),taken:localDatetime(),timeSource:"file_selected",
    lat:"",lon:"",source:"manual",accuracy:null});
  }
  picker.value="";
  paintPending();
  if(pending.length)message("Preencha as coordenadas manualmente ou use o botão de GPS antes de salvar.");
 });
 gps.addEventListener("click",()=>{
  if(busy)return;
  if(!pending.length){message("Selecione pelo menos uma foto antes de capturar as coordenadas.");return;}
  if(!navigator.geolocation){message("Geolocalização indisponível neste navegador. Digite as coordenadas.");return;}
  gps.disabled=true;message("Solicitando permissão para obter a posição atual do aparelho...");
  navigator.geolocation.getCurrentPosition(position=>{
   gps.disabled=false;
   const latitude=position.coords.latitude,longitude=position.coords.longitude;
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){message("GPS retornou dados inválidos. Preencha manualmente.");return;}
   pending.forEach(item=>{item.lat=latitude.toFixed(7);item.lon=longitude.toFixed(7);
    item.source="device_gps";item.accuracy=Number.isFinite(position.coords.accuracy)?position.coords.accuracy:null;});
   paintPending();
   message("GPS obtido agora: "+latitude.toFixed(7)+"°, "+longitude.toFixed(7)+"°. Confirme se essa posição corresponde ao local das fotos.");
  },error=>{
   gps.disabled=false;
   message(error.code===1?"Permissão de localização negada. Preencha latitude e longitude manualmente.":
    "Não foi possível obter a localização. Confira o GPS ou informe as coordenadas manualmente.");
  },{enableHighAccuracy:true,timeout:18000,maximumAge:0});
 });
 async function savePhotos(id){
  if(!pending.length)return 0;
  validate();
  busy=true;picker.disabled=true;gps.disabled=true;
  let savedCount=0;
  try{
   for(const item of [...pending]){
    const extension=item.file.type==="image/png"?"png":item.file.type==="image/webp"?"webp":"jpg";
    const path=id+"/"+crypto.randomUUID()+"."+extension;
    const upload=await db.storage.from(BUCKET).upload(path,item.file,{contentType:item.file.type,upsert:false});
    if(upload.error)throw new Error("Falha ao enviar "+item.file.name+": "+upload.error.message);
    const payload={
     routine_record_id:id,storage_path:path,original_name:item.file.name.slice(0,200),
     content_type:item.file.type,file_size_bytes:item.file.size,photo_at:new Date(item.taken).toISOString(),
     photo_time_source:item.timeSource,latitude:decimal(item.lat),longitude:decimal(item.lon),
     position_source:item.source,location_accuracy_m:item.source==="device_gps"?item.accuracy:null
    };
    const result=await db.from("field_routine_photos").insert(payload);
    if(result.error){
     await db.storage.from(BUCKET).remove([path]).catch(()=>{});
     throw new Error("Falha ao vincular "+item.file.name+": "+result.error.message);
    }
    savedCount++;
    pending.splice(pending.indexOf(item),1);
    release(item);
    paintPending();
   }
   await load(id);
   message(savedCount+" foto(s) vinculada(s) ao checklist com data, hora e coordenadas.");
   return savedCount;
  }finally{busy=false;picker.disabled=false;gps.disabled=false;}
 }
 if(recordId)load(recordId).catch(error=>notify("Não foi possível carregar as fotos vinculadas: "+error.message,true));
 return {validate,savePhotos,hasPending:()=>pending.length>0,destroy:()=>{
  removed=true;pending.forEach(release);pending=[];root.replaceChildren();
 }};
}
