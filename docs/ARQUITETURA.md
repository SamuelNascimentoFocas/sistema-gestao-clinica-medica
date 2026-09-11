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

| Controller de recurso/leitura                                                             | Actions                            |
| ----------------------------------------------------------------------------------------- | ---------------------------------- |
| `UsersController`, `ClinicsController`, `ClinicMembershipsController`                     | `index`, `store`, `show`, `update` |
| `PatientsController`, `ProfessionalsController`, `AppointmentsController`                 | `index`, `store`, `show`, `update` |
| `ClinicMembersController`                                                                 | `index`, `store`                   |
| `MedicalRecordsController`, `ProfessionalSchedulesController`, `ClinicContextsController` | `show`                             |
| `MedicalRecordEntriesController`                                                          | `store`, `show`                    |
| `MedicalRecordAttachmentsController`                                                      | `index`, `store`                   |
| `ProfessionalWeeklyAvailabilitiesController`, `ProfessionalScheduleBlocksController`      | `store`, `update`                  |
| `AuditLogsController`, `UserClinicsController`                                            | `index`                            |
| `SessionsController`                                                                      | `store`, `show`, `destroy`         |

O prontuário e a agenda são agregados singulares: `show` apresenta seu conteúdo.
Entradas clínicas, disponibilidades e bloqueios são recursos próprios; não se
confundem com a edição do prontuário ou da agenda agregada. A correção de uma
entrada continua sendo um comando que preserva o original, nunca um `update`.

| Controller especializado                     | Actions e responsabilidade                                                                  | Origem                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| `UserStatusController`                       | `updateStatus`: ativação do usuário                                                         | `UsersController`                       |
| `ClinicStatusController`                     | `updateStatus`: ativação da clínica                                                         | `ClinicsController`                     |
| `ClinicMembershipStatusController`           | `updateStatus`: ativação do vínculo pelo administrador global                               | `ClinicMembershipsController`           |
| `ClinicMemberAccessController`               | `updateRole`, `updateStatus`: administração local de perfil/acesso                          | `ClinicMembersController`               |
| `PatientLinkStatusController`                | `updateStatus`: ativação do vínculo paciente-clínica                                        | `PatientsController`                    |
| `ProfessionalLinkStatusController`           | `updateStatus`: ativação do vínculo profissional-clínica                                    | `ProfessionalsController`               |
| `AppointmentStatusController`                | `confirm`, `cancel`, `complete`, `markNoShow`: transições da consulta                       | `AppointmentsController`                |
| `AppointmentReschedulingController`          | `reschedule`: reagendamento com preservação da consulta anterior                            | `AppointmentsController`                |
| `ProfessionalScheduleStatusController`       | `updateWeeklyAvailabilityStatus`, `updateScheduleBlockStatus`: ativação dos itens de agenda | `ProfessionalSchedulesController`       |
| `MedicalRecordCorrectionsController`         | `correct`: correção clínica imutável                                                        | `MedicalRecordsController.correctEntry` |
| `MedicalRecordAttachmentDownloadsController` | `download`: resposta binária e headers seguros                                              | `MedicalRecordAttachmentsController`    |

Comandos mantêm nomes explícitos, sem serem artificialmente transformados em CRUD.
As quatro transições de consulta ficam juntas; perfil/status local e ativação dos
dois tipos de item de agenda também permanecem agrupados por responsabilidade.

Na Fase 4, a listagem `ClinicContextsController.members` passou a
`ClinicMembersController.index` sem mudar, naquele momento, a resposta de
`GET /api/v1/clinics/:clinicId/members` nem acrescentar paginação.
`showEntry`/`storeEntry` passam a `MedicalRecordEntriesController.show`/
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

### HTTP no navegador — Fase 7

As chamadas dos Client Components usam a instância Axios 1.20.0 importável em
`frontend/src/lib/client/browser-api.ts`. Não há Provider/Context adicional.
O fluxo continua sendo navegador → BFF Next.js (`/api/...`) → AdonisJS;
Server Components continuam consultando os helpers server-side.

- `baseURL: "/"` e uma guarda de URLs relativas `/api/` evitam configurar esse
  cliente para chamar diretamente o backend ou outro host.
- O adaptador fetch do Axios mantém as três leituras com `cache: "no-store"`.
  Credenciais mantêm o padrão `same-origin` desse adaptador, sem configurar
  `withCredentials: true` ou `false`.
- O navegador não lê nem injeta bearer tokens. O BFF continua lendo o cookie
  HttpOnly e acrescentando Authorization somente no servidor. Cookies, CORS e
  a verificação existente de origem das mutações não foram modificados.
- A inserção automática de XSRF do Axios fica desativada; não se introduz uma
  nova convenção de cookie/header. O cliente também não acrescenta User-Agent
  nem escolhe Content-Type automaticamente; os headers JSON existentes ficam
  nas chamadas e o runtime define o multipart de FormData.
- `validateStatus` mantém respostas HTTP disponíveis aos ramos existentes da
  UI; `isSuccessfulResponse` reconhece apenas 2xx. Os status 400/401/403/404/
  409/422/500 e seus corpos não são convertidos em uma mensagem genérica.
  Falhas de rede continuam rejeitando, agora como AxiosError (`ERR_NETWORK`);
  cancelamento nativo continua distinguível (`ERR_CANCELED`). Não há retries,
  redirects globais ou timeout novo.
- `readBrowserJson` retorna `unknown` e rejeita JSON inválido. Cada consumidor
  mantém sua decisão anterior de usar fallback ou tratar falha de parsing.
  O download usa `responseType: "blob"`; erros JSON recebidos como blob também
  são decodificados. Nome do arquivo, clique e revogação da URL são preservados.
- FormData continua enviando `files[]`, sem boundary manual. Não há novo fluxo
  de cancelamento na UI: o inventário não encontrou consumidores de AbortSignal.

Inventário: 31 chamadas diretas a fetch em 25 arquivos, sendo 30 no navegador
em 24 arquivos e uma server-side. Foram migradas as 30 chamadas: autenticação
(2), membros (3), pacientes (4), profissionais (4), agendas (7), consultas (4)
e prontuários/anexos (6). Permanece uma chamada direta a fetch em
`frontend/src/lib/server/backend-api.ts`, reutilizada pelo BFF e pelos helpers
server-side, com URL do backend e `cache: "no-store"`. Ela não é código browser.

O frontend possui oito testes focados em `frontend/tests/browser-api.test.mjs`,
executados com `npm test` e o runner nativo `node:test`, no Node.js 24.15.0 já
utilizado pelo projeto. Exercitam o adaptador real com transporte simulado,
sem servidor ou banco: JSON/same-origin, query/cache, guarda de URL, status/erros,
parsing, FormData, blob e signal. Não são testes de renderização React ou E2E.
Nenhuma dependência de testes foi adicionada. Next.js e React não foram atualizados.

### Formulários — Fase 8

React Hook Form 7.87.0 e Zod 4.4.3, integrados por resolvers 5.9.1, gerenciam
17 dos 22 formulários existentes. Os quatro filtros e o upload permanecem
inalterados. Create/edit continuam separados e não foram introduzidos Dialog,
DataTable ou componentes de navegação.

Os schemas de `frontend/src/lib/forms/form-schemas.ts` validam valores do browser
sem normalizar payloads. Inputs shadcn/Base UI usam Controller; controles nativos
usam register. As regras HTML, os serializers, erros backend, defaults/resets,
strings vazias e conversões de datas/fusos continuam preservados. O componente
mínimo FormFieldError associa erros locais aos campos de forma acessível.

O inventário, os 14 schemas, as diferenças browser/BFF/Vine deliberadamente
mantidas e os testes focados estão em [FORMULARIOS.md](FORMULARIOS.md).
O runner frontend soma 22 testes (oito HTTP e 14 de formulários), sem infraestrutura
nova de componentes/E2E. Backend e BFF não foram modificados nesta fase.

### Query, paginação e DataTable — Fase 9

As listagens de membros, pacientes, profissionais, consultas e auditoria usam uma
DataTable route-first. Cada tabela recebe uma rota BFF relativa, constrói sua query e
consulta pelo `browserApi`/Axios. O fluxo permanece navegador → BFF Next.js → backend
AdonisJS; URLs ou credenciais privadas do backend não são expostas ao navegador.

A navegação usa apenas os metadados numéricos `total`, `perPage`, `currentPage` e
`lastPage`. URLs produzidas pelo paginator Lucid não são usadas. Consultas e auditoria
mantêm filtros na URL pública da página e preservam as conversões de data e fuso no
Server Component. Não há sorting interativo.

`GET /api/v1/clinics/:clinicId/members` aceita `page`, `perPage`, `search`,
`roleId` e `isActive` e retorna `{ data, meta }`. `roleId` é também o único seletor
aceito nos writes de membership; `Role.code` permanece identidade interna persistida
dos perfis predefinidos e personalizados. Helpers server-side que precisam
de todos os membros, como as opções de vínculo profissional e o filtro de auditoria,
percorrem todas as páginas em lotes de 100 e validam os metadados antes de avançar.

Clínicas acessíveis, timeline do prontuário, anexos, agenda profissional agregada e
dados auxiliares de selects mantêm suas apresentações especializadas.

Dois testes `node:test` da infraestrutura remota elevam a suíte frontend atual de
22 para 24 testes, sem adicionar infraestrutura de renderização de componentes.

```text
ROUTES=59
VALIDATION_CONTRACTS=47
QUERY_CONTRACTS=12
BODY_UPLOAD_CONTRACTS=35
NEW_QUERY_CONTRACT=GET /api/v1/clinics/:clinicId/members:query
```

### Formulários compartilhados e Dialog — Fase 10

A unificação de criação e edição foi aplicada somente quando as duas operações
possuem equivalência semântica real: pacientes, disponibilidade semanal e bloqueios
de agenda. Ela não foi generalizada para todos os formulários do sistema.

`PatientForm` concentra os campos e a submissão de pacientes. Sem paciente, usa os
valores vazios e `POST`; com paciente, usa `patientLinkToForm(...)` e `PATCH`. O
`patientFormSchema`, o conjunto completo de campos e o envio das strings opcionais
vazias foram preservados; a conversão posterior para `null` continua no BFF.
`create-patient-card.tsx` e `edit-patient-card.tsx` são wrappers finos. Pacientes
permanecem na superfície de página/card, sem Dialog, porque o formulário é extenso.

Os formulários curtos e contextuais da agenda usam Dialog:

- `WeeklyAvailabilityFormDialog` implementa create com `POST` e edit com `PATCH`,
  preservando `weeklyAvailabilityFormSchema`, o prefill por
  `weeklyAvailabilityToForm(...)` e o payload de dia e horários;
- `ScheduleBlockFormDialog` implementa create com `POST` e edit com `PATCH`,
  preservando `scheduleBlockFormSchema`, o prefill por `scheduleBlockToForm(...)`
  e a conversão `Date(...).toISOString()` de início e fim.

Ambos sincronizam o estado do React Hook Form com `reset(...)` quando mudam modo,
registro ou profissional. Fecham após sucesso confirmado ou cancelamento e
permanecem abertos em erro HTTP ou de rede. Permissões, seleção do profissional,
callbacks e atualização das listas continuam sob responsabilidade do manager.

O wrapper `frontend/src/components/ui/dialog.tsx` usa o primitive já instalado
`@base-ui/react/dialog`; nenhuma dependência foi adicionada. Portal, foco,
fechamento por Escape e restauração de foco permanecem delegados ao Base UI.

Profissionais, consultas, membros da clínica e prontuários/correções/anexos foram
deliberadamente mantidos especializados: profissionais distinguem criação global
com vínculo de edição apenas do vínculo; consultas distinguem criação completa de
edição parcial e reagendamento; membros usam criação de usuário/vínculo e comandos
separados de papel/status; prontuários seguem o modelo append-only e ações clínicas
especializadas. Essas diferenças não são pendências técnicas.

A Fase 10 não alterou backend, contratos HTTP, BFF Route Handlers, schemas Zod,
dependências, DataTables route-first, autenticação ou regras de permissão. O fluxo
continua navegador → BFF Next.js → backend AdonisJS.

### Sidebar e troca de clínica — Fase 11

`/clinics` permanece como a seleção inicial. Quando há uma única clínica acessível,
o redirecionamento existente leva a `/clinics/:clinicId/dashboard`; com múltiplas
clínicas, a página apresenta as opções disponíveis. Dentro de
`/clinics/[clinicId]/*`, o `pathname` é a fonte de verdade da clínica atual.

O layout server-side valida primeiro a clínica corrente com
`getClinicContext(clinicId)`. Um contexto inválido mantém o comportamento seguro de
`notFound()`. Depois da validação, `getAccessibleClinics()` carrega no servidor a
lista apresentada pelo `ClinicSwitcher`, que a recebe por props e é renderizado pelo
slot do `ClinicAppShell`.

O switcher não faz HTTP, não acessa token ou cookie e não persiste a clínica no
navegador. Não existe cookie de clínica, `localStorage`, React Context global ou query
param para essa seleção. A troca sempre navega para
`/clinics/:newClinicId/dashboard`, sem preservar automaticamente o módulo anterior,
pois a clínica de destino pode possuir permissões diferentes. O novo render
server-side executa `getClinicContext(newClinicId)` e o backend revalida o acesso; a
seleção na interface não concede autorização.

O shell clínico usa uma arquitetura adaptada ao padrão de sidebar recomendado pela
revisão, com primitives locais compatíveis com shadcn/base-nova:
`SidebarProvider`, `Sidebar`, `SidebarInset` e `Sheet` no comportamento mobile. A
navegação é organizada em Visão geral, Atendimento e Gestão, e seus oito itens
continuam filtrados pelas permissões existentes. O Administrador Global preserva o
wildcard `*`, e Administração preserva sua regra OR anterior.

Não foram introduzidos nova API/BFF, novas rotas, dependências, breadcrumbs, avatar,
grupos internos recolhíveis ou persistência da última clínica. O frontend controla
somente navegação e visibilidade; o backend permanece a autoridade de autorização.

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
- hash de senha, nulo somente enquanto o convite inicial não foi aceito;
- status ativo;
- indicador de administrador global.

### Convite e definição inicial de senha

O onboarding usa um registro separado em `clinic.user_invitation_tokens`. O token aleatório
de 256 bits existe em claro somente na composição do e-mail; o banco armazena seu digest
SHA-256. Convites expiram em 24 horas, são de uso único e mantêm no máximo um registro
pendente por usuário.

A criação ou reemissão confirma primeiro a transação PostgreSQL e só depois realiza o
dispatch SMTP. Falha de transporte preserva o estado recuperável para um reenvio. O aceite
bloqueia usuário e convite, grava o hash bcrypt e consome o token na mesma transação. Uma
conta sem `password_hash` segue indistinguível de credenciais inválidas no login.

O estado `is_active` permanece uma decisão administrativa independente da aceitação do
convite. Convites não criam Professional, não concedem Global Admin e, quando criam vínculo,
passam pelo mesmo `RoleGrantService` usado pelas demais atribuições.

No frontend, o link abre `/accept-invitation#token=...`. Um Client Component lê o fragmento,
remove-o imediatamente do histórico e mantém o token apenas em memória. Validação e aceite
seguem por `POST` no BFF Next.js, com `Cache-Control: no-store` e
`Referrer-Policy: no-referrer`; o navegador nunca chama o AdonisJS diretamente. Na administração da clínica,
a criação usa o endpoint de convite sem senha, mostra separadamente habilitação da conta,
senha configurada e estado do convite, e permite reenvio sem alterar vínculo ou perfil.

### Administração global no frontend

A rota autenticada `/admin` é independente de `clinicId` e aplica um gate server-side
diretamente sobre `user.isGlobalAdmin`. Ela não exige membership, clínica corrente,
cookie de clínica, armazenamento no browser ou contexto React global. A proteção de
interface antecipa o acesso; os middlewares do backend continuam sendo a autoridade
final de todas as operações.

A página reúne duas superfícies paginadas no servidor:

- `GlobalUsersManager` lista identidades, diferencia habilitação, senha configurada e
  estado do convite, e permite convidar, editar nome/e-mail, alterar status e reenviar
  convite. Vínculos iniciais usam exclusivamente `clinicId` + `roleId` e os perfis
  atribuíveis continuam vindo da API clinic-scoped;
- `GlobalClinicsManager` lista clínicas ativas e inativas, cadastra e edita somente os
  campos aceitos pela API e altera habilitação sem confundir essa operação com exclusão.
  Clínicas ativas oferecem entrada para a administração clinic-scoped existente;
  clínicas inativas podem ser reativadas, mas não fornecem atalho operacional.

O fluxo no browser permanece navegador → BFF Next.js em `/api/admin/*` → AdonisJS.
Não existe chamada direta ao backend, administração de senha ou promoção de Global
Admin nessa interface. A criação do primeiro Global Admin continua restrita ao comando
de bootstrap. Custom Roles, memberships, profissionais e agendas não são duplicados em
`/admin`; suas telas clinic-scoped continuam canônicas.

O header autenticado apresenta `Administração Global` somente quando
`user.isGlobalAdmin === true`, como ação separada dos oito itens de navegação da clínica.
Após login, a própria identidade devolvida pelo BFF direciona Global Admin para `/admin`
e usuários comuns para `/clinics`. O mesmo critério é aplicado em `/dashboard`, inclusive
quando o Global Admin não possui membership.

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
- testes de renderização de componentes e E2E no frontend;
- dashboard analítico avançado.

Essas ausências não impedem a validação acadêmica local, mas precisam ser tratadas antes de uma implantação real.

## 22. Evoluções possíveis

Evoluções posteriores podem incluir:

- dashboard analítico;
- Docker e Docker Compose;
- OpenAPI;
- ampliação dos testes de frontend além da camada HTTP e dos schemas/estado de formulários;
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
