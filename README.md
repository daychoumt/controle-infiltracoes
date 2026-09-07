# AMOT · Gestão de infiltrações

Controle interno do setor de autorizações para acompanhar cada guia, do pedido recebido à entrega ao faturamento, sem depender de cadernos.

**[Explorar a demonstração](https://xn--amotinfiltrao-7eb3d.online/painel.html?demo=1)** · **[Painel da clínica](https://xn--amotinfiltrao-7eb3d.online/)** · **[Configurar o backend](docs/BACKEND.md)** · **[Segurança operacional](docs/SECURITY.md)**

## O problema

Receber um pedido não garante que sua guia chegue ao faturamento. Informações distribuídas entre planilha, e-mails e documentos dificultam identificar o que está parado e o que falta corrigir.

O projeto evoluiu de um formulário isolado para uma interface única do setor de autorizações. O sistema reduz a atualização manual aos acontecimentos reais da rotina, registra a condição de cada processo e produz as relações impressas usadas na entrega.

## Experimente em dois minutos

1. Abra o painel. A demonstração começa vazia para você testar o fluxo desde o primeiro cadastro.
2. Selecione **Cadastrar primeiro paciente** e use somente informações fictícias.
3. Escolha 1ª, 2ª ou 3ª aplicação, articulação, lado e uma condição como falta de carimbo ou ressonância aguardando envio.
4. Abra a guia criada e use **Novo pedido deste paciente** para cadastrar outra articulação sem repetir prontuário, nome e convênio.
5. Informe o número da guia, o agendamento e a realização; as demais datas são registradas automaticamente pelos botões de ação.
6. Conclua a conferência, abra **Entregar ao faturamento** e gere um lote por convênio com protocolo imprimível.
7. Abra **Relatórios** para testar as relações mensais de movimento, pendências e entregas.

A demonstração é interativa, mas não grava dados em servidores ou no armazenamento do navegador. Recarregar a página limpa todos os testes. Não insira informações reais nessa demonstração.

## O que está implementado

| Área | Comportamento |
| --- | --- |
| Entrada única | O endereço principal abre o controle; o formulário antigo que disparava e-mail não é mais utilizado pelo site |
| Perfil único | O prontuário identifica um único paciente e reaproveita nome e convênio nos próximos processos |
| Cadastro operacional | Prontuário Racimed, paciente, convênio, pedido, médico, articulação, lado, sequência e data do pedido |
| Regra da guia | Cada combinação de articulação e lado é registrada como uma guia independente |
| Trabalho do dia | Prioriza pendências, retornos de hoje e guias atrasadas antes das demais filas |
| Prazo operacional | Conta os dias desde a última mudança de etapa e utiliza a próxima data de acompanhamento quando informada |
| Acompanhamento | Autorizações e pós-procedimento ficam em blocos distintos; pesquisa também por pedido do Racimed e médico |
| Conferência | Guia autorizada, guia assinada, execução e documentação conferidas |
| Ações simples | Enviar à operadora → autorizar → agendar → realizar → receber guia → conferir → incluir no lote |
| Fluxo completo | Pedido recebido → na operadora → autorizado → agendado → realizado → conferência → pronto → entregue |
| Pendências | Correções aparecem como alerta separado e impedem avanço até serem resolvidas |
| Condição do processo | Pedido para corrigir, ressonância aguardando envio, falta de carimbo/assinatura, laudo aguardando, divergência ou outra pendência |
| Responsabilidade | O setor de autorizações mantém o controle; recepção e faturamento recebem as relações impressas |
| Histórico | Todas as articulações e aplicações aparecem no perfil do paciente, mas cada guia mantém processo e situação próprios |
| Novo pedido do paciente | O perfil oferece um atalho que reaproveita prontuário, nome e convênio e pede somente os dados da nova articulação |
| Correções | Nome e convênio podem ser corrigidos no perfil e são atualizados em todas as guias do prontuário |
| Cancelamento | Encerra somente a infiltração escolhida, exige motivo e preserva as demais articulações e o histórico |
| Duplicidade | Impede um segundo processo ativo com o mesmo prontuário, articulação, lado e aplicação |
| Lote de faturamento | Reúne somente guias prontas do mesmo convênio, registra quem recebeu e encerra todas juntas |
| Relatórios mensais | Movimento completo, pendências ou entregas; folhas A4 separadas por convênio |
| Protocolo impresso | Número único do lote, competência, responsáveis, guias entregues e campos de assinatura |
| Relação impressa | Paciente, prontuário, guia, médico, articulação, lado, aplicação, datas do pedido/realização/faturamento, situação e pendências |
| Backend | API em Cloudflare Workers, autenticação Firebase e banco SQL D1 |
| Concorrência | Versão esperada por atualização; registro e evento gravados na mesma transação |
| Acesso | API nega usuários fora da lista de equipe, mesmo que tenham login válido |
| Sessão protegida | Tokens ficam somente na memória, são apagados ao sair e a tela bloqueia após 15 minutos sem uso |
| Privacidade no navegador | Prontuários seguem no corpo da requisição, formulários clínicos não usam preenchimento automático e o painel pede para não ser indexado |
| Integridade concorrente | O banco impede processos ativos duplicados mesmo quando duas pessoas salvam ao mesmo tempo |
| Cadastros auxiliares | Listas reais de médicos, convênios e medicamentos ficam no backend; a demonstração usa exemplos fictícios |
| Qualidade | Testes automatizados de fluxo, segurança, banco, concorrência e lotes no GitHub Actions |

## O que está publicado e o que depende de configuração

- **Entrada principal:** o endereço inicial abre o painel. O formulário público antigo e seu endpoint de notificação não participam mais do fluxo.
- **Painel público:** demonstração independente com dados fictícios, sem acesso a pacientes da clínica.
- **Painel da equipe:** código implementado, mas acesso real depende de criar o D1, configurar um projeto Firebase da clínica e liberar individualmente os usuários no Worker. A configuração pública está vazia por padrão.

O painel não envia e-mails. O banco protegido é a fonte principal e a impressão usa os dados já cadastrados sem alterar os registros. Uma planilha de backup só deve ser conectada depois que a clínica definir o arquivo oficial e quem poderá acessá-lo.

## Arquitetura

| Camada | Tecnologia / responsabilidade |
| --- | --- |
| Interface | HTML semântico, CSS responsivo, módulos JavaScript, diálogos nativos e renderização com `textContent` |
| Regras compartilhadas | Validação, transições, permissões por etapa e conferência de documentos |
| API | Cloudflare Worker com autenticação em cada requisição e respostas sem cache |
| Identidade | Firebase Authentication; contas e perfis liberados explicitamente no servidor |
| Persistência da equipe | D1, perfis em `patients`, processos em `cases`, lotes em `delivery_batches` e auditoria em `events` |
| Cópia de segurança | Integração futura com a planilha oficial da clínica, sem notificações e sem trabalho manual |
| Hospedagem | GitHub Pages com domínio próprio |

O projeto não depende de framework nem de uma etapa de compilação para publicar o frontend. A base funciona com módulos nativos, o que permite estudar separadamente interface, domínio, autenticação e persistência.

## Desenvolvimento

Requer Node.js 22.13 ou superior para os testes com SQLite. Não é necessário instalar dependências para validar o projeto.

```sh
npm run check
npm test
```

Para abrir a interface localmente, sirva esta pasta por HTTP, por exemplo com `python3 -m http.server 8080`, e acesse `/painel.html`. Utilize somente dados fictícios enquanto o backend protegido não estiver configurado.

```text
assets/       Interface, validações e modos demo/equipe
worker/       API, autenticação e repositório SQL
migrations/   Esquema do banco
scripts/      Verificações estruturais
tests/       Regras de negócio e integração da API com SQLite
docs/        Configuração do backend
```

## Limites atuais

Sem anexos, importação automática do Racimed ou decisões clínicas automatizadas. Como não existe integração disponível com o Racimed, o primeiro perfil ainda é manual; nos próximos processos, nome e convênio são recuperados pelo prontuário. Solicitação, autorização, recebimento da guia, conferência e envio ao faturamento ganham data automática. Agendamento, realização, retorno, condição e observação são informados quando ocorrerem.

Nenhum dado real foi usado nos testes. A ativação para a clínica exige validar fluxo, permissões, bloqueio de sessão, restauração de backup e rotina de desligamento de usuários em um ambiente de homologação. A direção da clínica deve aprovar quem acessa os dados e por quanto tempo eles serão mantidos.

**Desenvolvido por [Thalys Daychoum](https://github.com/daychoumt)** · JavaScript, interfaces web e automação de processos.
