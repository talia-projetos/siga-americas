// SIGA Américas · mapa contratual de cobertura de campo.
// GeoJSON/KML WGS84. Nenhuma geometria ou métrica espacial é inferida de nomes.
import {GOOGLE_MAPS_BROWSER_KEY} from "./config.js";
import {iconMarkup} from "./icons.js?v=4";
const VIEW=[-25.51,-54.56]; // enquadramento urbano aproximado; NÃO É PIN DE SERVIÇO
const R=6371008.8;
const METER=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=x=>METER.format(x);
const countryBounds=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&
 p[0]>-55.2&&p[0]<-54.05&&p[1]>-26.0&&p[1]<-24.9;
function haversine(a,b){
 const rad=Math.PI/180,dy=(b[1]-a[1])*rad,dx=(b[0]-a[0])*rad;
 const v=Math.sin(dy/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dx/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(v)));
}
function segment(points){let sum=0;for(let i=1;i<points.length;i++)sum+=haversine(points[i-1],points[i]);return sum;}
function ringArea(ring){
 let area=0,rad=Math.PI/180;
 for(let i=0;i<ring.length-1;i++)area+=((ring[i+1][0]-ring[i][0])*rad)*(Math.sin(ring[i][1]*rad)+Math.sin(ring[i+1][1]*rad));
 return Math.abs(area*R*R/2);
}
function polygonArea(rings){if(!rings?.length)return 0;return Math.max(0,ringArea(rings[0])-rings.slice(1).reduce((s,r)=>s+ringArea(r),0));}
function measure(geo){
 let meters=0,squareMeters=0,points=0,segments=0,polygons=0;
 for(const feat of geo?.features||[]){
  const g=feat.geometry;
  if(!g)continue;
  if(g.type==="Point")points++;
  else if(g.type==="MultiPoint")points+=g.coordinates.length;
  else if(g.type==="LineString"){meters+=segment(g.coordinates);segments++;}
  else if(g.type==="MultiLineString"){g.coordinates.forEach(p=>{meters+=segment(p);segments++;});}
  else if(g.type==="Polygon"){squareMeters+=polygonArea(g.coordinates);polygons++;}
  else if(g.type==="MultiPolygon"){g.coordinates.forEach(p=>{squareMeters+=polygonArea(p);polygons++;});}
 }
 return {meters,squareMeters,points,segments,polygons};
}
const walkPoints=g=>{
 if(!g)return[];
 const collect=x=>typeof x?.[0]==="number"?[x]:Array.isArray(x)?x.flatMap(collect):[];
 return collect(g.coordinates);
};
export function validateCoverageGeoJSON(geo){
 const collection=geo?.type==="FeatureCollection"?geo:
  geo?.type==="Feature"?{type:"FeatureCollection",features:[geo]}:null;
 if(!collection||!Array.isArray(collection.features))throw Error("Arquivo sem coleção geográfica GeoJSON/KML válida.");
 if(!collection.features.length)throw Error("Nenhuma geometria encontrada no arquivo.");
 if(collection.features.length>800)throw Error("Limite de 800 geometrias por camada. Simplifique no QGIS.");
 const types=new Set(["Point","MultiPoint","LineString","MultiLineString","Polygon","MultiPolygon"]);
 let vertices=0;
 const features=collection.features.map((f,i)=>{
  if(!types.has(f.geometry?.type))throw Error("Geometria não suportada no elemento "+(i+1)+".");
  const points=walkPoints(f.geometry);
  if(!points.length||points.some(p=>!countryBounds(p)))throw Error("Coordenadas fora da região de Foz do Iguaçu ou CRS não convertido. Exporte KML em WGS84 (EPSG:4326).");
  vertices+=points.length;
  if(vertices>50000)throw Error("Mais de 50 mil vértices: simplifique os dados no QGIS.");
  const allowed={};
  for(const [k,v] of Object.entries(f.properties||{})){
   if(["name","Name","description","Description","trecho","codigo"].includes(k))
    allowed[k]=String(v??"").slice(0,180);
  }
  return {type:"Feature",properties:allowed,geometry:f.geometry};
 });
 return {type:"FeatureCollection",features};
}
const fmtMetric=m=>[
 ...(m.meters>0?[n(m.meters/1000)+" km de linhas ("+n(m.meters)+" m)"]:[]),
 ...(m.squareMeters>0?[n(m.squareMeters/10000)+" ha de polígonos"]:[]),
 ...(m.points>0?[m.points+" ponto(s)"]:[])
].join(" · ")||"Sem dimensão espacial calculável";
async function readGeoFile(file){
 if(file.size>8*1024*1024)throw Error("Arquivo acima de 8 MB. Simplifique antes de importar.");
 if(!/\.(?:kml|kmz|geojson|json)$/i.test(file.name))throw Error("Escolha um arquivo KML, KMZ ou GeoJSON.");
 let content;
 if(/\.kmz$/i.test(file.name)){
  const module=await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  const zip=await (module.default||module).loadAsync(await file.arrayBuffer());
  const entry=Object.values(zip.files).find(f=>!f.dir&&/\.kml$/i.test(f.name));
  if(!entry)throw Error("KMZ sem arquivo KML interno.");
  content=await entry.async("string");
  if(content.length>8*1024*1024)throw Error("KML interno muito grande.");
 }else content=await file.text();
 if(/\.geojson$|\.json$/i.test(file.name))return validateCoverageGeoJSON(JSON.parse(content));
 const doc=new DOMParser().parseFromString(content,"application/xml");
 if(doc.querySelector("parsererror"))throw Error("KML com XML inválido.");
 const converter=await import("https://cdn.jsdelivr.net/npm/@tmcw/togeojson@7.1.2/+esm");
 const geo=converter.kml(doc);
 return validateCoverageGeoJSON(geo);
}
let googleInit=null;
function loadGoogle(key){
 if(window.google?.maps)return Promise.resolve(window.google.maps);
 if(googleInit)return googleInit;
 googleInit=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.async=true;
  script.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&loading=async&v=weekly";
  script.onload=()=>window.google?.maps?resolve(window.google.maps):reject(Error("API Google Maps não inicializou."));
  script.onerror=()=>reject(Error("Google Maps indisponível. Confira chave, domínios autorizados e faturamento."));
  document.head.appendChild(script);
 });return googleInit;
}
export async function mountCoverageMap(root,db,{canWrite=false,notify=()=>{}}={}){
 root.innerHTML='<section class="coverage-map-shell">'+
 '<div class="coverage-map-header"><div><span class="eyebrow">COBERTURA OPERACIONAL · PROERG EM ITAIPU</span><h2>Mapa das áreas de cobertura</h2>'+
 '<p>Camadas georreferenciadas de trechos, áreas e pontos de atendimento. Medições espaciais calculadas a partir do KML/KMZ/GeoJSON, sem presumir execução ou aprovação.</p></div>'+
 '<span class="coverage-map-count" data-count>— camadas</span></div>'+
 '<div class="coverage-map-toolbar"><label>Imagem de fundo<select data-basemap>'+
  '<option value="satellite">Satélite · Esri World Imagery</option><option value="street">Mapa viário · OpenStreetMap</option>'+
  (GOOGLE_MAPS_BROWSER_KEY?'<option value="google">Google Satélite (API autorizada)</option>':"")+
  '</select></label>'+
  '<a class="btn btn-ghost" href="https://www.google.com/maps/@-25.51,-54.56,13z/data=!3m1!1e3" target="_blank" rel="noopener noreferrer">Abrir no Google Satélite '+iconMarkup("arrow")+'</a>'+
  (canWrite?'<button type="button" class="btn btn-secondary" data-open-import>Importar KML / KMZ</button>':"")+
 '</div>'+
 '<div class="coverage-map-layout"><div class="coverage-map-canvas" data-map role="region" aria-label="Mapa interativo das frentes operacionais da PROERG em Itaipu"></div>'+
 '</div>'+
 '<div class="coverage-map-import" data-import-panel hidden>'+
  '<h3>Importar geometria para conferência contratual</h3>'+
  '<p>Formato KML, KMZ ou GeoJSON em WGS84 · EPSG:4326. Indique a fonte e o vínculo à matriz de 73 atividades. A geometria será armazenada e poderá ser consultada por outras contas autorizadas.</p>'+
  '<div class="coverage-map-inputs"><label>Nome da área/trecho/ponto<input data-layer-name maxlength="140" placeholder="Ex.: Ciclovia Vila A · trecho leste"></label>'+
   '<label>Categoria<select data-layer-category><option value="trecho">Trecho linear</option><option value="area">Área de cobertura</option><option value="ponto">Ponto externo</option></select></label>'+
   '<label>Referência do contrato / matriz<input data-layer-contract maxlength="220" placeholder="Ex.: 3.35 · Corte de gramados"></label>'+
   '<label>Fonte da geometria<input data-layer-source maxlength="220" placeholder="Ex.: levantamento QGIS / vistoria de campo"></label>'+
   '<label>Arquivo KML/KMZ/GeoJSON<input type="file" data-layer-file accept=".kml,.kmz,.json,.geojson"></label></div>'+
  '<div class="coverage-map-import-actions"><button class="btn btn-primary" type="button" data-layer-save>Salvar camada georreferenciada</button>'+
  '<button class="btn btn-ghost" type="button" data-import-close>Cancelar</button></div></div>'+
 '<div class="coverage-map-footer"><strong>Referências no contrato:</strong> 73 atividades na matriz; postos institucionais e frentes de serviço conforme registros cadastrados. As áreas institucionais do KML são referências geográficas, não confirmação de cobertura contratual. Ciclovia: 4,8 km publicados; linha ainda sem levantamento validado. <span data-provider-warning></span></div>'+
 '</section>';
 const q=s=>root.querySelector(s);let layers=[],map=null,engine="leaflet",drawn=[],googleData=[],destroyed=false,resizeObserver=null,resizeFrame=0;
 const mapDiv=q("[data-map]");
 const defaultPins=[]; // Nenhuma referência nominal recebe coordenadas inventadas.
 const satelliteUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
 const streetUrl="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
 let tiles=null;
 const maps=window.L;
 if(!maps){mapDiv.innerHTML='<p>Biblioteca de mapas indisponível. Confira sua conexão com a internet.</p>';return ()=>{};}
 map=maps.map(mapDiv,{scrollWheelZoom:false,zoomControl:true}).setView(VIEW,12);
 // Respeitar o novo tamanho do painel, inclusive quando o menu lateral muda.
 const syncMapSize=()=>{
  if(destroyed||!root.isConnected)return;
  if(resizeFrame)cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>{
   resizeFrame=0;
   if(engine==="leaflet"&&map)map.invalidateSize({pan:false,animate:false});
   else if(engine==="google"&&gMap&&window.google?.maps?.event)
    google.maps.event.trigger(gMap,"resize");
  });
 };
 if(typeof ResizeObserver!=="undefined"){
  resizeObserver=new ResizeObserver(syncMapSize);
  resizeObserver.observe(mapDiv);
 }
 const applyBase=(mode)=>{
  if(tiles){map.removeLayer(tiles);tiles=null;}
  const sat=mode==="satellite";
  tiles=maps.tileLayer(sat?satelliteUrl:streetUrl,{
   maxZoom:sat?19:19,attribution:sat?
   'Imagens: Esri, Maxar, Earthstar Geographics e colaboradores':
   '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(map);
 };
 applyBase("satellite");
 maps.control.scale({metric:true,imperial:false}).addTo(map);
 const colorFor=l=>l.category==="ponto"?"#f1ba62":l.category==="trecho"?"#22ac81":"#4c8ae5";
 function addGeoToLeaflet(l){
  if(!l.geometry)return;
  const layer=maps.geoJSON(l.geometry,{
   style:()=>({color:colorFor(l),weight:4,fillColor:"#25a779",fillOpacity:.24}),
   pointToLayer:(feature,latlng)=>maps.circleMarker(latlng,{radius:7,color:"#fff",weight:2,fillColor:colorFor(l),fillOpacity:.95}),
   onEachFeature:(feature,item)=>{
    item.bindPopup('<strong>'+esc(feature.properties?.name||l.name)+'</strong><br>'+
      esc(l.source_name||"KML fornecido")+'<br>Geometria ainda não validada pelo contrato.');
   }
  }).addTo(map);
  drawn.push({id:l.id,layer});
 }
 let gMap=null;
 async function setGoogle(){
  const gm=await loadGoogle(GOOGLE_MAPS_BROWSER_KEY);
  engine="google";map.remove();map=null;mapDiv.replaceChildren();drawn=[];
  gMap=new gm.Map(mapDiv,{center:{lat:VIEW[0],lng:VIEW[1]},zoom:12,mapTypeId:gm.MapTypeId.HYBRID,mapTypeControl:false,streetViewControl:false});
  for(const l of layers.filter(x=>x.geometry))addGoogleData(l);
 }
 function addGoogleData(l){
  const mapData=new google.maps.Data({map:gMap});
  mapData.addGeoJson(l.geometry);
  mapData.setStyle({strokeColor:colorFor(l),strokeWeight:4,fillColor:"#26a879",fillOpacity:.25});
  googleData.push({id:l.id,layer:mapData});
 }
 function draw(){
  q("[data-count]").textContent=layers.filter(l=>l.geometry).length+" camada(s) com geometria";
  const geo=layers.filter(l=>l.geometry),stats=geo.reduce((acc,l)=>{
   const m=measure(l.geometry);
   acc.meters+=m.meters;acc.area+=m.squareMeters;acc.points+=m.points;return acc;
  },{meters:0,area:0,points:0});
  if(engine==="leaflet"){
   for(const item of drawn)map.removeLayer(item.layer);
   drawn=[];geo.forEach(addGeoToLeaflet);
   if(drawn.length){
    const all=maps.featureGroup(drawn.map(x=>x.layer));const bounds=all.getBounds();
    if(bounds.isValid())map.fitBounds(bounds.pad(.13),{maxZoom:16});
   }
  }else{
   for(const x of googleData)x.layer.setMap(null);googleData=[];
   geo.forEach(addGoogleData);
  }
 }
 function showLayer(id){
  if(engine==="leaflet"){
   const target=drawn.find(l=>l.id===id),bounds=target?.layer.getBounds();
   if(bounds?.isValid())map.fitBounds(bounds.pad(.18),{maxZoom:17});
  }else{
   const record=layers.find(l=>l.id===id);if(!record?.geometry)return;
   const b=new google.maps.LatLngBounds();
   record.geometry.features.forEach(f=>walkPoints(f.geometry).forEach(p=>b.extend({lat:p[1],lng:p[0]})));
   if(!b.isEmpty())gMap.fitBounds(b);
  }
 }
 root.addEventListener("click",async e=>{
  const open=e.target.closest("[data-open-import]");
  if(open){q("[data-import-panel]").hidden=false;return;}
  if(e.target.closest("[data-import-close]")){q("[data-import-panel]").hidden=true;return;}
  const button=e.target.closest("[data-layer-save]");
  if(!button||!canWrite)return;
  const name=q("[data-layer-name]").value.trim(),
   cat=q("[data-layer-category]").value,
   contract=q("[data-layer-contract]").value.trim(),
   source=q("[data-layer-source]").value.trim(),
   file=q("[data-layer-file]").files?.[0];
  if(!name||!contract||!source||!file){notify("Informe nome, vínculo à matriz contratual, fonte e arquivo de geometria.",true);return;}
  button.disabled=true;button.textContent="Conferindo geometria...";
  try{
   const geo=await readGeoFile(file);
   const hasLine=geo.features.some(x=>["LineString","MultiLineString"].includes(x.geometry.type));
   const hasPoly=geo.features.some(x=>["Polygon","MultiPolygon"].includes(x.geometry.type));
   const hasPoint=geo.features.some(x=>["Point","MultiPoint"].includes(x.geometry.type));
   if(cat==="trecho"&&!hasLine||cat==="area"&&!hasPoly||cat==="ponto"&&!hasPoint)
    throw Error("A categoria selecionada não corresponde à geometria incluída.");
   const duplicate=layers.find(l=>l.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR")&&!l.geometry);
   const payload={
    name,category:cat,contract_reference:contract,source_name:source,source_filename:file.name,
    source_type:/\.(?:kml|kmz)$/i.test(file.name)?"kml":"geojson",verification_status:"geometria_importada",geometry:geo
   };
   const write=duplicate?db.from("coverage_map_layers").update(payload).eq("id",duplicate.id).select().single():
    db.from("coverage_map_layers").insert(payload).select().single();
   const result=await write;
   if(result.error)throw result.error;
   const i=layers.findIndex(l=>l.id===result.data.id);
   if(i<0)layers.push(result.data);else layers[i]=result.data;
   q("[data-import-panel]").hidden=true;q("[data-layer-file]").value="";
   draw();showLayer(result.data.id);
   notify("Geometria salva. Confira sua correspondência com os limites e medidas contratuais.");
  }catch(error){notify("Não foi possível salvar a camada: "+error.message,true);}
  finally{button.disabled=false;button.textContent="Salvar camada georreferenciada";}
 });
 q("[data-basemap]").addEventListener("change",async e=>{
  const mode=e.target.value;
  try{
   if(mode==="google"){await setGoogle();}
   else if(engine==="google"){
    engine="leaflet";gMap=null;googleData=[];mapDiv.replaceChildren();
    map=maps.map(mapDiv,{scrollWheelZoom:false,zoomControl:true}).setView(VIEW,12);
    maps.control.scale({metric:true,imperial:false}).addTo(map);
    applyBase(mode);draw();
   }else applyBase(mode);
  }catch(error){q("[data-basemap]").value="satellite";notify("Google Satélite não pôde iniciar: "+error.message,true);}
 });
 const result=await db.from("coverage_map_layers").select("*").order("created_at",{ascending:true}).limit(200);
 if(result.error)throw result.error;
 layers=result.data||[];
 if(destroyed)return ()=>{};
 draw();
 q("[data-provider-warning]").textContent=GOOGLE_MAPS_BROWSER_KEY?"Google Satélite disponível pela API configurada.":
  "Google Satélite integrado exige chave de API autorizada; mapa inicia com satélite Esri.";
 syncMapSize();
 return ()=>{destroyed=true;resizeObserver?.disconnect();if(resizeFrame)cancelAnimationFrame(resizeFrame);if(map){map.remove();map=null;}for(const g of googleData)g.layer.setMap(null);};
}
