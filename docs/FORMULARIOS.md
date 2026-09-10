# Formulários frontend — Fases 8 e 10

## Escopo e decisão

Adequação à recomendação de React Hook Form e validação frontend do parecer,
sem harmonizar as diferenças preexistentes entre browser, BFF e Vine.
O backend permanece a autoridade de regras de negócio e segurança.

Foram identificados **22 formulários HTML**: **17 migrados**, quatro filtros
deliberadamente preservados e um upload preservado. Não foram criados formulários
para botões de status, seleção de profissional ou edição de papel em uma linha.
Create/edit continuam em componentes distintos. Não há DataTable, Dialog,
paginação nova, sidebar ou alteração de BFF nesta fase.

Dependências exatas: `react-hook-form@7.87.0`, `zod@4.4.3` e
`@hookform/resolvers@5.9.1`, com React 19.2.4 e Next.js 16.2.10 preservados.
Zod 4.4.3 já existia transitivamente e passou a ser dependência direta.
A dependência transitiva nova é `@standard-schema/utils@0.3.0`.
A reorganização de ajv/ajv-formats/json-schema-traverse no lockfile foi auditada
e autorizada: os consumidores preexistentes continuam resolvendo suas versões
anteriores. Não houve reinstalação para reduzir o diff, execução de scripts de
instalação, audit fix ou atualização geral de dependências.

## Inventário inicial

Os caminhos abaixo são relativos a `frontend/`. `C` representa
`/api/clinics/:clinicId`; `P` representa `C/patients/:patientId/medical-record`;
`S` representa `C/professionals/:professionalId`. Os IDs continuam codificados
com `encodeURIComponent` nas chamadas reais.

Todos os 17 formulários usavam `useState` para campos, handlers `onChange` e
submissão manual. A coluna estado/handlers conta somente campos do formulário,
não loading, mensagens, painel aberto, dados carregados ou drafts de ações de linha.

| Arquivo                                                             | Finalidade/categoria         | Campos                                                                                                                            | Estado/handlers antes | Endpoint e payload preservados                                                                            | Sucesso preservado                                               |
| ------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/app/login/login-form.tsx`                                      | Login; ação                  | email, password                                                                                                                   | 2/2                   | POST `/api/auth/login`; `{email,password}` sem trim no browser                                            | replace `/clinics` e refresh                                     |
| `src/components/administration/clinic-members-manager.tsx`          | Convite de membro; create    | fullName, email, roleId                                                                                                           | RHF/Zod                | POST `C/members`; BFF encaminha ao lifecycle de convite clinic-scoped por `roleId`                          | Recarrega a lista, limpa o formulário e exibe sucesso            |
| `src/components/patients/create-patient-card.tsx`                   | Paciente/vínculo; create     | Os 13 campos de paciente descritos abaixo                                                                                         | 1 objeto/13           | POST `C/patients`; objeto completo, inclusive strings vazias                                              | Callback, reset, fecha card e mensagem                           |
| `src/components/patients/edit-patient-card.tsx`                     | Paciente/vínculo; edit       | Os mesmos 13 campos                                                                                                               | 1 objeto/13           | PATCH `C/patients/:patientId`; conjunto completo, não apenas dirty fields                                 | Callback de atualização                                          |
| `src/components/professionals/create-professional-card.tsx`         | Profissional/vínculo; create | fullName, crmNumber, crmState, specialty, phone, email, userId, localCode, defaultAppointmentDurationMinutes, acceptsAppointments | 1 objeto/10           | POST `C/professionals`; propriedades explícitas, `userId                                                  |                                                                  | null`, duração com `Number`, boolean preservado   | Callback, reset, fecha card e mensagem                         |
| `src/components/professionals/edit-professional-link-card.tsx`      | Vínculo profissional; edit   | localCode, defaultAppointmentDurationMinutes, acceptsAppointments                                                                 | 1 objeto/3            | PATCH `S`; três propriedades explícitas, duração numérica                                                 | Callback de atualização                                          |
| `src/components/schedules/create-weekly-availability-card.tsx`      | Disponibilidade; create      | weekday, startTime, endTime                                                                                                       | 1 objeto/3            | POST `S/weekly-availabilities`; weekday com `Number`, horários intactos                                   | Callback, reset, fecha card e mensagem                           |
| `src/components/schedules/edit-weekly-availability-card.tsx`        | Disponibilidade; edit        | weekday, startTime, endTime                                                                                                       | 1 objeto/3            | PATCH `S/weekly-availabilities/:availabilityId`; mesmos três campos                                       | Callback de atualização                                          |
| `src/components/schedules/create-schedule-block-card.tsx`           | Bloqueio; create             | startsAt, endsAt, reason                                                                                                          | 1 objeto/3            | POST `S/schedule-blocks`; `new Date(...).toISOString()` no fuso do browser, reason intacto                | Callback, reset, fecha card e mensagem                           |
| `src/components/schedules/edit-schedule-block-card.tsx`             | Bloqueio; edit               | startsAt, endsAt, reason                                                                                                          | 1 objeto/3            | PATCH `S/schedule-blocks/:blockId`; mesma conversão                                                       | Callback de atualização                                          |
| `src/components/appointments/create-appointment-card.tsx`           | Consulta; create             | patientClinicId, clinicProfessionalId, startsAt, durationMinutes, appointmentTypeCode, administrativeNote                         | 1 objeto/6            | POST `C/appointments`; seis propriedades, duração com `Number` e data pelo helper do fuso clínico         | Verifica retorno, reset, fecha card, mensagem e refresh          |
| `src/components/appointments/appointment-list-item.tsx`             | Consulta; edit               | patientClinicId, appointmentTypeCode, administrativeNote                                                                          | 1 objeto/3            | PATCH `C/appointments/:id`; três campos + expectedVersion atual                                           | Atualiza consulta/prefill, fecha edição, mensagem e refresh      |
| `src/components/appointments/appointment-reschedule-action.tsx`     | Reagendamento; ação          | clinicProfessionalId, startsAt, durationMinutes, cancellationNote                                                                 | 1 objeto/4            | POST `C/appointments/:id/reschedule`; campos + expectedVersion, duração numérica e helper do fuso clínico | Alert e navegação para a data reagendada                         |
| `src/components/appointments/appointment-status-actions.tsx`        | Cancelamento; ação           | cancellationReasonCode, cancellationNote                                                                                          | 2/2                   | POST `C/appointments/:id/cancel`; dois campos + expectedVersion                                           | Callback, mensagem, fecha/limpa cancelamento e refresh           |
| `src/components/medical-records/medical-records-manager.tsx`        | Acesso auditado; ação        | selectedPatientId, purposeCode, purposeNote                                                                                       | 3/3                   | POST `P/access`; purposeCode, `purposeNote.trim()                                                         |                                                                  | null`, page e perPage 20; paciente apenas no path | Carrega timeline; paginação/refresh permanecem em loadTimeline |
| `src/components/medical-records/medical-record-entry-form.tsx`      | Entrada clínica; ação        | entryTypeCode, content                                                                                                            | 2/2                   | POST `P/entries`; appointmentId null, entryTypeCode, content.trim()                                       | Limpa somente conteúdo, mantém tipo, aguarda callback e mensagem |
| `src/components/medical-records/medical-record-correction-form.tsx` | Correção; ação               | content                                                                                                                           | 1/1                   | POST `P/entries/:entryId/corrections`; content.trim()                                                     | Limpa conteúdo e aguarda callback                                |

Campos de paciente: fullName, birthDate, cpf, phone, email, addressStreet,
addressNumber, addressComplement, addressNeighborhood, addressCity, addressState,
addressPostalCode e localRecordNumber.

### Formulários não migrados

| Arquivo                                                                    | Campos/estado anterior                                                                  | Validação e envio existentes                                                                                                                                               | Motivo                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/components/patients/clinic-patients-manager.tsx`                      | searchInput/statusFilter; dois estados e handlers                                       | Search trim e limite 180; GET `C/patients` com query; atualiza listagem/erros                                                                                              | Filtro/paginação fora da fase                     |
| `src/components/professionals/clinic-professionals-manager.tsx`            | search/status/acceptance; três estados e handlers                                       | Search trim e limite 180; GET `C/professionals` com query; atualiza listagem/erros                                                                                         | Filtro/paginação fora da fase                     |
| `src/app/(authenticated)/clinics/[clinicId]/appointments/page.tsx`         | fromDate, toDate, status, patientClinicId, clinicProfessionalId; sem estado client-side | Formulário GET nativo; datas HTML obrigatórias; recarrega página com query                                                                                                 | Server Component/filtro                           |
| `src/app/(authenticated)/clinics/[clinicId]/audit-logs/page.tsx`           | fromDate, toDate, userId, patientId, accessAction, purposeCode; sem estado client-side  | Formulário GET nativo; datas HTML obrigatórias; recarrega página com query                                                                                                 | Server Component/filtro                           |
| `src/components/medical-records/medical-record-attachment-upload-form.tsx` | selectedFiles + input ref; um handler                                                   | 1–2 arquivos, até 10 MB, não vazios, nome até 255, extensões/MIMEs atuais; POST `P/entries/:entryId/attachments`, FormData `files[]`; limpa lista/input e aguarda callback | Fluxo simples e especializado, preservado sem RHF |

Drafts de papel por membro, seleção de profissional da agenda, status,
confirmar/concluir/falta e downloads não foram convertidos em formulários.

## Schemas, HTML e comparação com Vine

Os schemas estão em `frontend/src/lib/forms/form-schemas.ts`. Compartilham
somente regras repetidas (textos, e-mail, duração, campos de vínculo/consulta).
Cada componente declara seu `useForm` e `zodResolver`; não existe Provider nem
camada genérica de renderização de formulários.

| Schema(s)                                                                           | Contrato browser-side preservado                                                                                                                                                            | Validator backend de referência / diferença preservada                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loginFormSchema                                                                     | email HTML obrigatório; senha não vazia                                                                                                                                                     | `session.ts`: Vine também limita email/senha e normaliza email. Não foram acrescentados limites novos ao login browser                                   |
| memberFormSchema                                                                    | Nome 3–180; email obrigatório até 254; perfil selecionado por `roleId`; o administrador não define senha                                                                                    | `user_invitation.ts`; a criação clinic-scoped usa convite e mantém o `RoleGrantService` como autoridade                                                   |
| invitationPasswordFormSchema                                                        | Senha com no mínimo 12 caracteres, no máximo 72 bytes UTF-8 e confirmação idêntica                                                                                                          | `user_invitation.ts`; o backend repete a política e consome o convite em uso único                                                                        |
| patientFormSchema                                                                   | Nome 3–180, nascimento obrigatório/max data local atual; opcionais mantêm vazio; phone 20, email 254, rua 180, número 30, complemento/bairro/cidade 120, UF 2, CEP 8, CPF 11, prontuário 60 | `patient.ts`: Vine/BFF exigem completude de CPF/CEP, trim/null e datas válidas. PATCH admite opcionais, mas a UI continua enviando o formulário completo |
| professionalFormSchema / professionalLinkFormSchema                                 | Nome 3–180; CRM 1–30 e UF com 2 caracteres; especialidade 2–120; phone 20, email 254, código local 60; duração inteira 5–480 e boolean                                                      | `professional.ts`: userId continua opção de select, não recebe nova regex UUID; JSON mantém null, Number e campos explícitos                             |
| weeklyAvailabilityFormSchema                                                        | Sete opções de weekday; horários obrigatórios via input time                                                                                                                                | `professional_schedule.ts`: formato e regras definitivas no backend. Ordem início/fim continua no BFF/Service, não foi antecipada silenciosamente        |
| scheduleBlockFormSchema                                                             | Datas válidas segundo new Date, início anterior ao fim e reason até 240                                                                                                                     | `professional_schedule.ts`: ISO é produzido pelo serializer existente; não utiliza o helper de fuso de consultas                                         |
| appointmentFormSchema / appointmentEditFormSchema / appointmentRescheduleFormSchema | Selects obrigatórios aplicáveis, duração inteira 5–480, tipo até 60 e notas até 500; data required e helper clínico existente                                                               | `appointment.ts`: versões e permissões continuam backend; não introduz uuid/datetime defaults Zod nem propriedades extras                                |
| appointmentCancellationFormSchema                                                   | Seis razões manuais; nota opcional até 500, inclusive vazia para other                                                                                                                      | `appointment.ts`: não confunde cancelamento com a regra de finalidade de prontuário                                                                      |
| medicalRecordAccessFormSchema                                                       | Paciente selecionado, quatro finalidades, nota até 500 e não branca para other                                                                                                              | `medical_record.ts` + BFF/Service: exigência condicional já existia no browser e continua existindo no servidor                                          |
| medicalRecordEntryFormSchema / medicalRecordCorrectionFormSchema                    | Conteúdo não branco, até 20.000 caracteres; três tipos de entrada quando aplicável                                                                                                          | `medical_record.ts`: trim continua no serializer, não transforma o valor exibido enquanto se digita                                                      |

`required`, `type`, `minLength`, `maxLength`, `min`, `max`, `step`, `multiple`
e demais atributos HTML existentes foram preservados. Não se adicionou
`noValidate`: restrições nativas de email, date, time e number continuam ativas.
Os schemas não substituem todas as verificações nativas ou server-side.

Diferenças preexistentes explicitamente mantidas:

- E-mail: HTML permite `ana!teste@example.com` e domínio de um rótulo; Zod
  padrão/BFF/Vine não têm exatamente o mesmo conjunto. Não se usa `z.email()`.
- UUID: há diferença entre aceitação do Vine e a restrição de versões 1–5 em
  helpers BFF. Os selects não receberam uma nova restrição por versão.
- UF: paciente continua removendo não letras e convertendo para maiúsculas,
  embora Vine verifique somente comprimento; CRM também conserva seu handler.
- CPF e CEP continuam removendo não dígitos. Não foi criada exigência de
  completude no browser onde ela antes pertencia ao BFF/backend.
- Opcionais seguem como strings vazias/espaços no formulário e nas chamadas que
  já os enviavam assim. O BFF continua responsável por seu trim/null posterior.
- Edições não passaram a enviar só campos alterados; os conjuntos completos
  anteriores permanecem, mesmo quando o endpoint PATCH aceita menos campos.
- Nascimento mantém a data local do browser como limite. Bloqueios usam o fuso
  do browser; consultas/reagendamento usam `localDateTimeToUtcIso` com o fuso da
  clínica. Nenhum desses helpers foi alterado.
- Regras exclusivamente server-side, autorização, conflitos e constraints não
  foram duplicadas no frontend nem retiradas do backend.

## Estado, apresentação e erros

- `Controller` integra os Inputs shadcn/Base UI já controlados e o select que
  altera a duração por profissional. `register` integra selects, textareas e
  checkboxes nativos. Não foram instalados novos componentes shadcn.
- `defaultValues`, `reset` e `resetField` substituem os estados de campo.
  Prefill continua usando os helpers anteriores; não há efeito novo que
  sobrescreva um draft quando props mudam. Os pontos explícitos de reset ao
  abrir/cancelar/salvar são mantidos.
- `useWatch` é usado somente para contadores de conteúdo e contexto de acesso
  que precisam refletir valores durante a digitação.
- O padrão `shouldUnregister: false` mantém a finalidade detalhada quando seu
  campo fica oculto. Entrada clínica limpa só content, preservando entryTypeCode.
- `formState.isSubmitting` acompanha a Promise completa, inclusive callbacks.
  Loading de timeline e pendingAction compartilhado com outros comandos continuam
  sendo estados legítimos de UI.
- Erros locais usam `FormFieldError`, `role="alert"`, `aria-invalid` e
  `aria-describedby`. Labels, componentes, classes e estrutura visual permanecem.
- Tratamento específico de HTTP/backend, respostas inválidas, rede, mensagens,
  redirects e sucesso permanece em cada handler. Erros locais não substituem
  mensagens de regras exclusivamente server-side.

### Contagens antes/depois

| Medida                                                    | Antes | Depois |
| --------------------------------------------------------- | ----: | -----: |
| Formulários HTML                                          |    22 |     22 |
| Formulários RHF                                           |     0 |     17 |
| useState exclusivos dos campos migrados                   |    22 |      0 |
| useState totais em src (incluindo UI legítima)            |   117 |     81 |
| Ocorrências onChange em src, incluindo opções de register |    86 |     23 |
| Atributos JSX onChange em src                             |    86 |     17 |
| Handlers nos 17 formulários migrados                      |    78 |     15 |

Dos 15 handlers restantes nesses formulários, nove preservam normalização ou
dependência entre campos e seis são callbacks de register que limpam mensagens
ou invalidam a timeline. Os oito handlers fora dos formulários migrados continuam
intactos. Além dos 22 estados de campo, 14 flags manuais de submissão foram
substituídas por RHF; estados de interface não foram removidos indiscriminadamente.

## Testes e limites

`frontend/tests/form-schemas.test.mjs` acrescenta 14 testes ao runner `node:test`
existente, sem dependência adicional de testes. Exercita valores válidos/inválidos,
limites, vazios, não transformação, email permissivo, senha em bytes, IDs sem
restrição nova, regras condicionais e datas/fusos. `createFormControl` do próprio
RHF testa submissão válida/inválida, espera da Promise, reset/prefill, conteúdo
limpo isoladamente e retenção de nota oculta.

Total: **22 testes frontend**, incluindo os oito testes Axios da Fase 7.
Não são testes de renderização de componentes nem E2E; não comprovam interação
visual automatizada em navegador. Essa infraestrutura não foi ampliada nesta fase.

Checks: npm test, typecheck, lint, build, Prettier nos arquivos relevantes,
git diff --check e backend test:contracts (59 rotas/46 validações).
O build requer acesso às fontes Geist existentes quando não estão em cache.
Nenhum PostgreSQL é necessário nem foi acessado.

A revisão estrutural dos 17 arquivos compara com o HEAD anterior à Fase 8 as
19 configurações de chamada HTTP, atributos de validação HTML e normalizações.
As expressões de URL, método, headers e payload permanecem equivalentes; o BFF,
backend, cliente Axios e helper de datas não fazem parte do diff.

## Evolução de create/edit — Fase 10

A unificação foi aplicada somente aos recursos em que create e edit representam a
mesma operação semântica sobre o mesmo conjunto de campos. Os schemas Zod, os
payloads e a arquitetura navegador → BFF → backend permaneceram inalterados.

### Pacientes

`PatientForm` é a única implementação real dos campos de paciente. No modo create,
usa valores vazios e `POST`; no modo edit, usa `patientLinkToForm(...)` e `PATCH`.
O `patientFormSchema`, o conjunto completo de campos enviado e as strings opcionais
vazias foram preservados, mantendo no BFF a normalização posterior para `null`.
`create-patient-card.tsx` e `edit-patient-card.tsx` permanecem como wrappers finos.

Pacientes não usam Dialog: o formulário é extenso e continua adequado à superfície
existente em página/card.

### Disponibilidade semanal

`WeeklyAvailabilityFormDialog` é a implementação única de criação e edição:

- create usa `POST`;
- edit usa `PATCH` e prefill por `weeklyAvailabilityToForm(...)`;
- `weeklyAvailabilityFormSchema` e o payload com `weekday`, `startTime` e `endTime`
  foram preservados;
- `reset(...)` sincroniza a troca de registro, modo e profissional.

O Dialog é adequado por ser um formulário curto e contextual.

### Bloqueios de agenda

`ScheduleBlockFormDialog` é a implementação única de criação e edição:

- create usa `POST`;
- edit usa `PATCH` e prefill por `scheduleBlockToForm(...)`;
- `scheduleBlockFormSchema` foi preservado;
- o payload continua convertendo início e fim com `Date(...).toISOString()`;
- `reset(...)` sincroniza a troca de registro, modo e profissional.

Nos dois formulários de agenda, o Dialog fecha após sucesso confirmado ou
cancelamento e permanece aberto em erro HTTP ou de rede. Permissões, seleção do
profissional, callbacks e atualização das listas continuam no manager.

### Wrapper e exceções deliberadas

O wrapper `frontend/src/components/ui/dialog.tsx` usa
`@base-ui/react/dialog`, já presente no projeto. Nenhuma dependência foi instalada.
Portal, foco, Escape e restauração de foco ficam delegados ao primitive acessível do
Base UI.

Não foram unificados:

- profissionais: criação global com vínculo versus edição somente do vínculo;
- consultas: criação completa versus edição parcial e reagendamento especializado;
- membros da clínica: criação de usuário/vínculo versus comandos separados de
  papel e status;
- prontuários, correções e anexos: modelo append-only e ações clínicas
  especializadas.

Essas exceções são decisões arquiteturais, não pendências técnicas. A Fase 10 não
alterou backend, contratos HTTP, BFF Route Handlers, schemas Zod, dependências,
DataTables route-first da Fase 9, autenticação ou regras de permissão.
