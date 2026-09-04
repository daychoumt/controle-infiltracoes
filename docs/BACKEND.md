# Ativação do painel da equipe

O backend deste projeto é independente do Finance AI. O site público permite explorar uma demonstração, mas a base real de pacientes só existe depois da criação do D1. A publicação do frontend não cria banco nem libera usuários.

## 1. Identidade da clínica

Use um projeto Firebase dedicado à clínica. Ative o provedor **E-mail/senha** em Authentication e crie as contas da equipe pelo console. Não há cadastro público na interface.

Anote o ID do projeto, a configuração Web de API e os UIDs dos usuários. A configuração Web identifica o projeto; as permissões de consulta são verificadas pelo Worker. Não coloque credenciais de conta de serviço no frontend.

Cada requisição envia o ID token ao endpoint oficial `accounts:lookup` do Firebase. O servidor confere projeto, expiração, usuário, conta desativada, revogação da sessão e liberação na equipe. A sessão do frontend fica somente na memória da aba, sem cookies ou `localStorage`. Após expirar, entre novamente.

## 2. Banco e Worker na Cloudflare

Com Wrangler autenticado na conta da clínica, copie o exemplo e crie um banco dedicado:

```sh
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler d1 create amot-infiltracoes
```

Em `wrangler.jsonc`, substitua:

- `database_id` pelo ID retornado ao criar o D1;
- `FIREBASE_PROJECT_ID` e `FIREBASE_WEB_API_KEY` pela configuração do projeto da clínica;
- `ALLOWED_ORIGINS` pelas origens exatas do site, sem caminho ou barra no final. O domínio atual já está no exemplo.

O arquivo ativo está ignorado pelo Git para não publicar configurações operacionais por acidente. Mantenha o nome do binding **DB**. Não reutilize o Worker do Finance AI.

Valide e aplique as migrações primeiro localmente, depois no banco remoto vazio:

```sh
npx wrangler d1 migrations apply amot-infiltracoes --local
npx wrangler deploy --dry-run
npx wrangler d1 migrations apply amot-infiltracoes --remote
npx wrangler deploy
```

Cadastre o segredo de equipe no Worker:

```sh
npx wrangler secret put STAFF_ROLES
```

Cole um objeto JSON com os UIDs reais quando a ferramenta pedir o valor. Exemplo ilustrativo:

```json
{"UID_DO_SETOR":"recepcao","UID_DO_ADMIN":"admin"}
```

No painel Cloudflare, a alternativa é **Configurações → Variáveis e segredos → Adicionar**, nome `STAFF_ROLES`, tipo **Segredo**. Sem essa lista, todo usuário é recusado, inclusive quem acabou de criar uma conta no Firebase. Mantenha apenas os acessos necessários.

Cadastre também as listas operacionais como segredo, para que médicos, convênios e medicamentos não fiquem expostos no GitHub público:

```sh
npx wrangler secret put REFERENCE_DATA
```

Cole um JSON com as listas oficiais da clínica:

```json
{"convenios":["Convênio 1"],"medicacoes":["Medicação 1"],"medicos":["Médico 1"]}
```

Use os nomes reais somente no segredo do Worker. A demonstração pública utiliza exemplos fictícios. Depois do login, o painel busca essas listas na rota protegida `/references`.

## 3. Conectar a interface

Atualize `assets/config.js`:

```js
export const config = Object.freeze({
  apiUrl: 'https://amot-infiltracoes.SEU_SUBDOMINIO.workers.dev',
  firebaseApiKey: 'CONFIGURACAO_WEB_DO_FIREBASE_DA_CLINICA'
});
```

Use a origem do Worker, sem `/cases` no final. O painel deve ser acessado por HTTPS em produção. Publique a alteração pelo GitHub Pages. A página continua abrindo na demonstração; **Acesso do setor** permite entrar no banco real. Sair limpa os registros exibidos e retorna aos exemplos.

Não coloque `STAFF_ROLES`, tokens, senhas ou dados de pacientes nesse arquivo. O segredo Gemini não é usado neste projeto.

## 4. Homologar antes da rotina da clínica

Com registros fictícios e uma conta do setor:

1. Confirme que uma conta sem UID liberado recebe acesso negado.
2. Abra uma guia, marque uma pendência e confirme que ela não avança até a correção.
3. Cadastre outra articulação com o mesmo prontuário e confirme que nome e convênio são recuperados do perfil único.
4. Registre o envio à operadora. Para autorizar, informe o número da guia e confirme a autorização.
5. Marque uma aplicação passada como realizada. Tente deixá-la pronta com documentos pendentes; o servidor deve impedir.
6. Conclua a conferência e registre a entrega; confirme as três datas (pedido, realização e faturamento) na guia e na impressão.
7. Abra o mesmo registro em duas sessões. Após uma salvar, a outra deve receber conflito e reabrir os detalhes.
8. Saia do setor e verifique que os dados reais não permanecem na lista ou nos diálogos.

O schema e os testes não criam pacientes no banco remoto. Defina também quem administra acessos, backups e correções cadastrais. A versão atual não permite excluir registros nem corrigir os sete dados cadastrais pela interface; essa limitação deve ser considerada antes de utilizá-la na rotina.

## API

Todas as rotas de dados exigem `Authorization: Bearer <ID_TOKEN>` e usuário liberado em `STAFF_ROLES`.

| Método / rota | Resultado |
| --- | --- |
| `GET /session` | Perfil autorizado no servidor |
| `GET /references` | Listas de convênios, medicamentos e médicos após autenticação |
| `GET /patient?prontuario=...` | Perfil mínimo do paciente para reaproveitar nome e convênio no cadastro |
| `PATCH /patient` | Corrige nome e convênio do perfil e atualiza todas as guias do prontuário |
| `GET /cases` | Até 100 atendimentos, mais recentes primeiro, e cursor da próxima página |
| `GET /cases?cursor=...` | Página seguinte; use o cursor retornado, sem montar manualmente |
| `GET /cases/:id` | Dados, etapa, versão, conferência e histórico |
| `POST /cases` | Cadastra uma guia; recebe UUID v4 em `id` e os campos operacionais em `fields` |
| `PATCH /cases/:id` | Recebe `version`, `stage`, `fields` editáveis e `checks`; aplica regras e registra evento |

`checks` contém quatro booleanos: `autorizada`, `assinada`, `execucao`, `documentos`. As etapas são `recebido`, `solicitado`, `agendado`, `realizado`, `conferencia` e `faturamento`. Na interface elas aparecem separadas entre autorizações e pós-procedimento. Cada processo guarda `dataPedido`, `dataAplicacao` e `dataFaturamento`; a última é preenchida automaticamente na entrega final.

O prontuário é a chave única da tabela `patients`. Joelho direito, joelho esquerdo e ombro direito do mesmo paciente continuam sendo três processos independentes na tabela `cases`, com guias, aplicações e situações próprias. A etapa `cancelado` encerra apenas o processo selecionado, exige motivo e não apaga o histórico.

Reenviar um cadastro com o mesmo UUID, mesmos campos e mesmo usuário retorna o registro existente. Conflitos de versão retornam `409`. Atualização e evento são gravados juntos; uma falha no lote desfaz ambos. Não há repetição automática de mutações após falha de rede.

As respostas usam `Cache-Control: no-store`. O corpo das requisições é limitado a 8 KiB. Erros externos, consultas SQL, credenciais e pacientes não são incluídos nos logs da aplicação. CORS restringe origens de navegador; a autenticação e a lista da equipe são os controles efetivos de acesso.

## Referências

- [Autenticação REST do Firebase](https://firebase.google.com/docs/reference/rest/auth)
- [Sessões do Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions)
- [Transações em lote do D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Migrações do D1](https://developers.cloudflare.com/d1/reference/migrations/)

O frontend e os testes não exigem serviços pagos. A hospedagem do backend está sujeita às cotas vigentes da Cloudflare e do Firebase; consulte os painéis antes de ativar recursos adicionais.
