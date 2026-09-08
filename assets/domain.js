export const STAGES = [
  ['recebido', 'Pedido recebido'], ['solicitado', 'Na operadora / em análise'],
  ['autorizado', 'Autorizado'], ['agendado', 'Agendado'],
  ['realizado', 'Realizado · aguardando guia'], ['conferencia', 'Em conferência'],
  ['pronto_faturamento', 'Pronto para faturamento'], ['faturamento', 'Entregue ao faturamento'],
  ['cancelado', 'Cancelado']
];
export const MACRO_PHASES = [
  {id:'entrada',number:1,label:'Entrada do pedido',hint:'Documentos recebidos',stages:['recebido']},
  {id:'autorizacao',number:2,label:'Autorização',hint:'Operadora e senha',stages:['solicitado','autorizado']},
  {id:'recepcao',number:3,label:'Agendamento e recepção',hint:'Retirada e devolução',stages:['agendado']},
  {id:'procedimento',number:4,label:'Procedimento',hint:'Execução registrada',stages:['realizado']},
  {id:'faturamento',number:5,label:'Conferência e faturamento',hint:'Pronto para entrega',stages:['conferencia','pronto_faturamento','faturamento']}
];
export const STAGE_LIMIT_DAYS = Object.freeze({recebido:1,solicitado:3,autorizado:2,realizado:1,conferencia:1,pronto_faturamento:1});
export const CHECKS = {
  autorizada:'Autorização e senha conferidas',
  validade:'Validade da autorização conferida',
  assinada:'Guia assinada pelo paciente e pelo médico',
  execucao:'Execução, materiais e quantidade conferidos',
  documentos:'Documentos do paciente conferidos',
  compatibilidade:'Pedido, articulação e cobrança compatíveis',
  registroCompleto:'Registro completo para o faturamento'
};
export const CHECK_MIN_STAGE = Object.freeze({
  autorizada:'autorizado', execucao:'realizado', validade:'conferencia',
  assinada:'conferencia', documentos:'conferencia', compatibilidade:'conferencia',
  registroCompleto:'conferencia'
});
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
  ['cancelado','Paciente não realizará este procedimento'],
  ['outro','Outra pendência']
];
export const DOCUMENT_STATUSES = [
  ['nao_aplica','Não se aplica'],
  ['conferido','Conferido'],
  ['pendente','Pendente']
];
export const OPERATOR_STATUSES = [
  ['nao_solicitado','Ainda não solicitado'],
  ['em_analise','Em análise pela operadora'],
  ['pendencia','Pendência da operadora'],
  ['recurso','Recurso em análise'],
  ['negado','Negado definitivamente'],
  ['autorizado','Autorizado']
];
export const RECEPTION_PENDING = [
  ['sem_pendencia','Sem pendência'],
  ['assinatura_paciente','Falta assinatura do paciente'],
  ['assinatura_medico','Falta assinatura do médico'],
  ['carimbo_medico','Falta carimbo médico'],
  ['documento','Documento ou carteirinha pendente'],
  ['divergencia','Divergência encontrada na guia'],
  ['outro','Outra pendência']
];
export const FIELD_LABELS = {paciente:'Paciente', convenio:'Convênio', medicacao:'Medicação', aplicacao:'Detalhes da aplicação', data:'Data da aplicação', executor:'Médico executor', atendente:'Responsável pelo registro'};
export const WORKFLOW_FIELD_LABELS = {
  prontuario:'Prontuário', paciente:'Paciente', convenio:'Convênio', executor:'Médico',
  medicacao:'Medicação', articulacao:'Articulação', lado:'Lado', numeroAplicacao:'Aplicação',
  pedidoRacimed:'Pedido no Racimed', numeroGuia:'Número da guia', dataPedido:'Data do pedido',
  dataSolicitacao:'Solicitado à operadora', dataAutorizacao:'Data da autorização',
  senhaAutorizacao:'Senha da autorização', protocoloOperadora:'Protocolo da operadora',
  validadeAutorizacao:'Validade da autorização', quantidadeAutorizada:'Quantidade autorizada',
  dataAgendamento:'Data agendada', dataAplicacao:'Data da realização',
  dataGuiaRecebida:'Guia recebida pelo setor', dataConferencia:'Conferência concluída',
  dataFaturamento:'Data de envio ao faturamento', retornoEm:'Próximo acompanhamento',
  loteReferencia:'Lote de entrega',
  condicaoProcesso:'Condição do processo', observacao:'Detalhes da pendência', atendente:'Responsável'
};
export const problem = (status, message) => Object.assign(new Error(message), {status});
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function addDays(value,days) {
  const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function validLocalDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [date,time]=value.split('T'),[hour,minute]=time.split(':').map(Number);
  return validDate(date) && hour>=0 && hour<=23 && minute>=0 && minute<=59;
}
export function localDateTime(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get=type=>parts.find(part=>part.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
const checked=value=>value===true || value==='true' || value==='1' || value==='on';
const enumValue=(value,choices,fallback)=>{
  if(!value)return fallback;
  if(!choices.some(([key])=>key===value))throw problem(400,'Escolha uma opção válida para o processo.');
  return value;
};
const quantity=(value,fallback='')=>{
  const normalized=String(value ?? fallback).trim();
  if(!normalized)return '';
  if(!/^\d{1,2}$/.test(normalized) || Number(normalized)<1)throw problem(400,'Informe uma quantidade entre 1 e 99.');
  return normalized;
};
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
    observacao:String(input.observacao || '').trim(),
    pedidoMedicoRecebido:checked(input.pedidoMedicoRecebido),
    carteirinhaRecebida:checked(input.carteirinhaRecebida),
    documentoPacienteRecebido:checked(input.documentoPacienteRecebido),
    cidStatus:enumValue(String(input.cidStatus || ''),DOCUMENT_STATUSES,'nao_aplica'),
    exameStatus:enumValue(String(input.exameStatus || ''),DOCUMENT_STATUSES,'nao_aplica'),
    situacaoOperadora:enumValue(String(input.situacaoOperadora || ''),OPERATOR_STATUSES,'nao_solicitado'),
    senhaAutorizacao:String(input.senhaAutorizacao || '').trim().toUpperCase(),
    protocoloOperadora:String(input.protocoloOperadora || '').trim().toUpperCase(),
    validadeAutorizacao:String(input.validadeAutorizacao || '').trim(),
    autorizacaoSemValidade:checked(input.autorizacaoSemValidade),
    quantidadeSolicitada:quantity(input.quantidadeSolicitada,'1'),
    quantidadeAutorizada:quantity(input.quantidadeAutorizada),
    dataPedido:String(input.dataPedido || '').trim(),
    dataSolicitacao:String(input.dataSolicitacao || '').trim(),
    dataAutorizacao:String(input.dataAutorizacao || '').trim(),
    dataAgendamento:String(input.dataAgendamento || '').trim(),
    dataAplicacao:String(input.dataAplicacao || input.data || '').trim(),
    dataGuiaRecebida:String(input.dataGuiaRecebida || '').trim(),
    dataConferencia:String(input.dataConferencia || '').trim(),
    dataFaturamento:'',
    retornoEm:String(input.retornoEm || '').trim(),
    recepcionista:String(input.recepcionista || '').trim(),
    dataHoraRetiradaRecepcao:String(input.dataHoraRetiradaRecepcao || '').trim(),
    dataHoraRetornoAutorizacao:String(input.dataHoraRetornoAutorizacao || '').trim(),
    pendenciaRecepcao:enumValue(String(input.pendenciaRecepcao || ''),RECEPTION_PENDING,'sem_pendencia'),
    observacaoRecepcao:String(input.observacaoRecepcao || '').trim(),
    quantidadeRealizada:quantity(input.quantidadeRealizada),
    materiaisUtilizados:String(input.materiaisUtilizados || '').trim(),
    loteId:'', loteReferencia:'',
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
  if(structured.pedidoRacimed.length>60 || structured.numeroGuia.length>60 || structured.senhaAutorizacao.length>80 || structured.protocoloOperadora.length>80 || structured.observacao.length>500 || structured.recepcionista.length>120 || structured.observacaoRecepcao.length>300 || structured.materiaisUtilizados.length>500 || structured.atendente.length<2 || structured.atendente.length>120) throw problem(400,'Confira os dados da guia e o responsável pelo registro.');
  if(!validDate(structured.dataPedido)) throw problem(400,'Informe a data em que o pedido foi recebido.');
  for(const [key,label] of [['dataSolicitacao','solicitação'],['dataAutorizacao','autorização'],['dataAgendamento','agendamento'],['dataAplicacao','realização'],['dataGuiaRecebida','recebimento da guia'],['dataConferencia','conferência'],['retornoEm','próximo acompanhamento']]) {
    if(structured[key] && !validDate(structured[key]))throw problem(400,`Informe uma data de ${label} válida.`);
  }
  if(structured.validadeAutorizacao && !validDate(structured.validadeAutorizacao))throw problem(400,'Informe uma validade de autorização válida.');
  if(structured.validadeAutorizacao&&structured.autorizacaoSemValidade)throw problem(400,'Informe a validade ou marque que ela não foi informada, não as duas opções.');
  if(structured.quantidadeRealizada&&structured.quantidadeAutorizada&&Number(structured.quantidadeRealizada)>Number(structured.quantidadeAutorizada))throw problem(400,'A quantidade realizada não pode ser maior que a quantidade autorizada.');
  for(const [key,label] of [['dataHoraRetiradaRecepcao','retirada pela recepção'],['dataHoraRetornoAutorizacao','devolução ao setor de autorizações']])if(structured[key]&&!validLocalDateTime(structured[key]))throw problem(400,`Informe uma data e hora de ${label} válidas.`);
  if(structured.dataHoraRetiradaRecepcao&&!structured.recepcionista)throw problem(400,'Informe qual recepcionista retirou o processo.');
  if(structured.dataHoraRetornoAutorizacao&&!structured.dataHoraRetiradaRecepcao)throw problem(400,'Registre a retirada antes da devolução do processo.');
  if(structured.dataHoraRetornoAutorizacao&&structured.dataHoraRetornoAutorizacao<structured.dataHoraRetiradaRecepcao)throw problem(400,'A devolução não pode acontecer antes da retirada.');
  if(structured.pendenciaRecepcao==='outro'&&!structured.observacaoRecepcao)throw problem(400,'Explique a outra pendência encontrada pela recepção.');
  structured.data=structured.dataAplicacao;
  structured.aplicacao=`${structured.numeroAplicacao}ª aplicação · ${structured.articulacao} ${structured.lado.toLowerCase()}`;
  return structured;
}
export function updateCaseFields(previous,input,references={convenios:CONVENIOS,medicacoes:MEDICACOES,medicos:MEDICOS}) {
  if(!input || typeof input!=='object')throw problem(400,'Confira os dados da guia.');
  const text=(key,upper=false)=>{
    const value=String(input[key] ?? previous[key] ?? '').trim();return upper?value.toUpperCase():value;
  };
  const boolean=key=>Object.hasOwn(input,key)?checked(input[key]):checked(previous[key]);
  const numeroGuia=text('numeroGuia',true),senhaAutorizacao=text('senhaAutorizacao',true),protocoloOperadora=text('protocoloOperadora',true);
  const observacao=text('observacao'),observacaoRecepcao=text('observacaoRecepcao'),materiaisUtilizados=text('materiaisUtilizados');
  const fallback=previous.condicaoProcesso || (previous.pendencia?'outro':'regular');
  const condicaoProcesso=String(input.condicaoProcesso ?? fallback).trim();
  const pendencia=condicaoProcesso!=='regular';
  const dataAplicacao=String(input.dataAplicacao ?? input.data ?? previous.dataAplicacao ?? previous.data ?? '').trim();
  const dataAgendamento=text('dataAgendamento'),retornoEm=text('retornoEm'),dataPedido=text('dataPedido');
  const validadeAutorizacao=text('validadeAutorizacao'),dataHoraRetiradaRecepcao=text('dataHoraRetiradaRecepcao'),dataHoraRetornoAutorizacao=text('dataHoraRetornoAutorizacao');
  const pedidoRacimed=text('pedidoRacimed'),executor=text('executor'),medicacao=text('medicacao'),recepcionista=text('recepcionista');
  const selectedJoint=String(input.articulacao ?? previous.articulacao ?? '').trim();
  const articulacao=selectedJoint==='Outra articulação'?String(input.articulacaoOutra || '').trim():selectedJoint;
  const lado=text('lado'),numeroAplicacao=text('numeroAplicacao');
  const cidStatus=enumValue(text('cidStatus'),DOCUMENT_STATUSES,'nao_aplica');
  const exameStatus=enumValue(text('exameStatus'),DOCUMENT_STATUSES,'nao_aplica');
  const situacaoOperadora=enumValue(text('situacaoOperadora'),OPERATOR_STATUSES,'nao_solicitado');
  const pendenciaRecepcao=enumValue(text('pendenciaRecepcao'),RECEPTION_PENDING,'sem_pendencia');
  const quantidadeSolicitada=quantity(input.quantidadeSolicitada ?? previous.quantidadeSolicitada,'1');
  const quantidadeAutorizada=quantity(input.quantidadeAutorizada ?? previous.quantidadeAutorizada);
  const quantidadeRealizada=quantity(input.quantidadeRealizada ?? previous.quantidadeRealizada);
  const pedidoMedicoRecebido=boolean('pedidoMedicoRecebido'),carteirinhaRecebida=boolean('carteirinhaRecebida'),documentoPacienteRecebido=boolean('documentoPacienteRecebido'),autorizacaoSemValidade=boolean('autorizacaoSemValidade');
  if(numeroGuia.length>60 || senhaAutorizacao.length>80 || protocoloOperadora.length>80)throw problem(400,'Confira o número da guia, a senha e o protocolo da operadora.');
  if(!PROCESS_CONDITIONS.some(([key])=>key===condicaoProcesso))throw problem(400,'Informe a condição atual do processo.');
  if(condicaoProcesso==='outro' && !observacao)throw problem(400,'Explique a outra pendência no campo de detalhes.');
  if(observacao.length>500 || observacaoRecepcao.length>300 || materiaisUtilizados.length>500)throw problem(400,'Um dos campos de observação ultrapassou o limite permitido.');
  if(dataAplicacao && !validDate(dataAplicacao))throw problem(400,'Informe uma data de realização válida.');
  if(dataAgendamento && !validDate(dataAgendamento))throw problem(400,'Informe uma data de agendamento válida.');
  if(retornoEm && !validDate(retornoEm))throw problem(400,'Informe uma data de acompanhamento válida.');
  if(validadeAutorizacao && !validDate(validadeAutorizacao))throw problem(400,'Informe uma validade de autorização válida.');
  if(validadeAutorizacao&&autorizacaoSemValidade)throw problem(400,'Informe a validade ou marque que ela não foi informada, não as duas opções.');
  if(quantidadeRealizada&&quantidadeAutorizada&&Number(quantidadeRealizada)>Number(quantidadeAutorizada))throw problem(400,'A quantidade realizada não pode ser maior que a quantidade autorizada.');
  if(dataHoraRetiradaRecepcao&&!validLocalDateTime(dataHoraRetiradaRecepcao))throw problem(400,'Informe uma data e hora de retirada válidas.');
  if(dataHoraRetornoAutorizacao&&!validLocalDateTime(dataHoraRetornoAutorizacao))throw problem(400,'Informe uma data e hora de devolução válidas.');
  if(dataHoraRetiradaRecepcao&&!recepcionista)throw problem(400,'Informe qual recepcionista retirou o processo.');
  if(dataHoraRetornoAutorizacao&&!dataHoraRetiradaRecepcao)throw problem(400,'Registre a retirada antes da devolução do processo.');
  if(dataHoraRetornoAutorizacao&&dataHoraRetornoAutorizacao<dataHoraRetiradaRecepcao)throw problem(400,'A devolução não pode acontecer antes da retirada.');
  if(pendenciaRecepcao==='outro'&&!observacaoRecepcao)throw problem(400,'Explique a outra pendência encontrada pela recepção.');
  if(!validDate(dataPedido))throw problem(400,'Informe a data do pedido.');
  if(pedidoRacimed.length>60 || !references.medicos?.includes(executor) || (medicacao && !references.medicacoes?.includes(medicacao)))throw problem(400,'Confira o pedido, o médico e a medicação.');
  if(!articulacao || articulacao.length>60 || (selectedJoint!=='Outra articulação'&&!ARTICULACOES.includes(articulacao)))throw problem(400,'Confira a articulação.');
  if(!LADOS.includes(lado) || !['1','2','3'].includes(numeroAplicacao))throw problem(400,'Confira o lado e a aplicação.');
  const aplicacao=`${numeroAplicacao}ª aplicação · ${articulacao} ${lado.toLowerCase()}`;
  return {...previous,numeroGuia,senhaAutorizacao,protocoloOperadora,validadeAutorizacao,autorizacaoSemValidade,quantidadeSolicitada,quantidadeAutorizada,
    pedidoMedicoRecebido,carteirinhaRecebida,documentoPacienteRecebido,cidStatus,exameStatus,situacaoOperadora,
    condicaoProcesso,observacao,pendencia,dataPedido,dataAgendamento,dataAplicacao,data:dataAplicacao,retornoEm,
    recepcionista,dataHoraRetiradaRecepcao,dataHoraRetornoAutorizacao,pendenciaRecepcao,observacaoRecepcao,
    quantidadeRealizada,materiaisUtilizados,pedidoRacimed,executor,medicacao,articulacao,lado,numeroAplicacao,aplicacao};
}
export function processLabel(fields) {
  const key=fields.condicaoProcesso || (fields.pendencia?'outro':'regular');
  return PROCESS_CONDITIONS.find(([value])=>value===key)?.[1] || 'Condição não informada';
}
export function optionLabel(options,value,fallback='Não informado') {
  return options.find(([key])=>key===value)?.[1] || fallback;
}
export function operatorLabel(fields) {return optionLabel(OPERATOR_STATUSES,fields.situacaoOperadora,'Ainda não solicitado');}
export function receptionLabel(fields) {return optionLabel(RECEPTION_PENDING,fields.pendenciaRecepcao,'Sem pendência');}
export function applicationLabel(fields) {
  return fields.numeroAplicacao ? `${fields.numeroAplicacao}ª aplicação` : 'Aplicação';
}
export function jointLabel(fields) {
  return [fields.articulacao,fields.lado].filter(Boolean).join(' · ') || fields.aplicacao || 'Articulação não informada';
}
export function emptyChecks() { return Object.fromEntries(Object.keys(CHECKS).map(k=>[k,false])); }
export function normalizeChecks(checks={}) {return Object.fromEntries(Object.keys(CHECKS).map(key=>[key,Boolean(checks?.[key])]))}
export function pending(record) { const checks=normalizeChecks(record.checks);return Object.keys(CHECKS).filter(key=>!checks[key]); }
export function macroPhase(stage) {return MACRO_PHASES.find(phase=>phase.stages.includes(stage)) || null;}
export function hasOperationalPending(record) {
  const fields=record.fields || {};
  return Boolean(fields.pendencia || ['pendencia','recurso','negado'].includes(fields.situacaoOperadora) || (fields.pendenciaRecepcao && fields.pendenciaRecepcao!=='sem_pendencia'));
}
export function nextStage(stage) {
  const flow=STAGES.filter(([id])=>id!=='cancelado');
  const index=flow.findIndex(([id])=>id===stage);
  return index<0?null:flow[index+1]?.[0] || null;
}
export function canReviewCheck(key,stage) {
  const flow=STAGES.filter(([id])=>id!=='cancelado').map(([id])=>id);
  const current=flow.indexOf(stage),minimum=flow.indexOf(CHECK_MIN_STAGE[key]);
  return current>=0 && minimum>=0 && current>=minimum;
}
export function canEdit(record, role) {
  return !['faturamento','cancelado'].includes(record.stage) && ['admin','recepcao'].includes(role);
}
export function daysInStage(record,today=localDate()) {
  const start=(record.stageChangedAt || record.updatedAt || record.createdAt || '').slice(0,10);
  if(!validDate(start))return 0;
  return Math.max(0,Math.floor((new Date(`${today}T12:00:00Z`)-new Date(`${start}T12:00:00Z`))/86400000));
}
export function attentionState(record,today=localDate()) {
  if(['faturamento','cancelado'].includes(record.stage))return {key:'encerrado',label:'Encerrado',days:0};
  if(record.fields.pendencia)return {key:'pendencia',label:processLabel(record.fields),days:daysInStage(record,today)};
  if(['pendencia','recurso','negado'].includes(record.fields.situacaoOperadora))return {key:'pendencia',label:operatorLabel(record.fields),days:daysInStage(record,today)};
  if(record.fields.pendenciaRecepcao&&record.fields.pendenciaRecepcao!=='sem_pendencia')return {key:'pendencia',label:receptionLabel(record.fields),days:daysInStage(record,today)};
  if(record.fields.validadeAutorizacao&&['autorizado','agendado'].includes(record.stage)&&record.fields.validadeAutorizacao<today)return {key:'pendencia',label:'Autorização vencida',days:daysInStage(record,today)};
  const reference=record.fields.retornoEm || (record.stage==='agendado'?record.fields.dataAgendamento:'');
  if(reference && reference<today)return {key:'atrasada',label:`Atrasada há ${Math.max(1,Math.floor((new Date(`${today}T12:00:00Z`)-new Date(`${reference}T12:00:00Z`))/86400000))} dia(s)`,days:daysInStage(record,today)};
  if(reference===today)return {key:'hoje',label:'Acompanhar hoje',days:daysInStage(record,today)};
  const days=daysInStage(record,today),limit=STAGE_LIMIT_DAYS[record.stage];
  if(limit && days>=limit)return {key:'atrasada',label:`Sem avanço há ${days} dia(s)`,days};
  return {key:'regular',label:reference?`Próxima ação em ${reference.split('-').reverse().join('/')}`:'Dentro do fluxo',days};
}
export function nextActionLabel(stage) {
  return ({recebido:'Enviar à operadora',solicitado:'Registrar autorização',autorizado:'Registrar agendamento',agendado:'Registrar realização',realizado:'Receber guia assinada',conferencia:'Concluir conferência',pronto_faturamento:'Adicionar ao lote de entrega'})[stage] || 'Consultar histórico';
}
export function transition(record, input, role, references) {
  if (!Object.hasOwn(ROLES,role)) throw problem(403,'Acesso não autorizado.');
  if (!input || !Number.isInteger(input.version) || input.version !== record.version) throw problem(409,'Este atendimento foi atualizado. Reabra os detalhes antes de alterar.');
  const target = input.stage || record.stage;
  const advancing = target !== record.stage;
  if (['faturamento','cancelado'].includes(record.stage)) throw problem(409,'Este processo já foi encerrado. O histórico está disponível para consulta.');
  if (advancing && target!=='cancelado' && nextStage(record.stage) !== target) throw problem(400,'Avance uma etapa de cada vez.');
  if (!canEdit(record,role)) throw problem(403,'Esta ação é do setor de autorizações.');
  const rawChecks=input.checks || record.checks;
  if(!rawChecks || typeof rawChecks!=='object' || Object.entries(rawChecks).some(([key,value])=>!Object.hasOwn(CHECKS,key)||typeof value!=='boolean'))throw problem(400,'Confira a lista de documentos.');
  const checks=normalizeChecks(rawChecks);
  const fields = input.fields ? updateCaseFields(record.fields,input.fields,references) : {...record.fields};
  if(target==='cancelado') {
    if(!fields.observacao)throw problem(400,'Informe o motivo do cancelamento deste procedimento.');
    fields.condicaoProcesso='cancelado';fields.pendencia=false;
    return {...record,fields,checks:{...checks},stage:target,version:record.version+1};
  }
  if (advancing && fields.pendencia) throw problem(400,'Resolva a pendência antes de avançar esta guia.');
  const today=localDate();
  if(advancing&&target==='solicitado'){
    const missing=[['pedidoMedicoRecebido','pedido médico'],['carteirinhaRecebida','carteirinha'],['documentoPacienteRecebido','documento do paciente']].filter(([key])=>!fields[key]).map(([,label])=>label);
    if(missing.length)throw problem(400,`Antes de solicitar, confirme: ${missing.join(', ')}.`);
    if(fields.cidStatus==='pendente'||fields.exameStatus==='pendente')throw problem(400,'Resolva o CID ou o exame marcado como pendente antes de enviar à operadora.');
    fields.dataSolicitacao=fields.dataSolicitacao||today;fields.retornoEm=fields.retornoEm||addDays(today,3);fields.situacaoOperadora='em_analise';
  }
  if(advancing&&target==='autorizado'){
    if(!fields.numeroGuia)throw problem(400,'Informe o número da guia autorizada antes de avançar.');
    if(!fields.senhaAutorizacao&&!fields.protocoloOperadora)throw problem(400,'Informe a senha de autorização ou o protocolo fornecido pela operadora.');
    if(!fields.validadeAutorizacao&&!fields.autorizacaoSemValidade)throw problem(400,'Informe a validade ou marque que a operadora não informou uma validade.');
    if(fields.validadeAutorizacao<today&&!fields.autorizacaoSemValidade)throw problem(400,'A autorização informada já está vencida. Confira a validade antes de avançar.');
    if(!fields.quantidadeAutorizada)throw problem(400,'Informe a quantidade autorizada.');
    checks.autorizada=true;fields.dataAutorizacao=fields.dataAutorizacao||today;fields.retornoEm='';fields.situacaoOperadora='autorizado';
  }
  if (['autorizado','agendado','realizado','conferencia','pronto_faturamento','faturamento'].includes(target) && !checks.autorizada) throw problem(400,'Confirme a autorização da guia antes de avançar.');
  if (['autorizado','agendado','realizado','conferencia','pronto_faturamento','faturamento'].includes(target) && !fields.numeroGuia) throw problem(400,'Informe o número da guia autorizada antes de avançar.');
  if(advancing&&target==='agendado'&&!fields.dataAgendamento)throw problem(400,'Informe a data agendada antes de confirmar o agendamento.');
  if(advancing&&target==='agendado'&&fields.dataAgendamento<fields.dataPedido)throw problem(400,'A data agendada não pode ser anterior à data do pedido.');
  if(advancing&&target==='agendado'&&fields.validadeAutorizacao&&fields.dataAgendamento>fields.validadeAutorizacao)throw problem(400,'A data agendada ultrapassa a validade da autorização. Regularize a senha antes de confirmar.');
  const dataAplicacao=fields.dataAplicacao || fields.data || '';
  if(advancing&&target==='realizado'&&!dataAplicacao)throw problem(400,'O agendamento já está registrado. Informe a data em que a infiltração realmente aconteceu.');
  if(advancing&&target==='realizado'&&dataAplicacao>today)throw problem(400,'A data da realização não pode ser futura. Mantenha a guia como agendada até o procedimento acontecer.');
  if(advancing&&target==='realizado'&&dataAplicacao<fields.dataPedido)throw problem(400,'A data da realização não pode ser anterior à data do pedido.');
  if(advancing&&target==='realizado'&&(!fields.recepcionista||!fields.dataHoraRetiradaRecepcao))throw problem(400,'Registre quem retirou o processo na recepção e a data e hora da retirada.');
  if(advancing&&target==='realizado')fields.quantidadeRealizada=fields.quantidadeRealizada||fields.quantidadeAutorizada||'1';
  if(advancing&&target==='conferencia'){
    fields.dataHoraRetornoAutorizacao=fields.dataHoraRetornoAutorizacao||localDateTime();
    fields.dataGuiaRecebida=fields.dataGuiaRecebida||today;
  }
  for(const key of Object.keys(CHECKS))if(!canReviewCheck(key,target))checks[key]=false;
  if(advancing&&target==='pronto_faturamento'&&fields.pendenciaRecepcao!=='sem_pendencia')throw problem(400,'Resolva a pendência registrada pela recepção antes de liberar a guia.');
  if (['pronto_faturamento','faturamento'].includes(target) && Object.values(checks).some(value=>!value)) throw problem(400,'Conclua todos os itens da conferência final antes de deixar a guia pronta para o faturamento.');
  if(advancing&&target==='pronto_faturamento')fields.dataConferencia=fields.dataConferencia||today;
  if(advancing && target==='faturamento'){
    if(!input.deliveryBatchId || !input.deliveryReference)throw problem(400,'Entregue esta guia por um lote de faturamento.');
    fields.dataFaturamento=today;fields.loteId=input.deliveryBatchId;fields.loteReferencia=input.deliveryReference;
  }
  return {...record,fields,checks:{...checks}, stage:target, version:record.version+1};
}
export function eventLabel(previous, updated) {
  if (!previous) return 'Atendimento aberto';
  if (previous.stage !== updated.stage) return updated.stage === 'faturamento' ? 'Guia entregue ao faturamento' : `Etapa alterada: ${STAGES.find(([id])=>id === updated.stage)[1]}`;
  if(previous.fields.dataHoraRetiradaRecepcao!==updated.fields.dataHoraRetiradaRecepcao&&updated.fields.dataHoraRetiradaRecepcao)return `Processo retirado pela recepção · ${updated.fields.recepcionista}`;
  if(previous.fields.dataHoraRetornoAutorizacao!==updated.fields.dataHoraRetornoAutorizacao&&updated.fields.dataHoraRetornoAutorizacao)return 'Processo devolvido ao setor de autorizações';
  if(previous.fields.situacaoOperadora!==updated.fields.situacaoOperadora)return `Operadora: ${operatorLabel(updated.fields)}`;
  if (JSON.stringify(previous.fields)!==JSON.stringify(updated.fields)) return 'Dados de acompanhamento da guia atualizados';
  const changed = Object.entries(CHECKS).filter(([key])=>previous.checks[key] !== updated.checks[key]);
  return changed.length ? changed.map(([key,label])=>`${label}: ${updated.checks[key] ? 'sim' : 'não'}`).join(' · ') : 'Conferência revisada';
}
