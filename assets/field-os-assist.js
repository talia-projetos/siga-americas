// Apoio ao registro técnico semanal: relação segura de OS e postos (sem execução presumida).
// Uma OS somente é preselecionada quando o vínculo é inequívoco.
const iso=x=>String(x||"").slice(0,10);
const endWeek=s=>{const d=new Date(iso(s)+"T12:00:00Z");if(Number.isNaN(d.getTime()))return "";d.setUTCDate(d.getUTCDate()+6);return d.toISOString().slice(0,10)};
export function teamFixedPosts(team,posts){return team?.code==="EQ06"?(posts||[]).slice().sort((a,b)=>String(a.code).localeCompare(String(b.code),"pt-BR",{numeric:true})):[]}
export function allowedTeamAreas(team,areas,links,posts){
 const own=new Set((links||[]).filter(x=>x.team_id===team?.id&&x.active!==false).map(x=>x.area_id));
 if(team?.code==="EQ06")for(const post of teamFixedPosts(team,posts))if(post.area_id)own.add(post.area_id);
 return (areas||[]).filter(a=>own.has(a.id));
}
export function relevantOrders({orders=[],links=[],teamId,teamCode,postId="",areaId="",week="",workedOn=""}={}){
 const max=endWeek(week);
 const postOrderIds=new Set(links.filter(l=>l.service_post_id===postId&&postId).map(l=>l.work_order_id));
 const allPostIds=new Set(links.filter(l=>l.service_post_id).map(l=>l.work_order_id));
 return orders.filter(o=>{
  if(o.status==="cancelada")return false;
  const linkedToThisPost=postOrderIds.has(o.id);
  const linkedToOtherPost=allPostIds.has(o.id)&&!linkedToThisPost;
  if(linkedToOtherPost)return false;
  if(!(o.team_id===teamId||teamCode==="EQ06"&&linkedToThisPost))return false;
  // Quando o posto é selecionado, não sugerir OS de outro posto/área.
  if(areaId&&o.area_id&&o.area_id!==areaId&&!linkedToThisPost)return false;
  if(postId&&allPostIds.has(o.id)&&!linkedToThisPost)return false;
  const due=iso(o.due_on);
  if(workedOn&&due&&due!==workedOn)return false;
  if(!workedOn&&due&&week&&(due<week||due>max))return false;
  return true;
 }).sort((a,b)=>Number(Boolean(postOrderIds.has(b.id)))-Number(Boolean(postOrderIds.has(a.id)))||
  String(a.due_on||"").localeCompare(String(b.due_on||""))||
  String(a.reference||"").localeCompare(String(b.reference||""),"pt-BR",{numeric:true}));
}
export function autoMatchOrder(candidates,currentId="",activityId=""){
 if(currentId){return candidates.find(o=>o.id===currentId)||null}
 const matching=activityId?candidates.filter(o=>o.activity_id===activityId):candidates;
 return matching.length===1?matching[0]:null;
}
export function orderPrefill(order,post,unitHint=""){
 return {area_id:post?.area_id||order?.area_id||"",
  activity_id:order?.activity_id||"",
  location:post?.name||order?.location||"",
  unit:order?.unit||unitHint||"",
  planned_quantity:order?.quantity??null};
}
