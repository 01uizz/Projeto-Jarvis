# JARVIS

Assistente pessoal de IA com três partes no mesmo projeto:

- **Site oficial** (`/`, `/recursos`, `/download`, `/instalacao`, `/documentacao`, `/atualizacoes`, `/seguranca`, `/suporte`). `/download` e `/atualizacoes` leem `app_releases` do Supabase.
- **JARVIS Core**: rotas de API no servidor (`/api/core/message|resolve|ping`) que rodam o agente com a sessão do usuário (RLS vale; nenhuma chave privada).
- **JARVIS Android**: o app (`/app`) empacotado com Capacitor num APK, que registra o aparelho, informa capacidades reais e executa comandos enviados pelo Core via `device_commands` + Realtime.

O mesmo app também roda no navegador/PWA em `/app`.

## Estado real desta versão (leia primeiro)

Este código foi escrito num ambiente cloud em que **o npm e o seu Supabase estavam bloqueados pela rede** (403). Por isso:

- **`next build` nunca foi executado.** A checagem de tipos foi feita com declarações provisórias e a lógica do agente foi testada contra um **banco simulado em memória**, não contra o Supabase real. A primeira compilação de verdade acontece no deploy da Vercel.
- **Nenhum teste foi feito contra o Supabase real** (login, RLS, gravação). Para isso existe **Mais → Diagnóstico**: roda os testes reais no seu aparelho e diz o que falhou (variável, chave, tabela, coluna, RLS, tipo, regra CHECK etc.). **Rode o Diagnóstico logo depois do primeiro login.**
- Não existe `package-lock.json` (sem acesso ao registro). A Vercel instala a partir do `package.json`.
- Serviço de voz, e-mail de confirmação e service worker dependem do navegador e do Supabase e **não puderam ser exercitados aqui**.

**Também não foi possível aqui:** compilar o APK, rodar o GitHub Actions, testar Realtime, microfone, notificações, localização ou abertura de apps num Android real. Tudo isso está implementado, validado só estaticamente (tipos com declarações provisórias, testes do Core e das ferramentas de dispositivo contra banco simulado) e **precisa do seu primeiro teste no aparelho**.

## O que funciona (implementado, ainda não verificado no seu banco)

| Recurso | Detalhe |
|---|---|
| Cadastro | e-mail, username (único, distinto do e-mail), nome opcional, senha + confirmação, medidor de força (muito fraca/fraca/média/forte) e requisitos |
| Login / sessão / logout | Supabase Auth, e-mail + senha |
| Confirmação de e-mail | rota `/auth/callback`; o link usa `NEXT_PUBLIC_SITE_URL` ou o endereço aberto no navegador, nunca localhost fixo |
| Recuperação de senha | link por e-mail → `/auth/callback` → tela de nova senha; também há "Alterar senha" em Mais → Segurança |
| Perfil | `profiles`: username, display_name, onboarding_completed (criado no primeiro login) |
| Chat | histórico persistido (`conversations`/`messages`), confirmações por botão ou digitando "sim"/"não" |
| Agente | intenção → ferramenta → autonomia → integração → permissão → confirmação → **execução real no Supabase** → resposta → `audit_logs` |
| Ferramentas reais | `create_task`, `update_task`, `delete_task`, `list_tasks`, `create_reminder`, `update_reminder`, `delete_reminder`, `calendar_read`, `calendar_create`, `calendar_update`, `calendar_delete`, `memory_save`, `memory_search`, `notifications_read` |
| Tarefas | criar, editar, concluir, reabrir, excluir, prioridade, prazo, categoria, origem ("via JARVIS") |
| Agenda | eventos com duração, descrição, local e origem; lembretes com ativar/desativar, editar e excluir |
| Memória | 6 tipos, editar, desativar, excluir |
| Dashboard | dados reais: tarefas, eventos, lembretes, notificações, atividade, status |
| Voz | botão de microfone com Web Speech API (pt-BR), estados idle/listening/processing/success/error/unsupported, exige HTTPS |
| Site oficial | 8 páginas; versão, notas, requisitos e link de download vêm de `app_releases` (nada inventado: campo ausente aparece como "não informado") |
| Core | `/api/core/message`, `/resolve`, `/ping`: autenticam o token da sessão, usam cliente Supabase com esse token (RLS) e rodam o mesmo agente |
| Comandos ao aparelho | ferramentas `device_open_app`, `device_get_location`, `device_notify`, `device_status`: checam aparelho online (heartbeat recente), capacidade e permissão, criam `device_commands` e só informam sucesso quando `device_command_results` confirma; senão expiram (timeout) |
| Android | registro em `devices`, `device_capabilities` (nunca marcadas disponíveis sem verificação), `device_installations`, `device_events`, onboarding (`device_onboarding`), heartbeat, Realtime com reconexão + polling de segurança, confirmação no aparelho, aviso de nova versão e bloqueio por `is_required` |
| Voz nativa | reconhecimento pelo plugin do Android (OUVINDO / PROCESSANDO / ERRO / SEM PERMISSÃO / INDISPONÍVEL) e resposta falada (RESPONDENDO) pela síntese de voz do aparelho; sem wake word permanente |
| Lembretes locais | no APK, lembretes das próximas 48 h viram notificações locais do Android (agendadas na abertura do app) |
| Telas novas | Mais → Dispositivos (estado, capacidades, pedir permissão, bloquear/revogar outros aparelhos) e Mais → Histórico (ações, comandos, eventos) |
| Tema | escuro/claro/sistema + 5 cores, salvo em `theme_preferences` |
| PWA | manifest, ícones e service worker (abre a "casca" offline; **sem** push nem sincronização em segundo plano) |

Exclusões (tarefa, lembrete, evento) **sempre pedem confirmação**. Mensagens do tipo "Tenho que entregar o trabalho sexta às 10h" geram uma pergunta antes de criar a tarefa.

## O que NÃO existe (o JARVIS responde "Essa integração ainda não está conectada." e não finge)

- Pesquisa na web, e-mail, WhatsApp/mensagens, pagamentos e compras (ferramentas registradas como alto risco, sem integração real).
- Conversa livre com IA: o provedor padrão (`rulesProvider`) entende comandos em português por regras. Para usar um modelo de linguagem, implemente `AIProvider` (`src/features/agent/types.ts`); a chave deve ficar só no servidor.
- Automações e pedidos recorrentes ("todo domingo…"): as tabelas `automations`/`automation_runs` existem, mas as colunas **não foram definidas**, e a regra do projeto é não inventar estrutura. A tela mostra isso. Também falta um motor em segundo plano (o Android restringe).
- Notificações push remotas (FCM): não configuradas, `device_push_tokens` não é usada. Só notificações locais.
- Contatos, arquivos, calendário do aparelho e tarefas em segundo plano: capacidades registradas como **indisponíveis** (não implementadas).
- No navegador, lembretes só aparecem com o app aberto. No APK, usam alarmes locais agendados na abertura (lembretes criados depois só entram na próxima abertura).
- O aparelho só recebe comandos com o app aberto e conectado.
- MFA/2FA: não implementado. A confirmação de e-mail é outra coisa e funciona via Supabase Auth.
- Google Calendar, Gmail, Outlook.

## Configurar o Supabase

1. **SQL Editor**: execute, nesta ordem, `migrations/001_jarvis_core.sql` e `migrations/002_auth_profile_agent.sql`. São aditivas e idempotentes (não apagam dados). A 001 também ativa **RLS** com políticas `user_id = auth.uid()`. Se uma tabela existente tiver colunas `NOT NULL` extras, o Diagnóstico vai apontar.
2. **Authentication → URL Configuration** (corrige o link de e-mail apontando para localhost):
   - **Site URL**: `https://SEU-APP.vercel.app`
   - **Redirect URLs**: `https://SEU-APP.vercel.app/auth/callback` e `https://SEU-APP.vercel.app/**`
3. **Authentication → Providers → Email**: confirmação de e-mail ligada ou desligada, como preferir.
4. Contas criadas antes dessa configuração têm link antigo; peça "Reenviar e-mail" na tela de cadastro.

## Tabelas do Android: o que foi assumido (LEIA)

As tabelas `devices, device_capabilities, device_commands, device_command_results, app_releases, device_installations, device_push_tokens, device_onboarding, device_events` **já existem no seu Supabase e não são recriadas** (não há migração para elas). O prompt define os nomes das tabelas e poucos campos; os **nomes de colunas** abaixo foram **assumidos** e estão todos centralizados em `src/lib/schema.ts`:

| Tabela | Colunas assumidas |
|---|---|
| devices | id, user_id, device_name, manufacturer, model, android_version, app_version, device_identifier, status, last_seen_at, core_connected, onboarding_completed |
| device_capabilities | id, device_id, user_id, capability, available, permission_granted, metadata |
| device_commands | id, user_id, device_id, command_type, payload, status, requires_confirmation, expires_at, created_at |
| device_command_results | id, command_id, device_id, success, result, error_code, error_message, execution_time_ms (definidas no prompt) |
| device_events | id, user_id, device_id, event_type, metadata, created_at |
| device_installations | id, user_id, device_id, app_release_id, version_name, version_code, installation_status, installation_source, installed_at, first_launch_at, last_launch_at |
| device_onboarding | id, user_id, device_id, step, completed, completed_at |
| device_push_tokens | id, user_id, device_id, token, platform (ainda não usada) |
| app_releases | lida com `select *` e normalizada; esperado: version_code, is_required, versão (version_name/version), notas, requisitos, link de download |

**Rode Mais → Diagnóstico → grupo "Android e Core"**: ele confere cada coluna no banco real e diz *exatamente* qual tabela ou coluna falta. Nada é alterado automaticamente. Se um nome real for diferente, me informe (ou ajuste `src/lib/schema.ts` e o código que o usa) em vez de criar uma estrutura paralela. Outros pontos que dependem do seu esquema real: valores de `status`/`command_type`/`event_type` aceitos por eventuais CHECKs, a coluna `user_id` em `device_command_results` (não é gravada hoje) e as políticas de RLS/Realtime de cada tabela.

**Sem estrutura definida (não implementado, aguardando você):** `automations`, `automation_runs`, `web_searches`, `web_search_results`.

## Android: do código ao APK (pelo celular)

1. Suba o projeto no GitHub e faça o deploy na Vercel (seção abaixo). Anote a URL, por exemplo `https://SEU-APP.vercel.app`.
2. No GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**: `JARVIS_APP_URL` = `https://SEU-APP.vercel.app/app`.
3. **Assinatura (recomendado):** crie os *Secrets* `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` com uma keystore sua. Sem eles, o workflow assina com uma **chave temporária** e avisa: o APK funciona, mas **não atualiza por cima** de uma versão assinada com outra chave. A keystore nunca vai para o repositório (`.gitignore` bloqueia `*.keystore`/`*.jks`).
4. **Actions → Android APK → Run workflow**: informe `version_name` (ex.: `1.0.0`) e `version_code` (inteiro crescente). O job instala as dependências, gera o `capacitor.config.json`, cria o projeto Android (`cap add android`), ajusta permissões/versão, compila, assina e publica o APK em **Releases**.
5. O resumo do job mostra o link do APK e um modelo de `insert` para `app_releases` (ajuste os nomes das colunas para os reais). **O repositório precisa ser público** para o link de download funcionar sem login; caso contrário, hospede o APK em outro lugar e cadastre esse link.
6. No site, `/download` passa a mostrar a versão e o botão "Baixar JARVIS para Android". No Android: permita instalar apps do navegador, instale, entre e conclua a configuração inicial.

Como funciona: o APK carrega `JARVIS_APP_URL` (Capacitor em modo URL remota) e usa a ponte nativa para microfone, notificações, localização e abertura de apps. Isso significa que **atualizações do app web chegam sem novo APK**; um novo APK só é preciso para mudar plugins/permissões. Sem internet, o APK mostra uma tela de aviso. O link de confirmação de e-mail abre no navegador do aparelho (rota `/auth/callback`); depois, abra o app e entre.

Permissões do Android pedidas só quando necessárias: microfone, notificações, localização (e alarmes exatos para lembretes locais). Não são usados contatos, arquivos, IMEI nem QUERY_ALL_PACKAGES (apps abertos pelo nome ficam limitados à lista em `KNOWN_APPS` ou ao pacote informado).

## Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_publishable
NEXT_PUBLIC_SITE_URL=https://SEU-APP.vercel.app   # opcional
```

Só chaves **públicas**. Nunca use `service_role`, senha do banco ou chaves privadas no frontend nem no repositório.

## Do ZIP ao ar (pelo celular)

1. Extraia o ZIP e envie os arquivos a um repositório do GitHub (`package.json` na raiz).
2. Vercel → *Add New → Project* → importe o repositório.
3. Cadastre as variáveis acima e clique em **Deploy**. Se o build falhar, o log mostra o erro (a primeira compilação real é aqui).
4. Faça a configuração do Supabase (acima), abra a URL no celular, crie a conta, confirme o e-mail e rode **Mais → Diagnóstico**.
5. Para instalar: menu do navegador → *Adicionar à tela inicial*.

## Rodar localmente (opcional)

```
npm install
npm run dev
npm run typecheck
npm run build
```

## Arquitetura

```
src/
├── app/                  (site)/ páginas públicas · app/ (o aplicativo) · api/core/ (JARVIS Core) · auth/callback · manifest
├── android/              ponte Android: registro, capacidades, comandos, Realtime, onboarding, atualização
├── core/                 server.ts (auth por token + cliente com RLS) e coreClient.ts
├── components/           site/ (cabeçalho, rodapé) · Providers (auth, tema, service worker) e design system (ui)
├── config/               tema, cores, níveis de autonomia
├── features/
│   ├── agent/            Agent, AIProvider, rulesProvider, tools/ (registro de ferramentas)
│   ├── chat/ dashboard/ tasks/ calendar/ memory/ permissions/ reminders/ settings/
│   └── search/ automation/ notifications/ integrations/   (reservados)
├── hooks/                useVoice
├── lib/                  cliente Supabase, erros, senha, URL do site
├── services/             auditoria, permissões, confirmações, conversas, voz, diagnóstico
├── styles/  types/  utils/
migrations/               SQL do Supabase (001, 002); nada para as tabelas de dispositivo
scripts/android/          make-config.mjs, patch-android.mjs
.github/workflows/        android.yml (APK na nuvem)
android-shell/            página de fallback do APK
public/                   ícones e sw.js
```

### Agente e autonomia

Nível 0: só conversa. Nível 1: ações simples (criar tarefas, lembretes, eventos, memórias). Nível 2: ações autorizadas em Permissões. Nível 3: reservado para automações (hoje igual ao 2). Ações de alto risco (e-mail, mensagem, pagamento) e exclusões sempre pedem confirmação. Permissões de e-mail, mensagens, pagamentos e compras começam desativadas. Para adicionar uma ferramenta, crie-a em `features/agent/tools/` e registre em `tools/index.ts`.

### Segurança

- Só chave publishable no frontend, no Core e no APK; `.env*` no `.gitignore`. O Core nunca usa `service_role`: cada requisição usa o token do próprio usuário.
- Comandos ao aparelho: verificam aparelho online, capacidade e permissão; confirmações antes de ações sensíveis; `device_events` não guarda texto de mensagens, coordenadas nem tokens; identificador do aparelho é um UUID gerado pelo app (sem IMEI).
- Aparelhos `blocked`/`revoked` não são reativados pelo app e não executam comandos.
- RLS por `auth.uid()`; `audit_logs` não permite update/delete pelo usuário; o Diagnóstico testa gravação como outro usuário e leitura cruzada.
- Ações sensíveis exigem confirmação e são registradas com origem, resultado e erro.
- `secret_references` nunca deve ser legível pelo navegador (sem política neste projeto).
- Erros técnicos vão para o console; o usuário vê mensagens claras.
