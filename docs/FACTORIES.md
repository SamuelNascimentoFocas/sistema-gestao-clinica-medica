# Factories e fixtures de testes — Fase 6 (B06)

## Escopo e mecanismo

A Fase 6 usa a API oficial de factories do **Lucid 21.8.2** já instalado:
`import factory from '@adonisjs/lucid/factories'`, `define`, `merge`, `state`,
`relation`, `build`, `create`, `createMany` e `with`.
Não foi necessário alterar models, configuração, dependências ou código de produção.

Referência: [Lucid Model factories](https://lucid.adonisjs.com/docs/model-factories).
A documentação corrente pode descrever versões posteriores: o import default
e as assinaturas foram conferidos nos arquivos instalados
`build/src/factories/main.d.ts`, `build/src/types/factory.d.ts` e na implementação
de `factory_builder.js`. O mecanismo mantém os hooks dos models e usa transações;
os testes existentes com transação global e os novos testes de factories verificam
a integração real, sem adaptar o bootstrap.

## Inventário inicial e resultado

Inventário sintático de `backend/tests/**/*.ts`, comparado com o HEAD aprovado
da Fase 5. A contagem mede **locais de chamada direta a um model importado**,
não o número de registros criados durante a execução. Não inclui
`Factory.create`, `User.accessTokens.create`, `ace.create`,
`related(...).create`, SQL ou query builder.

- Antes: 20 specs funcionais, 91 provas funcionais, 148 chamadas diretas e
  79 declarações de funções `create*`.
- Depois: 21 specs funcionais, 94 provas (91 preservadas + 3 de factories),
  70 chamadas diretas e 31 funções `create*` (29 locais e 2 compartilhadas).
- Redução: 78 chamadas diretas (53%) e 48 declarações de helpers (61%).
- 18 specs existentes foram refatorados; `auth/user_model.spec.ts` e
  `commands/create_admin.spec.ts` permaneceram inalterados.

Caminhos abaixo são relativos a `backend/tests/functional/`.

| Arquivo                                             | Model.create antes | Depois |
| --------------------------------------------------- | -----------------: | -----: |
| appointments/appointment_models.spec.ts             |                 32 |     26 |
| appointments/appointments_api.spec.ts               |                  9 |      1 |
| audit_logs/audit_logs_api.spec.ts                   |                 11 |      0 |
| auth/sessions.spec.ts                               |                  3 |      0 |
| auth/user_clinics.spec.ts                           |                  3 |      0 |
| auth/user_model.spec.ts                             |                  1 |      1 |
| authz/authorization_catalog.spec.ts                 |                  3 |      0 |
| clinic_access/clinic_access.spec.ts                 |                  3 |      0 |
| clinic_memberships/clinic_members_admin_api.spec.ts |                  3 |      0 |
| clinic_memberships/clinic_memberships.spec.ts       |                  3 |      1 |
| clinics/clinics.spec.ts                             |                  1 |      0 |
| commands/create_admin.spec.ts                       |                  0 |      0 |
| medical_records/medical_record_models.spec.ts       |                 34 |     25 |
| medical_records/medical_records_api.spec.ts         |                 11 |      0 |
| patients/patient_models.spec.ts                     |                  8 |      7 |
| patients/patients_api.spec.ts                       |                  3 |      0 |
| professionals/professional_models.spec.ts           |                 11 |      9 |
| professionals/professional_schedules_api.spec.ts    |                  5 |      0 |
| professionals/professionals_api.spec.ts             |                  3 |      0 |
| users/users.spec.ts                                 |                  1 |      0 |
| factories/lucid_factories.spec.ts (novo)            |                  — |      0 |
| **Total**                                           |            **148** | **70** |

Modelos inicialmente mais repetidos: Appointment (28), User (20), Clinic (15),
MedicalRecordEntry (14), MedicalRecordAccessLog (13), ClinicProfessional (11),
UserClinicRole (10), PatientClinic (9), Professional (7), Patient (6),
MedicalRecord (5), MedicalRecordAttachment (4),
ProfessionalWeeklyAvailability (3), ProfessionalScheduleBlock (2) e Role (1).

Os helpers mais repetidos eram `createUser`, `createClinic`,
`createMembership` e `createToken/createBearerToken`.
Os contextos recorrentes combinam usuário/clínica/papel, paciente/vínculo/prontuário
global, profissional/vínculo/agenda e entrada/anexo/log com autoria clínica explícita.

## Factories e decisões de dados

Arquivos em `backend/database/factories/`, com nomes em snake_case e sufixo
`_factory.ts`:

| Factory                        | Defaults e dados que permanecem explícitos                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| User                           | Email sequencial, normalização, senha sintética, ativo e não Global Admin. Overrides preservados.                                               |
| Clinic                         | Nome sequencial, contatos/endereço opcionais nulos, ativa. Timezone explícito nos cenários que já o definiam; caso contrário, default do banco. |
| UserClinicRole                 | Ativo; usuário, clínica e papel selecionados pelo cenário.                                                                                      |
| Patient                        | Nascimento fixo em 1990-05-10, contatos nulos, ativo. CPF opcional nulo ou valor explícito.                                                     |
| PatientClinic                  | Número local nulo e vínculo ativo; paciente e clínica explícitos.                                                                               |
| MedicalRecord                  | Paciente explícito; o mesmo prontuário global é reutilizado entre clínicas.                                                                     |
| Professional                   | CRM sequencial, MG, Clínica Médica, ativo; vínculo com usuário opcional e explícito.                                                            |
| ClinicProfessional             | Ativo, aceita consultas, duração de 30 minutos; cenários de 60 minutos mantêm o override.                                                       |
| ProfessionalWeeklyAvailability | Ativa; vínculo, dia da semana e horas fornecidos pelo teste.                                                                                    |
| Appointment                    | Scheduled, versão 1, metadados de transições nulos; contexto, autor, início e fim explícitos.                                                   |
| MedicalRecordEntry             | Evolution, texto sintético, sem consulta/correção por default; IDs e autoria explícitos.                                                        |
| MedicalRecordAttachment        | Somente metadados sintéticos disponíveis em private_fs; chave sequencial sobrescrevível. Não grava arquivos.                                    |
| MedicalRecordAccessLog         | Anexo e nota opcionais nulos; contexto, ação e finalidade explícitos, instante explícito quando relevante para o cenário.                       |

`fixture_sequence.ts` mantém contadores monotônicos por recurso durante o processo.
Não usa Faker nem datas aleatórias. Os contadores não são reiniciados entre testes
que possam compartilhar dados. Emails gerados usam `factory.user.N@example.test`;
CRM usa uma faixa numérica distinta dos valores explícitos existentes.
CPFs, CNPJs e códigos locais opcionais ficam nulos: não são gerados valores
fictícios potencialmente inválidos/repetidos. Testes de identidade fornecem seus
valores deliberadamente. IDs UUID continuam sendo gerados pelo banco.

Isso não promete unicidade entre processos independentes no mesmo banco:
a suíte mantém sua execução isolada/sequencial e seu ciclo de limpeza existente.
Não se deve compartilhar esse banco entre workers paralelos sem isolamento próprio.

### States

Somente `UserFactory.globalAdmin` e `UserFactory.inactive` foram necessários.
Cada um altera apenas sua flag; podem ser combinados. As sobrescritas passadas
a `merge` são respeitadas conforme a API Lucid.

Papéis locais, status de consultas, horários e metadados de cancelamento continuam
explícitos. Não foram criados states que escondam transições ou criem grafos de
permissões implicitamente.

### Relações

Relações declaradas, **sem criação automática**:

- UserClinicRole → user, clinic.
- PatientClinic → patient, clinic.
- MedicalRecord → patient.
- ClinicProfessional → clinic, professional.

Usar `merge({ ...Ids })` para reutilizar entidades existentes ou `with(...)`
explicitamente para criar a relação desejada. Entries, appointments, attachments
e logs não possuem grafos automáticos: FKs compostas exigem que o cenário escolha
identidades clínicas consistentes.

Os helpers compartilhados em `tests/helpers/auth.ts` e `membership.ts` concentram
emissão de token e resolução de papel já presente no catálogo. Membership exige
usuário, clínica e código do papel; não executa seeding oculto.

Helpers locais que montam contextos de domínio foram mantidos quando expressam
um cenário coeso. Agora compõem factories, em vez de repetir todos os atributos.
Helpers de armazenamento continuam expondo escrita real, tamanho e hash calculados
dos bytes utilizados pelo teste.

### Factories não criadas

- **Role:** único ponto manual prepara o catálogo específico do teste de vínculos,
  inclusive papel inativo. Demais testes usam o seeder oficial existente.
- **ProfessionalScheduleBlock:** os dois pontos diretos são um caso de constraint
  e um bloqueio deliberado para conflito de agenda. O CRUD de bloqueios é testado
  via HTTP. Uma factory não eliminaria fixture normal recorrente.

## Classificação completa dos 70 pontos manuais restantes

As quantidades incluem linhas de controle válidas junto das violações, pois fazem
parte da mesma matriz de constraints. Os títulos identificam os testes sem depender
de números de linha voláteis.

| Arquivo/cenário                                      | Pontos | Justificativa                                                                                                                               |
| ---------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| appointment_models: relates appointments…            |      5 | Contrato dos models/relações e metadados de diferentes estados e reagendamento, explicitamente construídos.                                 |
| appointment_models: enforces clinic scope…           |      6 | FKs compostas, isolamento e unicidade do sucessor; controles e violações.                                                                   |
| appointment_models: enforces duration, version…      |      9 | Checks de duração, versão e metadados de status.                                                                                            |
| appointment_models: prevents overlapping…            |      6 | Exclusion constraint e exceções válidas para sobreposição.                                                                                  |
| appointments_api: validates patient, professional…   |      1 | Bloqueio com horário explícito para testar conflito de agenda.                                                                              |
| auth/user_model: hashes password…                    |      1 | Exercita diretamente hook de senha, credenciais, serialização e token.                                                                      |
| clinic_memberships: helper createRole                |      1 | Catálogo especial do teste, com estado ativo/inativo sob controle explícito.                                                                |
| medical_record_models: helper createAttachment       |      1 | Usado também para construir metadados inválidos, duplicidade de chave e violações de contexto; sem defaults de factory mascarando entradas. |
| medical_record_models: builds one global timeline…   |      5 | Teste direto das relações de entries/correção/logs, incluindo duas clínicas no mesmo prontuário.                                            |
| medical_record_models: enforces patient, clinic…     |      7 | Violações intencionais de contexto e consistência de entrada.                                                                               |
| medical_record_models: keeps clinical entries…       |      2 | Registros-alvo dos testes diretos de triggers de imutabilidade.                                                                             |
| medical_record_models: validates access-log purpose… |      3 | Controle e violações de finalidade/contexto de log.                                                                                         |
| medical_record_models: relates attachments…          |      1 | Log usado para comprovar a relação direta entre model de anexo e download.                                                                  |
| medical_record_models: enforces attachment scope…    |      1 | Anexo pending com transição/metadados sob teste direto.                                                                                     |
| medical_record_models: validates attachment-aware…   |      5 | Matriz de logs com/sem anexo, controle e violações de escopo.                                                                               |
| patient_models: helper createPatient                 |      1 | Também chamado com CPF deliberadamente duplicado; teste direto de identidade do model.                                                      |
| patient_models: enforces clinic-link…                |      6 | Unique de vínculo, número local e prontuário global.                                                                                        |
| professional_models: helper createProfessional       |      1 | Também chamado com CRM/usuário duplicados; teste direto do model.                                                                           |
| professional_models: enforces clinic and schedule…   |      8 | Unique de vínculo e checks de duração/dia/intervalo/bloqueio.                                                                               |
| **Total**                                            | **70** | **Todos revisados deliberadamente.**                                                                                                        |

Fora dessa métrica, cinco chamadas `related(...).create` foram preservadas em
`patient_models` (2) e `professional_models` (3), pois testam a API de relações do
ORM. SQL de preparação, testes de triggers, comandos Ace e emissão de tokens não
foram convertidos em factories. Os cenários de concorrência mantêm suas operações
concorrentes e assertions; apenas fixtures preparatórias válidas foram migradas.

## Validação

Os domínios foram executados progressivamente, sempre em
`clinic_phase6_suite_20260902`, no PostgreSQL 18.4 temporário em
`127.0.0.1:55432`, com PGDATA independente conferido antes da execução.
Nenhum acesso à porta 5432 ou aos bancos locais de desenvolvimento/teste.

Seleções direcionadas: autenticação/autorização/acesso (12), usuários/clínicas/
vínculos (13), pacientes (7), profissionais (7), agendas (4), consultas (16),
prontuários/anexos/auditoria (31), factories (3).

Os três testes novos cobrem unicidade/defaults/sobrescritas/states e relações
explícitas multi-clínica. Uma comparação sintática das 18 specs refatoradas confirmou
1.008 declarações de testes, assertions e chamadas de payload inalteradas em relação
ao HEAD da Fase 5. Nenhuma baseline de contrato foi editada.

Checks finais aprovados: `npm run format`, `npm run typecheck`, `npm run lint`,
`npm test` (**94/94**), `npm run build`, `npm run test:contracts` (**2/2**),
`prettier --check .` no backend e `git diff --check`. A auditoria confirmou
**59 rotas, 46 contratos de validação e 41 validators**, sem divergências.
As 25 migrations foram revertidas no encerramento; schema `clinic` ausente,
ledger vazio e extensão `btree_gist` preservada conforme a baseline aprovada.

Durante a implementação, o typecheck identificou inferência de strings dos
enums em três factories, um import sem uso e três propriedades duplicadas
no setup de auditoria. Foram corrigidos antes dos testes finais. A primeira
seleção de arquivos com glob completo não selecionou testes; ela não foi
contabilizada como validação e foi refeita com os filtros reconhecidos pelo Japa.
Os logs de falhas sintéticas de anexos são esperados pelos testes existentes.
