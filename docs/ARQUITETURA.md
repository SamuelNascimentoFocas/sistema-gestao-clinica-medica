# Arquitetura do Sistema de Gestão de Clínica Médica

Este documento descreve a arquitetura implementada, seus limites de confiança e as principais decisões técnicas. Os contratos HTTP detalhados estão em [API.md](API.md), os fluxos de interface em [FORMULARIOS.md](FORMULARIOS.md) e os procedimentos locais em [EXECUCAO.md](EXECUCAO.md).

## 1. Visão geral

O sistema é uma aplicação web multi-clínica formada por duas aplicações TypeScript e um banco PostgreSQL:

```text
Browser
  -> Next.js App Router
     -> Server Components e Route Handlers
     -> BFF same-origin /api/**
        -> AdonisJS /api/v1/**
           -> PostgreSQL
           -> armazenamento privado de anexos
           -> SMTP
```

As responsabilidades são deliberadamente separadas:

- o Next.js renderiza a interface, mantém a sessão do frontend e oferece a camada BFF;
- o AdonisJS é a autoridade final de autenticação, autorização, validação e regras de negócio;
- o PostgreSQL mantém relacionamentos, unicidade, integridade referencial e restrições de concorrência;
- arquivos clínicos ficam fora da área pública e só são lidos após autorização.

No fluxo normal, o browser chama rotas relativas `/api/**` do Next.js. Ele não chama o AdonisJS diretamente e não recebe o access token emitido pelo backend. O frontend pode ocultar ações e antecipar bloqueios por usabilidade, mas isso nunca substitui a autorização no backend.

## 2. Repositório e camadas

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
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── types/
└── docs/
```

### Backend

- **Rotas e middleware** definem a fronteira HTTP e aplicam autenticação, autoridade global ou permissão no contexto de clínica.
- **Controllers** validam a entrada, coordenam casos de uso e formam a resposta.
- **Validators VineJS** definem os contratos aceitos pelo backend.
- **Services** concentram regras de aplicação, transações, locks e políticas reutilizáveis.
- **Models Lucid** representam o schema `clinic` e suas relações.
- **Migrations** são a fonte versionada da evolução do banco.

### Frontend

- **Server Components** resolvem identidade, acesso e dados iniciais quando apropriado.
- **Route Handlers** formam o BFF, recuperam a credencial HTTP-only e encaminham payloads permitidos ao backend.
- **Componentes client-side** usam os BFFs same-origin para tabelas, diálogos e mutações.
- **Schemas Zod e React Hook Form** oferecem validação e estado de formulário no browser; VineJS e as regras do backend continuam definitivos.
- **Parsers defensivos** evitam confiar apenas em assertions TypeScript para respostas externas.

## 3. Autenticação, sessão e onboarding

### Sessão

O AdonisJS autentica credenciais e emite o access token usado nas chamadas servidor a servidor. O Next.js guarda essa credencial em cookie HTTP-only, com atributos seguros adequados ao ambiente. A resposta de login entregue ao JavaScript contém a identidade pública necessária para navegação, não o token do backend.

Senhas são verificadas e persistidas com bcrypt. Usuário inativo não autentica. Uma conta convidada pode ter `passwordHash` nulo até o aceite; tentar autenticar antes de configurar a senha resulta na mesma fronteira segura de falha de credenciais.

### Onboarding por convite

O onboarding administrativo normal é exclusivamente por convite:

1. um Global Admin ou administrador autorizado da clínica cria o convite;
2. o backend gera um token aleatório de 32 bytes e persiste somente seu digest SHA-256;
3. o e-mail contém o token bruto no fragmento da URL de aceite;
4. a página pública remove o fragmento da barra de endereço e mantém o token apenas em memória;
5. o usuário define e confirma a própria senha;
6. o backend consome o convite em transação e ativa a senha configurada.

O convite expira em 24 horas, é de uso único e o reenvio revoga convites pendentes anteriores. O envio SMTP ocorre depois do commit da transação. Respostas administrativas nunca devolvem o token bruto.

Administradores não escolhem nem alteram a senha de outro usuário por endpoints HTTP. O comando `backend/commands/create_admin.ts` é uma exceção isolada para criar o primeiro Global Admin: executa no backend, recebe a senha diretamente e não depende de convite, SMTP ou endpoint administrativo.

## 4. Autorização e Global Admin

### RBAC por clínica

O modelo de autorização clinic-scoped é:

```text
Permission <- RolePermission -> Role <- UserClinicRole -> User
```

- `Permission` representa uma capacidade granular.
- `Role` agrega permissões.
- `UserClinicRole` vincula um usuário, uma clínica e um perfil de acesso.
- roles de sistema são globais e imutáveis;
- custom roles pertencem a uma clínica e podem ser criadas, alteradas e ativadas ou inativadas dentro dela.

Contratos de membership e convite usam `roleId`. `Role.code` continua existindo como identidade interna de roles de sistema, mas não é um campo HTTP para atribuir membership. A autorização não depende de comparar `Role.name`.

As capacidades `roles.manage` e `users.assign_role` são distintas. O `RoleGrantService` limita as permissões e os roles que o ator pode conceder ao subconjunto de sua própria autoridade. A permissão curinga não pode ser atribuída a custom roles. Essas verificações são repetidas pelo backend mesmo quando a interface já filtra as opções.

### Global Admin

Global Admin é uma propriedade explícita da identidade (`isGlobalAdmin`), não um perfil de clínica. Um Global Admin ativo recebe autoridade global com wildcard `*` e não precisa de membership para acessar `/admin` ou executar operações globais autorizadas.

A interface `/admin` permite gerir usuários e clínicas. Convites globais podem incluir zero ou mais memberships iniciais, cada uma formada somente por `clinicId` e `roleId`. A administração detalhada de membros, profissionais e custom roles é reutilizada nas rotas clinic-scoped, evitando uma segunda implementação global.

Não existe promoção ou rebaixamento de Global Admin por UI ou endpoint HTTP. A criação inicial permanece restrita ao comando de bootstrap.

## 5. Isolamento multi-clínica

O contexto operacional de clínica é explícito no pathname `/clinics/[clinicId]/**`. Não existe clínica selecionada como autoridade global em `localStorage`, cookie de clínica ou React context global.

Em cada operação clinic-scoped, o backend revalida:

- usuário e clínica ativos;
- membership e role ativos, salvo a autoridade global;
- permissões exigidas pela rota;
- pertencimento dos recursos à clínica ou a relação autorizadora correspondente.

O seletor e a navegação do frontend derivam a clínica atual da rota. O Global Admin pode entrar na administração de uma clínica ativa a partir de `/admin`, mas continua sujeito às validações do backend e não usa uma clínica fictícia para operar globalmente.

## 6. Separação de identidades e vínculos

Quatro conceitos não são intercambiáveis:

- `User`: identidade de autenticação;
- `Professional`: identidade clínica, CRM, especialidade e contato;
- `UserClinicRole`: vínculo de acesso e autorização por clínica;
- `ClinicProfessional`: vínculo profissional com a clínica, com código local, duração padrão e aceite de agendamentos.

Um Professional pode existir sem User. Vincular uma conta a um profissional não cria nem altera automaticamente seu role. Da mesma forma, membership não transforma um usuário em profissional clínico.

## 7. Pacientes e prontuário

`Patient` é uma identidade global. `PatientClinic` representa o vínculo com cada clínica e pode conter número de prontuário local e status próprios. Cada paciente possui um único `MedicalRecord` global; sua timeline pode reunir entradas de clínicas diferentes quando o acesso atual satisfaz todas as regras.

### Defesa em profundidade no acesso

O acesso ao prontuário combina:

1. permissão clinic-scoped para a operação;
2. vínculo ativo entre paciente e clínica;
3. gate relacional médico/paciente quando o ator não possui wildcard ou `medical_records.access_all`;
4. finalidade declarada para leitura;
5. registro de acesso.

Para o gate relacional, o usuário precisa estar ligado a um `Professional` ativo na clínica e ter relação qualificante com o paciente por agendamento. Possuir apenas `medical_records.read` não concede acesso indiscriminado a qualquer prontuário.

### Autoria e imutabilidade

Na escrita clínica, o backend deriva a autoria a partir do usuário autenticado e de seu vínculo `ClinicProfessional` ativo. O cliente não escolhe o autor.

Entradas clínicas são append-only. Não há edição destrutiva: uma correção cria nova entrada ligada à anterior e preserva o histórico. Quando informado, `appointmentId` é opcional e só pode vincular um agendamento concluído compatível com paciente, clínica e profissional.

O conteúdo é identificado como Markdown versão 1. A renderização aceita somente um subconjunto de elementos textuais, ignora HTML bruto e mantém fallback de texto para formatos desconhecidos. Essa política reduz a superfície de conteúdo ativo sem perder estrutura clínica e preserva a evolução versionada do formato.

## 8. Agendas e agendamentos

Cada vínculo `ClinicProfessional` pode ter disponibilidades semanais e bloqueios de agenda. A clínica fornece o timezone usado para interpretar horários. Regras de duração, intervalo, disponibilidade e status são validadas no backend.

Agendamentos usam os estados:

- `scheduled`;
- `confirmed`;
- `completed`;
- `cancelled`;
- `no_show`.

`no_show` é uma extensão deliberada ao conjunto mínimo do requisito original. Confirmação, conclusão, cancelamento, falta e reagendamento são comandos explícitos. Reagendar preserva a consulta anterior como cancelada por reagendamento e cria uma nova consulta agendada.

Conflitos de horário são protegidos por validação de aplicação e constraint temporal no PostgreSQL. Operações críticas usam transação, locks e versão otimista quando aplicável. Permissões separam gestão geral (`*.manage`) e do próprio profissional (`*.manage_own`), sempre confirmadas no backend.

## 9. Anexos clínicos

Anexos do prontuário usam armazenamento privado (`private_fs`):

- a chave física é opaca e gerada pelo servidor;
- o nome original é mantido somente como metadata;
- o limite de tamanho é configurável até o teto estrutural de 10 MiB;
- o upload aceita de um a dois arquivos por requisição e rejeita arquivos vazios ou metadata inválida;
- tipo declarado normalizado, tamanho e SHA-256 são registrados nos metadados;
- listagem e download repetem o gate de acesso ao prontuário e registram a finalidade;
- não existe URL pública permanente.

No download, somente PDF, JPEG e PNG preservam um content type considerado seguro; demais tipos são entregues como `application/octet-stream`. A resposta usa `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` e `Cache-Control: private, no-store`. A interface oferece pré-visualização apenas local, antes do envio, para JPEG e PNG; conteúdo ativo ou arbitrário não é renderizado inline pelo servidor.

## 10. Auditoria e logging

Operações clínicas e acessos a prontuário/anexos possuem registros auditáveis com usuário, clínica, recurso, ação e finalidade quando aplicável.

Logs de servidor usam eventos e códigos técnicos sanitizados. Senhas, access tokens e tokens brutos de convite não devem ser registrados. Erros desconhecidos seguem o tratamento central sem serialização crua de objetos potencialmente sensíveis para o browser.

## 11. Decisões técnicas

| Decisão | Justificativa |
| --- | --- |
| AdonisJS v6 | Oferece estrutura coesa para HTTP, autenticação, VineJS, Lucid, migrations e testes no backend. |
| Next.js App Router | Combina renderização no servidor, rotas autenticadas e Route Handlers próximos da interface. |
| BFF Next.js | Mantém a credencial do backend fora do JavaScript, centraliza forwarding e reduz acoplamento do browser ao AdonisJS. |
| PostgreSQL | Sustenta relações multi-clínica e constraints avançadas de integridade e concorrência. |
| bcrypt | Usa derivação de senha apropriada em vez de criptografia reversível ou hash rápido. |
| Onboarding por convite | Garante que o próprio usuário defina a senha e permite expiração, revogação e uso único. |
| RBAC clinic-scoped | Mantém a autoridade explícita por clínica e permite custom roles sem depender de nomes de perfil. |
| Prontuário imutável | Preserva rastreabilidade clínica; correções acrescentam histórico em vez de apagar evidência. |
| Armazenamento privado | Impede acesso por URL pública e força autenticação e autorização em cada download. |
| Markdown restrito e versionado | Permite estrutura textual controlada sem aceitar HTML arbitrário. |

## 12. Limites e referências

- O backend permanece a fonte de verdade para segurança, ainda que a UI esconda ações sem permissão.
- A gestão global não inclui um gerenciador autônomo de memberships; vínculos locais são administrados no contexto da clínica.
- O armazenamento privado atual pode usar filesystem no ambiente local, mas não é exposto como diretório público.
- Configuração, comandos e variáveis de ambiente estão em [EXECUCAO.md](EXECUCAO.md).
- Contratos HTTP atuais estão em [API.md](API.md).
- Campos e comportamentos visíveis estão em [FORMULARIOS.md](FORMULARIOS.md).
- Evolução estrutural do banco está em [MIGRATIONS.md](MIGRATIONS.md).
