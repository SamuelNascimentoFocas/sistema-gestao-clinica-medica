# Telas, formulários e validações

Este documento descreve as telas e os formulários atualmente renderizados pelo frontend. Os contratos HTTP completos estão em [API.md](API.md), as decisões de segurança em [ARQUITETURA.md](ARQUITETURA.md) e a configuração local em [EXECUCAO.md](EXECUCAO.md).

## 1. Padrões de interface

O frontend usa Next.js App Router, componentes shadcn/Base UI e Tailwind. Formulários de mutação usam React Hook Form e Zod quando isso melhora estado, validação e reutilização; filtros simples podem usar formulários GET ou estado local.

O fluxo normal é sempre browser → BFF Next.js `/api/**` → AdonisJS. O browser não recebe o access token do backend. A validação no cliente oferece retorno imediato, mas VineJS, autorização e regras de negócio no AdonisJS são definitivos.

Listagens administrativas usam paginação e filtros no servidor. Estados de carregamento, vazio, sucesso e erro são exibidos sem revelar stack trace ou detalhes internos. Botões de envio são desabilitados enquanto a operação está pendente para reduzir submissões duplicadas.

## 2. Autenticação e entrada

### Login

Rota: `/login`.

Campos:

- e-mail;
- senha.

O formulário envia as credenciais ao BFF de autenticação. Em caso de sucesso, o Next.js grava a sessão em cookie HTTP-only; nenhum token Adonis é persistido em JavaScript ou `localStorage`.

O destino é derivado da identidade autenticada:

- Global Admin segue para `/admin`, mesmo sem membership;
- usuário comum segue para a seleção/experiência de clínicas existente.

Falhas de credencial, conta inativa ou senha ainda não configurada usam mensagens seguras, sem revelar detalhes da conta.

### Aceite de convite

Rota: `/accept-invitation`.

O token chega no fragmento do link, é removido imediatamente da barra de endereço e permanece somente em memória durante validação e aceite. A página não grava o token em query string, cookie ou storage.

Campos:

- nova senha;
- confirmação da senha.

Validações no browser:

- mínimo de 12 caracteres;
- máximo de 72 bytes UTF-8;
- confirmação idêntica.

O backend repete a validação e decide se o convite está válido, expirado, revogado, usado ou já indisponível. A senha é definida pelo próprio convidado; não existe campo administrativo de senha inicial.

## 3. Navegação autenticada

Usuários comuns entram em `/clinics`, escolhem uma clínica permitida e navegam sob `/clinics/[clinicId]/**`. A clínica corrente é derivada da URL, sem cookie ou estado global persistente de clínica.

O shell clinic-scoped filtra os itens por permissões e mantém navegação equivalente no desktop e no menu móvel. Global Admin vê uma ação separada “Administração Global”, que leva a `/admin`; ela não é um nono módulo clinic-scoped.

O dashboard respeita a mesma resolução de destino: Global Admin retorna a `/admin` e usuários comuns mantêm o fluxo de clínica.

## 4. Administração Global

Rota: `/admin`.

A página possui gate server-side por `isGlobalAdmin` e não exige `clinicId` nem membership. O gate melhora a experiência, mas cada BFF ainda depende da autorização global do backend.

### Usuários

A tabela global usa paginação remota, pesquisa e filtro de status. Ela distingue:

- conta ativa ou inativa;
- senha configurada ou pendente;
- estado do convite;
- datas de envio e expiração quando disponíveis;
- memberships resumidas.

Esses estados não são tratados como equivalentes: conta ativa não significa convite aceito ou senha configurada.

#### Convidar usuário

Campos:

- nome completo;
- e-mail;
- zero ou mais memberships iniciais.

Cada membership repetível contém:

- clínica (`clinicId`);
- perfil atribuível (`roleId`).

Uma clínica não pode ser repetida no mesmo convite. A lista de clínicas é pesquisada e paginada pelo BFF global; depois da seleção, os perfis atribuíveis são carregados do BFF clinic-scoped. System Roles e Custom Roles elegíveis são dinâmicos, e o backend aplica o `RoleGrantService`.

O formulário não possui `roleCode`, nome livre de role, senha ou opção `isGlobalAdmin`. Convidar um usuário não cria Professional, Role ou clínica implicitamente.

#### Editar usuário

Campos:

- nome completo;
- e-mail.

Não há edição de senha, hash, memberships ou promoção para Global Admin nesse diálogo. Ativação/inativação é uma ação separada e não remove memberships nem redefine senha. O reenvio de convite aparece somente quando o estado do usuário permite e nunca exibe o token bruto.

### Clínicas

A tabela global usa paginação, pesquisa e status no servidor. Exibe nome, CNPJ quando informado, contato/localização resumidos, status e ações.

O mesmo diálogo atende criação e edição com os campos realmente suportados:

- nome;
- CNPJ opcional com 14 dígitos;
- telefone;
- rua, número, complemento e bairro;
- cidade, UF e CEP.

UF, quando informada, possui dois caracteres; CEP, quando informado, possui oito dígitos. Criar uma clínica não cria User, membership, Professional ou Role.

Ativação/inativação é distinta de exclusão. Clínica ativa oferece a ação “Administrar clínica”, que leva à administração clinic-scoped existente. Clínica inativa pode ser vista e reativada, mas não recebe atalho operacional que contorne sua inatividade.

Não existe gerenciador global autônomo de memberships; esses vínculos são administrados na clínica.

## 5. Administração da clínica

Rota principal: `/clinics/[clinicId]/administration`.

### Membros

A listagem usa paginação remota, pesquisa, filtro de status e filtro por `roleId`. Exibe perfil, estado do vínculo e metadados seguros de onboarding.

O convite clinic-scoped contém:

- nome completo;
- e-mail;
- perfil selecionado por `roleId`.

O administrador não define senha. Perfis atribuíveis vêm da API e podem incluir custom roles. Ações separadas permitem alterar o role por `roleId`, ativar/inativar o vínculo e reenviar o convite quando aplicável.

### Custom Roles

A área “Perfis de acesso” apresenta roles de sistema como somente leitura e custom roles da clínica como administráveis.

Campos de criação/edição:

- nome;
- descrição opcional;
- permissões selecionadas do catálogo atribuível.

Custom roles podem ser ativadas ou inativadas. A interface filtra permissões e opções conforme a autoridade conhecida, mas o backend volta a validar escopo, subconjunto de permissões e anti-escalation. `roles.manage` e `users.assign_role` permanecem capacidades distintas.

## 6. Pacientes

Rota: `/clinics/[clinicId]/patients`.

A tabela usa paginação remota, pesquisa por dados relevantes e filtro ativo/inativo. Criação e edição compartilham o formulário de paciente.

Dados globais do paciente:

- nome completo;
- data de nascimento;
- CPF;
- telefone e e-mail;
- endereço: rua, número, complemento, bairro, cidade, UF e CEP.

Dado do vínculo com a clínica:

- número de prontuário local.

O status administrado na tela é o do vínculo `PatientClinic`. O paciente e seu prontuário são globais; o número local e a ativação pertencem à clínica. A data de nascimento não pode estar no futuro, e os campos de CPF, UF e CEP recebem normalizações compatíveis com os contratos atuais.

## 7. Profissionais

Rota: `/clinics/[clinicId]/professionals`.

A listagem usa paginação remota, pesquisa, filtro de status e filtro “aceita agendamentos”.

### Cadastrar e vincular

Campos da identidade profissional:

- nome completo;
- número e UF do CRM;
- especialidade;
- telefone e e-mail;
- conta de usuário opcional.

Campos do vínculo com a clínica:

- código local;
- duração padrão de consulta, entre 5 e 480 minutos;
- aceita agendamentos.

O select opcional de conta mostra usuários elegíveis com vínculo ativo na clínica. Um profissional pode existir sem User, e a associação a uma conta não concede role automaticamente.

### Editar vínculo

A edição existente altera somente os dados clinic-scoped:

- código local;
- duração padrão;
- aceita agendamentos.

Ativação/inativação do vínculo é uma ação separada. A tela não oferece edição destrutiva da identidade global do profissional nesse fluxo.

## 8. Agenda profissional

Rota: `/clinics/[clinicId]/schedules`.

A tela seleciona um profissional vinculado e mostra sua disponibilidade semanal e seus bloqueios. Quem possui `schedules.manage` pode gerir agendas da clínica; `schedules.manage_own` limita a gestão ao Professional associado ao usuário. O backend repete essa decisão.

### Disponibilidade semanal

O diálogo compartilhado de criação/edição contém:

- dia da semana;
- horário inicial;
- horário final.

Cada disponibilidade pode ser ativada ou inativada.

### Bloqueios

O diálogo compartilhado contém:

- início;
- fim;
- motivo opcional.

O início deve anteceder o fim. Cada bloqueio pode ser ativado ou inativado. Regras de sobreposição e coerência temporal continuam no backend.

## 9. Agendamentos

Rota: `/clinics/[clinicId]/appointments`.

A página oferece filtros server-side por período, status, paciente e profissional. O intervalo é limitado pelo contrato do backend e a clínica fornece o timezone usado nas conversões.

### Criar

Campos:

- paciente vinculado à clínica;
- profissional vinculado;
- data e hora inicial;
- duração entre 5 e 480 minutos;
- tipo de consulta opcional;
- observação administrativa opcional.

### Editar e reagendar

A edição administrativa de uma consulta ativa permite alterar paciente, tipo e observação. Mudança de horário ou profissional usa a ação de reagendamento, com:

- profissional;
- novo início;
- duração;
- observação opcional sobre o cancelamento anterior.

Reagendar preserva a consulta anterior no histórico e cria uma nova. O backend verifica disponibilidade, conflito e versão concorrente.

### Transições de status

Os estados exibidos são:

- Marcado (`scheduled`);
- Confirmado (`confirmed`);
- Realizado (`completed`);
- Cancelado (`cancelled`);
- Falta (`no_show`).

As ações disponíveis permitem confirmar, concluir, cancelar, marcar falta ou reagendar conforme estado e permissão. Cancelamento solicita uma razão e aceita observação opcional. Escopos `appointments.manage` e `appointments.manage_own` controlam gestão geral ou própria; a interface apenas antecipa o gate do backend.

Uma consulta concluída pode oferecer atalho para criar uma entrada no prontuário com paciente e agendamento já contextualizados. A conclusão não cria registro clínico automaticamente.

## 10. Prontuário

Rota: `/clinics/[clinicId]/medical-records`.

### Acesso e timeline

Antes de carregar a timeline, o usuário seleciona:

- paciente;
- finalidade: cuidado direto, coordenação do cuidado, obrigação legal ou outra;
- detalhamento obrigatório quando a finalidade é “outra”.

O backend verifica permissão, vínculo ativo e relação autorizadora. A timeline global do paciente é exibida em ordem decrescente e carregada de forma paginada. A finalidade acompanha leituras e downloads para auditoria.

### Nova entrada clínica

Campos:

- tipo: consulta, evolução ou outro registro clínico;
- conteúdo, obrigatório e limitado a 20.000 caracteres.

O conteúdo aceita Markdown restrito. Títulos, ênfase e listas suportados são renderizados por uma allowlist; HTML bruto não é renderizado. A autoria clínica é derivada pelo backend, não escolhida no formulário.

Quando a tela é aberta pelo atalho de uma consulta concluída, o `appointmentId` pode acompanhar a criação. O backend exige compatibilidade com paciente, clínica e profissional.

### Correção

O formulário de correção recebe somente o novo conteúdo, também limitado a 20.000 caracteres. A correção gera outra entrada ligada à original; o registro anterior não é editado nem apagado.

## 11. Anexos do prontuário

Em uma entrada clínica autorizada, a interface permite selecionar e enviar de um a dois arquivos por vez.

Validações locais observáveis:

- pelo menos um e no máximo dois arquivos;
- arquivo não vazio;
- nome original presente e com até 255 caracteres.

O limite de tamanho é configurado no backend e pode chegar a 10 MiB por arquivo. O seletor atual não promete uma allowlist de extensões; ele mostra o tipo declarado e deixa a validação definitiva para o servidor. Antes do upload, JPEG e PNG possuem preview local de imagem, enquanto PDFs usam a renderização nativa do browser. Os previews usam URLs `blob:` temporárias, revogadas quando deixam de ser necessárias, sem criar URL pública do anexo no backend.

A lista de anexos mostra metadata pública e status. O download passa pelo BFF e pelo gate de prontuário, usa a finalidade já informada e não expõe URL pública permanente. O arquivo é entregue como download; tipos não considerados seguros pelo backend recebem tipo opaco. Falhas de validação, autorização ou indisponibilidade são apresentadas como mensagens sem detalhes internos.

## 12. Validação, erros e acessibilidade estrutural

- Zod e atributos HTML fornecem validação imediata onde implementados.
- O BFF normaliza e limita payloads; VineJS e os services do backend são a autoridade final.
- Erros de formulário usam labels associados, `aria-invalid`, descrições e regiões de alerta/status quando aplicável.
- Diálogos usam `DialogTitle`, foco e comportamento de teclado do primitive de UI.
- Formulários extensos e diálogos usam grids e limites responsivos; conteúdo repetível pode rolar verticalmente em viewports menores.
- Estados pendentes impedem nova submissão até a resposta; diálogos permanecem abertos quando ocorre erro.

Essas práticas são estruturais e não constituem declaração de conformidade integral com uma norma de acessibilidade.

## 13. Limites atuais

- Não existe UI para promover ou rebaixar Global Admin.
- Não existe campo administrativo para definir ou alterar a senha de outro usuário.
- Não existe gerenciador global separado de memberships; a gestão ocorre na clínica.
- Roles são selecionadas por `roleId`, nunca por `roleCode` digitado pelo usuário.
- Não existe edição destrutiva de entrada clínica.
