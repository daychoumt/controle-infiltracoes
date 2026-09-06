import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,emptyChecks,validateFields,validateCaseFields,validDate,jointLabel,attentionState,canReviewCheck} from '../assets/domain.js';
import {DemoStore} from '../assets/store.js';
const fields={prontuario:'AB-102',paciente:'Paciente de teste',convenio:'Particular',medicacao:'',articulacao:'Joelho',lado:'Direito',numeroAplicacao:'1',pedidoRacimed:'RC-1',aplicacao:'1ª aplicação · Joelho direito',numeroGuia:'GUIA-1',pendencia:false,condicaoProcesso:'regular',observacao:'',dataPedido:'2025-12-20',dataAgendamento:'2026-01-01',dataAplicacao:'2026-01-01',data:'2026-01-01',executor:'Dr. Exemplo A',atendente:'Autorizações'};
const all={autorizada:true,assinada:true,execucao:true,documentos:true};
const record=(stage='recebido',checks=emptyChecks())=>({fields,stage,checks,version:1});
const workflowFields={prontuario:'ab-102',paciente:'Paciente de teste',convenio:'Particular',medicacao:'',articulacao:'Joelho',lado:'Direito',numeroAplicacao:'2',pedidoRacimed:'RC-9',condicaoProcesso:'regular',observacao:'',dataPedido:'2025-12-20',dataAplicacao:'2026-01-01',executor:'Dr. Exemplo A',atendente:'Autorizações'};
test('normaliza os campos e rejeita datas inexistentes',()=>{
  assert.equal(validateFields({...fields,paciente:'  Ana  '}).paciente,'Ana');
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
  assert.throws(()=>validateFields({...fields,data:'2026-02-30'}),{status:400});
});
test('estrutura uma guia por articulação e preserva a sequência',()=>{
  const result=validateCaseFields(workflowFields);
  assert.equal(result.prontuario,'AB-102');assert.equal(result.aplicacao,'2ª aplicação · Joelho direito');assert.equal(jointLabel(result),'Joelho · Direito');
  assert.throws(()=>validateCaseFields({...workflowFields,lado:'Bilateral'}),{status:400});
  assert.throws(()=>validateCaseFields({...workflowFields,numeroAplicacao:'4'}),{status:400});
});
test('aceita outra articulação somente quando ela é identificada',()=>{
  assert.equal(validateCaseFields({...workflowFields,articulacao:'Outra articulação',articulacaoOutra:'Sacroilíaca'}).articulacao,'Sacroilíaca');
  assert.throws(()=>validateCaseFields({...workflowFields,articulacao:'Outra articulação',articulacaoOutra:''}),{status:400});
});
test('estrutura a condição do processo e exige detalhes para outra pendência',()=>{
  const pending=validateCaseFields({...workflowFields,condicaoProcesso:'aguardando_ressonancia',observacao:'Paciente enviará por e-mail'});
  assert.equal(pending.pendencia,true);assert.equal(pending.condicaoProcesso,'aguardando_ressonancia');
  assert.equal(validateCaseFields(workflowFields).pendencia,false);
  assert.throws(()=>validateCaseFields({...workflowFields,condicaoProcesso:'outro',observacao:''}),{status:400});
});
test('rejeita campos obrigatórios, enumerações e tamanho inválidos',()=>{
  for(const change of [{paciente:' '},{convenio:'Não existe'},{executor:'Outro'},{medicacao:'Outro'},{aplicacao:'x'.repeat(301)}])assert.throws(()=>validateFields({...fields,...change}),{status:400});
});
test('não registra autorização sem confirmação ou número da guia',()=>{
  assert.throws(()=>transition({...record('solicitado'),fields:{...fields,numeroGuia:''}},{version:1,stage:'autorizado'},'recepcao'),{status:400});
});
test('não permite pular etapas',()=>assert.throws(()=>transition(record('recebido',all),{version:1,stage:'agendado'},'admin'),{status:400}));
test('agendamento usa a data agendada sem exigir a data da realização',()=>{
  const current={...record('autorizado',{...emptyChecks(),autorizada:true}),fields:{...fields,dataAgendamento:'',dataAplicacao:'',data:''}};
  const scheduled=transition(current,{version:1,stage:'agendado',fields:{dataAgendamento:'2026-01-15'}},'recepcao');
  assert.equal(scheduled.stage,'agendado');assert.equal(scheduled.fields.dataAgendamento,'2026-01-15');assert.equal(scheduled.fields.dataAplicacao,'');
});
test('realização ausente ou futura apresenta uma orientação específica',()=>{
  const current={...record('agendado',all),fields:{...fields,dataAplicacao:'',data:''}};
  assert.throws(()=>transition(current,{version:1,stage:'realizado'},'admin'),error=>error.status===400&&/agendamento já está registrado/i.test(error.message));
  assert.throws(()=>transition({...current,fields:{...current.fields,dataAplicacao:'2099-01-01',data:'2099-01-01'}},{version:1,stage:'realizado'},'admin'),error=>error.status===400&&/não pode ser futura/i.test(error.message));
});
test('conferências ficam bloqueadas até a etapa correta',()=>{
  assert.equal(canReviewCheck('autorizada','autorizado'),true);assert.equal(canReviewCheck('execucao','agendado'),false);assert.equal(canReviewCheck('documentos','conferencia'),true);
  const cleaned=transition(record('agendado',all),{version:1},'recepcao');
  assert.deepEqual(cleaned.checks,{autorizada:true,assinada:false,execucao:false,documentos:false});
});
test('todos os documentos são necessários para deixar a guia pronta',()=>{
  for(const missing of Object.keys(all))assert.throws(()=>transition(record('conferencia',{...all,[missing]:false}),{version:1,stage:'pronto_faturamento'},'recepcao'),{status:400});
});
test('uma pendência impede avanço até ser resolvida',()=>{
  const pendingRecord={...record(),fields:{...fields,pendencia:true}};
  assert.throws(()=>transition(pendingRecord,{version:1,stage:'solicitado'},'recepcao'),{status:400});
  assert.equal(transition(pendingRecord,{version:1,fields:{condicaoProcesso:'regular',observacao:'Corrigido'},stage:'solicitado'},'recepcao').stage,'solicitado');
});
test('somente o setor de autorizações ou administrador altera guias',()=>{
  assert.throws(()=>transition(record(),{version:1,checks:all},'faturamento'),{status:403});
  assert.equal(transition(record(),{version:1},'recepcao').version,2);
});
test('versão antiga, checklist inválido e caso encerrado são rejeitados',()=>{
  assert.throws(()=>transition(record(),{version:0},'admin'),{status:409});
  assert.throws(()=>transition(record(),{version:1,checks:{autorizada:'sim'}},'admin'),{status:400});
  assert.throws(()=>transition(record('faturamento',all),{version:1},'admin'),{status:409});
});
test('fluxo completo exige poucos registros do setor e preserva o original',()=>{
  const original=record();let next=transition(original,{version:1,stage:'solicitado'},'recepcao');
  next=transition(next,{version:2,stage:'autorizado'},'recepcao');
  next=transition(next,{version:3,stage:'agendado'},'recepcao');
  next=transition(next,{version:4,stage:'realizado'},'recepcao');
  next=transition(next,{version:5,stage:'conferencia'},'recepcao');
  next=transition(next,{version:6,stage:'pronto_faturamento',checks:all},'recepcao');
  next=transition(next,{version:7,stage:'faturamento',deliveryBatchId:'10000000-0000-4000-8000-000000000099',deliveryReference:'AMOT-202601-TESTE'},'recepcao');
  assert.equal(next.version,8);assert.equal(next.stage,'faturamento');assert.equal(validDate(next.fields.dataFaturamento),true);assert.equal(next.fields.loteReferencia,'AMOT-202601-TESTE');assert.equal(original.version,1);assert.equal(original.checks.autorizada,false);
});
test('prioridade identifica retorno vencido, acompanhamento de hoje e pendência',()=>{
  const base={...record('solicitado'),createdAt:'2026-01-01T10:00:00.000Z',updatedAt:'2026-01-01T10:00:00.000Z',stageChangedAt:'2026-01-01T10:00:00.000Z'};
  assert.equal(attentionState({...base,fields:{...fields,retornoEm:'2026-01-05'}},'2026-01-10').key,'atrasada');
  assert.equal(attentionState({...base,fields:{...fields,retornoEm:'2026-01-10'}},'2026-01-10').key,'hoje');
  assert.equal(attentionState({...base,fields:{...fields,pendencia:true,condicaoProcesso:'falta_carimbo'}},'2026-01-10').key,'pendencia');
});
test('demonstração começa vazia, registra histórico e reinicia sem persistir dados',async()=>{
  const demo=new DemoStore();assert.equal((await demo.list()).items.length,0);
  const item=await demo.create({id:crypto.randomUUID(),fields:workflowFields});
  const updated=await demo.update(item.id,{version:1,stage:'solicitado'});
  assert.equal(updated.events.length,2);assert.match(updated.events.at(-1).action,/operadora/);
  await assert.rejects(()=>new DemoStore().detail(item.id),{status:404});
});
test('demonstração cadastra uma guia e aceita articulação personalizada',async()=>{
  const demo=new DemoStore(),before=(await demo.list()).items.length;
  const created=await demo.create({id:crypto.randomUUID(),fields:{...workflowFields,articulacao:'Outra articulação',articulacaoOutra:'Sacroilíaca'}});
  assert.equal(created.fields.articulacao,'Sacroilíaca');assert.equal(created.stage,'recebido');
  assert.equal((await demo.list()).items.length,before+1);
});
test('cadastro aparece imediatamente na fila e reaproveita o perfil do paciente',async()=>{
  const demo=new DemoStore(),id=crypto.randomUUID();
  await demo.create({id,fields:workflowFields});
  const list=await demo.list(),saved=list.items.find(item=>item.id===id),profile=await demo.patient('AB-102');
  assert.equal(saved.fields.paciente,'Paciente de teste');assert.equal(profile.patient.convenio,'Particular');
});
test('perfil é corrigido em todas as guias, mas só a infiltração escolhida é cancelada',async()=>{
  const demo=new DemoStore();
  await demo.create({id:crypto.randomUUID(),fields:workflowFields});
  await demo.create({id:crypto.randomUUID(),fields:{...workflowFields,articulacao:'Ombro',lado:'Esquerdo',numeroAplicacao:'1',pedidoRacimed:'RC-10'}});
  await demo.updatePatient('AB-102',{paciente:'Ana Corrigida',convenio:'Particular'});
  const corrected=(await demo.list()).items.filter(item=>item.fields.prontuario==='AB-102');
  assert.ok(corrected.every(item=>item.fields.paciente==='Ana Corrigida'&&item.fields.convenio==='Particular'));
  const target=corrected[0],other=corrected[1];
  const changed=await demo.update(target.id,{version:target.version,stage:target.stage,checks:target.checks,fields:{articulacao:'Punho',lado:'Direito',numeroAplicacao:'3',pedidoRacimed:'RC-CORRIGIDO',dataPedido:'2026-01-02',medicacao:'Medicação Exemplo B',executor:'Dra. Exemplo B'}});
  assert.equal(changed.fields.articulacao,'Punho');assert.notEqual((await demo.detail(other.id)).fields.articulacao,'Punho');
  await demo.update(target.id,{version:changed.version,stage:'cancelado',checks:changed.checks,fields:{condicaoProcesso:'cancelado',observacao:'Paciente desistiu deste procedimento'}});
  assert.equal((await demo.detail(target.id)).stage,'cancelado');assert.notEqual((await demo.detail(other.id)).stage,'cancelado');
});
test('lote da demonstração encerra somente guias prontas do mesmo convênio',async()=>{
  const demo=new DemoStore(),created=await demo.create({id:crypto.randomUUID(),fields:{...workflowFields,dataAgendamento:'2026-01-01',dataAplicacao:'2026-01-01'}});let current=created;
  for(const step of [{stage:'solicitado'},{stage:'autorizado',fields:{numeroGuia:'GUIA-LOTE'}},{stage:'agendado'},{stage:'realizado'},{stage:'conferencia'},{stage:'pronto_faturamento',checks:all}])current=await demo.update(current.id,{version:current.version,stage:step.stage,checks:step.checks||current.checks,fields:step.fields});
  const batch=await demo.createBatch({id:crypto.randomUUID(),caseIds:[current.id],competencia:'2026-01',recebidoPor:'Faturamento teste'});
  assert.equal(batch.total,1);assert.equal(batch.items[0].stage,'faturamento');assert.match(batch.reference,/^AMOT-202601-/);assert.equal((await demo.listBatches()).items.length,1);
});
