// SIGA Américas · mapa contratual de cobertura de campo.
// GeoJSON/KML WGS84. Nenhuma geometria ou métrica espacial é inferida de nomes.
import {GOOGLE_MAPS_BROWSER_KEY} from "./config.js";
import {iconMarkup} from "./icons.js?v=6";
import {readKmlFromKmz} from "./kmz-geometry-reader.js?v=1";
const VIEW=[-25.51,-54.56]; // enquadramento urbano aproximado; NÃO É PIN DE SERVIÇO
const R=6371008.8;
const METER=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=x=>METER.format(x);
// Uma cor exclusiva por área identificada no KML institucional, sem alterar o traçado.
// Cartografia SIGA: materiais e paisagens de Itaipu (ardósia, musgo, terra,
// aço e madeira). Tonalidades sóbrias, suficientemente distintas sobre satélite.
const areaPalette={
 "area da central hidreletrica de itaipu - br":"#C5B58C", // areia / concreto
 "pti":"#80A8B7",                           // aço azulado
 "vila a":"#86B38F",                        // verde-mata
 "vila b":"#C49573",                        // argila
 "vila c":"#9D98B1",                        // ardósia violeta
 "rbv 1":"#72A69F",                         // petróleo esverdeado
 "rbv 2":"#B7A587",                         // pedra terrosa
 "rbv 3":"#AAB57D",                         // oliva
 "rbv 4":"#B77E73",                         // óxido / ferrugem
 "centro executivo e gramadao":"#9AB0A8" // cinza-sálvia
};
const fallbackPalette=["#85ABA2","#BCA785","#8FAFB7","#AB967B","#9DAF83","#9C98B1","#BA897C"];
const areaKey=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/["']/g,"").toLowerCase().replace(/\s+/g," ").trim();
const featureName=(feature,layer)=>String(feature?.properties?.name||feature?.properties?.Name||
 feature?.properties?.trecho||layer?.name||"Geometria sem nome").trim();
const areaColor=name=>{
 const key=areaKey(name);
 if(areaPalette[key])return areaPalette[key];
 let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;
 return fallbackPalette[hash%fallbackPalette.length];
};
const validColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toUpperCase():null;
const colorForFeature=(feature,layer)=>validColor(feature?.properties?._siga_import_color)||
 (layer?.reference_scope==="matrizes"?"#28CDA7":areaColor(featureName(feature,layer)));
const symbolType=(feature,layer)=>{
 const geom=feature?.geometry?.type||"";
 if(/Polygon/.test(geom))return "area";
 if(/LineString/.test(geom))return "rota";
 return layer?.reference_scope==="matrizes"||/matriz|arvor.?s.*matriz/i.test(layer?.name||"")?"matriz":"ponto";
};
const matrixName=str=>/matriz|matrizes|arvore|árvore|seed.?tree|semente/i.test(String(str||""));
const isPoint=f=>["Point","MultiPoint"].includes(f?.geometry?.type);
function matrizCandidateCollection(geo){
 const pts=(geo.features||[]).filter(isPoint);
 const tagged=pts.filter(f=>matrixName(f.properties?.name)||matrixName(f.properties?.description));
 return {allPoints:pts.length,matched:tagged.length,
  selected:{type:"FeatureCollection",features:tagged.length?tagged:pts}};
}
function nearExisting(feature,layers,tolerance=3){
 const p=feature.geometry?.type==="Point"?feature.geometry.coordinates:null;
 if(!p)return false;
 for(const l of layers)if(l.geometry&&(l.reference_scope==="matrizes"||/matriz|matrizes/i.test(l.name||"")))
  for(const current of l.geometry.features||[])if(current.geometry?.type==="Point"&&
    haversine(current.geometry.coordinates,p)<=tolerance)return true;
 return false;
}
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
async function readGeoFile(file,{matrizes=false}={}){
 if(!/\.(?:kml|kmz|geojson|json)$/i.test(file.name))throw Error("Escolha KML, KMZ ou GeoJSON.");
 if(!/\.kmz$/i.test(file.name)&&file.size>24*1024*1024)
  throw Error("Arquivo muito grande. Exporte apenas as geometrias para KML/GeoJSON.");
 let geo,entry="",otherKmlCount=0;
 if(/\.(?:geojson|json)$/i.test(file.name))geo=JSON.parse(await file.text());
 else{
  let content;
  if(/\.kmz$/i.test(file.name)){
   const unpack=await readKmlFromKmz(file);content=unpack.content;
   entry=unpack.entry;otherKmlCount=unpack.otherKmlCount;
  }else content=await file.text();
  const doc=new DOMParser().parseFromString(content,"application/xml");
  if(doc.querySelector("parsererror"))throw Error("KML inválido.");
  const converter=await import("https://cdn.jsdelivr.net/npm/@tmcw/togeojson@7.1.2/+esm");
  geo=converter.kml(doc);
 }
 const summary=matrizes?matrizCandidateCollection(geo):null;
 return {geometry:validateCoverageGeoJSON(summary?summary.selected:geo),summary,entry,otherKmlCount};
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
  (canWrite?'<label class="coverage-import-color">Cor da importação <input type="color" data-import-color value="#72A69F" aria-label="Cor das novas camadas importadas"></label><button type="button" class="btn btn-secondary" data-open-import>Importar KML / KMZ</button>':"")+
 '</div>'+
 '<div class="coverage-map-layout"><div class="coverage-map-canvas" data-map role="region" aria-label="Mapa interativo das frentes operacionais da PROERG em Itaipu"></div>'+
 '<details class="coverage-map-legend" data-legend open><summary>'+iconMarkup("layers")+
 ' Áreas do KML <span data-legend-count></span>'+iconMarkup("chevrondown")+'</summary>'+
 '<div class="coverage-map-legend-items" data-legend-list></div></details></div>'+
 '<div class="coverage-map-import" data-import-panel hidden>'+
  '<h3>Importar geometria para conferência contratual</h3>'+
  '<p>Formato KML, KMZ ou GeoJSON em WGS84 · EPSG:4326. Indique a fonte e o vínculo à matriz de 73 atividades. A geometria será armazenada e poderá ser consultada por outras contas autorizadas.</p>'+
  '<div class="coverage-map-inputs"><label>Nome da área/trecho/ponto<input data-layer-name maxlength="140" placeholder="Ex.: Ciclovia Vila A · trecho leste"></label>'+
   '<label>Categoria<select data-layer-category><option value="trecho">Trecho linear</option><option value="area">Área de cobertura</option><option value="ponto">Ponto externo</option><option value="matrizes">Árvores matrizes (KMZ)</option></select></label>'+
   '<label>Referência do contrato / matriz<input data-layer-contract maxlength="220" placeholder="Ex.: 3.35 · Corte de gramados"></label>'+
   '<label>Fonte da geometria<input data-layer-source maxlength="220" placeholder="Ex.: levantamento QGIS / vistoria de campo"></label>'+
   '<label>Arquivo KML/KMZ/GeoJSON<input type="file" data-layer-file accept=".kml,.kmz,.json,.geojson"></label></div>'+
 '<div class="coverage-matrix-preview" data-matrix-preview aria-live="polite"></div>'+
  '<label class="coverage-replace-toggle" data-replace-wrap hidden><input type="checkbox" data-replace-matrices> Substituir os pontos provisórios de matrizes após conferência</label>'+
  '<p class="coverage-import-note">KMZ grande: só o KML interno será processado, sem carregar as fotografias. A importação não comprova identificação botânica.</p>'+
  '<div class="coverage-map-import-actions"><button class="btn btn-primary" type="button" data-layer-save>Salvar camada georreferenciada</button>'+
  '<button class="btn btn-ghost" type="button" data-import-close>Cancelar</button></div></div>'+
 '</section>';
 const q=s=>root.querySelector(s);let layers=[],map=null,engine="leaflet",drawn=[],googleData=[],destroyed=false,resizeObserver=null,resizeFrame=0;
 let preview=null;
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
 const legend=q("[data-legend]");
 if(window.matchMedia?.("(max-width: 600px)").matches)legend.open=false;

 function paintLegend(){
  const items=new Map();
  for(const layer of layers.filter(entry=>entry.geometry)){
   for(const feature of layer.geometry.features||[]){
    if(!feature.geometry)continue;
    const kind=symbolType(feature,layer),name=kind==="matriz"?"Árvores matrizes":
      kind==="rota"?(layer.name||"Rota"):kind==="area"?featureName(feature,layer):layer.name||"Pontos";
    const color=colorForFeature(feature,layer),key=kind+"|"+areaKey(name)+"|"+color;
    if(!items.has(key))items.set(key,{name,color,kind});
   }
  }
  legend.hidden=!items.size;
  q("[data-legend-count]").textContent="("+items.size+")";
  q("[data-legend-list]").innerHTML=[...items.values()].map(entry=>
   '<div class="coverage-map-legend-entry"><span class="coverage-map-legend-line" data-symbol="'+entry.kind+
   '" style="--legend-color:'+entry.color+'" aria-hidden="true"></span><span>'+esc(entry.name)+'</span></div>'
  ).join("");
 }
 // SVG com hachuras diagonais de opacidade 20%, sem rasterizar os polígonos.
 // O padrão fica no renderer SVG do Leaflet e acompanha zoom e deslocamento.
 function hatchPolygon(featureLayer,color){
  const path=featureLayer._path,svg=path?.ownerSVGElement;
  if(!path||!svg)return;
  const ns="http://www.w3.org/2000/svg",token=color.replace("#","").toLowerCase();
  const id="siga-hatch-"+token;
  let defs=svg.querySelector("defs[data-siga-hatches]");
  if(!defs){defs=document.createElementNS(ns,"defs");defs.setAttribute("data-siga-hatches","");svg.insertBefore(defs,svg.firstChild);}
  if(!Array.from(defs.children).some(x=>x.id===id)){
   const pattern=document.createElementNS(ns,"pattern");
   pattern.id=id;pattern.setAttribute("width","9");pattern.setAttribute("height","9");
   pattern.setAttribute("patternUnits","userSpaceOnUse");pattern.setAttribute("patternTransform","rotate(45)");
   const under=document.createElementNS(ns,"rect");
   under.setAttribute("width","9");under.setAttribute("height","9");
   under.setAttribute("fill",color);under.setAttribute("fill-opacity",".055");
   const dash=document.createElementNS(ns,"path");
   dash.setAttribute("d","M0 0V9");
   dash.setAttribute("stroke",color);dash.setAttribute("stroke-width","1.7");
   dash.setAttribute("stroke-opacity",".20");
   pattern.append(under,dash);defs.appendChild(pattern);
  }
  path.setAttribute("fill","url(#"+id+")");
  path.setAttribute("fill-opacity","1");
  path.setAttribute("fill-rule","evenodd");
 }
 function addGeoToLeaflet(l){
  if(!l.geometry)return;
  const layer=maps.geoJSON(l.geometry,{
   style:feature=>{
    const c=colorForFeature(feature,l),kind=symbolType(feature,l);
    return kind==="area"?
     {color:c,weight:1.6,opacity:.94,fill:true,fillColor:c,fillOpacity:.08,className:"siga-area-hatched"}:
     {color:kind==="rota"?"#F4B39C":c,weight:3.1,opacity:.95,dashArray:"9 6",lineCap:"round",fill:false,className:"siga-route-dashed"};
   },
   pointToLayer:(feature,latlng)=>{
    const kind=symbolType(feature,l),c=kind==="matriz"?"#25C9A2":colorForFeature(feature,l);
    return maps.circleMarker(latlng,{
     radius:kind==="matriz"?5.1:4.7,
     color:"#FFFFFF",weight:1.35,opacity:.98,fill:true,fillColor:c,fillOpacity:.96,
     className:"siga-point-solid "+(kind==="matriz"?"siga-matrix-point":"")
    });
   },
   onEachFeature:(feature,item)=>{
    const kind=symbolType(feature,l),coords=feature.geometry?.type==="Point"?feature.geometry.coordinates:null;
    const name=featureName(feature,l);
    item.bindPopup('<div class="siga-map-popup"><strong>'+esc(name)+'</strong>'+
      '<span>'+esc(kind==="matriz"?"Matriz georreferenciada · identificação a conferir":
        kind==="area"?"Área cartográfica":kind==="rota"?"Traçado georreferenciado":"Ponto")+'</span>'+
      (coords?'<small>WGS84: '+esc(coords[1].toFixed(6))+'; '+esc(coords[0].toFixed(6))+'</small>':'')+
      '<small>Fonte: '+esc(l.source_name||l.source_filename||"KML fornecido")+'</small>'+
      '<small>Não constitui execução ou medição contratual.</small></div>');
   }
  }).addTo(map);
  layer.eachLayer(part=>{
   const kind=symbolType(part.feature,l);
   if(kind==="area")hatchPolygon(part,colorForFeature(part.feature,l));
  });
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
  mapData.setStyle(feature=>({
   strokeColor:validColor(feature.getProperty("_siga_import_color"))||areaColor(feature.getProperty("name")||feature.getProperty("Name")||
    feature.getProperty("trecho")||l.name),
   strokeWeight:3,strokeOpacity:1,fillOpacity:0
  }));
  mapData.addListener("click",event=>{
   const name=event.feature.getProperty("name")||event.feature.getProperty("Name")||l.name;
   new google.maps.InfoWindow({content:'<strong>'+esc(name)+'</strong>',position:event.latLng}).open({map:gMap});
  });
  googleData.push({id:l.id,layer:mapData});
 }
 function draw(){
  const geo=layers.filter(l=>l.geometry);
  paintLegend();
  const polygons=geo.reduce((total,l)=>total+(l.geometry.features||[]).reduce((count,f)=>
   count+(f.geometry?.type==="Polygon"?1:f.geometry?.type==="MultiPolygon"?f.geometry.coordinates.length:0),0),0);
  q("[data-count]").textContent=polygons?polygons+" áreas georreferenciadas":geo.length+" camada(s) com geometria";
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
    const selectedColor=validColor(q("[data-import-color]")?.value)||"#72A69F";
    geo.features=geo.features.map(feature=>({...feature,properties:{...(feature.properties||{}),_siga_import_color:selectedColor}}));
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
 syncMapSize();
 return ()=>{destroyed=true;resizeObserver?.disconnect();if(resizeFrame)cancelAnimationFrame(resizeFrame);if(map){map.remove();map=null;}for(const g of googleData)g.layer.setMap(null);};
}
