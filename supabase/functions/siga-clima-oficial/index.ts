// SIGA - fontes meteorológicas oficiais: INMET com contingência CPTEC/INPE.
// Nunca retornar dados gerados ou extrapolações como previsão.
const cors={"Access-Control-Allow-Origin":"https://talia-projetos.github.io",
"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
"Access-Control-Allow-Methods":"GET,OPTIONS"};
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":status>=400?"no-store":"public, max-age=600"}});
const timezone="America/Sao_Paulo";
const nowDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const num=v=>v==null||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const normalize=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
async function get(url){
 const c=new AbortController();const t=setTimeout(()=>c.abort(),6500);
 try{const r=await fetch(url,{signal:c.signal,headers:{"Accept":"application/json, application/xml, text/xml;q=0.9, */*;q=0.8"}});
 if(!r.ok)throw Error("HTTP "+r.status);return r;}
 finally{clearTimeout(t);}
}
function inmetDays(input){
 const data=input?.["4108304"]??input?.["FOZ DO IGUACU"]??input;
 if(!data||typeof data!=="object")return [];
 const days=[];
 for(const [date,period] of Object.entries(data)){
  if(!/^20\d\d-\d\d-\d\d$/.test(date)||date<nowDay()||!period||typeof period!=="object")continue;
  const parts=Object.values(period).filter(x=>x&&typeof x==="object");
  const find=(...keys)=>parts.map(p=>keys.map(k=>p[k])).flat().find(x=>x!==null&&x!==undefined&&String(x).trim()!=="");
  const desc=find("resumo","tempo","descricao","condicao","tempo_manha","tempo_tarde");
  if(!desc)continue;
  days.push({date,description:String(desc).slice(0,160),min:num(find("temp_min","minima","temperatura_minima")),max:num(find("temp_max","maxima","temperatura_maxima"))});
 }
 return days.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
}
const getTag=(xml,tag)=>xml.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","i"))?.[1]?.trim()??"";
function cptecDays(xml){
 const city=getTag(xml,"nome"),state=getTag(xml,"uf");
 if(!normalize(city).includes("foz do iguacu")||state.toUpperCase()!=="PR")throw Error("Cidade CPTEC não corresponde a Foz do Iguaçu/PR");
 const conditions={ec:"Encoberto com chuva",ci:"Chuvas isoladas",c:"Chuva",in:"Instável",pp:"Possibilidade de chuva",cm:"Chuva pela manhã",cn:"Chuva à noite",pt:"Pancadas de chuva à tarde",pm:"Pancadas de chuva pela manhã",np:"Nublado com pancadas",n:"Nublado",pn:"Parcialmente nublado",pnt:"Pancadas de chuva à noite",ps:"Predomínio de sol",e:"Encoberto",t:"Tempestade",cl:"Céu claro"};
 const days=[...xml.matchAll(/<previsao>([\s\S]*?)<\/previsao>/gi)].map(m=>{
  const fragment=m[1],date=getTag(fragment,"dia"),key=getTag(fragment,"tempo").toLowerCase();
  return {date,description:conditions[key]||("Condição CPTEC ("+key+")"),min:num(getTag(fragment,"minima")),max:num(getTag(fragment,"maxima"))};
 }).filter(d=>/^20\d\d-\d\d-\d\d$/.test(d.date)&&d.date>=nowDay()&&!d.description.endsWith("()"));
 if(!days.length)throw Error("Nenhuma data atual reconhecida no XML");
 return days.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
}

// Serviço de meteorologia pública da Noruega (MET Norway), que utiliza ECMWF IFS
// para previsões globais. É previsão modelada, não boletim emitido pelo INMET.
const metLabels={clearsky:"Céu claro",fair:"Poucas nuvens",partlycloudy:"Parcialmente nublado",cloudy:"Nublado",
 fog:"Neblina",lightrain:"Chuva fraca",rain:"Chuva",heavyrain:"Chuva forte",
 rainshowers:"Pancadas de chuva",lightrainshowers:"Pancadas fracas",
 heavyrainshowers:"Pancadas fortes",rainandthunder:"Chuva e trovoadas",
 rainshowersandthunder:"Pancadas e trovoadas",heavyrainandthunder:"Chuva forte e trovoadas"};
const metDate=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
const metDescription=key=>{
 const base=String(key||"").replace(/_(day|night|polartwilight)$/,"");
 if(metLabels[base])return metLabels[base];
 if(base.includes("thunder"))return "Possibilidade de trovoadas";
 if(base.includes("rain"))return "Possibilidade de chuva";
 if(base.includes("cloud"))return "Nebulosidade variável";
 return "Condição calculada pelo modelo";
};
async function metNorwayForecast(){
 const url="https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-25.5478&lon=-54.5882";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  // O provedor exige identificação, atribuição e respeito ao cache.
  const r=await fetch(url,{signal:controller.signal,headers:{"User-Agent":"SIGA-Americas/1.0 https://talia-projetos.github.io/siga-americas/","Accept":"application/json"}});
  if(!r.ok)throw Error("MET Norway HTTP "+r.status);
  const data=await r.json(),raw=data?.properties?.timeseries,updated=data?.properties?.meta?.updated_at;
  if(!Array.isArray(raw)||!raw.length)throw Error("MET Norway sem série temporal");
  if(!updated||!Number.isFinite(Date.parse(updated))||Date.now()-Date.parse(updated)>30*3600*1000)throw Error("MET Norway não atualizou previsão recentemente");
  const groups=new Map();
  for(const slot of raw){
   if(!slot?.time||Date.parse(slot.time)<Date.now()-3600*1000)continue;
   const day=metDate(slot.time);if(day<nowDay())continue;
   const temp=num(slot.data?.instant?.details?.air_temperature);
   const code=slot.data?.next_6_hours?.summary?.symbol_code||
     slot.data?.next_1_hours?.summary?.symbol_code||
     slot.data?.next_12_hours?.summary?.symbol_code;
   if(temp===null||!Number.isFinite(Date.parse(slot.time)))continue;
   if(!groups.has(day))groups.set(day,{date:day,min:temp,max:temp,description:"",firstTime:Infinity});
   const obj=groups.get(day);obj.min=Math.min(obj.min,temp);obj.max=Math.max(obj.max,temp);
   const stamp=Date.parse(slot.time);
   if(code&&stamp<obj.firstTime){obj.firstTime=stamp;obj.description=metDescription(code);}
  }
  const days=[...groups.values()].filter(x=>x.description).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7)
    .map(({date,min,max,description})=>({date,min:Math.round(min),max:Math.round(max),description}));
  if(!days.length)throw Error("MET Norway sem dias atuais utilizáveis");
  return {source:"MET Norway / ECMWF IFS",source_url:"https://api.met.no/weatherapi/locationforecast/2.0/documentation",
   forecast_type:"modelo_numerico",attribution:"Dados MET Norway (CC BY 4.0), modelo ECMWF IFS; interpretação automatizada pelo SIGA.",
   city:"Foz do Iguaçu, PR",retrieved_at:new Date().toISOString(),model_updated_at:updated,horizon:"curto_prazo",days};
 } finally{clearTimeout(timer);}
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET")return respond({error:"Método não permitido"},405);
 const errors=[];
 try{
  const response=await get("https://apiprevmet3.inmet.gov.br/previsao/4108304");
  const days=inmetDays(await response.json());
  if(days.length)return respond({source:"INMET",city:"Foz do Iguaçu, PR",source_url:"https://previsao.inmet.gov.br/4108304",retrieved_at:new Date().toISOString(),horizon:"curto_prazo",days});
  errors.push("INMET retornou dados sem datas atuais utilizáveis");
 }catch(e){errors.push("INMET indisponível: "+String(e).slice(0,100));}
 for(const protocol of ["https","http"]){
  try{
   const url=protocol+"://servicos.cptec.inpe.br/XML/cidade/7dias/-25.5478/-54.5882/previsaoLatLon.xml";
   const xml=await (await get(url)).text();
   const days=cptecDays(xml);
   return respond({source:"CPTEC/INPE",city:"Foz do Iguaçu, PR",source_url:"https://servicos.cptec.inpe.br/XML/",retrieved_at:new Date().toISOString(),horizon:"curto_prazo",days});
  }catch(e){errors.push("CPTEC "+protocol+" indisponível: "+String(e).slice(0,100));}
 }
 // Contingência documentada pelo CPTEC: buscar o código da localidade e consultar 7 ou 4 dias.
 for(const protocol of ["https","http"]){
  try{
   const lookup=await (await get(protocol+"://servicos.cptec.inpe.br/XML/listaCidades?city=foz%20do%20iguacu")).text();
   const candidates=[...lookup.matchAll(/<cidade>([\s\S]*?)<\/cidade>/gi)].map(m=>m[1]);
   const item=candidates.find(xml=>normalize(getTag(xml,"nome")).includes("foz do iguacu")&&getTag(xml,"uf").toUpperCase()==="PR");
   const id=item?getTag(item,"id"):"";
   if(!/^\d{1,7}$/.test(id))throw Error("Localidade não encontrada");
   for(const segment of ["7dias/",""]){
    try{
     const xml=await (await get(protocol+"://servicos.cptec.inpe.br/XML/cidade/"+segment+id+"/previsao.xml")).text();
     const days=cptecDays(xml);
     return respond({source:"CPTEC/INPE",city:"Foz do Iguaçu, PR",source_url:"https://servicos.cptec.inpe.br/XML/",retrieved_at:new Date().toISOString(),horizon:"curto_prazo",days});
    }catch(forecastError){errors.push("CPTEC "+(segment||"4dias")+" "+protocol+": "+String(forecastError).slice(0,80));}
   }
  }catch(e){errors.push("CPTEC busca de município "+protocol+": "+String(e).slice(0,95));}
 }
 // Terceira fonte independente: serviço meteorológico público da Noruega.
 try{const forecast=await metNorwayForecast();return respond(forecast);}
 catch(e){errors.push("MET Norway/ECMWF: "+String(e).slice(0,110));}
 return respond({unavailable:true,days:[],city:"Foz do Iguaçu, PR",sources_checked:["INMET","CPTEC/INPE","MET Norway / ECMWF IFS"],message:"Fontes oficiais não responderam com previsão utilizável neste momento.",last_checked:new Date().toISOString(),diagnostics:errors.slice(0,5)},503);
});
