# Rastreabilidade da Fase 12

## Objetivo

Este documento registra a rastreabilidade final dos findings B1–B9 tratados durante a revisão de conformidade da Fase 12. O mapa relaciona cada problema reconstruído ao critério adotado, aos commits que evidenciam sua correção e ao estado verificado na branch `refactor/company-review-compliance` a partir do commit `7dc3c1f452f2f72a6770ae60d355b5e13890285c`.

Ele complementa, sem substituir, os documentos canônicos de [API](API.md), [arquitetura](ARQUITETURA.md), [formulários](FORMULARIOS.md), [execução](EXECUCAO.md), [migrations](MIGRATIONS.md) e [validação](VALIDACAO.md).

## Metodologia e limites históricos

- B1–B9 são identificadores usados durante a revisão de conformidade da Fase 12.
- Os títulos e as descrições abaixo são reconstruções funcionais baseadas no histórico Git, nos diffs, nos testes e na implementação atual. Não são citações literais de um registro histórico original, pois esse registro não existe no repositório.
- Todos os findings possuem definição reconstruída com confiança alta, sustentada por evidências convergentes de implementação e validação.
- Os commits listados são evidências da implementação ou da correção. Um finding pode depender de vários commits complementares; os SHAs não significam que cada problema tenha sido resolvido isoladamente por um único commit.
- Commits principais implementam diretamente o critério central. Commits de suporte fornecem infraestrutura, integração ou metadados complementares e não devem ser confundidos com o núcleo da correção.
- O estado `RESOLVED` descreve o estado auditado da branch nesse marco. Mudanças posteriores exigem nova validação.

## Mapa B1–B9

| ID | Problema reconstruído | Critério de resolução | Commits principais | Commits de suporte | Estado |
| --- | --- | --- | --- | --- | --- |
| B1 | Onboarding administrativo inseguro ou legado com senha definida por administrador | Onboarding por convite; senha definida pelo próprio usuário; token persistido somente como digest; expiração e uso único; remoção dos fluxos administrativos legados de senha. | `ba5fad9f537f2a8f71c80c2a4dcacfd400958774`<br>`93be1c20a1feb6cd279640501b6bb6729854f17a`<br>`b249cf1d9226a64debde7219be9f3ac58d1aea54` | `15b78b77a5a8b5b8474e172fbc3940d36d7edb37` | RESOLVED |
| B2 | Ausência de Custom Roles clinic-scoped e contratos de membership dependentes de `roleCode` | Custom Roles por clínica; system roles protegidas; membership por `roleId`; anti-escalation; `Role.code` restrito à identidade interna quando aplicável. | `516f3f775b3013a932cba708667f06104199997a`<br>`8848f6bc353c69d8bb11e588a5f99f58bbe5bb4f`<br>`611a9b0f89c07ac3d150110408955eb92357ba87` | — | RESOLVED |
| B3 | Administração Global incompleta e acoplada ao contexto de clínica | `/admin`; gate por `isGlobalAdmin`; operação global sem membership; BFF; gestão global de usuários e clínicas; ausência de promoção arbitrária pela UI ou API HTTP. | `43e5590522b423928a4a9f088ef41df5ac170b2b`<br>`9838669bcc5cdf77b69ae01a953d8342ce567768`<br>`3fd5bdce3ae6c4557b667c1345dc2dd43dfbbb7d` | — | RESOLVED |
| B4 | Conteúdo clínico sem contrato de formatação segura | Markdown restrito e versionado; allowlist; HTML bruto não executado; fallback seguro; ausência de conteúdo externo arbitrário. | `1cdf4fcfdabeaebf6256e6cab4fa11e69cb9836d`<br>`e12e26e2b935fb8d8ba1cc27a587ea84d0827b12` | — | RESOLVED |
| B5 | Fluxo e vínculo entre atendimento concluído e prontuário incompletos | Atalho autorizado; `appointmentId` opcional; vínculo somente com atendimento concluído compatível; validação de paciente, clínica e profissional. | `1cdf4fcfdabeaebf6256e6cab4fa11e69cb9836d`<br>`e12e26e2b935fb8d8ba1cc27a587ea84d0827b12` | — | RESOLVED |
| B6 | Limite de upload fixo e potencialmente divergente | Configuração central; validator e service coerentes; teto absoluto seguro; ausência de limite concorrente hardcoded no frontend. | `5cdd0ea45538d5bae87dbd053ad64da0fc864ef8` | `fbe58497c293c0e45bc21f9c6bfed2142e94405e` | RESOLVED |
| B7 | Preview de anexos incompleto | Preview local de JPEG, PNG e PDF; URLs `blob:` temporárias; cleanup seguro; listagem preservada; storage privado; download autenticado. | `fbe58497c293c0e45bc21f9c6bfed2142e94405e`<br>`5fd6da486fa1f3427a23f97a1f5cc63c620ccecc` | `41c5e5e8a0670e29e285eaaa54d8413177ef4bdd`<br>`24415061c4b72cc55f04437aa70717ddd54abb68`<br>`80f273abb5f68eeb063ee377acbef32a37a8f5c5`<br>`5cdd0ea45538d5bae87dbd053ad64da0fc864ef8` | RESOLVED |
| B8 | Dados pessoais ou sensíveis em logs | `create_admin` sem PII em logs; logging server-side por allowlist; ausência de password, hash, token, cookie e conteúdo clínico indevido. | `d11b77af6e06911e0d168c7ac925851424497d42`<br>`3216163748c15e4d84371fe07ba2640ad1bdee64` | — | RESOLVED |
| B9 | Documentação insuficiente ou desatualizada para handoff | API, setup, arquitetura, formulários, migrations, validação e documentação operacional alinhados à implementação atual. | `b868c4a021b5ce32ece3c5da7b0410f85a2b938d`<br>`cc28c0adaf10bb3f134e719fb32eaca15be01262`<br>`3d27773d3761b26b02e3736f63c6b015dc5826d4`<br>`d3051b0daf63537f89c37ddb336d6c672941dea5`<br>`7dc3c1f452f2f72a6770ae60d355b5e13890285c` | — | RESOLVED |

B4 e B5 compartilham os commits `1cdf4fcfdabeaebf6256e6cab4fa11e69cb9836d` e `e12e26e2b935fb8d8ba1cc27a587ea84d0827b12` porque a mesma evolução integrou o contrato seguro de conteúdo clínico ao fluxo de atendimento concluído. Os critérios e os findings permanecem distintos.

Em B7, o commit `5fd6da486fa1f3427a23f97a1f5cc63c620ccecc` completa especificamente o preview local de PDF. Em B9, `7dc3c1f452f2f72a6770ae60d355b5e13890285c` sincroniza a documentação após essa correção; o commit de implementação de B7 não é classificado como commit documental de B9.

## Evidências de validação final

As evidências abaixo são um snapshot da validação realizada ao final da Fase 12, não contagens permanentes nem contratos futuros do projeto.

| Camada | Verificação | Resultado no snapshot |
| --- | --- | --- |
| Backend | Testes | PASS — 143/143 |
| Backend | Typecheck | PASS |
| Backend | Lint | PASS |
| Backend | Build | PASS |
| Frontend | Testes após a correção de B7 | PASS — 82/82 |
| Frontend | Typecheck | PASS |
| Frontend | Lint | PASS |
| Frontend | Build de produção | PASS em ambiente autorizado com acesso ao Google Fonts |

O fechamento também registrou `CRITICAL_FINDINGS=0`, `HIGH_FINDINGS=0`, `MEDIUM_FINDINGS=0`, `LOW_FINDINGS=0` e `TECHNICAL_BLOCKERS_REMAINING=0`.

## Estado de fechamento

Os findings B1–B9 identificados durante a revisão da Fase 12 estão resolvidos no estado auditado da branch. Essa conclusão é limitada aos critérios e evidências registrados neste documento: não constitui afirmação de ausência absoluta de bugs, certificação de produção, segurança eterna ou dispensa de validações futuras.

Qualquer mudança posterior em autenticação, autorização, onboarding, prontuário, anexos, contratos HTTP, execução ou documentação deve ser avaliada contra os invariantes correspondentes e pode exigir uma nova auditoria.
