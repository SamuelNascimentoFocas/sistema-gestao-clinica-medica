# Arquitetura do Sistema

Este documento apresenta a arquitetura técnica do MVP do Sistema de Gestão de Clínica Médica, suas principais decisões de projeto e a organização dos módulos.

## 1. Visão geral

O sistema segue uma arquitetura web full stack composta por três partes principais:

```text
Navegador
   |
   v
Frontend Next.js
http://localhost:3000
   |
   v
Backend AdonisJS
http://localhost:3333
   |
   v
PostgreSQL
127.0.0.1:5432
```

Responsabilidades:

- o frontend apresenta as telas, formulários e navegação;
- o backend concentra autenticação, autorização, regras de negócio e acesso aos dados;
- o PostgreSQL preserva integridade, relacionamentos e restrições críticas;
- anexos clínicos são mantidos em armazenamento privado local.

## 2. Organização do repositório

```text
clinica-medica/
├── backend/
│   ├── app/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── services/
│   │   └── validators/
│   ├── commands/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── start/
│   ├── storage/private/
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── types/
├── docs/
└── README.md
```

## 3. Backend

O backend utiliza:

- Node.js;
- TypeScript;
- AdonisJS 6;
- Lucid ORM;
- VineJS;
- PostgreSQL;
- autenticação por access token;
- Japa para testes funcionais.

### Camadas principais

#### Controllers

Recebem requisições HTTP e coordenam:

- autenticação;
- validação;
- chamada dos casos de uso (nos módulos extraídos para Services);
- serialização;
- tradução de erros de aplicação;
- respostas HTTP.

#### Validators

Validam dados de entrada antes da execução das regras de negócio.

#### Models

Representam tabelas e relações do schema `clinic`.

#### Middleware

Aplicam regras transversais, como:

- autenticação;
- administrador global;
- permissão por consultório;
- gestão geral ou própria de agendas;
- gestão geral ou própria de agendamentos.

#### Services

Concentram regras reutilizáveis, como:

- autorização por consultório;
- proteção do último administrador local efetivo.

Na Fase 3 da adequação ao parecer (B08/B09), pacientes, profissionais, agendas,
agendamentos, prontuários e anexos passam a delegar consultas e operações
aplicacionais aos Services abaixo, em `backend/app/services/`. Os dois Services
anteriores de autorização e administração local não foram alterados.

| Service                                | Responsabilidade                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patient_registration_service.ts`      | Identidade global por CPF, vínculo local e prontuário único na mesma transação.                                                                   |
| `patient_service.ts`                   | Consultas, atualização global/local, ativação de vínculo e tradução dos conflitos de unicidade do paciente.                                       |
| `professional_registration_service.ts` | Compatibilidade do CRM/identidade, conta médica e criação do vínculo local na transação existente.                                                |
| `professional_service.ts`              | Consultas, configuração/ativação do vínculo e conflitos de unicidade do profissional.                                                             |
| `professional_schedule_service.ts`     | Disponibilidades semanais e bloqueios: ordem temporal, sobreposição, edição e ativação.                                                           |
| `appointment_query_service.ts`         | Consultas detalhadas e listagem paginada, com limites do intervalo da agenda.                                                                     |
| `appointment_policy_service.ts`        | Elegibilidade de paciente/profissional, escopo próprio/geral, duração, disponibilidade e conflitos de horário.                                    |
| `appointment_booking_service.ts`       | Criação, edição administrativa e reagendamento, preservando versão, locks, transações e histórico.                                                |
| `appointment_status_service.ts`        | Confirmação, cancelamento, conclusão e falta, incluindo idempotência e limites temporais.                                                         |
| `medical_record_context_service.ts`    | Contexto ativo paciente/prontuário, autoria clínica e escopo de leitura/escrita de entradas; recebe a transação e a opção de lock explicitamente. |
| `medical_record_read_service.ts`       | Timeline e entrada detalhada, com relações comuns e registro de acesso.                                                                           |
| `medical_record_entry_service.ts`      | Criação/correção imutável, compatibilidade com agendamento e concorrência de correções.                                                           |
| `medical_record_access_service.ts`     | Finalidade obrigatória e auditoria de leitura de prontuários/anexos.                                                                              |
| `medical_record_attachment_service.ts` | Listagem, upload e download autorizados pelo contexto clínico; coordena metadados, transação e compensação.                                       |
| `attachment_storage_service.ts`        | Nome/tipo real, SHA-256, chave privada, movimentação, leitura e remoção compensatória de arquivos.                                                |
| `postgres_error.ts`                    | Leitura tipada de código/constraint PostgreSQL; não decide respostas HTTP.                                                                        |

Os novos Services não recebem `HttpContext`, `request` ou `response`, nem escolhem
status HTTP. Recebem IDs, contexto de escopo e dados já validados; os tipos de
payload são inferidos dos validators com imports apenas de tipo, sem duplicar
schemas. Os arquivos de upload continuam sendo os objetos `MultipartFile`
validados, usados como dependência de armazenamento, sem transportar a requisição.
Não foram acrescentadas dependências, camada genérica de repositórios ou factories.

#### Erros na fronteira HTTP

`backend/app/exceptions/domain_error.ts` define `DomainError`, sem status HTTP.
Os controllers usam `controllers/helpers/domain_error_response.ts` para o mapeamento:

| Categoria             | Resposta preservada | Situações                                                                          |
| --------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `forbidden`           | 403                 | Autoria clínica ou gestão de agendamento fora do escopo.                           |
| `not_found`           | 404                 | Recurso/vínculo ausente no contexto permitido.                                     |
| `conflict`            | 409                 | Inatividade, unicidade, versão, estado, sobreposição ou arquivo indisponível.      |
| `invalid`             | 422                 | Finalidade, metadados de arquivo, intervalo ou regra temporal inválida.            |
| `storage_unavailable` | 500                 | Disco cadastrado no anexo não configurado; conserva a resposta explícita anterior. |

As mensagens existentes são preservadas. Erros desconhecidos são relançados ao
handler existente. Nos mesmos casos anteriormente tratados, os Services convertem
`23P01` de agendamentos e `23505` das constraints conhecidas de pacientes,
profissionais e correções em conflito. Não há captura genérica de falhas de banco
como conflito. Body de atualização vazio continua retornando 400 no controller.
A ordem de busca/validação dos endpoints de status foi mantida, inclusive a
precedência de 404 sobre body inválido quando o recurso não existe.

#### Fronteiras preservadas na extração

- As 13 transações antes presentes nesses seis controllers foram transferidas
  integralmente, sem criar novas transações nem incorporar consultas externas a elas.
- Os mesmos locks e verificações de versão continuam nos mesmos pontos das operações.
  A confirmação idempotente continua sendo verificada antes da versão esperada.
- A leitura global do prontuário/anexo continua condicionada ao vínculo ativo do
  paciente na clínica atual; escrita e correção continuam restritas à clínica de origem.
- No upload, preparação/hash e movimentação continuam antes da transação; paciente
  e entrada são novamente consultados com lock dentro dela. Falhas removem somente
  as chaves já movimentadas, com `Promise.allSettled`, como anteriormente.
- O upload devolve uma operação de compensação para o controller preservar também
  a falha síncrona durante a construção da resposta. Particularidade preexistente:
  nesse ponto o commit já ocorreu; os arquivos são compensados, mas os metadados
  permanecem. Alterar essa política exigiria uma decisão funcional fora desta fase.
- SHA-256 continua calculado antes da movimentação e persistido com os metadados;
  não foi acrescentada uma nova política de revalidação do hash no download.
- Serialização pública, `Content-Disposition`, `nosniff`, tipo/tamanho e
  `Cache-Control: private, no-store` permanecem na camada HTTP. Chaves, disco e hash
  privados continuam fora da resposta pública de anexos.

Os contratos de rotas e validators da Fase 1 não foram alterados.

#### Resource Controllers e comandos especializados (Fase 4 — B01/B02)

Os controllers de recursos usam somente as actions semanticamente aplicáveis.
Não são criadas operações de exclusão para recursos com ativação, transição de
estado ou preservação histórica. A sessão mantém `destroy`, pois revoga o token.

| Controller de recurso/leitura | Actions |
| --- | --- |
| `UsersController`, `ClinicsController`, `ClinicMembershipsController` | `index`, `store`, `show`, `update` |
| `PatientsController`, `ProfessionalsController`, `AppointmentsController` | `index`, `store`, `show`, `update` |
| `ClinicMembersController` | `index`, `store` |
| `MedicalRecordsController`, `ProfessionalSchedulesController`, `ClinicContextsController` | `show` |
| `MedicalRecordEntriesController` | `store`, `show` |
| `MedicalRecordAttachmentsController` | `index`, `store` |
| `ProfessionalWeeklyAvailabilitiesController`, `ProfessionalScheduleBlocksController` | `store`, `update` |
| `AuditLogsController`, `UserClinicsController` | `index` |
| `SessionsController` | `store`, `show`, `destroy` |

O prontuário e a agenda são agregados singulares: `show` apresenta seu conteúdo.
Entradas clínicas, disponibilidades e bloqueios são recursos próprios; não se
confundem com a edição do prontuário ou da agenda agregada. A correção de uma
entrada continua sendo um comando que preserva o original, nunca um `update`.

| Controller especializado | Actions e responsabilidade | Origem |
| --- | --- | --- |
| `UserStatusController` | `updateStatus`: ativação do usuário | `UsersController` |
| `ClinicStatusController` | `updateStatus`: ativação da clínica | `ClinicsController` |
| `ClinicMembershipStatusController` | `updateStatus`: ativação do vínculo pelo administrador global | `ClinicMembershipsController` |
| `ClinicMemberAccessController` | `updateRole`, `updateStatus`: administração local de perfil/acesso | `ClinicMembersController` |
| `PatientLinkStatusController` | `updateStatus`: ativação do vínculo paciente-clínica | `PatientsController` |
| `ProfessionalLinkStatusController` | `updateStatus`: ativação do vínculo profissional-clínica | `ProfessionalsController` |
| `AppointmentStatusController` | `confirm`, `cancel`, `complete`, `markNoShow`: transições da consulta | `AppointmentsController` |
| `AppointmentReschedulingController` | `reschedule`: reagendamento com preservação da consulta anterior | `AppointmentsController` |
| `ProfessionalScheduleStatusController` | `updateWeeklyAvailabilityStatus`, `updateScheduleBlockStatus`: ativação dos itens de agenda | `ProfessionalSchedulesController` |
| `MedicalRecordCorrectionsController` | `correct`: correção clínica imutável | `MedicalRecordsController.correctEntry` |
| `MedicalRecordAttachmentDownloadsController` | `download`: resposta binária e headers seguros | `MedicalRecordAttachmentsController` |

Comandos mantêm nomes explícitos, sem serem artificialmente transformados em CRUD.
As quatro transições de consulta ficam juntas; perfil/status local e ativação dos
dois tipos de item de agenda também permanecem agrupados por responsabilidade.

A listagem `ClinicContextsController.members` passa a `ClinicMembersController.index`,
sem mudar a resposta de `GET /api/v1/clinics/:clinicId/members` nem acrescentar
paginação. `showEntry`/`storeEntry` passam a `MedicalRecordEntriesController.show`/
`store`; criação/edição de disponibilidades e bloqueios passam a `store`/`update`
dos respectivos controllers. Nenhum corpo de action é reescrito: preservam-se
parâmetros, precedência de busca/validação, validators, respostas e erros.

Os Services aprovados na Fase 3 permanecem inalterados. Apenas as duas consultas
auxiliares já existentes de membros são reunidas em `clinic_member_query_service.ts`,
evitando duplicação entre criação e administração de acesso; seus filtros,
relações e resultados são mantidos. Regras administrativas ainda preexistentes
nos controllers não são reescritas nesta reorganização. Nenhuma regra é movida
de Service para controller. A formatação de `Content-Disposition` acompanha o
download, enquanto serialização pública e compensação de upload permanecem na
fronteira HTTP original.

O total passa de 14 para 28 controllers, mantendo 58 actions e a rota raiz inline.
Em `start/routes.ts`, mudam somente imports e 24 referências a handlers. Não se
usa `router.resource()`, para evitar rotas extras ou mudanças de método/path.
Os grupos, prefixos, UUID matchers e middlewares, inclusive sua ordem, permanecem
inalterados nessa fase. Route Groups são tratados na Fase 5; factories, na Fase 6.

#### Route Groups e reauditoria de validação (Fase 5 — B07/B03)

`backend/start/routes.ts` passa de grupos independentes com prefixos e autenticação
repetidos para uma hierarquia explícita. Os handlers definidos na Fase 4 não mudam.

```text
/                                      público, fora da API versionada
/api/v1
├── /auth/login                        público
└── auth({ guards: ['api'] })           57 rotas
    ├── /auth                          me, me/clinics e logout
    ├── globalAdmin()                  15 rotas
    │   ├── /clinics
    │   ├── /users
    │   └── /clinic-memberships
    └── /clinics/:clinicId              39 rotas; matcher UUID compartilhado
        ├── /context e /members
        ├── /patients
        ├── /patients/:patientId/medical-record
        ├── /professionals
        ├── /professionals/:professionalId (agenda/disponibilidades/bloqueios)
        ├── /appointments
        └── /audit-logs
```

Autenticação é aplicada uma única vez ao grupo protegido. `globalAdmin()` fica
somente no subgrupo dos três recursos administrativos, nunca no contexto clínico.
O matcher de `clinicId` é compartilhado pelo grupo clínico; os demais matchers
UUID permanecem nos respectivos módulos/rotas.

As permissões comuns `schedules.read` e `appointments.read` passam aos grupos de
agenda e consultas, respectivamente. Em todas essas rotas, os argumentos já eram
idênticos. `scheduleManagement()` continua apenas nas seis rotas de escrita da
agenda; a leitura não passa a exigir gestão. `appointmentManagement()` continua
local, com os argumentos originais `create`, `update`, `changeStatus` e `reschedule`;
listagem/detalhe não recebem esse middleware. As demais permissões clínicas ficam
locais, pois variam por operação. Não são criadas duplicações nem permissões novas.

A sequência efetiva permanece `auth → globalAdmin` na administração global e
`auth → clinicPermission → gestão (quando existente)` no contexto clínico. O
kernel, os middlewares globais e seus argumentos não são alterados. A composição
foi conferida no código instalado do AdonisJS e no resultado do router, não apenas
pela ordem visual das chamadas em `routes.ts`. Não se utiliza `router.resource()`.

A reauditoria B03 mantém 28 controllers e 58 actions: 46 recebem entrada e validam
antes do uso; as outras 12 não leem body/query/upload. Há 35 chamadas aguardadas a
`request.validateUsing(...)` (34 de body e uma multipart/upload) e 11 consultas
aguardadas com `validator.validate(request.qs())`. O upload continua validado pelo
schema Vine de arquivos. Os parâmetros presentes nas rotas mantêm matchers UUID.

Os 41 validators exportados nos 12 arquivos continuam compilados por `vine.compile`
e todos são usados. Não foram identificados acessos crus a `request.input`, `all`,
`only`, `except`, `body`, `file`, `files`, query sem validação ou escapes do request.
Nenhuma lacuna exigiu correção: controllers, schemas Vine e a baseline da Fase 1
permanecem intactos. A comparação dos contratos registrados antes/depois inclui
59 rotas, middlewares na ordem efetiva com seus argumentos, 58 handlers e as
regras dos 46 contratos de validação. Factories continuam fora desta fase.

#### Migrations

Criam e fortalecem a estrutura do banco, incluindo foreign keys, checks, índices, unicidades e constraints temporais.

## 4. Frontend

O frontend utiliza:

- Next.js 16;
- React 19;
- TypeScript;
- Tailwind CSS;
- componentes ShadCN/Base UI.

### Organização

A estrutura usa o App Router do Next.js.

As páginas autenticadas ficam sob segmentos protegidos e são renderizadas conforme:

- sessão válida;
- consultório selecionado;
- permissões do contexto atual.

A comunicação com o backend ocorre por funções server-side em:

```text
frontend/src/lib/server
```

A variável:

```env
BACKEND_API_URL=http://localhost:3333
```

é usada no servidor Next.js e não precisa ser exposta ao navegador.

### Proteção de interface

A interface:

- oculta módulos sem permissão;
- bloqueia páginas protegidas;
- usa o contexto do consultório;
- não substitui a autorização do backend.

O backend permanece a autoridade final.

## 5. Modelo multi-consultório

O sistema foi projetado para suportar múltiplos consultórios.

Cada operação contextual usa:

```text
clinicId
```

O acesso depende de:

- consultório existente;
- consultório ativo;
- usuário ativo;
- vínculo ativo do usuário com o consultório;
- perfil ativo;
- permissões exigidas.

O administrador global é uma exceção controlada e recebe permissão curinga:

```text
*
```

## 6. Usuários, perfis e permissões

### Usuário

Um usuário possui identidade global.

Campos relevantes:

- nome;
- e-mail;
- hash de senha;
- status ativo;
- indicador de administrador global.

### Vínculo local

A tabela de vínculo associa:

```text
usuário + consultório + perfil
```

Cada usuário possui no máximo um vínculo por consultório.

### Perfis padrão

```text
clinic_admin
receptionist
doctor
```

### Princípio do menor privilégio

As permissões são atribuídas por perfil.

Exemplos:

- recepcionista não recebe acesso clínico;
- médica recebe acesso ao prontuário;
- médica administra apenas a própria agenda;
- auditoria fica restrita a perfil autorizado;
- administrador local gerencia o consultório.

## 7. Proteção do último administrador local

O sistema identifica o administrador local efetivo quando:

- o vínculo está ativo;
- o usuário está ativo;
- o perfil está ativo;
- o perfil é `clinic_admin`.

Operações administrativas impedem a remoção ou desativação do último administrador local efetivo de um consultório.

Essa regra reduz o risco de deixar uma clínica sem administração local.

## 8. Pacientes

O paciente possui identidade global.

O vínculo local é representado por:

```text
patient_clinics
```

Isso permite:

- o mesmo paciente em mais de uma clínica;
- número local diferente em cada clínica;
- ativação ou inativação local;
- um único prontuário global.

Restrições importantes:

- CPF global único quando informado;
- um vínculo por paciente e clínica;
- número local único dentro da clínica;
- um prontuário por paciente.

## 9. Profissionais

O profissional também possui identidade global.

Pode estar ligado opcionalmente a um usuário do sistema.

O vínculo local é representado por:

```text
clinic_professionals
```

Ele guarda informações como:

- código local;
- duração padrão de consulta;
- aceitação de agendamentos;
- status do vínculo.

Restrições importantes:

- CRM único por estado;
- usuário profissional único quando vinculado;
- um vínculo por profissional e clínica;
- código local único na clínica.

## 10. Agenda profissional

A agenda possui dois componentes:

### Disponibilidade semanal

Define os períodos recorrentes de atendimento:

```text
weekday
start_time
end_time
```

Regras:

- dia da semana entre 1 e 7;
- início menor que fim;
- combinação exata não pode ser duplicada.

### Bloqueios

Representam indisponibilidades pontuais:

```text
starts_at
ends_at
reason
```

Regras:

- início menor que fim;
- intervalo exato não pode ser duplicado;
- bloqueio pertence a um vínculo profissional-clínica.

### Gestão geral e própria

Usuários com:

```text
schedules.manage
```

podem administrar qualquer agenda do consultório.

Usuários com:

```text
schedules.manage_own
```

podem administrar somente a agenda do profissional ligado ao próprio usuário, desde que profissional e vínculo estejam ativos.

## 11. Agendamentos

Um agendamento pertence simultaneamente a:

- uma clínica;
- um vínculo paciente-clínica;
- um vínculo profissional-clínica;
- um usuário criador.

Foreign keys compostas comprovam que paciente e profissional pertencem ao mesmo consultório informado no agendamento.

### Estados

```text
scheduled
confirmed
completed
cancelled
no_show
```

### Integridade temporal

O banco garante:

- início anterior ao fim;
- duração entre 5 e 480 minutos;
- metadados coerentes com o status;
- versão positiva;
- consistência de confirmação;
- consistência de conclusão;
- consistência de cancelamento;
- consistência de ausência.

### Sobreposição

A constraint de exclusão usa:

```text
btree_gist
```

e impede sobreposição de agendamentos com status:

```text
scheduled
confirmed
```

O intervalo é tratado como:

```text
[início, fim)
```

Assim, horários adjacentes são permitidos.

### Concorrência

O módulo usa:

- proteção no banco contra sobreposição;
- controle otimista de versão;
- transações em operações compostas;
- preservação do agendamento anterior no reagendamento.

## 12. Prontuário eletrônico

Cada paciente possui um único prontuário global.

O acesso ocorre por um contexto local autorizado de clínica e paciente.

### Entradas clínicas

Cada entrada registra:

- prontuário;
- clínica de origem;
- vínculo profissional;
- usuário autor;
- conteúdo clínico;
- data e hora;
- contexto de agendamento quando aplicável.

### Imutabilidade

Entradas clínicas não são sobrescritas.

Correções:

- criam um novo registro;
- apontam para a entrada corrigida;
- preservam o original;
- formam cadeia linear;
- mantêm rastreabilidade.

## 13. Anexos clínicos

Anexos são vinculados a:

- prontuário;
- entrada clínica;
- clínica de origem;
- usuário responsável.

O armazenamento usa:

```text
backend/storage/private
```

Características:

- visibilidade privada;
- arquivos não são servidos diretamente;
- download passa por controller autorizado;
- metadados são validados;
- acesso pode gerar auditoria;
- caminhos privados não são expostos na API.

## 14. Auditoria

O módulo registra acessos relevantes ao prontuário.

Ações previstas:

```text
view_timeline
view_entry
list_attachments
download_attachment
```

Finalidades previstas:

```text
patient_care
care_coordination
legal_obligation
other
```

O log contém contexto suficiente para rastreabilidade sem duplicar conteúdo clínico.

A interface de auditoria oferece:

- filtros;
- paginação;
- ordenação decrescente;
- usuário responsável;
- paciente;
- finalidade;
- data e hora;
- metadados seguros de anexo.

## 15. Autenticação

O login cria um access token.

A sessão autenticada permite:

- consultar o próprio usuário;
- listar clínicas acessíveis;
- encerrar a sessão.

As senhas são armazenadas como hash.

Respostas serializadas não incluem:

- senha;
- hash;
- token interno;
- dados sensíveis desnecessários.

## 16. Autorização

A autorização ocorre em camadas.

### Camada 1 — autenticação

Confirma usuário autenticado.

### Camada 2 — contexto de consultório

Confirma:

- usuário ativo;
- clínica existente e ativa;
- vínculo ativo;
- perfil ativo;
- permissões exigidas.

### Camada 3 — escopo do recurso

Confirma:

- agenda própria ou geral;
- agendamento próprio ou geral;
- paciente pertencente ao contexto;
- profissional pertencente ao contexto;
- anexo pertencente ao prontuário e clínica corretos.

## 17. Banco de dados

O projeto usa PostgreSQL e um schema dedicado:

```text
clinic
```

As migrations estão organizadas em uma baseline granular de 25 etapas: guarda
de linhagem (somente leitura, antes das operações estruturais), schema,
18 tabelas (uma por migration), extensão `btree_gist`, exclusion constraint,
função de imutabilidade e dois triggers separados. Constraints e índices comuns
ficam junto à tabela que os possui e usam Schema/Table Builder. As regras que
antes eram acrescentadas por migrations posteriores estão incorporadas à
definição final de cada tabela.

A ordem completa, as exceções de SQL raw e os cuidados com bancos que usam o
histórico anterior estão em [MIGRATIONS.md](MIGRATIONS.md). A reorganização não é
uma migration incremental para bancos já populados.

### Responsabilidade do banco

O banco protege invariantes mesmo quando uma operação não passa pela interface.

Exemplos:

- formatos;
- unicidades;
- foreign keys;
- intervalos válidos;
- coerência de status;
- isolamento composto;
- imutabilidade clínica;
- prevenção de sobreposição.

## 18. Testes

O backend usa Japa com servidor HTTP real em testes funcionais.

O banco de testes:

```text
clinic_system_test
```

é separado do banco de desenvolvimento.

A suíte cobre:

- autenticação;
- usuários;
- clínicas;
- vínculos;
- autorização;
- pacientes;
- profissionais;
- agendas;
- agendamentos;
- concorrência;
- prontuários;
- anexos;
- auditoria;
- comando de administrador global.

Resultado registrado no fechamento do MVP:

```text
88 testes aprovados
```

Na Fase 3, a suíte passou com **91 testes**: os 88 existentes e três cenários
adicionais de compensação de anexos (segunda movimentação, segunda persistência
e construção da resposta). Os dois testes de contratos também passaram,
preservando 59 rotas e 46 contratos de validação. A execução utilizou somente
`clinic_phase3_suite_20260902`, no cluster temporário independente em
`127.0.0.1:55432`, com aplicação e rollback das 25 migrations aprovadas.

Na Fase 4, passaram novamente os **91 testes funcionais** e os dois testes de
contratos (59 rotas e 46 contratos de validação), sem alterar testes ou fixtures.
Antes da suíte completa, passaram duas seleções dos módulos afetados: 43 testes
clínicos e 16 administrativos. A validação utilizou exclusivamente o novo banco
`clinic_phase4_suite_20260902`, no mesmo cluster temporário independente em
`127.0.0.1:55432`, com conferência do destino efetivo antes de cada execução.
Uma comparação sintática adicional confirmou parâmetros/corpos idênticos nas
58 actions e somente substituições de imports/handlers nas rotas. Esse diagnóstico
não foi convertido em teste que congele a organização interna dos controllers.

Na Fase 5, passaram os **91 testes funcionais**, os dois testes de contratos e
uma seleção prévia de 13 testes de autenticação/acesso clínico. Os testes e suas
fixtures não foram alterados. A execução utilizou exclusivamente
`clinic_phase5_suite_20260902`, em `127.0.0.1:55432`, com o PGDATA temporário
independente verificado antes de cada execução e aplicação/rollback das 25
migrations. Formatação, typecheck, lint e build também passaram.

Na Fase 6, fixtures recorrentes passaram a usar 13 Lucid Factories compatíveis
com a versão 21.8.2 instalada. Foram mantidas as criações manuais que exercitam
constraints, relações dos models, hooks, triggers ou cenários especiais. O
inventário passou de 148 para 70 chamadas diretas a models e de 79 para 31
helpers `create*`. Nenhum código de produção ou configuração foi alterado.
O inventário completo, defaults, states, relações e justificativas dos usos
manuais estão em [FACTORIES.md](FACTORIES.md).

A validação passou com **94 testes funcionais** (os 91 existentes e três testes
das factories), os dois testes de contratos (59 rotas e 46 validações), format,
typecheck, lint e build. Foi utilizado somente `clinic_phase6_suite_20260902`,
no PostgreSQL 18.4 temporário em `127.0.0.1:55432`, com PGDATA independente
verificado, aplicação e rollback das 25 migrations.

## 19. Builds

### Backend

O build compila TypeScript e gera a pasta:

```text
backend/build
```

### Frontend

O build do Next.js valida:

- compilação;
- TypeScript;
- geração das rotas;
- preparação da aplicação para execução local de produção.

## 20. Segurança por padrão

Decisões incorporadas:

- hash de senha;
- token de acesso;
- menor privilégio;
- bloqueio por inatividade;
- isolamento por consultório;
- foreign keys compostas;
- validação de entrada;
- transações;
- controle de concorrência;
- registros clínicos imutáveis;
- armazenamento privado;
- auditoria;
- segredos fora do Git.

## 21. Limitações arquiteturais atuais

O MVP não possui:

- Docker;
- orquestração;
- proxy reverso;
- TLS configurado no repositório;
- armazenamento distribuído;
- fila de tarefas;
- cache;
- observabilidade de produção;
- serviço de backup;
- recuperação automatizada;
- especificação OpenAPI;
- testes automatizados próprios no frontend;
- dashboard analítico avançado.

Essas ausências não impedem a validação acadêmica local, mas precisam ser tratadas antes de uma implantação real.

## 22. Evoluções possíveis

Evoluções posteriores podem incluir:

- dashboard analítico;
- Docker e Docker Compose;
- OpenAPI;
- testes de frontend;
- testes end-to-end;
- armazenamento em objeto;
- backups e restauração;
- observabilidade;
- gestão externa de segredos;
- implantação com TLS;
- fila para tarefas assíncronas;
- relatórios;
- notificações;
- trilhas adicionais de auditoria;
- política formal de retenção.

## 23. Decisão de congelamento

O MVP foi congelado após a conclusão e validação de:

- autenticação;
- autorização;
- multi-consultório;
- membros;
- pacientes;
- profissionais;
- agendas;
- agendamentos;
- prontuário;
- anexos;
- auditoria;
- cenário demonstrativo;
- documentação de execução.

O estado final e as limitações são registrados em `CONGELAMENTO_MVP.md`.
