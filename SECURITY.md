# Política de Segurança

Este repositório contém o código de um sistema interno de apoio a processos administrativos de uma clínica.

## Dados sensíveis

- Nunca adicione dados reais de pacientes, prontuários, guias, documentos ou informações de convênios ao repositório.
- Utilize somente dados fictícios em testes, exemplos, imagens e documentação.
- Credenciais, tokens, chaves privadas, variáveis de ambiente e arquivos de configuração de produção não devem ser versionados.
- Segredos de produção devem permanecer nos provedores de infraestrutura, como Cloudflare e Firebase, usando os mecanismos próprios de secrets/variáveis protegidas.

## Controle de acesso

O acesso aos dados de produção deve depender de autenticação e autorização no backend. A visibilidade do código-fonte não substitui controles de acesso à aplicação e ao banco de dados.

## Antes de publicar alterações

1. Execute os testes do projeto.
2. Confirme que não existem dados reais de pacientes em código, testes, imagens ou documentação.
3. Revise o `git diff` em busca de chaves, tokens, URLs administrativas e dados internos.
4. Não publique arquivos `.env`, `.dev.vars`, `wrangler.jsonc`, bancos locais, chaves privadas ou credenciais de contas de serviço.

## Em caso de exposição de uma credencial

Remover a credencial do commit mais recente não é suficiente. Revogue ou rotacione a credencial no provedor correspondente e, quando necessário, remova o segredo do histórico Git.

## Vulnerabilidades

Falhas de segurança não devem ser descritas publicamente em issues contendo detalhes exploráveis, credenciais ou dados sensíveis. Corrija e valide o problema antes de documentar publicamente qualquer detalhe técnico que aumente o risco do ambiente de produção.
