// SIGA Américas · modelos corporativos para assinatura manuscrita.
// Os arquivos comprovam somente a emissão; não atestam serviço realizado,
// aceite, recebimento ou assinatura. Documentos Word e PDF sob demanda.
const clean=value=>String(value??"").trim();
const val=value=>clean(value)||"Não informado";
const niceDate=d=>d?new Date(String(d).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"Não informado";
const ref=(items,id,pick)=>{const row=(items||[]).find(x=>x.id===id);return row?pick(row):"Não informado"};
const titleCase=x=>clean(x).replaceAll("_"," ").replace(/(^|\s)\p{L}/gu,m=>m.toLocaleUpperCase("pt-BR"));
const numbered=x=>Number.isFinite(Number(x))&&x!==null&&x!==""?
 new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(Number(x)):"Não informado";
const money=x=>x!==null&&x!==undefined&&x!==""?
 new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(x)):"Não informado";
const stripPDF=s=>String(s??"").replace(/[\u2000-\u206F\u2190-\u21FF]/g," ").replace(/[^\x20-\x7E\u00A0-\u00FF]/g,"?");
const fileName=(s)=>clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,65)||"documento";
export function buildOperationalDocument(kind,row,refs){
 if(kind==="os"){
  const a=ref(refs.activity_catalog,row.activity_id,x=>x.code+" · "+x.name);
  const p=ref(refs.contract_items,row.contract_item_id,x=>x.code+" · "+x.name);
  return {
   kind,reference:val(row.reference),heading:"ORDEM DE SERVIÇO",subheading:"Programação e orientação para execução",
   badge:"EMISSÃO PARA COLETA DE ASSINATURAS",
   meta:[["Identificação da OS",val(row.reference)],["Data de emissão",new Date().toLocaleDateString("pt-BR")],["Situação cadastral",titleCase(row.status)]],
   fields:[
    ["Atividade da matriz de 73 itens",a],["Item da planilha de preços",p],
    ["Frente operacional",ref(refs.operational_areas,row.area_id,x=>x.code+" · "+x.name)],
    ["Equipe responsável",ref(refs.teams,row.team_id,x=>x.code+" · "+x.name)],
    ["Local de execução",val(row.location)],["Prazo / data prevista",niceDate(row.due_on)],
    ["Prioridade",titleCase(row.priority)],["Quantidade informada",numbered(row.quantity)+" "+clean(row.unit)]
   ],
   sections:[
    ["01  DESCRIÇÃO DO SERVIÇO",val(row.description)],
    ["02  ORIENTAÇÕES E IMPEDIMENTOS",val(row.impediment)],
    ["03  CONTROLE DE EXECUÇÃO","Início: ____/____/________ às ______  |  Término: ____/____/________ às ______\nEquipe mobilizada: _____________________________________________________\nQuantidade executada e comprovada: _____________________________________\nObservações de campo / evidências: _____________________________________"]
   ],
   notice:"Esta OS organiza a demanda e não equivale a autorização ambiental, execução comprovada, medição aprovada ou aceite contratual. Conferir requisitos de segurança, acessos e autorizações aplicáveis.",
   signers:[["EMISSOR / SUPERVISÃO","Nome, cargo e assinatura"],["CIÊNCIA DA EQUIPE / RESPONSÁVEL","Nome, cargo e assinatura"]]
  };
 }
 const asset=row.vehicle_id?ref(refs.vehicles,row.vehicle_id,x=>
  "Veículo · "+x.plate+" · "+x.description):row.equipment_id?
  ref(refs.equipment,row.equipment_id,x=>"Equipamento · "+x.asset_tag+" · "+x.name):
  "Bem não informado";
 return {
  kind,reference:val(row.term_code),heading:"TERMO DE RESPONSABILIDADE",subheading:"Recebimento, guarda e devolução de bem",
  badge:"PENDENTE DE ASSINATURAS",
  meta:[["Identificação do termo",val(row.term_code)],["Data da entrega informada",niceDate(row.assigned_on)],["Situação cadastral",titleCase(row.status)]],
  fields:[
   ["Responsável designado",ref(refs.employees,row.employee_id,x=>x.name)],
   ["Função",ref(refs.employees,row.employee_id,x=>x.job_title)],
   ["Equipe / lotação",ref(refs.employees,row.employee_id,x=>x.assignment_location||"Não informado")],
   ["Bem sob responsabilidade",asset],
   ["Titularidade",row.equipment_id?ref(refs.equipment,row.equipment_id,x=>x.owner_type==="itaipu"?"Itaipu - bem cedido":x.owner_type==="proerg"?"PROERG":"Não informada"):"A verificar no cadastro do veículo"],
   ["Data da devolução",niceDate(row.returned_on)]
  ],
  sections:[
   ["01  CONDIÇÕES DE RECEBIMENTO",val(row.condition_report)],
   ["02  COMPROMISSOS DE GUARDA","O responsável declara ciência da entrega do bem identificado e compromete-se a utilizá-lo exclusivamente nas atividades autorizadas, observando procedimentos de segurança, conservação e comunicação imediata de avarias, perdas ou ocorrências à supervisão."],
   ["03  DEVOLUÇÃO E REGISTRO","A devolução será conferida e registrada em campo próprio, com a situação do bem e as observações pertinentes. Qualquer responsabilidade por dano depende de apuração específica, sem atribuição automática por este documento.\nCondições da devolução: ________________________________________________\nData: ____/____/________"]
  ],
  notice:"Este termo registra a designação e as condições declaradas, sem presumir entrega material, aceite, assinatura ou responsabilidade automática por danos. Somente assinaturas colhidas e conferência física poderão comprovar o recebimento.",
  signers:[["RESPONSÁVEL DESIGNADO","Nome e assinatura"],["ENTREGA / REPRESENTANTE PROERG","Nome, cargo e assinatura"]]
 };
}
let cached={};
async function docxLib(){return cached.docx??=await import("https://cdn.jsdelivr.net/npm/docx@9.11.0/+esm");}
async function pdfLib(){return cached.pdf??=await import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm");}
async function zipLib(){return cached.zip??=await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");}
function buildDocxContent(model,lib){
 const {Paragraph,TextRun,Table,TableCell,TableRow,WidthType,BorderStyle,AlignmentType}=lib;
 const green="164D38",muted="567263",light="EEF4EE";
 const para=(text,opt={})=>new Paragraph({
  spacing:{after:opt.after??115,before:opt.before??0},alignment:opt.center?AlignmentType.CENTER:AlignmentType.LEFT,
  children:[new TextRun({text:String(text),bold:!!opt.bold,color:opt.color||"294635",size:opt.size||20,breakLine:false})]
 });
 const band=(text)=>para(text,{before:235,after:115,bold:true,color:green,size:21});
 const rows=(pairs)=>new Table({
  width:{size:100,type:WidthType.PERCENTAGE},borders:{
   top:{style:BorderStyle.SINGLE,color:"DCE7DC",size:4},
   bottom:{style:BorderStyle.SINGLE,color:"DCE7DC",size:4},
   left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE},
   insideHorizontal:{style:BorderStyle.SINGLE,color:"E9EEE9",size:4},insideVertical:{style:BorderStyle.NONE}
  },
  rows:pairs.map(([label,value],idx)=>new TableRow({children:[
   new TableCell({width:{size:34,type:WidthType.PERCENTAGE},shading:{fill:idx%2?"FFFFFF":light},
    margins:{top:100,bottom:100,left:120,right:90},
    children:[para(label,{bold:true,size:17,color:"506A58",after:0})]}),
   new TableCell({width:{size:66,type:WidthType.PERCENTAGE},shading:{fill:idx%2?"FFFFFF":"FAFCFA"},
    margins:{top:100,bottom:100,left:120,right:100},
    children:[para(value,{size:18,after:0})]})
  ]}))
 });
 const children=[
  para("PROERG  /  SIGA AMÉRICAS",{bold:true,size:25,color:green,after:60}),
  para("GESTÃO CONTRATUAL  ·  ITAIPU BINACIONAL",{size:15,color:muted,after:240}),
  para(model.heading,{bold:true,size:31,color:"193D2A",after:45}),
  para(model.subheading,{size:19,color:muted,after:175}),
  para(model.badge,{bold:true,size:15,color:"567B54",after:180}),
  rows(model.meta),
  band("IDENTIFICAÇÃO E REFERÊNCIAS"),rows(model.fields)
 ];
 for(const [h,body] of model.sections){
  children.push(band(h));
  for(const line of String(body).split("\n"))children.push(para(line||" ",{size:18,after:95}));
 }
 children.push(band("OBSERVAÇÃO DOCUMENTAL"),para(model.notice,{size:16,color:muted,after:150}));
 children.push(para("Local: _______________________________    Data: ____ / ____ / ________",{size:18,before:120,after:300}));
 for(const [label,sub] of model.signers){
  children.push(para("_______________________________________________",{size:20,before:210,after:35}));
  children.push(para(label,{bold:true,size:16,after:25}));
  children.push(para(sub,{size:15,color:muted,after:150}));
 }
 children.push(para("SIGA Américas  |  Documento emitido para assinatura física  |  Via administrativa",{size:14,color:muted,after:0}));
 return children;
}
export async function generateWord(model){
 const lib=await docxLib();
 const document=new lib.Document({
  creator:"SIGA Américas / PROERG",title:model.heading+" · "+model.reference,
  description:"Modelo administrativo para assinatura manual. Emissão não comprova aceite.",
  styles:{default:{document:{run:{font:"Aptos",size:19,color:"294635"},paragraph:{spacing:{line:276}}}}},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:760,left:900,right:900}}},children:buildDocxContent(model,lib)}]
 });
 return await lib.Packer.toBlob(document);
}
function wrapText(font,text,size,width){
 const lines=[];
 for(const raw of stripPDF(text).split("\n")){
  let out="";
  for(const word of (raw.match(/\S+/g)||[""])){
   const candidate=out?out+" "+word:word;
   if(font.widthOfTextAtSize(candidate,size)<=width){out=candidate;continue;}
   if(out){lines.push(out);out="";}
   if(font.widthOfTextAtSize(word,size)<=width){out=word;continue;}
   let piece="";
   for(const c of word){if(font.widthOfTextAtSize(piece+c,size)>width&&piece){lines.push(piece);piece=c;}else piece+=c;}
   out=piece;
  }
  lines.push(out);
 }
 return lines;
}
export async function generatePDF(models){
 const lib=await pdfLib();
 const pdf=await lib.PDFDocument.create();
 pdf.setTitle(models.length===1?models[0].heading+" · "+models[0].reference:"SIGA Américas - documentos para assinatura");
 pdf.setAuthor("SIGA Américas / PROERG");
 pdf.setSubject("Documentos administrativos para coleta de assinatura física; sem comprovação de execução");
 const regular=await pdf.embedFont(lib.StandardFonts.Helvetica),bold=await pdf.embedFont(lib.StandardFonts.HelveticaBold);
 const dark=lib.rgb(.10,.26,.20),green=lib.rgb(.11,.37,.27),muted=lib.rgb(.37,.49,.42),line=lib.rgb(.85,.90,.86);
 const W=595.28,H=841.89,margin=49;
 let page,y,pageNo=0;
 const bottom=65;
 const start=()=>{
  page=pdf.addPage([W,H]);pageNo++;
  page.drawRectangle({x:0,y:H-12,width:W,height:12,color:green});
  page.drawText("PROERG  /  SIGA AMÉRICAS",{x:margin,y:H-47,size:14,font:bold,color:green});
  page.drawText("GESTÃO CONTRATUAL · ITAIPU BINACIONAL",{x:margin,y:H-66,size:8.1,font:regular,color:muted});
  page.drawLine({start:{x:margin,y:H-78},end:{x:W-margin,y:H-78},thickness:1,color:line});
  page.drawText("Documento emitido para assinatura física · SIGA Américas",{x:margin,y:37,size:7.2,font:regular,color:muted});
  page.drawText(String(pageNo),{x:W-margin-5,y:37,size:8,font:regular,color:muted});
  y=H-102;
 };
 const ensure=needed=>{if(y-needed<bottom)start();};
 const textLines=(text,size=9.5,opt={})=>{
  const max=opt.width||W-margin*2;const f=opt.bold?bold:regular;
  const lines=wrapText(f,text,size,max),lh=opt.lineHeight||size*1.48;
  ensure(lines.length*lh+4);
  for(const chunk of lines){page.drawText(chunk||" ",{x:opt.x||margin,y,size,font:f,color:opt.color||dark});y-=lh;}
  y-=opt.after??4;
 };
 const label=(name,value)=>{
  const left=172,right=W-margin-left-40;
  const labelLines=wrapText(bold,name,8.5,left-8);
  const valueLines=wrapText(regular,value,9,right);
  const height=Math.max(labelLines.length*12,valueLines.length*12)+12;
  ensure(height);
  page.drawRectangle({x:margin-5,y:y-height+13,width:W-2*margin+9,height,color:lib.rgb(.973,.984,.974)});
  labelLines.forEach((chunk,i)=>page.drawText(chunk,{x:margin+4,y:y-i*12,size:8.5,font:bold,color:muted}));
  valueLines.forEach((chunk,i)=>page.drawText(chunk,{x:margin+left,y:y-i*12,size:9,font:regular,color:dark}));
  y-=height+4;
 };
 const section=s=>{ensure(29);y-=12;page.drawText(stripPDF(s),{x:margin,y,size:10.2,font:bold,color:green});y-=17;};
 for(const model of models){
  start();
  textLines(model.heading,18,{bold:true,color:dark,lineHeight:23,after:0});
  textLines(model.subheading,9.3,{color:muted,after:11});
  textLines(model.badge,8.4,{bold:true,color:green,after:13});
  model.meta.forEach(([name,value])=>label(name,value));
  section("IDENTIFICAÇÃO E REFERÊNCIAS");
  model.fields.forEach(([name,value])=>label(name,value));
  for(const [h,body] of model.sections){section(h);textLines(body,9.2,{lineHeight:13.5,after:6});}
  section("OBSERVAÇÃO DOCUMENTAL");textLines(model.notice,8,{color:muted,lineHeight:11.5,after:11});
  ensure(60);textLines("Local: ______________________________     Data: ____ / ____ / ________ ",9,{after:22});
  for(const [role,detail] of model.signers){
   ensure(54);
   page.drawLine({start:{x:margin,y:y-7},end:{x:margin+230,y:y-7},thickness:.8,color:dark});
   y-=22;
   textLines(role,8.8,{bold:true,after:0});
   textLines(detail,8,{color:muted,after:13});
  }
 }
 return new Blob([await pdf.save()],{type:"application/pdf"});
}
export function downloadDocument(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function generateBatchWordZip(models){
 const lib=await zipLib(),zip=new (lib.default||lib)();
 for(let i=0;i<models.length;i++){
  const m=models[i],blob=await generateWord(m);
  zip.file(String(i+1).padStart(2,"0")+"_"+(m.kind==="os"?"OS_":"Termo_")+fileName(m.reference)+".docx",await blob.arrayBuffer());
 }
 return await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:5}});
}
export async function generateCompletePack(models){
 const lib=await zipLib(),zip=new (lib.default||lib)();
 const pdf=await generatePDF(models);
 zip.file("Documentos_para_imprimir.pdf",await pdf.arrayBuffer());
 for(let i=0;i<models.length;i++){
  const m=models[i],doc=await generateWord(m);
  zip.file("Word/"+String(i+1).padStart(2,"0")+"_"+(m.kind==="os"?"OS_":"Termo_")+fileName(m.reference)+".docx",await doc.arrayBuffer());
 }
 return await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:5}});
}
export function safeFilename(model){
 return (model.kind==="os"?"OS_":"Termo_")+fileName(model.reference);
}
