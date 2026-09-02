# Baseline granular de migrations

## Escopo e compatibilidade

Esta baseline atende aos itens B04/B05 do parecer: uma operação lógica por
migration e uso de Schema/Table Builder quando há equivalência limpa. O objetivo
é reproduzir o estado final das 11 migrations do commit
`581c6baf71ee7652c74de0efd123939cb9110cec`, sem alterar regras funcionais. O código
antigo permanece recuperável no Git; a tag histórica `v0.1.0-mvp` não é alterada.

As 25 migrations novas destinam-se a bancos novos e vazios. **Não executar sobre
`clinic_system`, `clinic_system_test` ou outro banco com o histórico anterior.**
O Lucid identifica migrations por nome: os novos arquivos seriam considerados
pendentes mesmo se as tabelas já existissem. Isso não constitui uma atualização
incremental e não deve ser resolvido com reset/fresh ou edição automática de
`adonis_schema`.

Para um ambiente local existente, preservar dados e histórico; qualquer transição
exige decisão explícita: manter o banco anterior e criar outro vazio, ou preparar
um procedimento próprio de migração de dados e conciliação de histórico. Backup,
restauração verificada e autorização do responsável precedem qualquer operação
destrutiva. Esta fase não executa essa transição e não altera o dump local
`database_schema.sql`. Evoluções após a aprovação desta baseline voltam a ser
migrations incrementais, sem reescrever arquivos aplicados.

## Guarda executável da linhagem

A migration `1788307199999_guard_legacy_migration_lineage.ts` executa primeiro,
antes de qualquer DDL da baseline. A proteção estava ausente na implementação
inicial de 24 migrations e foi incluída na revisão corretiva da Fase 2.

A guarda usa `defer` e um SELECT via Query Builder, na mesma conexão/transação
do runner. Obtém `migrations.tableName` da configuração do cliente Knex, com o
mesmo default `adonis_schema` do Lucid 21.8.2. A configuração é preservada no
cliente transacional; não há import de configuração global ou conexão paralela.
Ela reconhece os 11 prefixos temporais históricos, normalizando separadores de
caminho Windows/Unix e aceitando nomes sem extensão, `.ts` ou `.js`.

Se houver histórico legado, lança `LEGACY_MIGRATION_LINEAGE`, descreve o motivo
e interrompe a sequência. Não cria objetos, não altera nem remove registros do
ledger e não registra a própria guarda quando falha. Em banco novo passa
normalmente. Seu `down` é vazio: somente o runner remove o registro da própria
guarda durante um rollback normal.

Limite explícito: antes de chamar a primeira migration, o Lucid prepara suas
tabelas de controle e pode atualizar metadados de versão 1 para 2. Nenhuma
migration consegue impedir esse bootstrap anterior. A guarda impede DDL da
**nova baseline**, não promete ausência absoluta de escritas internas do Lucid
em ledgers antigos/incompletos. Com o ledger v2 usado pelo Lucid 21.8.2 no MVP,
a rejeição deve preservar integralmente metadados, schema e dados preexistentes.
Ela não substitui as restrições de acesso aos bancos reais nem autoriza testes
contra eles.

A guarda reconhece a linhagem pelo ledger, não por inspeção genérica do schema.
Se alguém apagar o histórico antigo ou registrar manualmente a guarda como
aplicada, essa proteção pode ser contornada; o Lucid não reexecuta migrations
já registradas. Não se deve manipular o ledger para forçar a nova baseline.

## Ordem e granularidade

Arquivos em `backend/database/migrations`, todos com extensão `.ts`:

| Ordem / prefixo | Sufixo do arquivo                                | Responsabilidade              |
| --------------- | ------------------------------------------------ | ----------------------------- |
| 1788307199999   | guard_legacy_migration_lineage                   | Guarda somente de leitura     |
| 1788307200000   | create_clinic_schema                             | Schema `clinic`               |
| 1788307200001   | create_users_table                               | Usuários                      |
| 1788307200002   | create_auth_access_tokens_table                  | Tokens                        |
| 1788307200003   | create_clinics_table                             | Consultórios e timezone       |
| 1788307200004   | create_permissions_table                         | Permissões                    |
| 1788307200005   | create_roles_table                               | Perfis                        |
| 1788307200006   | create_role_permissions_table                    | Permissões dos perfis         |
| 1788307200007   | create_user_clinic_roles_table                   | Vínculos locais dos usuários  |
| 1788307200008   | create_patients_table                            | Pacientes                     |
| 1788307200009   | create_patient_clinics_table                     | Pacientes por consultório     |
| 1788307200010   | create_medical_records_table                     | Prontuários                   |
| 1788307200011   | create_professionals_table                       | Profissionais                 |
| 1788307200012   | create_clinic_professionals_table                | Profissionais por consultório |
| 1788307200013   | create_professional_weekly_availabilities_table  | Disponibilidades              |
| 1788307200014   | create_professional_schedule_blocks_table        | Bloqueios                     |
| 1788307200015   | create_appointments_table                        | Agendamentos                  |
| 1788307200016   | enable_btree_gist_extension                      | Extensão PostgreSQL           |
| 1788307200017   | add_appointments_overlap_constraint              | Exclusão de sobreposição      |
| 1788307200018   | create_medical_record_history_function           | Função de imutabilidade       |
| 1788307200019   | create_medical_record_entries_table              | Entradas e correções clínicas |
| 1788307200020   | create_medical_record_attachments_table          | Anexos                        |
| 1788307200021   | create_medical_record_access_logs_table          | Logs e referência ao anexo    |
| 1788307200022   | add_medical_record_entries_immutable_trigger     | Trigger das entradas          |
| 1788307200023   | add_medical_record_access_logs_immutable_trigger | Trigger dos logs              |

Cada tabela inclui suas PKs, FKs, uniques, checks e índices comuns. As FKs
compostas continuam impondo isolamento por consultório; nomes, ações referenciais
e semântica de NULL são preservados. A função é criada antes dos triggers; anexos
precedem logs porque estes podem referenciar um anexo. O rollback segue a ordem
inversa, retirando dependentes antes de suas dependências.

## SQL raw restante

Há nove chamadas `schema.raw`, restritas a cinco migrations:

| Migration (prefixo) | SQL em `up` / `down`                                                             | Por que o Builder não é adequado                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1788307200016       | `CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public` / nenhuma remoção | Não há API de extensão no Schema Builder. O `down` preserva a extensão compartilhável, como no histórico.                                                                 |
| 1788307200017       | `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE USING gist` / `DROP CONSTRAINT`      | Não há API própria para exclusion constraint com `tstzrange`, operador `&&` e predicado parcial. A remoção usa o mesmo recurso específico, sem fingir que é check/unique. |
| 1788307200018       | `CREATE FUNCTION ... LANGUAGE plpgsql` / `DROP FUNCTION`                         | O Builder não define funções PL/pgSQL. Corpo, erro `55000` e mensagem são preservados.                                                                                    |
| 1788307200022       | `CREATE TRIGGER` / `DROP TRIGGER`                                                | O Builder não representa o trigger por linha `BEFORE UPDATE OR DELETE` das entradas clínicas.                                                                             |
| 1788307200023       | `CREATE TRIGGER` / `DROP TRIGGER`                                                | Mesmo motivo para os logs de acesso.                                                                                                                                      |

Não há `CREATE TABLE`, FK, unique, check ou índice comum executado por `raw`.
Expressões de checks usam `table.check(...)`, com os mesmos predicados SQL;
defaults de UUID/timestamp usam as funções do cliente/Schema Builder. Não se
introduzem helpers genéricos para ocultar SQL raw.

## Decisão sobre `btree_gist` no rollback

O `down` preserva intencionalmente a extensão. Ela pertence ao banco inteiro,
embora seus objetos estejam em `public`, e pode servir a outros schemas e
aplicações. `CREATE EXTENSION IF NOT EXISTS` aceita uma instalação preexistente;
a migration não mantém informação persistente que prove autoria ou uso
exclusivo. Nem o proprietário da extensão nem uma variável na instância da
migration forneceriam essa garantia para um rollback posterior.

`DROP EXTENSION ... RESTRICT` ainda removeria a extensão e seus objetos quando
não houver dependências impeditivas, podendo retirar uma instalação anterior.
Com dependências externas, poderia bloquear o rollback. `CASCADE` seria pior:
poderia apagar objetos de outros schemas. `IF EXISTS` somente tolera ausência,
não comprova propriedade exclusiva. Portanto, nenhum desses drops é adequado
automaticamente nesta baseline. Ver [DROP EXTENSION — PostgreSQL 18](https://www.postgresql.org/docs/18/sql-dropextension.html).

A reversão remove os objetos da aplicação, incluindo sua exclusion constraint,
mas deixa a extensão reutilizável. Esse resíduo é esperado, preserva a semântica
histórica e permite reaplicação. Uma eventual desinstalação da extensão é tarefa
administrativa separada, após análise das dependências e autorização explícita;
não faz parte de `down`.

## Validação reproduzível

Versões inspecionadas: AdonisJS Core 6.21.0, Lucid 21.8.2, Knex 3.3.0 e PostgreSQL
18.4. A sintaxe/comportamento de rollback foi conferida no código instalado e
no [runner oficial do Lucid 21.8.2](https://github.com/adonisjs/lucid/blob/v21.8.2/src/migration/runner.ts),
com apoio da [documentação oficial de migrations](https://lucid.adonisjs.com/docs/migrations).

O script `backend/scripts/verify_migration_baseline.ts` compila as duas versões
usando o `BaseSchema` real em dry-run e Knex sem configuração de conexão. Apenas
o `defer` da guarda é admitido e não executado nesse modo; qualquer outro
callback adiado é rejeitado. O relatório declara que a reprodução do SQL não
valida a guarda em runtime. Essa parte é verificada separadamente por
`scripts/verify_migration_guard.ts --execute`, usando o runner Lucid real. Não usa
`ace migration:run --dry-run` contra bancos existentes: o runner pode preparar
tabelas de controle mesmo nesse modo. Por padrão, o script não conecta a banco:

```powershell
cd backend
node --import=ts-node-maintained/register/esm scripts/verify_migration_baseline.ts
```

A compilação isolada não comprova equivalência PostgreSQL. A execução completa
requer autorização para um cluster temporário isolado, criado para a validação,
em `127.0.0.1:55432`. O script aceita exclusivamente os
bancos `clinic_baseline_old_20260902` e `clinic_baseline_new_20260902`, exige ambos
vazios antes de qualquer migration e reconfirma host, porta e banco em cada
transação. Não cria nem elimina bancos. Com `BASELINE_PG_PORT` explicitamente
configurada e os alvos temporários autorizados:

```powershell
node --import=ts-node-maintained/register/esm scripts/verify_migration_baseline.ts --execute
```

Essa opção executa `up`, **todos os `down` (apagando as estruturas criadas)** e
reaplicação em ambos os bancos. Cada arquivo mantém sua transação. O script
extrai a versão antiga do commit fixo, evitando depender do dump local não
versionado. Fontes temporárias são removidas; SQL compilado, snapshots, diferenças
e resultado ficam em `backend/tmp/phase2-schema-equivalence.json`, ignorado pelo
Git. Não usar `--execute` com bancos reutilizados ou contendo dados.

A comparação consulta `pg_catalog` no mesmo servidor e com o mesmo `search_path`:

- schemas, tabelas e opções, colunas/tipos/nullability/defaults/collations;
- PKs, FKs, uniques, checks e exclusion constraint, incluindo nomes, definições,
  validação e deferrability;
- índices, método, predicados, unicidade e semântica de NULL;
- sequences (inclusive o serial integer de tokens), tipos próprios e extensões;
- função (corpo e propriedades), triggers e seu estado;
- igualdade após aplicação, após rollback e após reaplicação; estabilidade de
  cada baseline no ciclo completo.

OIDs e ordem física das colunas não são contratos; a ordem de colunas nas chaves
e índices é preservada. Definições são decompiladas pelo próprio PostgreSQL para
não comparar formatação dos arquivos de origem. O rollback deixa somente os
objetos nativos e a extensão `btree_gist`, intencionalmente preservada nas duas
versões. Uma diferença ou erro torna o comando malsucedido.

Além disso, executar typecheck, lint, build, Prettier e `test:contracts` (59 rotas).
A suíte `npm test` deve usar um terceiro banco descartável autorizado,
`clinic_baseline_suite_20260902`, no mesmo cluster isolado: seu setup aplica
migrations, casos executam `TRUNCATE ... RESTART IDENTITY CASCADE` e o teardown
chama `migration:reset`. No Lucid 21.8.2, reset delega ao rollback com `--batch=0`,
executando todos os `down`. Nunca executar essa suíte contra bancos locais com
dados a preservar. `migration:fresh` não é necessário para esta validação.

O verificador específico da guarda requer `BASELINE_PG_PORT=55432` e o banco
`clinic_baseline_suite_20260902` inicialmente vazio, no PGDATA temporário
explicitamente autorizado. Não deve rodar em paralelo com a suíte funcional:

```powershell
node --import=ts-node-maintained/register/esm scripts/verify_migration_guard.ts --execute
```

Sem `--execute`, esse script não acessa o banco. Com a opção, verifica aplicação
normal/idempotência, rollback com dependência externa de `btree_gist` e rejeição
de 11 nomes históricos sintéticos, incluindo variantes de caminho/extensão. O
ledger v2, sua sequence e os catálogos são comparados antes/depois da rejeição.
Apenas os IDs inseridos pela fixture são removidos ao final, após as asserções;
essa limpeza pertence ao teste, não à guarda. O relatório fica em
`backend/tmp/phase2-lineage-guard.json`. A seguir, `npm test` usa o mesmo banco
isolado para comprovar a reaplicação e os contratos funcionais.

Para inspecionar a mensagem de rejeição, o teste usa `node ace migration:run`
sem `--compact-output`: no Lucid 21.8.2, o formato compacto suprime o texto da
exceção e exibe apenas o arquivo com erro. A proteção continua ativa nos dois
formatos. O CLI também enumera arquivos pendentes após uma falha; isso não
significa que seu DDL foi executado.

## Evidência da Fase 2 — 02/09/2026

Validação executada exclusivamente no cluster temporário PostgreSQL 18.4,
escutando em `127.0.0.1:55432`, com PGDATA independente em
`C:\Users\Samuel\AppData\Local\Temp\clinic-baseline-pg18-20260902`.
Os três bancos de aplicação foram os nomes autorizados acima. A criação deles
usou a conexão administrativa padrão do próprio cluster temporário; nenhuma
conexão foi feita ao servidor da porta `5432` ou aos bancos locais anteriores.

Antes de iniciar a suíte, `ENV_PATH` apontou para o diretório vazio
`backend/tmp/phase2-empty-env`. Todas as variáveis obrigatórias da aplicação
foram definidas apenas no processo, com chave de aplicação sintética. Os cinco
`DB_*` e os parâmetros `PG*` apontaram explicitamente ao cluster temporário;
variáveis herdadas de serviço/URL PostgreSQL foram descartadas. Usou-se senha
sentinela não vazia para impedir fallback ao `.env` com autenticação temporária
`trust`. Nenhum arquivo `.env` real foi lido pela suíte ou alterado. A configuração
efetiva do AdonisJS e o `data_directory` do servidor foram conferidos antes dos
testes.

| Verificação                                                              | Resultado                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Comparação de catálogos após `up`                                        | Zero diferenças                                                                          |
| Comparação após todos os `down`                                          | Zero diferenças; somente `btree_gist` residual além dos objetos nativos                  |
| Comparação após reaplicação                                              | Zero diferenças                                                                          |
| Estado inicial versus reaplicado, em cada baseline                       | Zero diferenças em ambos                                                                 |
| Guarda em banco vazio, pelo runner Lucid                                 | 25 registros em `adonis_schema`, guarda primeiro e 18 tabelas `clinic`                   |
| Segunda execução sem mudanças                                            | Nenhuma migration reaplicada; ledger idêntico                                            |
| Guarda com 11 registros históricos sintéticos, ledger v2                 | Rejeição com `LEGACY_MIGRATION_LINEAGE`; ledger, versão, catálogo e sequence inalterados |
| Rollback com dependência externa de `btree_gist`                         | Extensão, tabela externa, índice GiST e linha sintética preservados                      |
| `npm test`, repetido após os cenários da guarda                          | 88 testes funcionais aprovados; 25 migrations aplicadas e revertidas                     |
| `node ace migration:reset --compact-output` no banco temporário da suíte | 25 revertidas; zero registros aplicados e schema `clinic` ausente                        |
| `npm run test:contracts`                                                 | 2 testes aprovados, incluindo equivalência das 59 rotas                                  |
| Typecheck, lint, build, Prettier e `git diff --check`                    | Aprovados                                                                                |

Os catálogos antigos/novos têm os mesmos schemas `clinic`/`public`, 18 tabelas,
185 colunas, 18 PKs, 35 FKs, 27 uniques, 63 checks, 137 constraints NOT NULL
catalogadas pelo PG18, 80 índices (34 explícitos e 46 de constraints), uma
sequence, uma exclusion constraint, uma função própria e dois triggers.
`btree_gist` v1.8 em `public` é idêntica nas duas versões. Tipos, defaults,
nullability, nomes e definições também coincidem.

O relatório JSON compara o SQL compilado por migration e os catálogos, não dados
de usuários ou ACLs preexistentes. O controle `adonis_schema` foi verificado
separadamente pelo runner real. Não houve migração de dados de bancos existentes.

A primeira tentativa do comparador recusou o endereço textual `127.0.0.1/32`
antes de aplicar migrations. O verificador foi corrigido para usar
`host(inet_server_addr())`, mantendo a comparação exata do host. A execução
subsequente passou integralmente; nenhuma migration precisou de ajuste.

Na revisão corretiva, a comparação foi repetida com 25 migrations e continuou
sem diferenças nas cinco comparações. A guarda foi validada separadamente pelo
runner real, pois seu SELECT adiado não é executado pela reprodução do SQL. O
teste inicialmente procurou a mensagem no formato compacto do CLI, que a
suprime; a asserção foi corrigida para inspecionar o comando normal. A rejeição
foi comprovada nos dois formatos, sem executar DDL da baseline.

O cluster foi desligado com `pg_ctl -D <PGDATA temporário> -m smart -w -t 30 stop`
e a ausência de listener na porta `55432` foi confirmada. PGDATA e relatório
local foram preservados para inspeção: bancos antigo/novo contêm os schemas
reaplicados; o banco da suíte terminou sem schema `clinic`, com tabelas de controle
do Lucid e a extensão residual. Nada disso foi adicionado ao Git.
