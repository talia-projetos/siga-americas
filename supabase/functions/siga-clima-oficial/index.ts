// SIGA · consulta à previsão INMET. Somente a cidade operacional Foz do Iguaçu/PR.
const allowedOrigin = "https://talia-projetos.github.io";
const cors = {"Access-Control-Allow-Origin": allowedOrigin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,OPTIONS"};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=900"}});
function text(x){return String(x??"").trim();}
function dayEntries(data){
 const city=data?.["4108304"]||data?.["FOZ DO IGUACU"]||data;
 if(!city||typeof city!=="object")return [];
 return Object.entries(city).filter(([date,value])=>/^20\d\d-\d\d-\d\d$/.test(date)&&value&&typeof value==="object").sort(([a],[b])=>a.localeCompare(b)).slice(0,7).map(([date,obj])=>{
  const periods=Object.values(obj).filter(v=>v&&typeof v==="object");
  const value=(...keys)=>periods.map(p=>keys.map(k=>p[k])).flat().find(v=>v!==null&&v!==undefined&&String(v)!=="");
  const desc=text(value("resumo","tempo","descricao","condicao","tempo_manha","tempo_tarde"))||"Previsão disponível no INMET";
  const mi=value("temp_min","minima","temperatura_minima");
  const ma=value("temp_max","maxima","temperatura_maxima");
  return {date,description:desc.slice(0,180),min:mi!=null?Number(mi):null,max:ma!=null?Number(ma):null};
 });
}
Deno.serve(async (req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET")return json({error:"Método não permitido"},405);
 const ctl=new AbortController();
 const timeout=setTimeout(()=>ctl.abort(),6500);
 try{
  const res=await fetch("https://apiprevmet3.inmet.gov.br/previsao/4108304",{signal:ctl.signal,headers:{"Accept":"application/json"}});
  if(!res.ok)throw Error("HTTP "+res.status);
  const payload=await res.json();
  const days=dayEntries(payload);
  if(!days.length)throw Error("Previsão sem datas reconhecíveis.");
  return json({source:"INMET",city:"Foz do Iguaçu, PR",source_url:"https://previsao.inmet.gov.br/4108304",retrieved_at:new Date().toISOString(),horizon:"curto_prazo",days});
 }catch(err){
  return json({source:"INMET",city:"Foz do Iguaçu, PR",days:[],unavailable:true,message:"Fonte oficial temporariamente indisponível; não substituir por previsão não verificada.",source_url:"https://previsao.inmet.gov.br/4108304",reason:String(err).slice(0,140)},503);
 }finally{clearTimeout(timeout);}
});