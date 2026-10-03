# JARVIS

Assistente pessoal de IA, em formato de aplicativo web/PWA (mobile-first). Esta é a **fundação** do produto: chat, agente com ferramentas, memória, tarefas, lembretes, agenda interna, permissões, confirmações e auditoria, com arquitetura pronta para novas integrações.

## Estado real desta versão (leia primeiro)

Este projeto foi escrito em um ambiente cloud em que o registro do npm estava bloqueado (erro 403). Por isso:

- **O build do Next.js (`next build`) não foi executado ali.** O código foi escrito com versões fixas de dependências e a lógica de datas e interpretação de comandos foi testada, mas a compilação completa acontece pela primeira vez no deploy da Vercel (ou ao rodar `npm install && npm run build`). Se o build apontar algum erro de tipo, ele será pequeno e localizado.
- **Nada foi testado contra o seu Supabase real** (login, gravação, RLS). Siga o passo "Configurar o Supabase" e teste o fluxo de cadastro → chat → tarefa antes de confiar nos dados.
- `package-lock.json` não foi gerado (sem acesso ao registro). A Vercel instala as dependências normalmente a partir do `package.json`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth + PostgreSQL com RLS) · Vercel · GitHub

## O que funciona hoje

| Recurso | Situação |
|---|---|
| Cadastro, login, logout, recuperação de senha (Supabase Auth) | Implementado |
| Chat com histórico salvo (`conversations`, `messages`) | Implementado |
| Agente: intenção → ferramenta → permissão → confirmação → execução → auditoria | Implementado |
| Ferramentas reais: `create_task`, `list_tasks`, `create_reminder`, `memory_save`, `memory_search`, `calendar_read` | Implementado |
| Tarefas (criar, editar, concluir, excluir, filtrar) | Implementado |
| Lembretes e agenda interna (eventos, tarefas com data, lembretes) | Implementado |
| Memória gerenciável (salvar, editar, desativar, excluir) | Implementado |
| Permissões por recurso e níveis de autonomia 0–3 | Implementado |
| Confirmação de ações sensíveis (`action_confirmations`) e log de auditoria (`audit_logs`) | Implementado |
| Tema escuro/claro/sistema + 5 cores de destaque, salvos em `theme_preferences` | Implementado |
| PWA (manifest, ícones, theme color) | Implementado (sem service worker/offline) |

## O que ainda NÃO existe (a arquitetura está pronta, a execução não)

- **Pesquisa na web** (`web_search`): registrada, mas sem provedor de busca. Responde que está indisponível.
- **E-mail, WhatsApp/mensagens, pagamentos e compras** (`email_send`, `message_send`, `payment_execute`): registradas como ferramentas de **alto risco**, que sempre exigem confirmação, mas **sem integração real**. O JARVIS informa que nada foi enviado/cobrado e nunca finge executar.
- **Conversa livre com IA**: o provedor padrão (`rulesProvider`) entende comandos em português por regras. Para usar um modelo de linguagem, implemente a interface `AIProvider` (`src/features/agent/types.ts`) e passe-a ao `Agent`; o resto do sistema não muda. A chave do provedor deve ficar só no servidor (rota de API), nunca no navegador.
- **Automações**: tabelas existem no banco, mas não há motor de execução agendada.
- **Notificações push e lembretes com o app fechado**: lembretes só aparecem dentro do app enquanto ele está aberto.
- **Voz**: o botão de microfone é um espaço reservado.
- **Google Calendar, Gmail, Outlook**: não conectados.

## Configurar o Supabase

1. No painel do Supabase, abra **SQL Editor** e execute `migrations/001_jarvis_core.sql`. Ele é idempotente: cria/ajusta as colunas usadas pelo app e ativa **RLS** com políticas `user_id = auth.uid()`.
   - Se suas tabelas já existentes tiverem colunas `NOT NULL` adicionais ou nomes diferentes, ajuste a tabela ou o código em `src/` (as consultas estão em `src/features/**` e `src/services/**`).
2. Em **Authentication → URL Configuration**, defina o **Site URL** como a URL do seu deploy na Vercel e adicione-a em *Redirect URLs* (necessário para confirmação de e-mail e recuperação de senha).
3. Em **Authentication → Providers → Email**, decida se exige confirmação de e-mail.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (rodando localmente) ou cadastre-as na Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_publishable
```

São chaves **públicas** (publishable). Nunca use `service_role`, senha do banco ou chaves privadas no frontend nem no repositório.

## Do ZIP ao ar (pelo celular)

1. **GitHub**: crie um repositório novo e envie os arquivos do ZIP já extraídos (pelo site do GitHub: *Add file → Upload files*; o ZIP deve ser extraído antes, com `package.json` na raiz do repositório).
2. **Vercel**: *Add New → Project* → importe o repositório do GitHub (framework detectado: Next.js).
3. Em *Environment Variables*, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. Se o build falhar, abra o log da Vercel: a primeira compilação é onde erros de tipo, se houver, vão aparecer.
5. Abra a URL no celular e use *Adicionar à tela inicial* para instalar o PWA.

## Rodar localmente (opcional)

```
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

## Arquitetura

```
src/
├── app/                  rotas (layout, page, manifest)
├── components/           Providers (auth + tema) e design system (components/ui)
├── config/               tema, cores, níveis de autonomia
├── features/
│   ├── agent/            Agent, AIProvider, rulesProvider e tools/ (registro de ferramentas)
│   ├── chat/ tasks/ calendar/ memory/ permissions/ reminders/ settings/
│   └── search/ automation/ notifications/ integrations/   (reservados para as próximas fases)
├── lib/                  cliente Supabase, tratamento de erros
├── services/             auditoria, permissões, confirmações, conversas
├── styles/               tokens CSS do tema
├── types/ utils/
migrations/               SQL do Supabase
```

### Agente

`mensagem → AIProvider.plan() → ferramenta → autonomia → disponibilidade da integração → permissão → confirmação? → execução → resposta → audit_logs`

Regras: nível 0 não executa nada; ferramentas de alto risco **sempre** pedem confirmação; ferramenta sem integração real responde que está indisponível e nunca simula sucesso.

### Ferramentas

Cada ferramenta (`src/features/agent/tools/`) declara nome, descrição, parâmetros, permissão exigida, nível de risco, se exige confirmação, se está implementada e a função `execute`. Para adicionar `update_task`, crie a ferramenta e registre-a em `tools/index.ts`.

### Temas

Tokens CSS em `src/styles/globals.css` (`--accent`, `--background`, `--surface`, `--border`, `--text`…). O app define `data-theme` e `data-accent` na raiz; nenhum componente usa cor fixa.

### Permissões e autonomia

`user_permissions` (permissão → liberada) e `user_settings.autonomy_level` (0–3), editáveis em *Mais → Permissões* e *IA e autonomia*. Permissões de e-mail, mensagens, pagamentos e compras começam desativadas.

### Memória

Tabela `memories` com conteúdo, categoria, origem, confiança e `is_active`. O JARVIS só grava o que você pede (ex.: "guarde que eu gosto de astronomia"); tudo é editável em *Mais → Memória*.

## Segurança

- Só chaves publishable no frontend; `.env*` está no `.gitignore`.
- RLS em todas as tabelas usadas, sempre por `auth.uid()`. `audit_logs` não permite update/delete pelo usuário.
- Ações sensíveis exigem confirmação e são registradas.
- `secret_references` nunca deve ser lida pelo navegador; não há política para ela neste projeto.
- Erros técnicos vão para o console; o usuário vê mensagens amigáveis.
