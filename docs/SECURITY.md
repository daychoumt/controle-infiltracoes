# Segurança operacional do painel

Este documento separa o que o sistema protege tecnicamente do que a clínica precisa organizar antes de cadastrar pacientes reais. O repositório público contém apenas código e exemplos fictícios; dados clínicos, listas reais e credenciais devem permanecer no Worker e no D1 da clínica.

## Controles já implementados

- autenticação validada pelo Firebase em toda requisição;
- lista de UIDs autorizados mantida como segredo no Worker;
- contas sem permissão, desativadas ou com sessão revogada são recusadas;
- tokens e renovação somente na memória da aba, sem cookies ou armazenamento local;
- bloqueio automático após 15 minutos sem atividade;
- respostas sem cache e erros sem SQL, credenciais ou dados do paciente;
- CORS limitado ao domínio clínico e Política de Segurança de Conteúdo no navegador;
- prontuário enviado no corpo da requisição, sem aparecer no endereço ou histórico;
- formulários clínicos com preenchimento automático desativado;
- limite de tamanho para requisições, validação de campos e consultas parametrizadas;
- histórico com usuário, papel, data e ação;
- atualização por versão para impedir que uma pessoa sobrescreva o trabalho de outra;
- restrição única no banco contra processo ativo duplicado;
- criação de lote e movimentação das guias na mesma transação;
- demonstração pública isolada, vazia e sem persistência.

## Checklist antes de pacientes reais

1. Criar projetos separados e de propriedade da clínica no Firebase e na Cloudflare.
2. Criar um banco D1 de homologação e outro de produção; nunca copiar pacientes para homologação.
3. Criar uma conta individual por colaborador e proibir o compartilhamento de senha.
4. Usar senhas longas e únicas e ativar proteção adicional da conta administrativa da Cloudflare, Firebase e GitHub.
5. Liberar no segredo `STAFF_ROLES` somente quem precisa trabalhar no painel.
6. Manter em `ALLOWED_ORIGINS` apenas o domínio oficial HTTPS.
7. Manter médicos, convênios e medicamentos reais exclusivamente em `REFERENCE_DATA`.
8. Executar todo o roteiro de homologação de `BACKEND.md` com dados fictícios.
9. Confirmar que a restauração do D1 funciona e definir uma exportação protegida com retenção maior.
10. Definir por escrito quem inclui usuários, quem os remove, quem restaura backup e quem responde a incidentes.
11. Aprovar com a direção ou encarregado da clínica a finalidade, os campos necessários, a retenção e a impressão dos relatórios.
12. Treinar a equipe para bloquear o computador, não fotografar telas e guardar ou descartar impressões de forma segura.

## Rotina mínima

- **Diariamente:** retirar acesso de quem mudou de função, conferir falhas e manter documentos impressos fora da vista do público.
- **Semanalmente:** revisar a lista de usuários autorizados e testar pendências e entregas com um registro fictício.
- **Mensalmente:** gerar a cópia administrativa definida pela clínica, conferir se pode ser restaurada e registrar o responsável.
- **Após atualização:** repetir o fluxo crítico em homologação antes de publicar em produção.

## Se houver suspeita de acesso indevido

1. Desativar imediatamente a conta no Firebase e remover o UID de `STAFF_ROLES`.
2. Revogar sessões e trocar credenciais administrativas que possam ter sido expostas.
3. Preservar o histórico e os horários; não apagar registros para “limpar” o incidente.
4. Informar a direção e o responsável definido pela clínica para avaliar contenção, titulares e comunicação aplicável.
5. Corrigir a causa primeiro em homologação e documentar a liberação antes de voltar à produção.

## Backup e restauração

O Time Travel do D1 fica ativo automaticamente, mas a janela depende do plano. Ele não substitui uma política própria de retenção. Antes da produção, faça uma restauração controlada em ambiente seguro e mantenha exportações de longo prazo somente em armazenamento criptografado, com acesso restrito e prazo definido pela clínica.

Referências: [guia e checklist de segurança da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte), [Firebase Authentication](https://firebase.google.com/docs/auth/web/start) e [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

Este checklist apoia a implantação técnica, mas não substitui a avaliação jurídica, contratual e de segurança da clínica.
