// Evidências das execuções: fotos vinculadas ao registro, sem repetir dados da OS.
const BUCKET="siga-execution-photos",MAX=8*1024*1024,LIMIT=10;
const ACCEPT=new Set(["image/jpeg","image/png","image/webp"]);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function initExecutionPhotos(root,db,{recordId=null,notify=()=>{}}={}){
 let pending=[],existing=[],saving=false,destroyed=false,id=recordId;
 root.innerHTML='<section class="execution-photo-upload"><div class="execution-photo-top"><div><strong>Fotos da execução</strong><small>Vinculadas ao registro e à OS, quando selecionada. Não é necessário digitar novamente data, frente ou atividade.</small></div>'+
 '<label class="btn btn-secondary execution-photo-picker">Adicionar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" data-exec-photo-input></label></div>'+
 '<div data-exec-photo-preview class="execution-photo-grid"></div><div data-exec-photo-saved class="execution-photo-saved"></div></section>';
 const fileInput=root.querySelector("[data-exec-photo-input]"),pendingRoot=root.querySelector("[data-exec-photo-preview]"),savedRoot=root.querySelector("[data-exec-photo-saved]");
 const release=item=>{if(item.url)URL.revokeObjectURL(item.url);};
 const render=()=>{
  pendingRoot.innerHTML=pending.map((item,i)=>'<div class="execution-photo-tile"><img src="'+esc(item.url)+'" alt="Prévia da foto selecionada">'+
   '<small>'+esc(item.file.name)+' · '+(item.file.size/1048576).toFixed(1)+' MB</small>'+
   '<button type="button" class="table-action" data-exec-photo-remove="'+i+'">Retirar</button></div>').join("");
 };
 fileInput.onchange=()=>{
  for(const file of Array.from(fileInput.files||[])){
   if(pending.length>=LIMIT){notify("Limite de "+LIMIT+" fotos por envio.",true);break;}
   if(!ACCEPT.has(file.type)||file.size<1||file.size>MAX){notify("Foto "+file.name+": use JPG, PNG ou WebP de até 8 MB.",true);continue;}
   pending.push({file,url:URL.createObjectURL(file)});
  }
  fileInput.value="";render();
 };
 pendingRoot.onclick=e=>{
  const button=e.target.closest("[data-exec-photo-remove]");
  if(!button||saving)return;
  const index=Number(button.dataset.execPhotoRemove);
  if(!Number.isInteger(index)||index<0||index>=pending.length)return;
  release(pending[index]);pending.splice(index,1);render();
 };
 async function reload(record){
  id=record;
  const result=await db.from("field_execution_photos").select("id,storage_path,original_name,created_at").eq("execution_entry_id",record).order("created_at",{ascending:false}).limit(100);
  if(result.error)throw result.error;
  if(destroyed)return;
  existing=result.data||[];
  const urls=await Promise.all(existing.map(x=>db.storage.from(BUCKET).createSignedUrl(x.storage_path,3600)));
  if(destroyed)return;
  savedRoot.innerHTML=existing.length?'<strong>Fotos já vinculadas ('+existing.length+')</strong>'+
   '<div class="execution-photo-grid">'+existing.map((x,i)=>'<div class="execution-photo-tile">'+
    (urls[i]?.data?.signedUrl?'<a href="'+esc(urls[i].data.signedUrl)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(urls[i].data.signedUrl)+'" alt="Foto anexada"></a>':"<span>Imagem indisponível</span>")+
    '<small>'+esc(x.original_name)+'</small></div>').join("")+'</div>':"";
 }
 const validate=()=>{
  if(pending.length>LIMIT)throw Error("Limite de "+LIMIT+" fotos por envio.");
  return true;
 };
 async function savePhotos(record){
  if(!pending.length)return 0;
  validate();saving=true;fileInput.disabled=true;
  let count=0;
  try{
   for(const item of [...pending]){
    const ext=item.file.type==="image/png"?"png":item.file.type==="image/webp"?"webp":"jpg";
    const path=record+"/"+crypto.randomUUID()+"."+ext;
    const upload=await db.storage.from(BUCKET).upload(path,item.file,{contentType:item.file.type,upsert:false});
    if(upload.error)throw Error("Falha ao enviar "+item.file.name+": "+upload.error.message);
    const result=await db.from("field_execution_photos").insert({execution_entry_id:record,storage_path:path,original_name:item.file.name.slice(0,200),content_type:item.file.type,file_size_bytes:item.file.size});
    if(result.error){
     try{await db.storage.from(BUCKET).remove([path]);}catch{}
     throw Error("Não foi possível vincular "+item.file.name+": "+result.error.message);
    }
    count++;pending.splice(pending.indexOf(item),1);release(item);render();
   }
   await reload(record);
   return count;
  }finally{saving=false;fileInput.disabled=false;}
 }
 if(recordId)reload(recordId).catch(e=>notify("Falha ao carregar fotos: "+e.message,true));
 return {hasPending:()=>pending.length>0,validate,savePhotos,destroy:()=>{destroyed=true;pending.forEach(release);pending=[];root.replaceChildren();}};
}
