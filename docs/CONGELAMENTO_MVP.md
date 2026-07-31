# Congelamento Técnico do MVP

Este documento registra o estado funcional, técnico e documental do MVP do Sistema de Gestão de Clínica Médica no encerramento da etapa principal de desenvolvimento.

## 1. Identificação do congelamento

```text
Projeto: Sistema de Gestão de Clínica Médica
Data do congelamento documental: 31/07/2026
Branch da documentação: docs/mvp-execution-guide
Base funcional integrada à main antes da documentação: 2589864
Ambiente principal: Windows 10/11
```

O congelamento significa que o núcleo funcional definido para o MVP foi concluído, validado e documentado.

Não significa que o sistema esteja pronto para operação real em produção sem etapas adicionais de infraestrutura, segurança, conformidade, observabilidade, backup e implantação.

## 2. Objetivo do MVP

O MVP foi desenvolvido como projeto acadêmico para demonstrar um sistema full stack capaz de apoiar a gestão administrativa e assistencial de clínicas médicas com:

- múltiplos consultórios;
- usuários com perfis diferentes;
- autorização baseada em papéis e permissões;
- pacientes e profissionais com identidade global;
- vínculos locais por consultório;
- agendas e agendamentos;
- prontuário eletrônico;
- anexos clínicos privados;
- auditoria de acesso.

## 3. Tecnologias congeladas nesta etapa

### Backend

```text
Node.js
TypeScript
AdonisJS 6
Lucid ORM
VineJS
PostgreSQL
AdonisJS Auth
AdonisJS Drive
Japa
```

### Frontend

```text
Next.js 16.2.10
React 19.2.4
TypeScript
Tailwind CSS
ShadCN/Base UI
```

### Ambiente validado

```text
Node.js 24.15.0
npm 11.16.0
PostgreSQL 18.4
Git 2.54.0.windows.1
```

Essas versões representam o ambiente de validação e não uma matriz formal de versões mínimas suportadas.

## 4. Escopo funcional concluído

### 4.1. Autenticação e sessão

Concluído:

- login;
- geração de access token;
- consulta do usuário autenticado;
- listagem das clínicas acessíveis;
- logout;
- bloqueio de usuário inativo;
- serialização segura sem senha ou hash.

### 4.2. Administração global

Concluído:

- criação de administrador global por comando interativo;
- cadastro e atualização de clínicas;
- ativação e inativação de clínicas;
- cadastro e atualização de usuários;
- ativação e inativação de usuários;
- gestão global de vínculos entre usuário, clínica e perfil.

### 4.3. Autorização

Concluído:

- catálogo de permissões;
- perfis `clinic_admin`, `receptionist` e `doctor`;
- autorização por consultório;
- vínculo ativo obrigatório;
- perfil ativo obrigatório;
- consultório ativo obrigatório;
- administrador global com permissão curinga;
- princípio do menor privilégio;
- proteção do último administrador local efetivo;
- escopo geral e próprio de agenda;
- escopo geral e próprio de agendamentos.

### 4.4. Membros do consultório

Concluído:

- listagem de membros;
- criação de usuário local com vínculo;
- alteração de perfil;
- ativação e inativação de vínculo;
- isolamento por consultório;
- bloqueio de administração por perfil não autorizado.

### 4.5. Pacientes

Concluído:

- identidade global;
- CPF global único quando informado;
- vínculo local por consultório;
- número de prontuário local;
- listagem;
- criação;
- consulta;
- atualização;
- ativação e inativação do vínculo;
- compartilhamento controlado entre clínicas;
- isolamento contextual.

### 4.6. Profissionais

Concluído:

- identidade global;
- CRM único por estado;
- vínculo opcional com usuário;
- vínculo local por consultório;
- duração padrão de consulta;
- listagem;
- criação;
- consulta;
- atualização;
- ativação e inativação do vínculo;
- compartilhamento controlado entre clínicas.

### 4.7. Agenda profissional

Concluído:

- disponibilidade semanal;
- bloqueios pontuais;
- validação de intervalos;
- ativação e inativação;
- gestão geral pelo administrador;
- gestão da própria agenda pelo médico;
- bloqueio de gestão da agenda de terceiros;
- validação de profissional e vínculo ativos.

### 4.8. Agendamentos

Concluído:

- listagem por intervalo;
- criação;
- consulta;
- atualização administrativa;
- confirmação;
- cancelamento;
- conclusão;
- ausência;
- reagendamento;
- preservação do agendamento anterior;
- controle otimista de versão;
- regras temporais;
- contexto composto de clínica, paciente e profissional;
- prevenção de sobreposição por constraint do PostgreSQL;
- tratamento de concorrência;
- escopo geral e próprio.

### 4.9. Prontuário eletrônico

Concluído:

- um prontuário global por paciente;
- linha do tempo global;
- acesso por contexto local autorizado;
- finalidade obrigatória de acesso;
- criação de entrada clínica;
- autoria derivada no backend;
- vínculo opcional com agendamento compatível;
- imutabilidade do registro;
- correção por novo registro;
- cadeia linear de correções;
- proteção contra correções concorrentes.

### 4.10. Anexos clínicos

Concluído:

- upload privado;
- vínculo com prontuário e entrada;
- validação de quantidade;
- validação de extensão;
- validação do tipo real;
- validação de tamanho;
- armazenamento em `backend/storage/private`;
- listagem autorizada;
- download autorizado;
- headers seguros;
- rejeição de arquivo fisicamente indisponível;
- auditoria de listagem e download.

### 4.11. Auditoria

Concluído:

- endpoint de auditoria por consultório;
- permissão `audit_logs.read`;
- isolamento por clínica;
- ordenação decrescente;
- filtros;
- paginação;
- usuário responsável;
- paciente;
- finalidade;
- ação;
- data e hora;
- metadados seguros de anexo;
- interface frontend;
- bloqueio de médico e recepcionista;
- ausência de conteúdo clínico, credenciais, hashes e caminhos privados.

### 4.12. Cenário demonstrativo

Concluído:

- duas clínicas;
- três usuários;
- cinco vínculos;
- um paciente global;
- dois vínculos do paciente;
- um prontuário;
- uma profissional global;
- dois vínculos profissionais;
- dez disponibilidades;
- dois agendamentos futuros;
- credenciais locais;
- idempotência;
- busca de horário livre;
- datas relativas;
- bloqueio em `production`.

## 5. Estrutura de banco concluída

O banco utiliza o schema:

```text
clinic
```

Migrations concluídas:

1. criação do schema;
2. usuários;
3. access tokens;
4. clínicas e autorização;
5. pacientes e prontuários;
6. profissionais e agendas;
7. agendamentos;
8. proteção contra sobreposição;
9. entradas clínicas e logs de acesso;
10. fortalecimento das constraints de prontuário;
11. anexos clínicos.

## 6. Evidências de validação

### Backend

Resultado registrado:

```text
Tests 88 passed (88)
Time 1m
```

Também aprovados:

```text
npm run format
npm run typecheck
npm run lint
npm run build
```

### Frontend

Aprovados:

```text
npm run typecheck
npm run lint
npm run build
```

O build reconheceu as rotas dinâmicas autenticadas, incluindo a área de auditoria.

### Seeder demonstrativo

Validado:

```text
Primeira execução: concluída
Segunda execução: concluída
Execução em production: bloqueada
Exit code em production: 1
```

### Banco demonstrativo

Quantidades confirmadas:

```text
Clínicas:               2
Usuários:               3
Vínculos de usuários:   5
Pacientes:              1
Vínculos de paciente:   2
Prontuários:            1
Profissionais:          1
Vínculos profissionais: 2
Disponibilidades:      10
Agendamentos:           2
```

### Validação manual no navegador

Confirmado:

- login dos perfis demonstrativos;
- visualização das duas clínicas pelo administrador;
- isolamento da recepcionista;
- contexto da médica;
- pacientes;
- profissionais;
- agendamentos futuros;
- prontuário;
- bloqueio de acesso sem permissão;
- auditoria;
- filtros;
- estado vazio;
- limpeza de filtros;
- persistência dos dados.

## 7. Documentação concluída nesta entrega

Arquivos planejados:

```text
README.md
docs/README.md
docs/API.md
docs/EXECUCAO.md
docs/CENARIO_DEMONSTRATIVO.md
docs/VALIDACAO.md
docs/ARQUITETURA.md
docs/CONGELAMENTO_MVP.md
```

A documentação cobre:

- objetivo;
- arquitetura;
- tecnologias;
- ambiente validado;
- instalação;
- configuração;
- migrations;
- seeds;
- execução;
- testes;
- builds;
- rotas;
- permissões;
- cenário demonstrativo;
- checklist de validação;
- limitações;
- evoluções futuras.

## 8. Itens fora do escopo congelado

Não fazem parte do MVP concluído:

- dashboard analítico avançado;
- relatórios gerenciais avançados;
- Docker;
- Docker Compose;
- implantação em nuvem;
- TLS configurado no repositório;
- proxy reverso;
- armazenamento distribuído;
- serviço de backup;
- recuperação automatizada;
- observabilidade de produção;
- fila de tarefas;
- cache distribuído;
- testes automatizados próprios no frontend;
- testes end-to-end completos;
- especificação OpenAPI;
- notificações;
- integração com operadoras;
- faturamento;
- prescrição eletrônica;
- telemedicina;
- assinatura digital;
- interoperabilidade com padrões externos.

A ausência desses itens não deve ser interpretada como defeito oculto. Eles foram deliberadamente mantidos fora do escopo principal desta etapa.

## 9. Limitações conhecidas

### 9.1. Execução local

A execução validada depende de:

- Node.js instalado;
- npm instalado;
- PostgreSQL instalado;
- configuração manual de variáveis;
- dois terminais para backend e frontend.

### 9.2. Armazenamento de anexos

Os anexos ficam no sistema de arquivos local.

Uma implantação distribuída exigirá:

- armazenamento persistente;
- política de backup;
- replicação ou storage de objeto;
- recuperação;
- monitoramento de capacidade.

### 9.3. Frontend

O frontend não possui atualmente:

- suíte própria de testes automatizados;
- comando de formatação;
- testes end-to-end versionados.

### 9.4. API

A API possui documentação textual, mas não uma especificação formal OpenAPI.

### 9.5. Produção

Não foram implementados no repositório:

- gestão externa de segredos;
- TLS;
- observabilidade;
- limitação de taxa;
- estratégia formal de disponibilidade;
- pipeline de implantação;
- política operacional de backup e retenção.

## 10. Segurança e uso responsável

O projeto incorpora mecanismos de segurança no nível do MVP, mas continua sendo um protótipo acadêmico.

Antes de uso real, são necessárias avaliações adicionais de:

- segurança da aplicação;
- segurança da infraestrutura;
- proteção de dados;
- privacidade;
- gestão de acesso;
- retenção;
- backup;
- recuperação;
- disponibilidade;
- conformidade jurídica;
- resposta a incidentes.

Dados reais de pacientes não devem ser inseridos em ambientes de demonstração sem controles adequados.

## 11. Condições para reabrir o escopo

O escopo deve ser reaberto apenas mediante uma nova etapa planejada.

Cada evolução deverá:

1. possuir requisito definido;
2. ser desenvolvida em branch própria;
3. incluir testes adequados;
4. passar por typecheck, lint e build;
5. preservar isolamento e menor privilégio;
6. atualizar migrations quando necessário;
7. atualizar documentação;
8. ser validada antes do merge na `main`.

## 12. Evoluções recomendadas

Ordem sugerida para etapas posteriores:

1. dashboard analítico;
2. testes automatizados de frontend;
3. testes end-to-end;
4. OpenAPI;
5. Docker e ambiente reproduzível por contêiner;
6. pipeline de integração contínua;
7. observabilidade;
8. armazenamento de anexos adequado à implantação;
9. backup e recuperação;
10. gestão de segredos;
11. revisão de segurança e privacidade;
12. implantação controlada.

## 13. Critério de encerramento atingido

O critério de encerramento do MVP foi atingido porque:

- o núcleo funcional foi implementado;
- as regras críticas estão protegidas no backend e no banco;
- o menor privilégio foi demonstrado;
- o isolamento por consultório foi demonstrado;
- o prontuário e a auditoria foram validados;
- o cenário demonstrativo é reproduzível;
- os 88 testes passam;
- os builds passam;
- a documentação permite reproduzir a execução;
- os itens não concluídos estão explicitamente fora do escopo.

## 14. Estado final

```text
Núcleo funcional do MVP: concluído
Backend: validado
Frontend: validado
Banco: validado
Autorização: validada
Prontuário: validado
Anexos: validados
Auditoria: validada
Seeder demonstrativo: validado
Documentação: concluída
Produção real: não incluída
```

Com a validação e a integração desta documentação, o projeto fica documentalmente congelado para a etapa do MVP.
