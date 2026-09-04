# AMOT · Gestão de infiltrações

Controle interno do setor de autorizações para acompanhar cada guia, do pedido recebido à entrega ao faturamento, sem depender de cadernos.

**[Explorar a demonstração](https://xn--amotinfiltrao-7eb3d.online/painel.html)** · **[Formulário da clínica](https://xn--amotinfiltrao-7eb3d.online/)** · **[Configurar o backend](docs/BACKEND.md)**

## O problema

Registrar uma aplicação não garante que sua guia chegue ao faturamento. Informações distribuídas entre recepção, planilha e documentos dificultam identificar o próximo responsável e as pendências de cada atendimento.

O projeto evoluiu de um formulário conectado ao Google Apps Script para uma interface de trabalho do setor de autorizações. O sistema reduz a atualização manual aos acontecimentos reais da rotina e produz as relações impressas usadas na entrega.

## Experimente em dois minutos

1. Abra o painel. Todos os registros são fictícios e identificados como demonstração.
2. Abra **Ana Exemplo** para consultar, pelo prontuário, suas aplicações anteriores em diferentes articulações.
3. Abra uma guia com pendência para ver o alerta destacado e a observação do que precisa ser corrigido.
4. Em uma guia autorizada, informe o número, confira os documentos e avance com poucos cliques.
5. Abra **Fechamento mensal**, escolha o tipo de folha e veja as relações separadas por convênio, prontas para impressão e assinatura.

A demonstração é interativa, mas não grava dados em servidores ou no armazenamento do navegador. Recarregar a página restaura os exemplos. Não insira informações reais nessa demonstração.

## O que está implementado

| Área | Comportamento |
| --- | --- |
| Registro da clínica | Formulário em três etapas, revisão antes do envio, validação e integração existente com Apps Script preservada |
| Cadastro operacional | Prontuário Racimed, paciente, convênio, pedido, médico, articulação, lado e sequência da aplicação |
| Regra da guia | Cada combinação de articulação e lado é registrada como uma guia independente |
| Acompanhamento | Fila visual por situação, pesquisa por paciente, prontuário, número da guia, convênio e articulação |
| Conferência | Guia autorizada, guia assinada, execução e documentação conferidas |
| Fluxo enxuto | Novo pedido → na operadora/em análise → autorizado → realizado → pronto → entregue ao faturamento |
| Pendências | Correções aparecem como alerta separado e impedem avanço até serem resolvidas |
| Responsabilidade | O setor de autorizações mantém o controle; recepção e faturamento recebem as relações impressas |
| Histórico | Aplicações agrupadas pelo prontuário, além de ações, datas, perfil e versão de cada atendimento |
| Fechamento mensal | Movimento completo, pendências ou entrega; folhas A4 separadas por convênio com campos de assinatura |
| Relação impressa | Paciente, prontuário, número da guia, médico, articulação, lado, 1ª/2ª/3ª aplicação, data, situação e totais |
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

Sem anexos, importação automática do Racimed ou decisões clínicas automatizadas. Como não existe integração disponível com o Racimed, o primeiro cadastro ainda é manual; número da guia, data da aplicação, pendência, observação e conferência podem ser atualizados depois. Guias entregues permanecem disponíveis para histórico e impressão.

Nenhum dado real foi usado nos testes. A ativação para a clínica exige validar o fluxo e as permissões em um ambiente de homologação.

**Desenvolvido por [Thalys Daychoum](https://github.com/daychoumt)** · JavaScript, interfaces web e automação de processos.
