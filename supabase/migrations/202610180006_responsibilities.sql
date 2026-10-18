-- SIGA Américas: responsabilidades documentais, provisionamento e eixos de conformidade.
-- Não altera custos/quantidades nem marca requisitos como atendidos.
begin;
alter table public.contract_obligations
  add column if not exists party_responsible text not null default 'a_confirmar',
  add column if not exists domain text not null default 'documentacao',
  add column if not exists review_status text not null default 'a_conferir';
alter table public.contract_resource_requirements
  add column if not exists provider_party text not null default 'a_confirmar',
  add column if not exists review_status text not null default 'a_conferir';
do $do$
begin
  if not exists (select 1 from pg_constraint where conname='siga_obligation_party_check') then
    alter table public.contract_obligations add constraint siga_obligation_party_check
    check(party_responsible in ('proerg','itaipu','compartilhada','a_confirmar'));
  end if;
  if not exists (select 1 from pg_constraint where conname='siga_resources_provider_check') then
    alter table public.contract_resource_requirements add constraint siga_resources_provider_check
    check(provider_party in ('proerg','itaipu','compartilhada','a_confirmar'));
  end if;
  if not exists (select 1 from pg_constraint where conname='siga_obligation_domain_check') then
    alter table public.contract_obligations add constraint siga_obligation_domain_check
    check(domain in ('campo','pessoal','seguranca','frota','maquinas','materiais','ambiental','documentacao'));
  end if;
end $do$;
update public.contract_obligations
set party_responsible='proerg',
    domain=case
      when source_ref like '3.40%' then 'campo'
      when source_ref like '5.1%' then 'pessoal'
      when source_ref like '5.2%' then 'seguranca'
      when source_ref='6.1' then 'frota'
      when source_ref='6.2' then 'maquinas'
      when source_ref='6.4' then 'materiais'
      when source_ref='6.5' then 'seguranca'
      when source_ref='6.6' then 'pessoal'
      when source_ref='7.4' then 'materiais'
      when source_ref='8' then 'ambiental'
      else 'documentacao'
    end
where party_responsible='a_confirmar';
update public.contract_resource_requirements
set provider_party='proerg'
where provider_party='a_confirmar';
-- A cessão específica da Itaipu não transfere as demais obrigações da contratada.
insert into public.contract_obligations(contract_id,source_ref,title,description,responsible,status,party_responsible,domain,review_status,notes)
select c.id,'3.9','Equipamentos e combustíveis para manutenção das trilhas no RBV',
 'Fornecimento específico de equipamentos e combustível associado ao serviço de trilhas do RBV, conforme a especificação. Confirmar alcance com fiscalização e documentos de cessão.',
 'Itaipu / fiscalização','pendente','itaipu','materiais','a_conferir',
 'Cadastro de referência documental; status pendente indica verificação não concluída, não descumprimento confirmado.'
from public.contracts c
where not exists(select 1 from public.contract_obligations o where o.contract_id=c.id and o.source_ref='3.9' and o.title='Equipamentos e combustíveis para manutenção das trilhas no RBV');
insert into public.contract_resource_requirements(contract_id,source_ref,category,item_name,unit,provider_party,review_status,remarks)
select c.id,'3.9','equipamento','Equipamentos e combustível para manutenção das trilhas no RBV','conforme demanda','itaipu','a_conferir',
 'Fornecimento específico atribuído à Itaipu segundo referência técnica 3.9; confirmar documentação, quantitativos e uso real.'
from public.contracts c
on conflict (source_ref,category,item_name) do nothing;
create index if not exists siga_obligation_party_status on public.contract_obligations(party_responsible,domain,status);
create index if not exists siga_resource_party_category on public.contract_resource_requirements(provider_party,category,validation_status);
commit;