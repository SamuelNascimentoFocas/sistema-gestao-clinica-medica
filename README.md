# Sistema de Gestão de Clínica Médica

Aplicação web full stack desenvolvida como projeto acadêmico para gestão administrativa e assistencial de clínicas médicas. Uma mesma instalação atende múltiplas clínicas, com usuários, perfis e permissões contextualizados por clínica e um Administrador Global independente de vínculo local.

O sistema cobre:

- autenticação e onboarding de usuários por convite;
- administração global de usuários e clínicas em `/admin`;
- perfis de sistema e Custom Roles por clínica;
- pacientes globais vinculáveis a diferentes clínicas;
- profissionais, vínculos profissionais e agendas;
- agendamentos com validação de disponibilidade, conflito e concorrência;
- prontuário global do paciente, entradas imutáveis e correções históricas;
- anexos clínicos privados e auditoria de acesso.

## Stack

### Backend

- AdonisJS 6, TypeScript, Lucid ORM e VineJS;
- PostgreSQL;
- autenticação por access token do AdonisJS;
- bcrypt para hash de senha;
- AdonisJS Mail para convites;
- AdonisJS Drive para anexos privados;
- Japa para testes funcionais e de integração.

### Frontend

- Next.js 16 com App Router e React 19;
- TypeScript, Tailwind CSS e shadcn/ui;
- React Hook Form e Zod;
- Axios centralizado para chamadas do navegador ao BFF;
- testes com o runner nativo do Node.js.

## Arquitetura resumida

```text
Navegador
   |
   | HTTPS e rotas same-origin /api/**
   v
Next.js (páginas + BFF)
   |
   | access token disponível somente no servidor
   v
AdonisJS
   |----------------------|
   v                      v
PostgreSQL          storage/private + SMTP
```

O navegador nunca chama o AdonisJS diretamente. No login, o BFF recebe o access token do backend e o mantém em cookie HTTP-only; a resposta entregue ao JavaScript do navegador contém apenas a identidade segura do usuário. O backend continua sendo a autoridade final de autenticação, autorização, escopo clínico e validação.

O onboarding administrativo é feito por convite. O administrador informa nome, e-mail e, quando aplicável, vínculos iniciais por `clinicId` + `roleId`; o próprio usuário define sua senha pelo link recebido. Administradores não escolhem nem alteram a senha de outra conta. O comando `node ace admin:create` é a exceção operacional isolada para criar o primeiro Administrador Global.

## Modelo de acesso

- `Permission -> Role -> UserClinicRole` representa a autorização por clínica.
- Perfis de sistema são globais e imutáveis; Custom Roles pertencem a uma clínica.
- Contratos de vínculo usam `roleId`, inclusive para perfis personalizados.
- A clínica corrente das telas clinic-scoped é derivada do pathname.
- `isGlobalAdmin` concede o contexto global e não exige membership.
- O painel `/admin` gerencia usuários e clínicas; a administração detalhada de membros, perfis e operações clínicas reutiliza as telas da própria clínica.
- Não existe promoção de Administrador Global pela interface ou pela API HTTP.

## Estrutura do repositório

```text
clinica-medica/
├── backend/
│   ├── app/
│   ├── commands/
│   ├── config/
│   ├── database/
│   ├── storage/private/
│   └── tests/
├── frontend/
│   ├── src/
│   └── tests/
├── docs/
└── README.md
```

## Requisitos

Para reproduzir o ambiente validado, use:

- Windows 10/11 ou ambiente equivalente;
- Node.js 24 e npm 11;
- PostgreSQL 18;
- Git.

Os lockfiles atuais incluem dependências que exigem Node.js 24 ou superior. Node.js 24
é também a referência validada para os testes frontend em TypeScript. O projeto não
declara uma versão mínima própria em `engines`.

Também são necessários dois bancos PostgreSQL separados, um para desenvolvimento e outro para testes, e um transporte SMTP acessível para exercitar o envio de convites.

## Início rápido

### Backend

```cmd
cd backend
npm ci
copy .env.example .env
node ace generate:key
node ace migration:run
node ace db:seed --files=database/seeders/authorization_catalog_seeder.ts
node ace admin:create
npm run dev
```

Antes de executar migrations ou seeders, configure `backend/.env` e crie o banco PostgreSQL. O catálogo de autorização, o bootstrap do Administrador Global e o cenário demonstrativo são operações diferentes. Consulte o [guia de execução](docs/EXECUCAO.md) antes de preparar um ambiente existente.

### Frontend

Em outro terminal:

```cmd
cd frontend
npm ci
copy .env.example .env.local
npm run dev
```

Com os valores locais dos exemplos, acesse `http://localhost:3000`. `BACKEND_API_URL` é usada somente pelo servidor Next.js e não deve receber o prefixo `NEXT_PUBLIC_`.

## Qualidade

Os comandos estáveis do projeto são:

### Backend

```cmd
cd backend
npm run format
npm run typecheck
npm run lint
npm test
npm run test:contracts
npm run build
```

### Frontend

```cmd
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
```

O frontend não possui script dedicado de formatação. As suítes abrangem contratos e fluxos funcionais do backend, contratos e comportamento do frontend, além de typecheck, lint e build; as contagens não são fixadas aqui porque evoluem com o projeto.

## Documentação

- [Índice documental](docs/README.md)
- [Instalação e execução local](docs/EXECUCAO.md)
- [Contratos HTTP do backend](docs/API.md)
- [Arquitetura e decisões de segurança](docs/ARQUITETURA.md)
- [Telas, formulários e validações](docs/FORMULARIOS.md)
- [Migrations e evolução do banco](docs/MIGRATIONS.md)
- [Estratégia de validação](docs/VALIDACAO.md)
- [Cenário demonstrativo](docs/CENARIO_DEMONSTRATIVO.md)

## Limites operacionais

O repositório não contém configuração oficial de contêiner, nuvem, TLS, proxy reverso, backup ou observabilidade de produção. Anexos usam armazenamento privado local em `backend/storage/private`. Uma implantação real exige definição adicional de infraestrutura, persistência, recuperação, gestão de segredos e revisão jurídica e de segurança.

## Licença

O backend está marcado como `UNLICENSED`. O projeto não deve ser tratado como software distribuído sob licença pública até que uma licença seja formalmente escolhida.
