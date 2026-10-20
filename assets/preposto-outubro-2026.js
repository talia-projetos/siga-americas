// Transcrição preliminar do caderno do preposto (02–08/10/2026).
// Nunca representa medição aprovada ou execução validada; dados exibidos somente
// para triagem técnica na Cobertura, sem alterar indicadores contratuais.
export const apontamentosPreposto=[
["2026-10-02","Operação de trator",8,"h","3.38","8 h anotadas"],
["2026-10-02","Irrigação",8,"h","3.23","8 h anotadas; conferir objeto do serviço"],
["2026-10-02","Trator agrícola (manutenção)",8,"h","3.46","8 h anotadas"],
["2026-10-02","S.E. — ciclovia",240,"h","a conferir","30 × 8 h; esclarecer abreviação S.E. e base de medição"],
["2026-10-02","Poda de limpeza",34,"un","3.25","Cerca da Vila C; quantidade com rasura no caderno: conferir 34"],
["2026-10-02","Corte de árvores até 0,40 m",18,"un","3.30","Cerca da Vila C"],
["2026-10-05","Operação de trator",8,"h","3.38","8 h anotadas"],
["2026-10-05","Trator agrícola",8,"h","3.46","Vila B"],
["2026-10-05","S.E. — ciclovia",264,"h","a conferir","33 × 8 h; esclarecer abreviação e tipo de serviço"],
["2026-10-05","Remoção manual de entulho",70,"m³","3.11","Distribuição anotada por locais; conferir volumes/setores"],
["2026-10-05","Poda de limpeza",38,"un","3.25","Av. Tancredo Neves: 33; Mercado Municipal: 5"],
["2026-10-05","Poda de palmeiras",8,"un","3.27","Estacionamento"],
["2026-10-05","Corte de árvores até 0,40 m",6,"un","3.30","Locais listados no caderno, conferir"],
["2026-10-05","Corte de árvores 0,41–0,70 m",1,"un","3.31","Local anotado no caderno, conferir"],
["2026-10-06","Operação de trator",8,"h","3.38","8 h anotadas"],
["2026-10-06","Remoção manual de entulho",40,"m³","3.11","RBV: 10 m³; ciclovia: 20 m³; DC: 10 m³"],
["2026-10-06","Poda de limpeza",23,"un","3.25","Há distribuição de locais a conferir no manuscrito"],
["2026-10-07","Operação de trator",8,"h","3.38","8 h anotadas"],
["2026-10-07","Irrigação",8,"h","3.23","8 h anotadas"],
["2026-10-07","Trator agrícola",8,"h","3.46","8 h anotadas"],
["2026-10-07","S.E. — ciclovia",264,"h","a conferir","33 × 8 h; esclarecer S.E."],
["2026-10-07","Remoção manual de entulho",70,"m³","3.11","Locais/setores indicados no caderno, confirmar rateio"],
["2026-10-07","Poda de limpeza",58,"un","3.25","Locais indicados no caderno; conferir"],
["2026-10-07","Corte de árvores até 0,40 m",26,"un","3.30","Locais indicados no caderno; conferir"],
["2026-10-08","Operação de trator",8,"h","3.38","8 h anotadas"]
];
export const jornadaPreposto=[
["02/10","Distribuição por almoxarifado, CRV, RBV, manutenção central e terrenos"],
["05/10","Distribuição por almoxarifado, CRV, RBV, manutenção central e terrenos"],
["06/10","Distribuição por almoxarifado, CRV, RBV, manutenção central e terrenos"],
["07/10","Distribuição por almoxarifado, CRV, RBV, manutenção central e terrenos"],
["08/10","Distribuição por almoxarifado, CRV, RBV, manutenção central e terrenos"]
];
export function renderApontamentosPreposto(escapeHTML){
 const safe=s=>escapeHTML(s);
 const date=s=>s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4);
 return '<section class="table-panel preposto-coverage">'+
 '<div class="table-head"><div><h2>Apontamentos do preposto · 02 a 08/10/2026</h2>'+
 '<span>'+apontamentosPreposto.length+' lançamentos transcritos do caderno · Fonte: fotos do caderno, páginas 02 a 08/10 · Situação: aguardando conferência</span></div></div>'+
 '<div class="catalog-context-note">A quantidade é a produção <strong>informada</strong> no manuscrito, não produção comprovada, medição aprovada nem receita faturável. Códigos são referências preliminares à planilha de preços, a validar pelo contrato/OS.</div>'+
 '<div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Atividade relatada</th><th>Quantidade</th><th>Unidade</th><th>Preço ref.</th><th>Observações e conferência</th></tr></thead><tbody>'+
 apontamentosPreposto.map(([day,activity,quantity,unit,code,notes])=>
 '<tr><td>'+safe(date(day))+'</td><td>'+safe(activity)+'</td><td>'+safe(String(quantity))+'</td><td>'+safe(unit)+'</td><td>'+safe(code)+'</td><td>'+safe(notes)+'</td></tr>').join('')+
 '</tbody></table></div></section>'+
 '<p class="catalog-context-note">As anotações de pessoal por posto/frente aparecem nos cinco dias, mas não são lançadas como produção adicional, para não duplicar serviços. A ciclovia da Vila A continua como <strong>pendência operacional</strong> até comprovação do encerramento.</p>';
}
