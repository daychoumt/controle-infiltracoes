# AMOT · Gestão de infiltrações

Registro de aplicações e acompanhamento administrativo das guias, da autorização à confirmação do faturamento. Um projeto criado a partir de uma necessidade da rotina de recepção de uma clínica.

**[Explorar a demonstração](https://xn--amotinfiltrao-7eb3d.online/painel.html)** · **[Formulário da clínica](https://xn--amotinfiltrao-7eb3d.online/)** · **[Configurar o backend](docs/BACKEND.md)**

## O problema

Registrar uma aplicação não garante que sua guia chegue ao faturamento. Informações distribuídas entre recepção, planilha e documentos dificultam identificar o próximo responsável e as pendências de cada atendimento.

O projeto evoluiu de um formulário conectado ao Google Apps Script para uma interface de trabalho com fila por etapa, conferência de documentos, histórico por prontuário e fechamento mensal impresso. A etapa final exige que o faturamento confirme o recebimento.

## Experimente em dois minutos

1. Abra o painel. Todos os registros são fictícios e identificados como demonstração.
2. Abra **Ana Exemplo** para consultar, pelo prontuário, suas aplicações anteriores em diferentes articulações.
3. Ative **Apenas guias para encaminhar**, confira os quatro itens e envie uma guia ao faturamento.
4. Altere **Simular perfil** para **Faturamento**, reabra o atendimento e confirme o recebimento.
5. Abra **Fechamento mensal**, escolha o tipo de folha e veja as relações separadas por convênio, prontas para impressão.

A demonstração é interativa, mas não grava dados em servidores ou no armazenamento do navegador. Recarregar a página restaura os exemplos. Não insira informações reais nessa demonstração.

## O que está implementado

| Área | Comportamento |
| --- | --- |
| Registro da clínica | Formulário em três etapas, revisão antes do envio, validação e integração existente com Apps Script preservada |
| Cadastro operacional | Prontuário Racimed, paciente, convênio, pedido, médico, articulação, lado e sequência da aplicação |
| Regra da guia | Cada combinação de articulação e lado é registrada como uma guia independente |
| Acompanhamento | Pesquisa por nome, prontuário, convênio e articulação; filtros por etapa; indicadores e consulta dos detalhes |
| Conferência | Guia autorizada, guia assinada, execução e documentação conferidas |
| Fluxo | Autorização → agendado → realizado → faturamento → recebimento confirmado |
| Responsabilidades | Recepção prepara e encaminha; faturamento confirma recebimento; administrador pode atuar em ambos |
| Histórico | Aplicações agrupadas pelo prontuário, além de ações, datas, perfil e versão de cada atendimento |
| Fechamento mensal | Movimento completo, pendências ou entrega; folhas A4 separadas por convênio com campos de assinatura |
| Relação impressa | Paciente, prontuário, médico, articulação, lado, 1ª/2ª/3ª aplicação, data, situação e totais |
| Backend | API em Cloudflare Workers, autenticação Firebase e banco SQL D1 |
| Concorrência | Versão esperada por atualização; registro e evento gravados na mesma transação |
| Acesso | API nega usuários fora da lista de equipe, mesmo que tenham login válido |
| Qualidade | 28 testes automatizados e verificações de sintaxe e referências locais no GitHub Actions |

## O que está publicado e o que depende de configuração

- **Formulário original:** continua enviando os mesmos sete campos à automação existente. O código do Apps Script não está neste repositório. Como a resposta é opaca (`no-cors`), o site informa que o envio ocorreu e orienta conferir a planilha; não afirma que a gravação foi confirmada.
- **Painel público:** demonstração independente com dados fictícios, sem acesso a pacientes da clínica.
- **Painel da equipe:** código implementado, mas acesso real depende de criar o D1, configurar um projeto Firebase da clínica e liberar os usuários no Worker. A configuração pública está vazia por padrão.

O painel não importa a planilha nem envia e-mails. O cadastro no painel e o envio do formulário à automação são operações separadas. A impressão usa os dados já cadastrados no painel e não altera os registros. A integração com a planilha pode ser evoluída quando o código e o contrato do Apps Script estiverem disponíveis.

## Arquitetura

| Camada | Tecnologia / responsabilidade |
| --- | --- |
| Interface | HTML semântico, CSS responsivo, módulos JavaScript, diálogos nativos e renderização com `textContent` |
| Regras compartilhadas | Validação, transições, permissões por etapa e conferência de documentos |
| API | Cloudflare Worker com autenticação em cada requisição e respostas sem cache |
| Identidade | Firebase Authentication; contas e perfis liberados explicitamente no servidor |
| Persistência da equipe | D1, tabelas `cases` e `events`, consultas parametrizadas e transações |
| Automação existente | Google Apps Script / planilha, preservados no formulário de registro |
| Hospedagem | GitHub Pages com domínio próprio |

O projeto não depende de framework nem de uma etapa de compilação para publicar o frontend. A base funciona com módulos nativos, o que permite estudar separadamente interface, domínio, autenticação e persistência.

## Desenvolvimento

Requer Node.js 22.13 ou superior para os testes com SQLite. Não é necessário instalar dependências para validar o projeto.

```sh
npm run check
npm test
```

Para abrir a interface localmente, sirva esta pasta por HTTP, por exemplo com `python3 -m http.server 8080`, e acesse `/painel.html`. Evite testar o envio do formulário real: ele está conectado à automação da clínica.

```text
assets/       Interface, validações e modos demo/equipe
worker/       API, autenticação e repositório SQL
migrations/   Esquema do banco
scripts/      Verificações estruturais
tests/       Regras de negócio e integração da API com SQLite
docs/        Configuração do backend
```

## Limites atuais

Sem anexos, edição dos dados cadastrais após abertura, importação da planilha ou decisões clínicas automatizadas. As movimentações são administrativas. Registros concluídos permanecem disponíveis para consulta. Ao abrir o histórico de um paciente ou o fechamento mensal, o painel percorre as páginas disponíveis do backend, com limite de segurança de 10 mil registros.

Nenhum dado real foi usado nos testes. A ativação para a clínica exige validar o fluxo e as permissões em um ambiente de homologação.

**Desenvolvido por [Thalys Daychoum](https://github.com/daychoumt)** · JavaScript, interfaces web e automação de processos.
