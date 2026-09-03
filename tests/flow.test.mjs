import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,emptyChecks,validateFields,validDate} from '../assets/domain.js';
import {DemoStore} from '../assets/store.js';
const fields={paciente:'Paciente de teste',convenio:'Particular',medicacao:'',aplicacao:'Procedimento de teste',data:'2026-01-01',executor:'Dr. Arthur',atendente:'Recepção'};
const all={autorizada:true,assinada:true,execucao:true,documentos:true};
const record=(stage='autorizacao',checks=emptyChecks())=>({fields,stage,checks,version:1});
test('normaliza os campos e rejeita datas inexistentes',()=>{
  assert.equal(validateFields({...fields,paciente:'  Ana  '}).paciente,'Ana');
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
  assert.throws(()=>validateFields({...fields,data:'2026-02-30'}),{status:400});
});
test('rejeita campos obrigatórios, enumerações e tamanho inválidos',()=>{
  for(const change of [{paciente:' '},{convenio:'Não existe'},{executor:'Outro'},{medicacao:'Outro'},{aplicacao:'x'.repeat(301)}])assert.throws(()=>validateFields({...fields,...change}),{status:400});
});
test('não agenda sem autorização',()=>assert.throws(()=>transition(record(),{version:1,stage:'agendado'},'recepcao'),{status:400}));
test('não permite pular etapas',()=>assert.throws(()=>transition(record('autorizacao',all),{version:1,stage:'realizado'},'admin'),{status:400}));
test('aplicação futura não pode ser marcada como realizada',()=>assert.throws(()=>transition({...record('agendado',all),fields:{...fields,data:'2099-01-01'}},{version:1,stage:'realizado'},'admin'),{status:400}));
test('todos os documentos são necessários para encaminhar ao faturamento',()=>{
  for(const missing of Object.keys(all))assert.throws(()=>transition(record('realizado',{...all,[missing]:false}),{version:1,stage:'faturamento'},'recepcao'),{status:400});
});
test('somente faturamento ou admin confirmam recebimento',()=>{
  assert.throws(()=>transition(record('faturamento',all),{version:1,stage:'concluido'},'recepcao'),{status:403});
  assert.equal(transition(record('faturamento',all),{version:1,stage:'concluido'},'faturamento').stage,'concluido');
});
test('faturamento não modifica documentos nem abre etapas da recepção',()=>{
  assert.throws(()=>transition(record(),{version:1,checks:all},'faturamento'),{status:403});
  assert.throws(()=>transition(record('faturamento',all),{version:1,stage:'concluido',checks:{...all,assinada:false}},'faturamento'),{status:400});
});
test('versão antiga, checklist inválido e caso encerrado são rejeitados',()=>{
  assert.throws(()=>transition(record(),{version:0},'admin'),{status:409});
  assert.throws(()=>transition(record(),{version:1,checks:{autorizada:'sim'}},'admin'),{status:400});
  assert.throws(()=>transition(record('concluido',all),{version:1},'admin'),{status:409});
});
test('fluxo completo preserva registro anterior e exige recepção e faturamento',()=>{
  const original=record();let next=transition(original,{version:1,stage:'agendado',checks:{...emptyChecks(),autorizada:true}},'recepcao');
  next=transition(next,{version:2,stage:'realizado'},'recepcao');
  next=transition(next,{version:3,stage:'faturamento',checks:all},'recepcao');
  next=transition(next,{version:4,stage:'concluido'},'faturamento');
  assert.equal(next.version,5);assert.equal(next.stage,'concluido');assert.equal(original.version,1);assert.equal(original.checks.autorizada,false);
});
test('demonstração registra histórico e reinicia sem persistir dados',async()=>{
  const demo=new DemoStore(),item=(await demo.list()).items.find(r=>r.stage==='realizado' && r.checks.documentos);
  const updated=await demo.update(item.id,{version:1,stage:'faturamento'});
  assert.equal(updated.events.length,2);assert.match(updated.events.at(-1).action,/faturamento/);
  assert.equal((await new DemoStore().detail(item.id)).stage,'realizado');
});
