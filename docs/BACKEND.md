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
4. Registre o envio à operadora. Confirme que a data de solicitação e o retorno sugerido foram preenchidos automaticamente.
5. Para autorizar, informe o número da guia. Para agendar, informe a data do procedimento.
6. Marque uma aplicação passada como realizada, receba a guia assinada e conclua os quatro itens da conferência.
7. Tente criar um processo ativo repetido para o mesmo prontuário, articulação, lado e aplicação; o servidor deve recusar.
8. Deixe duas guias do mesmo convênio prontas, crie um lote e confirme que ambas foram encerradas com a mesma referência.
9. Tente misturar convênios no mesmo lote; o servidor deve impedir sem entregar nenhuma guia.
10. Confirme as datas de pedido, solicitação, autorização, agendamento, realização, recebimento, conferência e faturamento no histórico e na impressão.
11. Abra o mesmo registro em duas sessões. Após uma salvar, a outra deve receber conflito e reabrir os detalhes.
12. No histórico do paciente, use **Novo pedido deste paciente** e confirme que prontuário, nome e convênio são reaproveitados enquanto a nova articulação mantém guia e situação próprias.
13. Saia do setor e verifique que os dados reais não permanecem na lista ou nos diálogos.

O schema e os testes não criam pacientes no banco remoto. Defina também quem administra acessos, backups e correções cadastrais. A interface permite corrigir o perfil do paciente e os dados de cada infiltração de forma independente; registros encerrados permanecem no histórico e não são apagados.

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
| `GET /batches` | Últimos 100 lotes entregues ao faturamento |
| `GET /batches/:id` | Cabeçalho do lote e suas guias |
| `POST /batches` | Entrega de 1 a 100 guias prontas do mesmo convênio em uma única transação |

`checks` contém quatro booleanos: `autorizada`, `assinada`, `execucao`, `documentos`. As etapas são `recebido`, `solicitado`, `autorizado`, `agendado`, `realizado`, `conferencia`, `pronto_faturamento` e `faturamento`. Na interface elas aparecem separadas entre autorizações e pós-procedimento.

Cada processo guarda `dataPedido`, `dataSolicitacao`, `dataAutorizacao`, `dataAgendamento`, `dataAplicacao`, `dataGuiaRecebida`, `dataConferencia`, `dataFaturamento` e `retornoEm`. Datas que correspondem a um clique real do fluxo são registradas automaticamente no servidor; agendamento, realização e próximo retorno são informados pelo setor.

O prontuário é a chave única da tabela `patients`. Joelho direito, joelho esquerdo e ombro direito do mesmo paciente continuam sendo três processos independentes na tabela `cases`, com guias, aplicações e situações próprias. Um processo ativo repetido para a mesma articulação, lado e aplicação é recusado. A etapa `cancelado` encerra apenas o processo selecionado, exige motivo e não apaga o histórico.

`delivery_batches` guarda a referência, competência, convênio, responsável que recebeu e observação. `delivery_batch_items` relaciona as guias. Criação do lote, itens, mudança das guias e eventos de auditoria são enviados em um único `DB.batch`; uma condição de versão ou etapa inválida aborta a entrega inteira.

Reenviar um cadastro com o mesmo UUID, mesmos campos e mesmo usuário retorna o registro existente. Conflitos de versão retornam `409`. Atualização e evento são gravados juntos; uma falha no lote desfaz ambos. Não há repetição automática de mutações após falha de rede.

As respostas usam `Cache-Control: no-store`. O corpo das requisições é limitado a 8 KiB. Erros externos, consultas SQL, credenciais e pacientes não são incluídos nos logs da aplicação. CORS restringe origens de navegador; a autenticação e a lista da equipe são os controles efetivos de acesso.

## Referências

- [Autenticação REST do Firebase](https://firebase.google.com/docs/reference/rest/auth)
- [Sessões do Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions)
- [Transações em lote do D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Migrações do D1](https://developers.cloudflare.com/d1/reference/migrations/)

O frontend e os testes não exigem serviços pagos. A hospedagem do backend está sujeita às cotas vigentes da Cloudflare e do Firebase; consulte os painéis antes de ativar recursos adicionais.
