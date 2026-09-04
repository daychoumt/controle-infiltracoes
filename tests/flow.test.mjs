import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,emptyChecks,validateFields,validateCaseFields,validDate,jointLabel} from '../assets/domain.js';
import {DemoStore} from '../assets/store.js';
const fields={paciente:'Paciente de teste',convenio:'Particular',medicacao:'',aplicacao:'Procedimento de teste',numeroGuia:'GUIA-1',pendencia:false,observacao:'',data:'2026-01-01',executor:'Dr. Arthur',atendente:'Autorizações'};
const all={autorizada:true,assinada:true,execucao:true,documentos:true};
const record=(stage='recebido',checks=emptyChecks())=>({fields,stage,checks,version:1});
const workflowFields={prontuario:'ab-102',paciente:'Paciente de teste',convenio:'Particular',medicacao:'',articulacao:'Joelho',lado:'Direito',numeroAplicacao:'2',pedidoRacimed:'RC-9',data:'2026-01-01',executor:'Dr. Arthur',atendente:'Recepção'};
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
test('rejeita campos obrigatórios, enumerações e tamanho inválidos',()=>{
  for(const change of [{paciente:' '},{convenio:'Não existe'},{executor:'Outro'},{medicacao:'Outro'},{aplicacao:'x'.repeat(301)}])assert.throws(()=>validateFields({...fields,...change}),{status:400});
});
test('não registra autorização sem confirmação ou número da guia',()=>{
  assert.throws(()=>transition(record('solicitado'),{version:1,stage:'agendado'},'recepcao'),{status:400});
  assert.throws(()=>transition({...record('solicitado',{...emptyChecks(),autorizada:true}),fields:{...fields,numeroGuia:''}},{version:1,stage:'agendado'},'recepcao'),{status:400});
});
test('não permite pular etapas',()=>assert.throws(()=>transition(record('recebido',all),{version:1,stage:'agendado'},'admin'),{status:400}));
test('aplicação futura não pode ser marcada como realizada',()=>assert.throws(()=>transition({...record('agendado',all),fields:{...fields,data:'2099-01-01'}},{version:1,stage:'realizado'},'admin'),{status:400}));
test('todos os documentos são necessários para deixar a guia pronta',()=>{
  for(const missing of Object.keys(all))assert.throws(()=>transition(record('realizado',{...all,[missing]:false}),{version:1,stage:'conferencia'},'recepcao'),{status:400});
});
test('uma pendência impede avanço até ser resolvida',()=>{
  const pendingRecord={...record(),fields:{...fields,pendencia:true}};
  assert.throws(()=>transition(pendingRecord,{version:1,stage:'solicitado'},'recepcao'),{status:400});
  assert.equal(transition(pendingRecord,{version:1,fields:{pendencia:false,observacao:'Corrigido'},stage:'solicitado'},'recepcao').stage,'solicitado');
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
  next=transition(next,{version:2,stage:'agendado',checks:{...emptyChecks(),autorizada:true}},'recepcao');
  next=transition(next,{version:3,stage:'realizado'},'recepcao');
  next=transition(next,{version:4,stage:'conferencia',checks:all},'recepcao');
  next=transition(next,{version:5,stage:'faturamento'},'recepcao');
  assert.equal(next.version,6);assert.equal(next.stage,'faturamento');assert.equal(original.version,1);assert.equal(original.checks.autorizada,false);
});
test('demonstração registra histórico e reinicia sem persistir dados',async()=>{
  const demo=new DemoStore(),item=(await demo.list()).items.find(r=>r.stage==='conferencia');
  const updated=await demo.update(item.id,{version:1,stage:'faturamento'});
  assert.equal(updated.events.length,2);assert.match(updated.events.at(-1).action,/faturamento/);
  assert.equal((await new DemoStore().detail(item.id)).stage,'conferencia');
});
