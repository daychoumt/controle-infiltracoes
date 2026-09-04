export const STAGES = [
  ['recebido', 'Novo pedido'], ['solicitado', 'Na operadora / em análise'],
  ['agendado', 'Autorizado'], ['realizado', 'Realizado'],
  ['conferencia', 'Pronto para faturamento'], ['faturamento', 'Entregue ao faturamento']
];
export const CHECKS = {
  autorizada: 'Guia autorizada', assinada: 'Guia assinada',
  execucao: 'Execução conferida', documentos: 'Documentação conferida'
};
export const ROLES = {recepcao:'Setor de Autorizações',admin:'Administrador'};
// Somente exemplos fictícios ficam no frontend público. Em produção, as listas
// reais são carregadas do backend depois do login.
export const CONVENIOS = ['Convênio Exemplo A', 'Convênio Exemplo B', 'Particular'];
export const MEDICACOES = ['Medicação Exemplo A', 'Medicação Exemplo B'];
export const MEDICOS = ['Dr. Exemplo A', 'Dra. Exemplo B'];
export const ARTICULACOES = ['Joelho', 'Ombro', 'Quadril', 'Tornozelo', 'Cotovelo', 'Punho', 'Mão', 'Pé', 'Outra articulação'];
export const LADOS = ['Direito', 'Esquerdo'];
export const PROCESS_CONDITIONS = [
  ['regular','Sem pendência'],
  ['pedido_correcao','Pedido médico precisa de correção'],
  ['aguardando_ressonancia','Aguardando envio da ressonância'],
  ['falta_carimbo','Falta carimbo ou assinatura'],
  ['aguardando_laudo','Aguardando relatório ou laudo'],
  ['divergencia_dados','Dados do processo estão divergentes'],
  ['outro','Outra pendência']
];
export const FIELD_LABELS = {paciente:'Paciente', convenio:'Convênio', medicacao:'Medicação', aplicacao:'Detalhes da aplicação', data:'Data da aplicação', executor:'Médico executor', atendente:'Responsável pelo registro'};
export const WORKFLOW_FIELD_LABELS = {
  prontuario:'Prontuário', paciente:'Paciente', convenio:'Convênio', executor:'Médico',
  medicacao:'Medicação', articulacao:'Articulação', lado:'Lado', numeroAplicacao:'Aplicação',
  pedidoRacimed:'Pedido no Racimed', numeroGuia:'Número da guia', data:'Data da aplicação',
  condicaoProcesso:'Condição do processo', observacao:'Detalhes da pendência', atendente:'Responsável'
};
export const problem = (status, message) => Object.assign(new Error(message), {status});
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function validateFields(input) {
  if (!input || typeof input !== 'object') throw problem(400, 'Preencha os dados do atendimento.');
  const out = {};
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const limit = key === 'aplicacao' ? 300 : 120;
    if (typeof input[key] !== 'string' || input[key].trim().length > limit || (key !== 'medicacao' && !input[key].trim())) {
      throw problem(400, `Confira o campo ${label.toLowerCase()}.`);
    }
    out[key] = input[key].trim();
  }
  if (!validDate(out.data)) throw problem(400, 'Informe uma data válida.');
  if (!CONVENIOS.includes(out.convenio) || !MEDICOS.includes(out.executor) || (out.medicacao && !MEDICACOES.includes(out.medicacao))) {
    throw problem(400, 'Escolha as opções disponíveis de convênio, medicação e médico.');
  }
  return out;
}
export function validateCaseFields(input,references={convenios:CONVENIOS,medicacoes:MEDICACOES,medicos:MEDICOS}) {
  if (!input || typeof input !== 'object') throw problem(400, 'Preencha os dados do atendimento.');
  const articulacaoSelecionada=String(input.articulacao || '').trim();
  const articulacao=articulacaoSelecionada === 'Outra articulação' ? String(input.articulacaoOutra || '').trim() : articulacaoSelecionada;
  const structured={
    prontuario:String(input.prontuario || '').trim().toUpperCase(),
    paciente:String(input.paciente || '').trim(), convenio:String(input.convenio || '').trim(),
    medicacao:String(input.medicacao || '').trim(), executor:String(input.executor || '').trim(),
    articulacao, lado:String(input.lado || '').trim(), numeroAplicacao:String(input.numeroAplicacao || '').trim(),
    pedidoRacimed:String(input.pedidoRacimed || '').trim(), numeroGuia:String(input.numeroGuia || '').trim().toUpperCase(),
    condicaoProcesso:String(input.condicaoProcesso || (input.pendencia?'outro':'regular')).trim(),
    observacao:String(input.observacao || '').trim(), data:String(input.data || '').trim(),
    atendente:String(input.atendente || '').trim()
  };
  if(!/^[A-Z0-9./-]{2,30}$/.test(structured.prontuario)) throw problem(400,'Informe o número do prontuário do Racimed.');
  if(!structured.paciente || structured.paciente.length>120) throw problem(400,'Confira o nome do paciente.');
  if(!references.convenios?.includes(structured.convenio) || !references.medicos?.includes(structured.executor) || (structured.medicacao && !references.medicacoes?.includes(structured.medicacao))) throw problem(400,'Confira convênio, médico e medicação.');
  if(!articulacao || articulacao.length>60 || (articulacaoSelecionada!=='Outra articulação' && !ARTICULACOES.includes(articulacao))) throw problem(400,'Informe a articulação.');
  if(!LADOS.includes(structured.lado)) throw problem(400,'Informe o lado da articulação. Cada lado utiliza sua própria guia.');
  if(!['1','2','3'].includes(structured.numeroAplicacao)) throw problem(400,'Informe se é a 1ª, 2ª ou 3ª aplicação.');
  if(!PROCESS_CONDITIONS.some(([key])=>key===structured.condicaoProcesso)) throw problem(400,'Informe a condição atual do processo.');
  structured.pendencia=structured.condicaoProcesso!=='regular';
  if(structured.condicaoProcesso==='outro' && !structured.observacao) throw problem(400,'Explique a outra pendência no campo de detalhes.');
  if(structured.pedidoRacimed.length>60 || structured.numeroGuia.length>60 || structured.observacao.length>500 || structured.atendente.length<2 || structured.atendente.length>120) throw problem(400,'Confira os dados da guia e o responsável pelo registro.');
  if(structured.data && !validDate(structured.data)) throw problem(400,'Informe uma data de aplicação válida.');
  structured.aplicacao=`${structured.numeroAplicacao}ª aplicação · ${structured.articulacao} ${structured.lado.toLowerCase()}`;
  return structured;
}
export function updateCaseFields(previous,input) {
  if(!input || typeof input!=='object')throw problem(400,'Confira os dados da guia.');
  const numeroGuia=String(input.numeroGuia ?? previous.numeroGuia ?? '').trim().toUpperCase();
  const observacao=String(input.observacao ?? previous.observacao ?? '').trim();
  const fallback=previous.condicaoProcesso || (previous.pendencia?'outro':'regular');
  const condicaoProcesso=String(input.condicaoProcesso ?? fallback).trim();
  const pendencia=condicaoProcesso!=='regular';
  const data=String(input.data ?? previous.data ?? '').trim();
  if(numeroGuia.length>60)throw problem(400,'O número da guia está muito longo.');
  if(!PROCESS_CONDITIONS.some(([key])=>key===condicaoProcesso))throw problem(400,'Informe a condição atual do processo.');
  if(condicaoProcesso==='outro' && !observacao)throw problem(400,'Explique a outra pendência no campo de detalhes.');
  if(observacao.length>500)throw problem(400,'Os detalhes devem ter no máximo 500 caracteres.');
  if(data && !validDate(data))throw problem(400,'Informe uma data de aplicação válida.');
  return {...previous,numeroGuia,condicaoProcesso,observacao,pendencia,data};
}
export function processLabel(fields) {
  const key=fields.condicaoProcesso || (fields.pendencia?'outro':'regular');
  return PROCESS_CONDITIONS.find(([value])=>value===key)?.[1] || 'Condição não informada';
}
export function applicationLabel(fields) {
  return fields.numeroAplicacao ? `${fields.numeroAplicacao}ª aplicação` : 'Aplicação';
}
export function jointLabel(fields) {
  return [fields.articulacao,fields.lado].filter(Boolean).join(' · ') || fields.aplicacao || 'Articulação não informada';
}
export function emptyChecks() { return Object.fromEntries(Object.keys(CHECKS).map(k=>[k,false])); }
export function pending(record) { return Object.keys(CHECKS).filter(key=>!record.checks[key]); }
export function nextStage(stage) { return STAGES[STAGES.findIndex(([id])=>id === stage)+1]?.[0] || null; }
export function canEdit(record, role) {
  return record.stage !== 'faturamento' && ['admin','recepcao'].includes(role);
}
export function transition(record, input, role) {
  if (!Object.hasOwn(ROLES,role)) throw problem(403,'Acesso não autorizado.');
  if (!input || !Number.isInteger(input.version) || input.version !== record.version) throw problem(409,'Este atendimento foi atualizado. Reabra os detalhes antes de alterar.');
  const target = input.stage || record.stage;
  const advancing = target !== record.stage;
  if (record.stage === 'faturamento') throw problem(409,'A guia já foi entregue ao faturamento. O histórico está disponível para consulta.');
  if (advancing && nextStage(record.stage) !== target) throw problem(400,'Avance uma etapa de cada vez.');
  if (!canEdit(record,role)) throw problem(403,'Esta ação é do setor de autorizações.');
  const checks = input.checks || record.checks;
  const fields = input.fields ? updateCaseFields(record.fields,input.fields) : {...record.fields};
  if (!checks || Object.keys(checks).length !== Object.keys(CHECKS).length || Object.keys(CHECKS).some(key=>typeof checks[key] !== 'boolean')) throw problem(400,'Confira a lista de documentos.');
  if (advancing && fields.pendencia) throw problem(400,'Resolva a pendência antes de avançar esta guia.');
  if (['agendado','realizado','conferencia','faturamento'].includes(target) && !checks.autorizada) throw problem(400,'Confirme a autorização da guia antes de avançar.');
  if (['agendado','realizado','conferencia','faturamento'].includes(target) && !fields.numeroGuia) throw problem(400,'Informe o número da guia autorizada antes de avançar.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (advancing && target==='realizado' && (!fields.data || fields.data>today)) throw problem(400,'Informe a data da aplicação antes de marcar como realizada.');
  if (['conferencia','faturamento'].includes(target) && Object.values(checks).some(value=>!value)) throw problem(400,'Conclua os quatro itens de conferência antes de deixar a guia pronta para o faturamento.');
  return {...record,fields,checks:{...checks}, stage:target, version:record.version+1};
}
export function eventLabel(previous, updated) {
  if (!previous) return 'Atendimento aberto';
  if (previous.stage !== updated.stage) return updated.stage === 'faturamento' ? 'Guia entregue ao faturamento' : `Etapa alterada: ${STAGES.find(([id])=>id === updated.stage)[1]}`;
  if (JSON.stringify(previous.fields)!==JSON.stringify(updated.fields)) return 'Dados de acompanhamento da guia atualizados';
  const changed = Object.entries(CHECKS).filter(([key])=>previous.checks[key] !== updated.checks[key]);
  return changed.length ? changed.map(([key,label])=>`${label}: ${updated.checks[key] ? 'sim' : 'não'}`).join(' · ') : 'Conferência revisada';
}
