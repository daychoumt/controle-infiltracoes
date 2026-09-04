import {validateFields, localDate} from './domain.js?v=4';
import {$,fillOptions,summary,closeDialogs} from './ui.js?v=4';
fillOptions(); closeDialogs();
const form=$('#registro'), dialog=$('#confirmacao'), status=$('#status'), send=$('#enviar');
let payload=null, sending=false, sent=false;
const date=form.elements.data;
date.value=date.max=localDate();
function updateReview() {
  const fields=Object.fromEntries(new FormData(form));
  $('#review-paciente').textContent=fields.paciente.trim() || 'Novo atendimento';
  $('#review-medico').textContent=fields.executor || 'Selecione o médico executor';
  $('#review-convenio').textContent=fields.convenio || 'Convênio não selecionado';
  $('#review-data').textContent=fields.data ? fields.data.split('-').reverse().join('/') : 'Selecione uma data';
}
form.addEventListener('input',updateReview); updateReview();
form.addEventListener('submit',event=>{
  event.preventDefault(); if(sending || sent) return;
  try {
    payload=validateFields(Object.fromEntries(new FormData(form)));
    if(payload.data>localDate()) throw new Error('Informe a data de uma aplicação já realizada.');
    summary($('#confirmacao-resumo'),payload); dialog.showModal();
  } catch(error) { status.textContent=error.message; status.focus(); }
});
dialog.addEventListener('cancel',event=>{if(sending) event.preventDefault();});
send.addEventListener('click',async()=>{
  if(sending || !payload) return;
  sending=true; send.disabled=true; $('#cancelar-envio').disabled=true; send.textContent='Enviando…';
  try {
    const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(payload),mode:'no-cors',signal:AbortSignal.timeout(20000)});
    if(response.type !== 'opaque' && !response.ok) throw new Error('Falha no envio');
    sent=true; form.querySelector('fieldset').disabled=true; $('#novo-registro').hidden=false;
    status.textContent='Envio realizado. Confirme o recebimento na planilha antes de abrir um novo registro. O site não consegue verificar a gravação automaticamente.';
  } catch {
    status.textContent='Não foi possível confirmar o envio. Seus dados continuam no formulário. Confira a planilha antes de tentar novamente para evitar duplicidade.';
  } finally {
    sending=false; send.disabled=false; $('#cancelar-envio').disabled=false; send.textContent='Confirmar e enviar'; dialog.close(); status.focus();
  }
});
$('#novo-registro').addEventListener('click',()=>{
  sent=false; payload=null; form.reset(); form.querySelector('fieldset').disabled=false; date.value=date.max=localDate();
  $('#novo-registro').hidden=true; status.textContent='Novo registro iniciado.'; updateReview(); form.elements.paciente.focus();
});
