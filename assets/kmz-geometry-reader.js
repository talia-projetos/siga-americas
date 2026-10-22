// Leitura seletiva de KMZ, inclusive arquivos grandes com fotos incorporadas.
// Processa exclusivamente a entrada KML compactada, nunca carrega todas as imagens.
// ZIP clássico com diretório central de 32 bits; ZIP64 sinaliza erro explícito.
const u16=(d,n)=>d.getUint16(n,true),u32=(d,n)=>d.getUint32(n,true);
const decoder=new TextDecoder("utf-8");
export async function readKmlFromKmz(file,{maxKmlBytes=24*1024*1024}={}){
 if(!file||!Number.isFinite(file.size)||file.size<22)throw Error("KMZ vazio ou inválido.");
 const tailSize=Math.min(file.size,65557),tail=new DataView(await file.slice(file.size-tailSize).arrayBuffer());
 let end=-1;
 for(let i=tail.byteLength-22;i>=0;i--){if(u32(tail,i)===0x06054b50){end=i;break;}}
 if(end<0)throw Error("Não foi encontrado o diretório ZIP no KMZ.");
 const count=u16(tail,end+10),length=u32(tail,end+12),offset=u32(tail,end+16);
 if(count===0xffff||length===0xffffffff||offset===0xffffffff)throw Error("KMZ em formato ZIP64: exporte apenas as geometrias em KML.");
 if(length>12*1024*1024)throw Error("KMZ com diretório de arquivos muito grande. Exporte um KML sem fotos.");
 if(offset+length>file.size)throw Error("Diretório ZIP inconsistente no KMZ.");
 const directory=new DataView(await file.slice(offset,offset+length).arrayBuffer()),kmls=[];
 let cursor=0;
 for(let i=0;i<count&&cursor+46<=directory.byteLength;i++){
  if(u32(directory,cursor)!==0x02014b50)throw Error("Diretório ZIP inválido.");
  const flags=u16(directory,cursor+8),method=u16(directory,cursor+10);
  const compressed=u32(directory,cursor+20),plain=u32(directory,cursor+24);
  const fileNameLength=u16(directory,cursor+28),extra=u16(directory,cursor+30),comment=u16(directory,cursor+32);
  const localOffset=u32(directory,cursor+42);
  const endName=cursor+46+fileNameLength;
  if(endName>directory.byteLength)throw Error("Nome de arquivo inválido no KMZ.");
  const name=decoder.decode(new Uint8Array(directory.buffer,directory.byteOffset+cursor+46,fileNameLength));
  if(/\.kml$/i.test(name)&&!name.includes("../")){
   if((flags&1)!==0)throw Error("KMZ criptografado não é aceito.");
   kmls.push({name,method,compressed,plain,localOffset});
  }
  cursor=endName+extra+comment;
 }
 if(!kmls.length)throw Error("Nenhuma geometria KML foi encontrada no KMZ.");
 // Preferir doc.kml, o KML raiz usual do Google Earth, sem supor conteúdo temático.
 kmls.sort((a,b)=>{
  const rank=n=>/(^|\/)doc\.kml$/i.test(n)?0:n.includes("/")?2:1;
  return rank(a.name)-rank(b.name)||b.plain-a.plain;
 });
 const item=kmls[0];
 if(item.plain>maxKmlBytes||item.compressed>maxKmlBytes)
  throw Error("KML interno maior que 24 MB. Exporte apenas as geometrias em KML, sem imagens.");
 if(item.localOffset+30>file.size)throw Error("Cabeçalho local inválido.");
 const local=new DataView(await file.slice(item.localOffset,item.localOffset+30).arrayBuffer());
 if(u32(local,0)!==0x04034b50)throw Error("Entrada KML com cabeçalho ZIP inválido.");
 const dataStart=item.localOffset+30+u16(local,26)+u16(local,28);
 if(dataStart+item.compressed>file.size)throw Error("Geometria KMZ truncada.");
 let content;
 if(item.method===0){
  content=await file.slice(dataStart,dataStart+item.compressed).text();
 }else if(item.method===8){
  if(typeof DecompressionStream==="undefined")throw Error("Navegador sem descompactação ZIP. Exporte em KML.");
  try{
   const stream=file.slice(dataStart,dataStart+item.compressed).stream().pipeThrough(new DecompressionStream("deflate-raw"));
   content=await new Response(stream).text();
  }catch(e){throw Error("Falha ao descompactar o KML. Exporte o arquivo no Google Earth como KML: "+e.message);}
 }else throw Error("Compactação ZIP não suportada (método "+item.method+").");
 if(content.length>maxKmlBytes)throw Error("KML excedeu o limite após a descompactação.");
 return {content,entry:item.name,otherKmlCount:kmls.length-1,zipSize:file.size};
}
