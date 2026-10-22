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
const stripPDF=s=>String(s??"").replace(/\r\n?/g,"\n").replace(/[\u2000-\u206F\u2190-\u21FF]/g," ").replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g,"?");
const fileName=(s)=>clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,65)||"documento";
export function buildOperationalDocument(kind,row,refs){
 if(kind==="os"){
  const a=ref(refs.activity_catalog,row.activity_id,x=>x.code+" · "+x.name);
  const priceItem=(refs.contract_items||[]).find(x=>x.id===row.contract_item_id&&x.source_type==="precos");
  const p=priceItem?[priceItem.code,priceItem.name].filter(Boolean).join(" · "):"Não vinculado";
  const priceUnit=clean(priceItem?.unit);
  const recordedUnit=clean(row.unit);
  const unit=priceUnit||recordedUnit;
  const unitMismatch=Boolean(priceUnit&&recordedUnit&&priceUnit!==recordedUnit);
  const qtySet=row.quantity!==null&&row.quantity!==undefined&&row.quantity!=="";
  const unitLabel=unit?(priceUnit?unit+" (planilha de preços)":unit+" (informada no cadastro)"):"A definir";
  const unitAlert=unitMismatch?"Unidade do cadastro divergente da planilha de preços; conferir o registro antes do uso.":!unit&&qtySet?"Unidade não definida; conferir antes do uso.":"";
  return {
   kind,reference:val(row.reference),heading:"ORDEM DE SERVIÇO",subheading:"Programação e orientação para execução",
   badge:"EMISSÃO PARA COLETA DE ASSINATURAS",
   meta:[["Identificação da OS",val(row.reference)],["Data de emissão",new Date().toLocaleDateString("pt-BR")],["Situação cadastral",titleCase(row.status)]],
   fields:[
    ["Atividade da matriz de 73 itens",a],["Item da planilha de preços",p],
    ["Frente operacional",ref(refs.operational_areas,row.area_id,x=>x.code+" · "+x.name)],
    ["Equipe responsável",ref(refs.teams,row.team_id,x=>x.code+" · "+x.name)],
    ["Local de execução",val(row.location)],["Prazo / data prevista",niceDate(row.due_on)],
    ["Prioridade",titleCase(row.priority)],
    ["Quantidade prevista na OS",qtySet?numbered(row.quantity):"A definir"],
    ["Unidade de medição",unitLabel],
    ...(unitAlert?[["Conferência necessária",unitAlert]]:[])
   ],
   sections:[
    ["01  DESCRIÇÃO DO SERVIÇO",val(row.description)],
    ["02  ORIENTAÇÕES E IMPEDIMENTOS",val(row.impediment)],
    ["03  REGISTRO POSTERIOR DA EXECUÇÃO",
     "Preencher após a realização do serviço; este espaço não comprova a execução.\n"+
     "Data e hora de início: ____/____/________  às ______\n"+
     "Data e hora de término: ____/____/________  às ______\n"+
     "Equipe mobilizada: ______________________________________________\n"+
     "Quantidade efetivamente executada: ______________________________\n"+
     "Unidade de medição: "+(unit||"A confirmar")+"\n"+
     "Evidências / referência documental: ______________________________\n"+
     "Ocorrências / observações: _______________________________________"]
   ],
   notice:"Esta OS registra programação e orientação. A quantidade prevista não constitui execução comprovada, medição aprovada ou aceite contratual. Conferir requisitos de segurança, acessos e autorizações aplicáveis."+(unitAlert?" Atenção: "+unitAlert:""),
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
/* Rasterização para Word/PDF: usa o SVG oficial sem editar seus caminhos.
   A cor discreta é aplicada somente à cópia renderizada no documento. */
async function officialLogo(){
 if(!cached.logo){
  cached.logo=(async()=>{
   const img=new Image();
   img.src=new URL("./assets/proerg-official-white.svg?v=1",document.baseURI).href;
   await img.decode();
   const src=document.createElement("canvas");src.width=1000;src.height=500;
   const context=src.getContext("2d",{willReadFrequently:true});
   if(!context)throw Error("Canvas indisponível");
   context.drawImage(img,0,0,src.width,src.height);
   const data=context.getImageData(0,0,src.width,src.height).data;
   let x0=src.width,y0=src.height,x1=0,y1=0;
   for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){
    if(data[(y*src.width+x)*4+3]>20){
     x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
   }
   if(x0>x1||y0>y1)throw Error("Marca não renderizada");
   const width=x1-x0+1,height=y1-y0+1;
   const output=document.createElement("canvas");output.width=width;output.height=height;
   const out=output.getContext("2d");
   out.drawImage(src,x0,y0,width,height,0,0,width,height);
   out.globalCompositeOperation="source-in";out.fillStyle="#31533F";out.fillRect(0,0,width,height);
   const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error("PNG indisponível")),"image/png"));
   return {bytes:new Uint8Array(await blob.arrayBuffer()),width,height};
  })().catch(error=>{cached.logo=null;throw error});
 }
 return cached.logo;
}
function buildDocxContent(model,lib,logo){
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
  ...(logo?[new Paragraph({spacing:{after:70},children:[new lib.ImageRun({
   data:logo.bytes,type:"png",transformation:{width:135,height:Math.max(22,Math.round(135*logo.height/logo.width))}
  })]})]:[para("PROERG",{bold:true,size:25,color:green,after:60})]),
  para("SIGA AMÉRICAS  |  SISTEMA DE GESTÃO DA PROERG EM ITAIPU",{size:15,color:muted,after:240}),
  para(model.heading,{bold:true,size:31,color:"193D2A",after:45}),
  para(model.subheading,{size:19,color:muted,after:175}),
  para(model.badge,{bold:true,size:15,color:"567B54",after:180}),
  rows(model.meta),
  band("IDENTIFICAÇÃO E REFERÊNCIAS"),rows(model.fields)
 ];
 for(const [h,body] of model.sections){
  children.push(band(h));
  for(const line of String(body).split("\n"))children.push(para(line||" ",{size:18,after:model.kind==="os"&&h.startsWith("03")?165:95}));
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
 const logo=await officialLogo().catch(()=>null);
 const document=new lib.Document({
  creator:"PROERG · SIGA Américas (sistema de gestão)",title:model.heading+" · "+model.reference,
  description:"Modelo administrativo para assinatura manual. Emissão não comprova aceite.",
  styles:{default:{document:{run:{font:"Aptos",size:19,color:"294635"},paragraph:{spacing:{line:276}}}}},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:760,left:900,right:900}}},children:buildDocxContent(model,lib,logo)}]
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
 pdf.setAuthor("PROERG · Sistema SIGA Américas");
 pdf.setSubject("Documentos administrativos para coleta de assinatura física; sem comprovação de execução");
 const regular=await pdf.embedFont(lib.StandardFonts.Helvetica),bold=await pdf.embedFont(lib.StandardFonts.HelveticaBold);
 const companyImage=await officialLogo().then(logo=>pdf.embedPng(logo.bytes)).catch(()=>null);
 const dark=lib.rgb(.10,.26,.20),green=lib.rgb(.11,.37,.27),muted=lib.rgb(.37,.49,.42),line=lib.rgb(.85,.90,.86);
 const W=595.28,H=841.89,margin=49;
 let page,y,pageNo=0;
 const bottom=65;
 const start=()=>{
  page=pdf.addPage([W,H]);pageNo++;
  page.drawRectangle({x:0,y:H-12,width:W,height:12,color:green});
  if(companyImage){
   const h=114*companyImage.height/companyImage.width;
   page.drawImage(companyImage,{x:margin,y:H-33-h,width:114,height:h});
   page.drawText("SIGA AMÉRICAS",{x:margin+130,y:H-45,size:9.5,font:bold,color:green});
   page.drawText("Sistema de gestão da PROERG em Itaipu",{x:margin+130,y:H-60,size:8,font:regular,color:muted});
  }else{
   page.drawText("PROERG",{x:margin,y:H-47,size:14,font:bold,color:green});
   page.drawText("SIGA AMÉRICAS · SISTEMA DE GESTÃO DA PROERG EM ITAIPU",{x:margin,y:H-66,size:8.1,font:regular,color:muted});
  }
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
  if(model.subheading)textLines(model.subheading,9.3,{color:muted,after:11});
  if(model.badge)textLines(model.badge,8.4,{bold:true,color:green,after:13});
  if(!model.subheading&&!model.badge)y-=8;
  model.meta.forEach(([name,value])=>label(name,value));
  section("IDENTIFICAÇÃO E REFERÊNCIAS");
  model.fields.forEach(([name,value])=>label(name,value));
  for(const [h,body] of model.sections){
   const executionRegister=(model.kind==="os"||model.kind==="programacao")&&h.startsWith("03");
   // Mantém título e linhas de preenchimento juntos em uma mesma página.
   if(executionRegister)ensure(wrapText(regular,body,9.2,W-margin*2).length*19+49);
   section(h);
   textLines(body,9.2,{lineHeight:executionRegister?19:13.5,after:executionRegister?12:6});
  }
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
