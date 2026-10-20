// SIGA Américas · Mapa da ciclovia da Vila A.
// Base online OSM + geometria real importada; nunca gera rota pela extensão divulgada.
const VIEW = [-25.49882, -54.56669]; // localização geral do bairro Vila A (OpenStreetMap)
const REF_METERS = 4800;
const GEO_SOURCE = "https://clickfozdoiguacu.com.br/ciclovia-calcamento-e-paisagismo-transformam-vila-a-num-grande-parque-a-ceu-aberto/";
const human = value => new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(value);
const escape = text => String(text??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pointValid = p => Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)&&
 p[0]>-54.85&&p[0]<-54.35&&p[1]>-25.7&&p[1]<-25.2;
const distance = (a,b) => {
 const radians=Math.PI/180, dLat=(b[1]-a[1])*radians, dLon=(b[0]-a[0])*radians;
 const sine=Math.sin(dLat/2)**2+Math.cos(a[1]*radians)*Math.cos(b[1]*radians)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(sine)));
};
function cleanGeometry(input){
 const sets=Array.isArray(input)?input:[input];
 const features=[];
 for(const collection of sets){
  const original=collection?.type==="FeatureCollection"?collection.features:
   collection?.type==="Feature"?[collection]:[];
  for(const f of original){
   const geometry=f?.geometry;
   if(!["LineString","MultiLineString"].includes(geometry?.type))continue;
   const parts=geometry.type==="LineString"?[geometry.coordinates]:geometry.coordinates;
   if(!Array.isArray(parts)||!parts.length)continue;
   if(!parts.every(part=>Array.isArray(part)&&part.length>=2&&part.every(pointValid))){
    throw Error("Geometria inválida ou fora da região de Foz do Iguaçu. Inclua o .prj no Shapefile.");
   }
   features.push({type:"Feature",properties:{
    origem:String(f.properties?.origem||"Ciclovia Vila A").slice(0,80),
    trecho:String(f.properties?.trecho||"").slice(0,100)
   },geometry:{type:geometry.type,coordinates:geometry.coordinates}});
  }
 }
 if(!features.length)throw Error("O arquivo não contém segmentos lineares de ciclovia.");
 const vertexCount=features.reduce((sum,f)=>sum+
  (f.geometry.type==="LineString" ? f.geometry.coordinates.length:
   f.geometry.coordinates.reduce((n,p)=>n+p.length,0)),0);
 if(vertexCount>50000)throw Error("O traçado ultrapassa 50 mil vértices. Simplifique no QGIS antes de importar.");
 return {type:"FeatureCollection",features};
}
function geometryMeters(geo){
 return geo.features.reduce((total,f)=>{
  const parts=f.geometry.type==="LineString"?[f.geometry.coordinates]:f.geometry.coordinates;
  for(const coords of parts)for(let i=1;i<coords.length;i++)total+=distance(coords[i-1],coords[i]);
  return total;
 },0);
}
function saveFile(data,name,type){
 const blob=data instanceof Blob?data:new Blob([data],{type});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export async function mountCicloviaMap(root,db,{canEdit=false,userId=null,notify=()=>{}}={}){
 root.innerHTML=`<div class="ciclo-grid">
  <section class="ciclo-map-panel">
   <div class="ciclo-map-top"><strong>Ciclovia da Vila A</strong><span>Foz do Iguaçu · PR</span></div>
   <div id="ciclo-map" class="ciclo-map" role="region" aria-label="Mapa interativo da Vila A com ciclovia georreferenciada"></div>
   <p class="ciclo-map-foot">Base: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · O traçado só aparece após a inclusão de dados georreferenciados.</p>
  </section>
  <aside class="ciclo-aside">
   <div class="ciclo-stat"><small>Extensão publicada (referência)</small><strong>4,8 km</strong><span>4.800 m · Não corresponde a uma medição SIG.</span></div>
   <div class="ciclo-stat"><small>Extensão calculada da camada</small><strong id="ciclo-measured">—</strong><span id="ciclo-difference">Aguardando geometria georreferenciada.</span></div>
   <div class="ciclo-stat"><small>Segmentos cartográficos</small><strong id="ciclo-segments">—</strong><span id="ciclo-validation">Sem shapefile validado.</span></div>
   <div class="ciclo-status"><strong>Execução: ciclovia pendente</strong><span>Informação operacional. Não indica aprovação de medição nem percentual executado.</span></div>
   <div class="ciclo-tools">
    <h3>Camada da ciclovia</h3>
    <p>Importe o traçado levantado em campo ou digitado no QGIS. Shapefile compactado (.zip contendo .shp, .shx, .dbf e .prj) ou GeoJSON WGS84.</p>
    <label for="ciclo-import" class="ciclo-import-label">Selecionar Shapefile ZIP / GeoJSON</label>
    <input id="ciclo-import" type="file" accept=".zip,.geojson,.json" ${canEdit?"":"disabled"} aria-label="Importar geometria da ciclovia">
    <div class="ciclo-action-row">
     <button type="button" class="btn btn-primary" id="ciclo-save" disabled>Salvar no SIGA</button>
     <button type="button" class="btn btn-secondary" id="ciclo-export" disabled>Baixar Shapefile</button>
     <button type="button" class="btn btn-ghost" id="ciclo-geojson" disabled>GeoJSON</button>
    </div>
    <small id="ciclo-source" class="ciclo-source">Nenhuma camada registrada.</small>
    ${canEdit?"":"<p class='ciclo-readonly'>Somente a gestão e a supervisão podem importar e salvar a camada.</p>"}
   </div>
  </aside>
 </div>
 <p class="ciclo-note">Os <strong>4,8 km</strong> são extensão de referência divulgada em 2020. O desenho esquemático apresentado anteriormente não deve ser utilizado como camada SIG. O percurso poderá ser conferido pela geometria importada. <a href="${GEO_SOURCE}" target="_blank" rel="noopener noreferrer">Consultar fonte</a>.</p>`;
 if(!window.L){
  root.querySelector("#ciclo-map").innerHTML='<div class="notice danger">Biblioteca de mapas indisponível. Verifique a conexão com o serviço cartográfico.</div>';
  return ()=>{};
 }
 const L=window.L,map=L.map(root.querySelector("#ciclo-map"),{zoomControl:true,scrollWheelZoom:false}).setView(VIEW,14);
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom:19
 }).addTo(map);
 L.control.scale({metric:true,imperial:false}).addTo(map);
 let overlay=null,current=null,sourceName="",unsaved=false;
 const get=id=>root.querySelector("#"+id);
 const render=()=>{
  if(overlay){map.removeLayer(overlay);overlay=null;}
  if(current){
   overlay=L.geoJSON(current,{style:{color:"#168c44",weight:6,opacity:.95},interactive:true})
    .bindPopup("Trecho georreferenciado · fonte: "+escape(sourceName)).addTo(map);
   const bounds=overlay.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.17),{maxZoom:17});
   const measured=geometryMeters(current);
   get("ciclo-measured").textContent=human(measured/1000)+" km";
   get("ciclo-difference").textContent="Diferença frente à referência: "+(measured>=REF_METERS?"+":"")+human(measured-REF_METERS)+" m. Não é medição faturável.";
   get("ciclo-segments").textContent=String(current.features.length);
   get("ciclo-validation").textContent="Traçado carregado · verificação documental pendente.";
   get("ciclo-source").textContent=(unsaved?"Importação ainda não salva: ":"Camada armazenada: ")+sourceName;
  }else{
   get("ciclo-measured").textContent="—";
   get("ciclo-segments").textContent="—";
   get("ciclo-validation").textContent="Sem traçado georreferenciado.";
   get("ciclo-source").textContent="Nenhuma camada registrada.";
  }
  get("ciclo-save").disabled=!canEdit||!current||!unsaved;
  get("ciclo-export").disabled=!current;
  get("ciclo-geojson").disabled=!current;
 };
 get("ciclo-import").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>20_000_000)throw Error("Arquivo acima de 20 MB. Simplifique o shapefile.");
   let geo;
   if(/\.zip$/i.test(file.name)){
    const mod=await import("https://unpkg.com/shpjs@6.2.0/dist/shp.esm.js");
    geo=await (mod.default||mod)(await file.arrayBuffer());
   }else if(/\.(geojson|json)$/i.test(file.name)){
    geo=JSON.parse(await file.text());
   }else throw Error("Formato não reconhecido.");
   const parsed=cleanGeometry(geo);
   current=parsed;sourceName=file.name;unsaved=true;render();
   notify("Traçado importado. Confira o mapa e a extensão antes de salvar no SIGA.");
  }catch(err){notify("Não foi possível importar: "+err.message,true);}
  finally{e.target.value="";}
 });
 get("ciclo-save").addEventListener("click",async()=>{
  if(!canEdit||!current||!unsaved)return;
  const btn=get("ciclo-save");btn.disabled=true;
  try{
   const record={code:"vila_a_ciclovia",geojson:current,source_file:sourceName,
    length_reference_m:REF_METERS,validation_status:"a_conferir",
    updated_at:new Date().toISOString()};
   if(userId)record.created_by=userId;
   const {error}=await db.from("ciclovia_routes").upsert(record,{onConflict:"code"});
   if(error)throw error;
   unsaved=false;render();notify("Camada salva. A validação técnica da geometria permanece pendente.");
  }catch(err){notify("Falha ao salvar camada: "+err.message,true);btn.disabled=false;}
 });
 get("ciclo-geojson").addEventListener("click",()=>{
  if(current)saveFile(JSON.stringify(current,null,2),"ciclovia_vila_a.geojson","application/geo+json");
 });
 get("ciclo-export").addEventListener("click",async()=>{
  if(!current)return;
  try{
   const mod=await import("https://cdn.jsdelivr.net/npm/@mapbox/shp-write@0.4.3/+esm");
   const writer=mod.default||mod;
   const archive=writer.zip(current,{folder:"ciclovia_vila_a",filename:"ciclovia_vila_a",
    outputType:"blob",compression:"DEFLATE",types:{polyline:"ciclovia_vila_a"}});
   saveFile(archive,"ciclovia_vila_a.zip","application/zip");
  }catch(err){notify("Não foi possível exportar o Shapefile: "+err.message,true);}
 });
 try{
  const {data,error}=await db.from("ciclovia_routes").select("geojson,source_file,validation_status")
   .eq("code","vila_a_ciclovia").maybeSingle();
  if(error)throw error;
  if(data?.geojson){
   current=cleanGeometry(data.geojson);
   sourceName=data.source_file||"camada importada";
   unsaved=false;render();
   get("ciclo-validation").textContent=data.validation_status==="validado"?"Geometria validada.":"Geometria cadastrada, aguardando validação.";
  }
 }catch(err){notify("Camada não carregada: "+err.message,true);}
 // Necessário após a montagem do layout dentro da SPA.
 requestAnimationFrame(()=>map.invalidateSize());
 return ()=>map.remove();
}
