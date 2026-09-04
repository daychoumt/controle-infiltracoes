export const STAGES = [
  ['autorizacao', 'Em autorização'], ['agendado', 'Agendado'],
  ['realizado', 'Realizado'], ['faturamento', 'No faturamento'], ['concluido', 'Recebido e conferido']
];
export const CHECKS = {
  autorizada: 'Guia autorizada', assinada: 'Guia assinada',
  execucao: 'Execução conferida', documentos: 'Documentação conferida'
};
export const ROLES = {recepcao: 'Recepção', faturamento: 'Faturamento', admin: 'Administrador'};
export const CONVENIOS = ['Bradesco O.P', 'Bradesco Saúde', 'Cabesp', 'CarePlus', 'Cassi', 'CET', 'Economus', 'GEAP', 'Mediservice', 'Metrus', 'NotreDame', 'Omint', 'Particular', 'Petrobrás', 'Seguros Unimed', 'Vivest'];
export const MEDICACOES = ['Diprospan', 'Osteonil', 'Suprahyal', 'Synolis', 'KD Intra-articular'];
export const MEDICOS = ['Dr. Ali', 'Dr. Arthur', 'Dr. Diego', 'Dr. Gustavo', 'Dr. Jorge', 'Dr. Lucas', 'Dr. Lucio', 'Dr. Renato', 'Dr. Victor', 'Dr. Yuri'];
export const ARTICULACOES = ['Joelho', 'Ombro', 'Quadril', 'Tornozelo', 'Cotovelo', 'Punho', 'Mão', 'Pé', 'Outra articulação'];
export const LADOS = ['Direito', 'Esquerdo'];
export const FIELD_LABELS = {paciente:'Paciente', convenio:'Convênio', medicacao:'Medicação', aplicacao:'Detalhes da aplicação', data:'Data da aplicação', executor:'Médico executor', atendente:'Responsável pelo registro'};
export const WORKFLOW_FIELD_LABELS = {
  prontuario:'Prontuário', paciente:'Paciente', convenio:'Convênio', executor:'Médico',
  medicacao:'Medicação', articulacao:'Articulação', lado:'Lado', numeroAplicacao:'Aplicação',
  pedidoRacimed:'Pedido no Racimed', data:'Data da aplicação', atendente:'Responsável'
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
export function validateCaseFields(input) {
  if (!input || typeof input !== 'object') throw problem(400, 'Preencha os dados do atendimento.');
  const articulacaoSelecionada=String(input.articulacao || '').trim();
  const articulacao=articulacaoSelecionada === 'Outra articulação' ? String(input.articulacaoOutra || '').trim() : articulacaoSelecionada;
  const structured={
    prontuario:String(input.prontuario || '').trim().toUpperCase(),
    paciente:String(input.paciente || '').trim(), convenio:String(input.convenio || '').trim(),
    medicacao:String(input.medicacao || '').trim(), executor:String(input.executor || '').trim(),
    articulacao, lado:String(input.lado || '').trim(), numeroAplicacao:String(input.numeroAplicacao || '').trim(),
    pedidoRacimed:String(input.pedidoRacimed || '').trim(), data:String(input.data || '').trim(),
    atendente:String(input.atendente || '').trim()
  };
  if(!/^[A-Z0-9./-]{2,30}$/.test(structured.prontuario)) throw problem(400,'Informe o número do prontuário do Racimed.');
  if(!structured.paciente || structured.paciente.length>120) throw problem(400,'Confira o nome do paciente.');
  if(!CONVENIOS.includes(structured.convenio) || !MEDICOS.includes(structured.executor) || (structured.medicacao && !MEDICACOES.includes(structured.medicacao))) throw problem(400,'Confira convênio, médico e medicação.');
  if(!articulacao || articulacao.length>60 || (articulacaoSelecionada!=='Outra articulação' && !ARTICULACOES.includes(articulacao))) throw problem(400,'Informe a articulação.');
  if(!LADOS.includes(structured.lado)) throw problem(400,'Informe o lado da articulação. Cada lado utiliza sua própria guia.');
  if(!['1','2','3'].includes(structured.numeroAplicacao)) throw problem(400,'Informe se é a 1ª, 2ª ou 3ª aplicação.');
  if(structured.pedidoRacimed.length>60 || structured.atendente.length<2 || structured.atendente.length>120) throw problem(400,'Confira o pedido e o responsável pelo registro.');
  if(!validDate(structured.data)) throw problem(400,'Informe uma data de aplicação válida.');
  structured.aplicacao=`${structured.numeroAplicacao}ª aplicação · ${structured.articulacao} ${structured.lado.toLowerCase()}`;
  return structured;
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
  return record.stage !== 'concluido' && (role === 'admin' || (role === 'recepcao' && record.stage !== 'faturamento'));
}
export function transition(record, input, role) {
  if (!Object.hasOwn(ROLES,role)) throw problem(403,'Acesso não autorizado.');
  if (!input || !Number.isInteger(input.version) || input.version !== record.version) throw problem(409,'Este atendimento foi atualizado. Reabra os detalhes antes de alterar.');
  const target = input.stage || record.stage;
  const advancing = target !== record.stage;
  if (record.stage === 'concluido') throw problem(409,'O recebimento já foi concluído. O histórico está disponível para consulta.');
  if (advancing && nextStage(record.stage) !== target) throw problem(400,'Avance uma etapa de cada vez.');
  if (record.stage === 'faturamento') {
    if (!['admin','faturamento'].includes(role) || !advancing) throw problem(403,'Somente o faturamento pode confirmar o recebimento.');
    if (input.checks && Object.keys(CHECKS).some(key=>input.checks[key] !== record.checks[key])) throw problem(400,'A conferência enviada não pode ser alterada nesta etapa.');
  } else if (!canEdit(record,role)) throw problem(403,'Esta ação é da recepção.');
  const checks = input.checks || record.checks;
  if (!checks || Object.keys(checks).length !== Object.keys(CHECKS).length || Object.keys(CHECKS).some(key=>typeof checks[key] !== 'boolean')) throw problem(400,'Confira a lista de documentos.');
  if (target !== 'autorizacao' && !checks.autorizada) throw problem(400,'Confirme a autorização da guia antes de avançar.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (advancing && target==='realizado' && record.fields.data>today) throw problem(400,'Uma aplicação futura ainda não pode ser marcada como realizada.');
  if (['faturamento','concluido'].includes(target) && Object.values(checks).some(value=>!value)) throw problem(400,'Conclua os quatro itens de conferência antes de enviar ao faturamento.');
  return {...record, checks:{...checks}, stage:target, version:record.version+1};
}
export function eventLabel(previous, updated) {
  if (!previous) return 'Atendimento aberto';
  if (previous.stage !== updated.stage) return updated.stage === 'concluido' ? 'Recebimento confirmado pelo faturamento' : `Etapa alterada: ${STAGES.find(([id])=>id === updated.stage)[1]}`;
  const changed = Object.entries(CHECKS).filter(([key])=>previous.checks[key] !== updated.checks[key]);
  return changed.length ? changed.map(([key,label])=>`${label}: ${updated.checks[key] ? 'sim' : 'não'}`).join(' · ') : 'Conferência revisada';
}
