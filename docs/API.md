# API do Sistema de Gestão de Clínica Médica

Este documento descreve o inventário de rotas do backend do MVP, os requisitos gerais de autenticação e autorização e as regras especiais de acesso por consultório.

## Visão geral

Base local validada:

```text
http://localhost:3333
```

Prefixo principal:

```text
/api/v1
```

Snapshot do contrato registrado em `backend/tests/contracts/http_contracts.fixture.ts`:

```text
TOTAL:   70
GET:     27
POST:    23
PATCH:   19
DELETE:   1
```

Essas contagens descrevem o estado atual da API e devem ser revalidadas quando o
contrato de rotas mudar.

A rota `/` é uma verificação pública simples da API. As demais rotas seguem os grupos de autenticação, administração global ou contexto de consultório descritos abaixo.

## Convenções de autenticação

O backend usa autenticação por access token.

Rotas protegidas pelo middleware `auth` exigem um usuário autenticado e ativo.

A API retorna respostas de erro conforme o contexto, incluindo:

- `401 Unauthorized` quando não há autenticação válida;
- `403 Forbidden` quando o usuário, o consultório, o vínculo ou o perfil está inativo, ou quando faltam permissões;
- `404 Not Found` quando o consultório ou recurso contextual não existe;
- `422 Unprocessable Entity` para dados de entrada inválidos, conforme os validadores;
- `409 Conflict` em conflitos de estado, versão ou agenda, conforme a operação.

## Autorização global

As rotas marcadas como `globalAdmin` exigem:

- autenticação;
- usuário ativo;
- `is_global_admin = true`.

O administrador global também pode acessar rotas de consultório. Nesse caso, recebe um contexto com permissão curinga:

```text
*
```

e não precisa possuir vínculo local com o consultório.

Não existe endpoint HTTP para promover ou rebaixar um usuário como administrador
global. A criação inicial desse tipo de conta ocorre pelo comando operacional de
bootstrap, fora da API.

## Autorização por consultório

As rotas com `clinicPermission` exigem:

- usuário ativo;
- consultório existente e ativo;
- vínculo ativo entre usuário e consultório, exceto para administrador global;
- perfil ativo;
- todas as permissões declaradas para a rota.

Falhas tratadas pelo serviço de autorização:

| Situação | Resposta |
|---|---:|
| Usuário inativo | 403 |
| Consultório inexistente | 404 |
| Consultório inativo | 403 |
| Usuário sem vínculo ativo | 403 |
| Perfil do vínculo inativo | 403 |
| Permissão insuficiente | 403 |

## Proteção do último administrador local

O sistema considera administrador local efetivo o vínculo que reúne simultaneamente:

- vínculo ativo;
- usuário ativo;
- perfil ativo;
- perfil com código `clinic_admin`.

As operações de administração de membros protegem o último administrador local efetivo de cada consultório, impedindo que a clínica fique sem administração ativa.

## Escopo de agenda profissional

As operações de escrita na agenda usam o middleware `scheduleManagement`.

São aceitos dois escopos:

### Gestão geral

Permitida para:

- administrador global;
- permissão curinga `*`;
- usuário com `schedules.manage`.

### Gestão da própria agenda

Permitida para usuário com `schedules.manage_own`, desde que:

- o vínculo entre profissional e consultório esteja ativo;
- o profissional esteja ativo;
- o profissional esteja ligado ao próprio usuário autenticado.

## Escopo de agendamentos

As operações de escrita em agendamentos usam o middleware `appointmentManagement`.

| Ação | Permissões gerais | Permissões sobre o próprio profissional |
|---|---|---|
| Criar | `appointments.create` | `appointments.create_own` |
| Atualizar | `appointments.update` | `appointments.update_own` |
| Alterar status | `appointments.change_status` | `appointments.change_status_own` |
| Reagendar | `appointments.create`, `appointments.update`, `appointments.change_status` | `appointments.create_own`, `appointments.update_own`, `appointments.change_status_own` |

O middleware define o escopo como:

```text
all
```

ou:

```text
own
```

Os controladores usam esse escopo para restringir as operações ao profissional associado ao usuário quando aplicável.

---

# Inventário de rotas

## Estado da API

### `GET /`

Autenticação: não exigida.

Finalidade: confirmar que a API está ativa.

Resposta esperada:

```json
{
  "name": "Clinic Management API",
  "status": "ok"
}
```

---

## Autenticação e sessão

### `POST /api/v1/auth/login`

Autenticação: não exigida.

Finalidade: autenticar um usuário e criar uma sessão por token.

### `GET /api/v1/auth/me`

Autenticação: obrigatória.

Finalidade: retornar o usuário autenticado.

### `GET /api/v1/auth/me/clinics`

Autenticação: obrigatória.

Finalidade: listar os consultórios ativos acessíveis pelo usuário autenticado.

### `DELETE /api/v1/auth/logout`

Autenticação: obrigatória.

Finalidade: encerrar a sessão atual.

### `POST /api/v1/invitations/validate`

Autenticação: não exigida.

Body:

```json
{
  "token": "<token recebido por e-mail>"
}
```

Finalidade: validar, sem consumir, um token de convite recebido exclusivamente no corpo.
Tokens inválidos, expirados, revogados ou consumidos recebem a mesma resposta pública.

### `POST /api/v1/invitations/accept`

Autenticação: não exigida.

Body:

```json
{
  "token": "<token recebido por e-mail>",
  "password": "<nova senha>",
  "passwordConfirmation": "<confirmação>"
}
```

A senha deve possuir no mínimo 12 caracteres e no máximo 72 bytes UTF-8; a
confirmação deve ser idêntica.

Finalidade: definir e confirmar a senha inicial, consumir o convite em uso único e então
permitir que o usuário utilize o login normal. Não cria sessão automaticamente.

---

## Consultórios — administração global

Todas as rotas desta seção exigem:

```text
auth + globalAdmin
```

### `GET /api/v1/clinics`

Finalidade: listar consultórios.

### `POST /api/v1/clinics`

Finalidade: criar um consultório.

### `GET /api/v1/clinics/:id`

Finalidade: consultar um consultório.

Parâmetros:

- `id`: UUID do consultório.

### `PATCH /api/v1/clinics/:id`

Finalidade: atualizar os dados de um consultório.

### `PATCH /api/v1/clinics/:id/status`

Finalidade: ativar ou inativar um consultório.

---

## Usuários — administração global

Todas as rotas desta seção exigem:

```text
auth + globalAdmin
```

### `GET /api/v1/users`

Finalidade: listar usuários.

### `POST /api/v1/users/invitations`

Finalidade: criar um usuário sem senha e enviar um convite. Pode receber vínculos por
`clinicId` + `roleId`; as mesmas regras de escopo e concessão de perfil são aplicadas.
A resposta contém somente status seguro do onboarding, nunca token ou digest.

Body:

```json
{
  "fullName": "Nome do usuário",
  "email": "usuario@example.com",
  "memberships": [
    {
      "clinicId": "<uuid da clínica>",
      "roleId": "<uuid do perfil>"
    }
  ]
}
```

`memberships` é opcional e não pode repetir a mesma clínica. `password`,
`passwordConfirmation` e `isGlobalAdmin` são explicitamente rejeitados.

### `POST /api/v1/users/:userId/invitations/resend`

Finalidade: revogar o convite pendente e enviar um novo convite para usuário ativo que
ainda não configurou senha. Não altera vínculos, perfis ou status do usuário.

### `GET /api/v1/users/:id`

Finalidade: consultar um usuário.

Parâmetros:

- `id`: UUID do usuário.

### `PATCH /api/v1/users/:id`

Finalidade: atualizar `fullName` e/ou `email`. Um body vazio é rejeitado. Os campos
`password`, `passwordConfirmation` e `passwordHash` são explicitamente rejeitados;
o administrador não pode definir nem substituir a credencial de outra conta.

### `PATCH /api/v1/users/:id/status`

Finalidade: ativar ou inativar um usuário.

A operação respeita a proteção do último administrador local efetivo.

---

## Vínculos globais entre usuários e consultórios

Todas as rotas desta seção exigem:

```text
auth + globalAdmin
```

### `GET /api/v1/clinic-memberships`

Finalidade: listar vínculos entre usuários, consultórios e perfis.

### `POST /api/v1/clinic-memberships`

Finalidade: criar um vínculo global.

O perfil deve ser selecionado exclusivamente por `roleId` (UUID), tanto para
perfis do sistema quanto para perfis personalizados.

### `GET /api/v1/clinic-memberships/:id`

Finalidade: consultar um vínculo.

Parâmetros:

- `id`: UUID do vínculo.

### `PATCH /api/v1/clinic-memberships/:id`

Finalidade: atualizar um vínculo.

O novo perfil deve ser informado exclusivamente por `roleId`.

### `PATCH /api/v1/clinic-memberships/:id/status`

Finalidade: ativar ou inativar um vínculo.

A operação respeita a proteção do último administrador local efetivo.

---

## Contexto e membros do consultório

### `GET /api/v1/clinics/:clinicId/context`

Permissões:

```text
clinics.read
```

Finalidade: retornar o contexto de autorização do usuário no consultório.

### `GET /api/v1/clinics/:clinicId/members`

Permissões:

```text
users.read
```

Finalidade: listar membros do consultório.

Query params opcionais:

- `page`: página atual, com default `1`;
- `perPage`: quantidade por página, com default `20` e máximo `100`;
- `search`: busca textual por nome ou e-mail do usuário;
- `roleId`: UUID do perfil, do sistema ou personalizado, disponível no consultório;
- `isActive`: status do vínculo (`true` ou `false`).

A resposta usa o envelope paginado do Lucid:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "perPage": 20,
    "currentPage": 1,
    "lastPage": 1
  }
}
```

Os itens de `data` preservam o vínculo e as relações `user` e `role`. O objeto `user`
inclui os metadados seguros de onboarding `passwordConfigured`, `invitationStatus`,
`invitationSentAt` e `invitationExpiresAt`, sem expor senha, hash ou token. A ordenação é
determinística por `created_at ASC, id ASC`, sempre isolada por `clinicId`.

### `POST /api/v1/clinics/:clinicId/members/invitations`

Permissões exigidas em conjunto:

```text
users.create
users.assign_role
```

Finalidade: criar usuário sem senha, vínculo local por `roleId` e convite. A senha não é
aceita neste endpoint e o `RoleGrantService` continua sendo a autoridade da atribuição.
O usuário define a própria senha ao aceitar o convite. A definição direta de senha permanece
restrita ao comando operacional de bootstrap do primeiro Administrador Geral, fora da API HTTP.

Body:

```json
{
  "fullName": "Nome do usuário",
  "email": "usuario@example.com",
  "roleId": "<uuid do perfil>"
}
```

`password`, `passwordConfirmation` e `isGlobalAdmin` são explicitamente rejeitados.

### `POST /api/v1/clinics/:clinicId/members/:membershipId/invitations/resend`

Permissão:

```text
users.create
```

Finalidade: reenviar convite para o usuário do vínculo pertencente ao consultório. Não
altera o vínculo nem o perfil.

### `PATCH /api/v1/clinics/:clinicId/members/:membershipId/role`

Permissões:

```text
users.assign_role
```

Finalidade: alterar o perfil de um membro do consultório.

O novo perfil deve ser informado exclusivamente por `roleId`.

A operação respeita a proteção do último administrador local efetivo.

`Role.code` permanece uma identidade interna persistida dos perfis, inclusive dos
perfis predefinidos. Ele não é aceito como seletor nas operações ou filtros de
membership; clientes devem usar o UUID `roleId`.

### `PATCH /api/v1/clinics/:clinicId/members/:membershipId/status`

Permissões:

```text
users.deactivate
```

Finalidade: ativar ou inativar o vínculo de um membro.

A operação respeita a proteção do último administrador local efetivo.

Parâmetros usados nesta seção:

- `clinicId`: UUID do consultório;
- `membershipId`: UUID do vínculo.

---

## Perfis e permissões do consultório

Perfis do sistema são globais e imutáveis. Perfis personalizados pertencem a uma
única clínica. As rotas abaixo são clinic-scoped: usuários comuns precisam do
vínculo e da permissão indicada; o administrador global usa o contexto curinga e
não depende de membership.

`Role.code` é identidade interna do domínio. Escritas e filtros de membership usam
exclusivamente `roleId`; `roleCode` não é input HTTP para atribuição de perfil.

### `GET /api/v1/clinics/:clinicId/roles/assignable`

Permissão:

```text
users.assign_role
```

Finalidade: listar em `{ data }` os perfis ativos do sistema e os perfis
personalizados ativos da clínica que o ator pode atribuir. Para um usuário
clinic-scoped, todas as permissões do perfil precisam estar contidas em sua própria
autoridade; o administrador global pode consultar todos os perfis ativos visíveis
na clínica.

### `GET /api/v1/clinics/:clinicId/roles/permissions`

Permissão:

```text
roles.manage
```

Finalidade: listar em `{ data }` as permissões ativas que podem integrar um perfil
personalizado. A permissão curinga e permissões não atribuíveis pelo catálogo não
são oferecidas.

### `GET /api/v1/clinics/:clinicId/roles`

Permissão:

```text
roles.manage
```

Finalidade: listar em `{ data }` os perfis do sistema e os perfis personalizados
pertencentes à clínica, com suas permissões. A listagem administrativa inclui
perfis ativos e inativos.

### `POST /api/v1/clinics/:clinicId/roles`

Permissão:

```text
roles.manage
```

Body:

```json
{
  "name": "Nome do perfil",
  "description": "Descrição opcional",
  "permissionCodes": ["patients.read"]
}
```

Finalidade: criar um perfil personalizado ativo na clínica. `name` possui de 3 a
120 caracteres, `description` é opcional/nula e limitada a 255 caracteres, e
`permissionCodes` é uma lista distinta. Nomes reservados por perfis do sistema e
nomes personalizados duplicados na clínica são rejeitados. Retorna `{ role }` com
status `201`.

### `GET /api/v1/clinics/:clinicId/roles/:roleId`

Permissão:

```text
roles.manage
```

Finalidade: consultar em `{ role }` um perfil do sistema ou um perfil
personalizado pertencente à clínica.

### `PATCH /api/v1/clinics/:clinicId/roles/:roleId`

Permissão:

```text
roles.manage
```

Body: o mesmo contrato completo de `name`, `description` e `permissionCodes` usado
na criação.

Finalidade: atualizar somente um perfil personalizado pertencente à clínica.
Perfis do sistema são imutáveis.

### `PATCH /api/v1/clinics/:clinicId/roles/:roleId/status`

Permissão:

```text
roles.manage
```

Body:

```json
{
  "isActive": true
}
```

Finalidade: ativar ou inativar um perfil personalizado da clínica. Perfis do
sistema são imutáveis. A reativação volta a validar se o ator pode conceder todas
as permissões contidas no perfil.

### Limites de concessão

`roles.manage` autoriza administrar perfis personalizados; `users.assign_role`
autoriza atribuir um perfil a um vínculo. As permissões são responsabilidades
distintas. O `RoleGrantService` rejeita a permissão curinga, permissões fora do
catálogo atribuível, permissões inexistentes/inativas e qualquer conjunto que
exceda a autoridade do ator. As mesmas verificações protegem criação, atualização,
reativação e atribuição, impedindo escalada por perfil personalizado.

---

## Pacientes

### `GET /api/v1/clinics/:clinicId/patients`

Permissões:

```text
patients.read
```

Finalidade: listar pacientes vinculados ao consultório.

### `POST /api/v1/clinics/:clinicId/patients`

Permissões:

```text
patients.create
```

Finalidade: criar um paciente global ou vinculá-lo ao consultório.

### `GET /api/v1/clinics/:clinicId/patients/:patientId`

Permissões:

```text
patients.read
```

Finalidade: consultar um paciente no contexto do consultório.

### `PATCH /api/v1/clinics/:clinicId/patients/:patientId`

Permissões:

```text
patients.update
```

Finalidade: atualizar os dados do paciente e seu contexto local.

### `PATCH /api/v1/clinics/:clinicId/patients/:patientId/status`

Permissões:

```text
patients.update
```

Finalidade: ativar ou inativar o vínculo do paciente com o consultório.

Parâmetros usados nesta seção:

- `clinicId`: UUID do consultório;
- `patientId`: UUID global do paciente.

---

## Prontuário eletrônico

As permissões indicadas nas rotas desta seção não bastam isoladamente. O backend
também aplica autorização sobre o paciente solicitado. `*` e
`medical_records.access_all` liberam o escopo completo; nos demais casos, o usuário
deve estar associado a um profissional ativo, com vínculo profissional ativo na
clínica e ao menos um agendamento `scheduled`, `confirmed` ou `completed` com o
vínculo do paciente nessa clínica. A mesma proteção alcança timeline, entrada,
correção e anexos.

### `GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record`

Permissões exigidas em conjunto:

```text
patients.read
medical_records.read
```

Finalidade: consultar a linha do tempo global do prontuário a partir de um contexto clínico autorizado.

A consulta exige uma finalidade de acesso válida e gera registro de auditoria.

### `POST /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries`

Permissões exigidas em conjunto:

```text
patients.read
medical_records.create
```

Finalidade: criar uma entrada clínica no prontuário.

A autoria e o contexto profissional são derivados no backend.

Body:

```json
{
  "appointmentId": "<uuid opcional ou null>",
  "entryTypeCode": "consultation",
  "content": "Conteúdo clínico"
}
```

`entryTypeCode` aceita `consultation`, `evolution` ou `other`; `content` possui de
1 a 20.000 caracteres. `appointmentId` é opcional/nulo. Quando informado, deve
identificar um agendamento `completed` da mesma clínica, paciente e profissional
derivado. Concluir um agendamento não cria uma entrada automaticamente.

A resposta serializada identifica `contentFormat` como `markdown` e
`contentFormatVersion` como `1`. O frontend oficial renderiza somente um subconjunto
restrito e versionado de Markdown; HTML bruto não é renderizado como HTML.

### `GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId`

Permissões exigidas em conjunto:

```text
patients.read
medical_records.read
```

Finalidade: consultar uma entrada específica.

A consulta gera registro de auditoria.

### `POST /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/corrections`

Permissões exigidas em conjunto:

```text
patients.read
medical_records.correct
```

Finalidade: registrar uma correção vinculada a uma entrada anterior.

A correção recebe somente `content`, usa a mesma representação Markdown
restrita/versionada na resposta e não sobrescreve o registro original.

Parâmetros usados nesta seção:

- `clinicId`: UUID do consultório;
- `patientId`: UUID do paciente;
- `entryId`: UUID da entrada clínica.

---

## Anexos clínicos

### `GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments`

Permissões exigidas em conjunto:

```text
patients.read
attachments.read
```

Finalidade: listar anexos disponíveis de uma entrada.

A operação exige `purposeCode`, aceita `purposeNote`, usa paginação e gera registro
de auditoria. A resposta contém metadados públicos do anexo, nunca chave privada,
hash de armazenamento ou URL pública.

### `POST /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments`

Permissões exigidas em conjunto:

```text
patients.read
attachments.upload
```

Finalidade: enviar de um a dois anexos clínicos privados em multipart, no campo
`files[]`. O tamanho máximo de cada arquivo vem da configuração do backend.

### `GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments/:attachmentId/download`

Permissões exigidas em conjunto:

```text
patients.read
attachments.read
```

Finalidade: baixar um anexo clínico privado. Não existe URL pública de arquivo.

O acesso exige `purposeCode`, aceita `purposeNote` e gera registro de auditoria.
A resposta usa `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`
e `Content-Disposition: attachment`; tipos não reconhecidos são entregues como
`application/octet-stream`.

Parâmetros adicionais:

- `attachmentId`: UUID do anexo.

---

## Profissionais

### `GET /api/v1/clinics/:clinicId/professionals`

Permissões:

```text
professionals.read
```

Finalidade: listar profissionais vinculados ao consultório.

### `POST /api/v1/clinics/:clinicId/professionals`

Permissões:

```text
professionals.create
```

Finalidade: criar um profissional global ou vinculá-lo ao consultório.

### `GET /api/v1/clinics/:clinicId/professionals/:professionalId`

Permissões:

```text
professionals.read
```

Finalidade: consultar um profissional no contexto do consultório.

### `PATCH /api/v1/clinics/:clinicId/professionals/:professionalId`

Permissões:

```text
professionals.update
```

Finalidade: atualizar os dados do profissional e do vínculo local.

### `PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/status`

Permissões:

```text
professionals.update
```

Finalidade: ativar ou inativar o vínculo profissional no consultório.

Parâmetros usados nesta seção:

- `clinicId`: UUID do consultório;
- `professionalId`: UUID global do profissional.

---

## Agenda profissional

### `GET /api/v1/clinics/:clinicId/professionals/:professionalId/schedule`

Permissões:

```text
schedules.read
```

Finalidade: consultar disponibilidades semanais e bloqueios do profissional.

### `POST /api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities`

Permissões:

```text
schedules.read
```

Além disso, exige:

```text
schedules.manage
```

ou:

```text
schedules.manage_own
```

Finalidade: criar disponibilidade semanal.

### `PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities/:availabilityId`

Permissões e escopo: iguais aos da criação de disponibilidade.

Finalidade: atualizar uma disponibilidade semanal.

### `PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities/:availabilityId/status`

Permissões e escopo: iguais aos da criação de disponibilidade.

Finalidade: ativar ou inativar uma disponibilidade semanal.

### `POST /api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks`

Permissões:

```text
schedules.read
```

Além disso, exige `schedules.manage` ou `schedules.manage_own`.

Finalidade: criar um bloqueio de agenda.

### `PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks/:blockId`

Permissões e escopo: iguais aos da criação de bloqueio.

Finalidade: atualizar um bloqueio de agenda.

### `PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks/:blockId/status`

Permissões e escopo: iguais aos da criação de bloqueio.

Finalidade: ativar ou inativar um bloqueio.

Parâmetros adicionais:

- `availabilityId`: UUID da disponibilidade;
- `blockId`: UUID do bloqueio.

---

## Agendamentos

### `GET /api/v1/clinics/:clinicId/appointments`

Permissões:

```text
appointments.read
```

Finalidade: listar agendamentos por intervalo e filtros aceitos pela API.

### `POST /api/v1/clinics/:clinicId/appointments`

Permissão base:

```text
appointments.read
```

Além disso, exige:

```text
appointments.create
```

ou:

```text
appointments.create_own
```

Finalidade: criar um agendamento.

### `GET /api/v1/clinics/:clinicId/appointments/:appointmentId`

Permissões:

```text
appointments.read
```

Finalidade: consultar um agendamento.

### `PATCH /api/v1/clinics/:clinicId/appointments/:appointmentId`

Permissão base:

```text
appointments.read
```

Além disso, exige:

```text
appointments.update
```

ou:

```text
appointments.update_own
```

Finalidade: atualizar dados administrativos permitidos sem alterar o horário diretamente.

Mudanças de horário devem usar a rota de reagendamento.

### `POST /api/v1/clinics/:clinicId/appointments/:appointmentId/confirm`

Permissão base:

```text
appointments.read
```

Além disso, exige:

```text
appointments.change_status
```

ou:

```text
appointments.change_status_own
```

Finalidade: confirmar um agendamento.

### `POST /api/v1/clinics/:clinicId/appointments/:appointmentId/cancel`

Permissões: iguais às da confirmação.

Finalidade: cancelar um agendamento com motivo válido.

### `POST /api/v1/clinics/:clinicId/appointments/:appointmentId/complete`

Permissões: iguais às da confirmação.

Finalidade: concluir um agendamento respeitando as regras temporais.

### `POST /api/v1/clinics/:clinicId/appointments/:appointmentId/no-show`

Permissões: iguais às da confirmação.

Finalidade: marcar ausência respeitando as regras temporais.

### `POST /api/v1/clinics/:clinicId/appointments/:appointmentId/reschedule`

Permissão base:

```text
appointments.read
```

Escopo geral exige, em conjunto:

```text
appointments.create
appointments.update
appointments.change_status
```

Escopo próprio exige, em conjunto:

```text
appointments.create_own
appointments.update_own
appointments.change_status_own
```

Finalidade: criar um novo agendamento e preservar o anterior como reagendado.

Parâmetros usados nesta seção:

- `clinicId`: UUID do consultório;
- `appointmentId`: UUID do agendamento.

---

## Auditoria

### `GET /api/v1/clinics/:clinicId/audit-logs`

Permissões:

```text
audit_logs.read
```

Finalidade: listar registros de auditoria do consultório.

Filtros aceitos:

- página;
- quantidade por página;
- data inicial;
- data final;
- usuário;
- paciente;
- ação de acesso;
- finalidade de acesso.

A resposta contém somente metadados seguros, sem conteúdo clínico, credenciais, caminhos de armazenamento ou hashes.

---

# Perfis do catálogo padrão

## `clinic_admin`

Nome: Administrador de Consultório.

Recebe todas as permissões atuais do catálogo e pode administrar operações e usuários do consultório.

## `receptionist`

Nome: Recepcionista.

Permissões principais:

```text
clinics.read
patients.read
patients.create
patients.update
professionals.read
schedules.read
appointments.read
appointments.create
appointments.update
appointments.change_status
```

Não recebe acesso a prontuários, anexos clínicos ou auditoria.

## `doctor`

Nome: Médico.

Permissões principais:

```text
clinics.read
patients.read
professionals.read
schedules.read
schedules.manage_own
appointments.read
appointments.create_own
appointments.update_own
appointments.change_status_own
medical_records.read
medical_records.create
medical_records.correct
attachments.read
attachments.upload
```

O médico administra apenas a própria agenda e os próprios agendamentos quando usa permissões `_own`.

---

# Observações de segurança

- Identificadores de rota são validados como UUID quando declarados no roteador.
- A existência de uma rota não garante acesso: a autorização é sempre reavaliada no backend.
- O frontend pode ocultar recursos sem permissão, mas o backend é a autoridade final.
- Pacientes e profissionais possuem identidade global, com vínculos locais por consultório.
- Agendamentos validam o contexto conjunto de clínica, paciente e profissional.
- Agendamentos ativos do mesmo profissional não podem se sobrepor.
- Entradas de prontuário e logs clínicos relevantes são preservados para rastreabilidade.
- Anexos permanecem em armazenamento privado e são entregues somente por rotas autorizadas.
- A documentação descreve o MVP acadêmico atual e não substitui uma especificação formal OpenAPI.
