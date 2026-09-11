# Frontend do Sistema de Gestão de Clínica Médica

Aplicação Next.js responsável pela interface web e pela camada BFF do sistema. O frontend usa App Router, React, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod e Axios.

## Arquitetura HTTP e sessão

```text
Navegador -> rotas same-origin /api/** do Next.js -> backend AdonisJS
```

O navegador não chama o AdonisJS diretamente. O BFF encaminha as requisições server-side, sanitiza respostas e mantém o access token do backend em cookie HTTP-only. O JavaScript do navegador não recebe esse token. Os gates de rota e a visibilidade de ações melhoram a experiência, mas a autorização final permanece no backend.

O cliente Axios centralizado do navegador aceita apenas URLs relativas em `/api/**`. Server Components e Route Handlers usam helpers server-side próprios, sem criar um segundo cliente de navegador.

## Rotas e áreas principais

- `/login`: autenticação;
- `/accept-invitation`: validação do convite e definição da senha pelo próprio usuário;
- `/dashboard`: encaminhamento ao destino autenticado adequado;
- `/clinics`: seleção das clínicas acessíveis;
- `/clinics/:clinicId/**`: dashboard e módulos clinic-scoped;
- `/admin`: gestão global de usuários e clínicas, exclusiva para `isGlobalAdmin` e sem dependência de membership;
- `/api/**`: BFFs do Next.js usados pelo navegador.

As áreas clinic-scoped incluem administração de membros e Custom Roles, pacientes, profissionais, agendas, agendamentos, prontuários, anexos e auditoria. A clínica corrente deriva do pathname; não existe estado global persistente de clínica em localStorage ou cookie.

## Onboarding e autorização

O fluxo administrativo cria convites sem senha. O usuário define sua própria senha em `/accept-invitation`; não existe campo para um administrador escolher ou alterar a senha de outra conta. Vínculos iniciais usam `clinicId` + `roleId`, inclusive para Custom Roles.

O Administrador Global usa `/admin`, pode existir sem membership e não pode promover outra conta a Administrador Global pela interface. A criação inicial dessa identidade é um procedimento de bootstrap do backend.

## Requisitos

Para reproduzir o ambiente validado, use Node.js 24 e npm 11. Os lockfiles atuais
incluem dependências que exigem Node.js 24 ou superior; essa versão também reproduz os
testes frontend em TypeScript executados pelo runner nativo.

O backend deve estar configurado e acessível pelo servidor Next.js.

## Configuração

Instale as dependências e crie o ambiente local:

```cmd
npm ci
copy .env.example .env.local
```

Variável necessária:

```env
BACKEND_API_URL=http://localhost:3333
```

`BACKEND_API_URL` é server-only. Não use `NEXT_PUBLIC_BACKEND_API_URL` nem exponha credenciais do backend em variáveis públicas.

## Desenvolvimento e execução

```cmd
npm run dev
```

O endereço padrão é `http://localhost:3000`.

Após gerar o build:

```cmd
npm run build
npm run start
```

O build usa `next/font` com Geist e pode precisar de acesso ao Google Fonts quando a fonte ainda não estiver em cache.

## Testes e qualidade

```cmd
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` usa `node:test` e cobre contratos, schemas e comportamentos relevantes sem iniciar o Next.js, o backend ou o PostgreSQL. O projeto não possui script frontend dedicado de formatação.

## Organização

```text
src/app/          páginas, layouts e Route Handlers BFF
src/components/   componentes de domínio e UI
src/lib/client/   infraestrutura permitida no navegador
src/lib/server/   integração server-side com o backend e sessão
src/lib/          contratos, schemas e helpers compartilhados
src/types/        tipos da aplicação
tests/            testes do frontend
```

Listagens administrativas reutilizam `RemoteDataTable` com paginação e filtros server-side. Formulários usam React Hook Form e Zod quando apropriado, mantendo o backend como autoridade de validação.

## Documentação relacionada

- [Guia de execução](../docs/EXECUCAO.md)
- [Arquitetura e segurança](../docs/ARQUITETURA.md)
- [Formulários e validações](../docs/FORMULARIOS.md)
- [Contratos HTTP do backend](../docs/API.md)
