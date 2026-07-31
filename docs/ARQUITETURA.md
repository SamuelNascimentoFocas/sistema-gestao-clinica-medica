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
- consulta e persistência;
- serialização;
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

As migrations criam 11 etapas principais:

1. schema;
2. usuários;
3. access tokens;
4. clínicas e autorização;
5. pacientes e prontuários;
6. profissionais e agendas;
7. agendamentos;
8. prevenção de sobreposição;
9. entradas clínicas e logs;
10. fortalecimento das constraints clínicas;
11. anexos clínicos.

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
