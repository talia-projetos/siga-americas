// SIGA - fontes meteorológicas oficiais: INMET com contingência CPTEC/INPE.
// Nunca retornar dados gerados ou extrapolações como previsão.
const cors={"Access-Control-Allow-Origin":"https://talia-projetos.github.io",
"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
"Access-Control-Allow-Methods":"GET,OPTIONS"};
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=900"}});
const timezone="America/Sao_Paulo";
const nowDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const num=v=>v==null||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const normalize=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
async function get(url){
 const c=new AbortController();const t=setTimeout(()=>c.abort(),5200);
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
 return respond({unavailable:true,days:[],city:"Foz do Iguaçu, PR",sources_checked:["INMET","CPTEC/INPE"],message:"INMET e CPTEC/INPE não forneceram previsão atual verificável. Consulte as fontes oficiais antes de liberar o campo.",last_checked:new Date().toISOString()},503);
});
