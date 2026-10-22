// SIGA Américas · simbologia SIG do mapa interativo. Fonte única para Leaflet/Google.
const validColor=c=>/^#[0-9a-f]{6}$/i.test(String(c||""));
export const safeColor=(value,fallback="#447A69")=>validColor(value)?value.toUpperCase():fallback;
export const geometryKind=g=>/Polygon$/.test(g?.type||"")?"area":/LineString$/.test(g?.type||"")?"rota":/Point$/.test(g?.type||"")?"ponto":"outro";
export const hatchId=color=>"siga-hatch-"+safeColor(color).slice(1).toLowerCase();
export function leafletSymbol(feature,color){
 const kind=geometryKind(feature?.geometry),stroke=safeColor(color);
 if(kind==="area")return {color:stroke,weight:1.6,opacity:.9,fill:true,
  fillColor:"url(#"+hatchId(stroke)+")",fillOpacity:1,interactive:true,className:"siga-map-sector"};
 if(kind==="rota")return {color:stroke,weight:3.2,opacity:.95,dashArray:"8 6",
  lineCap:"round",lineJoin:"round",interactive:true,className:"siga-map-route"};
 return {color:"#FFFFFF",weight:1.8,opacity:1,fill:true,fillColor:stroke,fillOpacity:1};
}
export function googleSymbol(feature,color){
 const kind=geometryKind({type:feature.getGeometry?.()?.getType?.()||""}),stroke=safeColor(color);
 // Google Data não oferece hachuras SVG nativas: sombreado atenuado sem alterar os limites.
 return {strokeColor:kind==="ponto"?"#FFFFFF":stroke,
  strokeWeight:kind==="area"?1.6:kind==="rota"?3.2:1.8,strokeOpacity:.95,
  fillColor:stroke,fillOpacity:kind==="area"?.12:1,
  icon:kind==="ponto"?{path:0,fillColor:stroke,fillOpacity:1,strokeColor:"#FFFFFF",strokeWeight:1.8,scale:6}:undefined};
}
export function ensureHatchPatterns(container,colors){
 const svgNS="http://www.w3.org/2000/svg";
 for(const svg of container.querySelectorAll(".leaflet-overlay-pane svg")){
  let defs=svg.querySelector("defs[data-siga-cartography]");
  if(!defs){defs=document.createElementNS(svgNS,"defs");defs.setAttribute("data-siga-cartography","");svg.insertBefore(defs,svg.firstChild);}
  for(const color of new Set(colors.filter(Boolean).map(x=>safeColor(x)))){
   const id=hatchId(color);
   if([...defs.children].some(child=>child.id===id))continue;
   const pattern=document.createElementNS(svgNS,"pattern");
   for(const [k,v] of Object.entries({id,width:"9",height:"9",patternUnits:"userSpaceOnUse",patternTransform:"rotate(45)"}))pattern.setAttribute(k,v);
   const rule=document.createElementNS(svgNS,"path");
   rule.setAttribute("d","M0 0V9");
   rule.setAttribute("stroke",color);
   rule.setAttribute("stroke-width","1.8");
   rule.setAttribute("stroke-opacity",".20");
   pattern.appendChild(rule);defs.appendChild(pattern);
  }
 }
}
export function featureMetadata(properties={}){
 const preferred=[
  ["Identificação","name"],["Código","codigo"],["Nome científico","scientific_name"],
  ["Espécie","species"],["Nome popular","common_name"],["Família","family"],
  ["Identificador original","id_original"],["Observação","description"]
 ];
 return preferred.map(([label,key])=>[label,String(properties[key]??"").trim()])
  .filter(([,value])=>value&&value!=="undefined").slice(0,8);
}
export function isMatrixRecord(layer,feature){
 const words=String((layer?.name||"")+" "+(layer?.contract_reference||"")+" "+(feature?.properties?.name||"")).toLowerCase();
 return /matriz|matrizes|árvores matrizes|arvores matrizes|semente/.test(words);
}
export async function readLargeKMZ(file){
 // Entrada local em streaming; imagens e mídias dentro do KMZ nunca são extraídas.
 // BlobReader lê os blocos necessários, sem converter 377 MB para ArrayBuffer.
 const mod=await import("https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/+esm");
 const zipReader=new mod.ZipReader(new mod.BlobReader(file),{useWebWorkers:false});
 try{
  const entries=await zipReader.getEntries();
  const kmls=entries.filter(e=>!e.directory&&/\.kml$/i.test(e.filename));
  if(!kmls.length)throw Error("Este KMZ não contém um arquivo KML.");
  // Se houver doc.kml, respeitar a hierarquia exportada pelo software de origem.
  kmls.sort((a,b)=>Number(/(^|\/)doc\.kml$/i.test(b.filename))-Number(/(^|\/)doc\.kml$/i.test(a.filename))||
    Number(a.uncompressedSize||0)-Number(b.uncompressedSize||0));
  const fileKml=kmls[0];
  if(Number(fileKml.uncompressedSize)>18*1024*1024)throw Error("KML interno acima de 18 MB. Exporte apenas os pontos/linhas no QGIS.");
  const content=await fileKml.getData(new mod.TextWriter());
  if(content.length>18*1024*1024)throw Error("KML interno excessivamente extenso.");
  return {content,internalName:fileKml.filename,otherKmls:kmls.length-1};
 }finally{await zipReader.close();}
}
export function importedSummary(geo){
 const types={ponto:0,rota:0,area:0};
 const missing=[];
 (geo.features||[]).forEach((feature,i)=>{const type=geometryKind(feature.geometry);if(type in types)types[type]++;
  const names=featureMetadata(feature.properties);if(type==="ponto"&&!names.length)missing.push(i+1);
 });
 return {types,withoutName:missing.length,total:(geo.features||[]).length};
}
