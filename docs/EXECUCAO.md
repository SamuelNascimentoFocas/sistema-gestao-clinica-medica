# Guia de Instalação e Execução

Este documento descreve como preparar e executar localmente o MVP do Sistema de Gestão de Clínica Médica em Windows, utilizando Node.js, npm e PostgreSQL instalados no sistema operacional.

## 1. Ambiente validado

O MVP foi validado com:

```text
Windows 10/11
Node.js 24.15.0
npm 11.16.0
PostgreSQL 18.4
Git 2.54.0.windows.1
```

Essas são as versões utilizadas na validação final. O projeto não declara formalmente versões mínimas por meio do campo `engines`.

## 2. Estrutura do projeto

```text
clinica-medica/
├── backend/
├── frontend/
├── docs/
└── README.md
```

O backend utiliza a porta `3333` e o frontend utiliza a porta `3000`.

## 3. Obter o código

Em um terminal CMD:

```cmd
git clone URL_DO_REPOSITORIO
cd clinica-medica
```

Quando o projeto já estiver disponível localmente, apenas acesse a raiz:

```cmd
cd C:\caminho\para\clinica-medica
```

## 4. Preparar o PostgreSQL

### 4.1. Confirmar o serviço

No ambiente usado durante o desenvolvimento, o serviço foi:

```cmd
sc query postgresql-x64-18 | findstr /I "STATE ESTADO"
```

O nome do serviço pode variar conforme a versão e a instalação do PostgreSQL.

Também é possível confirmar a conexão:

```cmd
psql --version
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

### 4.2. Criar usuário e bancos

Entre no `psql` com um usuário administrativo:

```cmd
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

Crie o usuário da aplicação e os bancos:

```sql
CREATE ROLE clinic_app
  WITH LOGIN
  PASSWORD 'DEFINA_UMA_SENHA_LOCAL_FORTE';

CREATE DATABASE clinic_system
  OWNER clinic_app;

CREATE DATABASE clinic_system_test
  OWNER clinic_app;
```

Saia do `psql`:

```text
\q
```

Não reutilize senhas demonstrativas como senha do banco.

Se o usuário ou os bancos já existirem, não execute novamente os comandos de criação. Confirme os objetos existentes antes de alterá-los.

### 4.3. Privilégios necessários

O usuário configurado no backend precisa conseguir:

- conectar-se aos dois bancos;
- criar e alterar objetos no banco;
- criar o schema `clinic`;
- executar as migrations;
- instalar ou utilizar a extensão `btree_gist`, necessária para a restrição de sobreposição de agendamentos.

A migration tenta executar:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist
WITH SCHEMA public;
```

Se o PostgreSQL negar essa operação, crie a extensão previamente com um usuário administrativo no banco correspondente:

```cmd
psql -h 127.0.0.1 -p 5432 -U postgres -d clinic_system -c "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;"
psql -h 127.0.0.1 -p 5432 -U postgres -d clinic_system_test -c "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;"
```

## 5. Configurar e instalar o backend

A partir da raiz:

```cmd
cd backend
npm ci
copy /Y .env.example .env
notepad .env
```

Configuração local esperada:

```env
TZ=UTC
PORT=3333
HOST=localhost
LOG_LEVEL=info
APP_KEY=
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=clinic_app
DB_PASSWORD=SUA_SENHA_LOCAL
DB_DATABASE=clinic_system
DRIVE_DISK=private_fs
```

Gere uma chave criptograficamente segura:

```cmd
node ace generate:key
```

Garanta que o valor gerado esteja definido em `APP_KEY` no arquivo `backend/.env`.

Nunca versione o arquivo `.env` ou senhas reais. Os arquivos locais de ambiente estão excluídos pelo Git.

## 6. Configurar o banco de testes

Crie o arquivo local:

```cmd
notepad .env.test
```

Conteúdo:

```env
DB_DATABASE=clinic_system_test
```

Durante `npm test`, o inicializador define:

```text
NODE_ENV=test
```

O arquivo `.env.test` substitui apenas o nome do banco, enquanto as demais variáveis continuam vindo do ambiente local do backend.

O banco de testes deve permanecer separado do banco de desenvolvimento.

## 7. Executar migrations

Esta sequência destina-se a uma instalação nova, em banco vazio. A baseline
granular substitui as migrations anteriores; um banco com registros antigos em
`adonis_schema` não é atualizado automaticamente. Não use `migration:run`, reset
ou fresh para tentar reconciliar esse histórico. Preserve os bancos existentes e
consulte [MIGRATIONS.md](MIGRATIONS.md) antes de escolher uma estratégia.

Ainda dentro de `backend`, após confirmar o banco de destino:

```cmd
node ace migration:run
```

Conferir o estado:

```cmd
node ace migration:status
```

As migrations criam:

- schema `clinic`;
- usuários e tokens;
- consultórios, permissões, perfis e vínculos;
- pacientes e prontuários;
- profissionais e agendas;
- agendamentos e proteção contra sobreposição;
- entradas clínicas e logs de acesso;
- correções de prontuário;
- anexos clínicos privados.

## 8. Popular o catálogo de autorização

O seeder do cenário demonstrativo já atualiza o catálogo automaticamente. Para executar somente o catálogo:

```cmd
node ace db:seed --files=database/seeders/authorization_catalog_seeder.ts
```

Perfis padrão:

```text
clinic_admin
receptionist
doctor
```

## 9. Criar o cenário demonstrativo

Execute:

```cmd
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
```

O seeder pode ser executado novamente sem duplicar o cenário.

Ele não pode ser executado com:

```text
NODE_ENV=production
```

Consulte `CENARIO_DEMONSTRATIVO.md` para dados criados, credenciais e roteiro de apresentação.

## 10. Criar um administrador global

Para criar um usuário administrativo global fora do cenário demonstrativo:

```cmd
node ace admin:create
```

O comando solicita:

- nome completo;
- e-mail;
- senha;
- confirmação da senha;
- confirmação final.

A senha deve possuir pelo menos 12 caracteres e no máximo 72 bytes.

## 11. Iniciar o backend em desenvolvimento

```cmd
npm run dev
```

Endereço esperado:

```text
http://localhost:3333
```

Teste rápido no navegador ou por outro cliente HTTP:

```text
GET http://localhost:3333/
```

Resposta esperada:

```json
{
  "name": "Clinic Management API",
  "status": "ok"
}
```

Mantenha esse terminal aberto.

## 12. Configurar e instalar o frontend

Abra outro terminal na raiz do projeto:

```cmd
cd frontend
npm ci
copy /Y .env.example .env.local
notepad .env.local
```

Conteúdo esperado:

```env
BACKEND_API_URL=http://localhost:3333
```

`BACKEND_API_URL` é utilizado somente no servidor Next.js. Não é necessário expor essa variável com o prefixo `NEXT_PUBLIC_`.

## 13. Iniciar o frontend em desenvolvimento

```cmd
npm run dev
```

Acesse:

```text
http://localhost:3000
```

Mantenha backend e frontend executando simultaneamente em terminais separados.

## 14. Ordem completa para uma instalação nova

Resumo operacional:

### Terminal 1 — backend

```cmd
cd clinica-medica\backend
npm ci
copy /Y .env.example .env
notepad .env
node ace generate:key
notepad .env.test
node ace migration:run
node ace db:seed --files=database/seeders/demo_scenario_seeder.ts
npm run dev
```

### Terminal 2 — frontend

```cmd
cd clinica-medica\frontend
npm ci
copy /Y .env.example .env.local
npm run dev
```

### Navegador

```text
http://localhost:3000
```

## 15. Testes e qualidade

### Backend

```cmd
cd backend
npm run format
npm run typecheck
npm run lint
npm test
npm run build
```

A validação final do MVP aprovou:

```text
88 testes
```

A suíte de testes aplica as migrations automaticamente antes da execução e reverte as migrations ao final da validação observada.

### Frontend

```cmd
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` executa 22 testes focados: oito da camada HTTP browser/Axios e 14 de
schemas/resolver/estado dos formulários RHF/Zod, descritos em
[FORMULARIOS.md](FORMULARIOS.md). Usa `node:test`, sem iniciar Next.js, backend
ou PostgreSQL, e a execução nativa de
TypeScript do Node.js 24.15.0 listado nos pré-requisitos, sem runner adicional.
O Node pode emitir `MODULE_TYPELESS_PACKAGE_JSON` ao detectar o módulo TypeScript:
é um aviso de autodetecção ESM, não uma falha. Não se alterou o tipo de módulos
de todo o projeto apenas para eliminar esse aviso.

O frontend continua sem script `format` ou configuração própria de Prettier;
não é necessário reformatar o projeto inteiro para executar esses checks.
O build existente usa `next/font` para Geist e precisa conseguir obter as fontes
do Google Fonts quando elas não estiverem disponíveis no cache.

## 16. Execução local após build

### Backend

Gere o build:

```cmd
cd backend
npm run build
```

Para iniciar a saída compilada conforme orientação do próprio AdonisJS:

```cmd
cd build
npm ci --omit=dev
node bin/server.js
```

As variáveis de ambiente necessárias devem estar disponíveis para o processo compilado.

### Frontend

```cmd
cd frontend
npm run build
npm run start
```

Por padrão, o frontend inicia em:

```text
http://localhost:3000
```

Essa execução local após build não equivale a uma implantação de produção completa.

## 17. Anexos clínicos

O armazenamento local privado fica em:

```text
backend/storage/private
```

Características:

- visibilidade privada;
- arquivos não são servidos diretamente;
- downloads passam pelo backend autorizado;
- acessos relevantes geram auditoria;
- diretório ignorado pelo Git.

Em uma nova instalação, o diretório pode ser criado pelo fluxo da aplicação quando necessário. Garanta que o processo do backend tenha permissão de leitura e escrita.

## 18. Comandos úteis

### Backend

```cmd
node ace list
node ace list:routes --table
node ace migration:status
node ace migration:run
node ace db:seed --help
node ace admin:create
npm run dev
npm test
npm run build
```

### Frontend

```cmd
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

### Git

```cmd
git status
git diff --check
git log --oneline --decorate
```

## 19. Solução de problemas

### Backend não conecta ao PostgreSQL

Confirme:

- serviço do PostgreSQL ativo;
- host `127.0.0.1`;
- porta `5432`;
- usuário e senha;
- banco `clinic_system`;
- regras locais de autenticação do PostgreSQL.

Teste:

```cmd
psql -h 127.0.0.1 -p 5432 -U clinic_app -d clinic_system
```

### Testes usam o banco errado

Confirme a existência de:

```text
backend/.env.test
```

e o conteúdo:

```env
DB_DATABASE=clinic_system_test
```

Nunca configure o banco de desenvolvimento como banco de testes.

### Frontend informa que `BACKEND_API_URL` não foi configurada

Confirme:

```text
frontend/.env.local
```

com:

```env
BACKEND_API_URL=http://localhost:3333
```

Reinicie o servidor Next.js após alterar variáveis de ambiente.

### Porta já está em uso

Identifique o processo:

```cmd
netstat -ano | findstr :3333
netstat -ano | findstr :3000
```

Encerre apenas o processo conhecido ou ajuste a configuração local.

### Caracteres acentuados aparecem incorretamente no terminal

Os arquivos Markdown são gravados em UTF-8. No Windows PowerShell 5.1, visualize com:

```cmd
powershell -NoProfile -Command "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-Content -LiteralPath 'ARQUIVO.md' -Encoding UTF8"
```

### Migration da extensão `btree_gist` falha

Crie a extensão previamente com um usuário administrativo, conforme a seção de preparação do PostgreSQL.

## 20. Limites da execução atual

O repositório não inclui:

- `Dockerfile`;
- Docker Compose;
- configuração oficial de nuvem;
- proxy reverso;
- TLS;
- serviço de backup;
- observabilidade de produção;
- armazenamento distribuído de anexos.

A execução validada deste MVP é local. Uma implantação real exige planejamento adicional de infraestrutura, segurança, backup, recuperação e gestão de segredos.
