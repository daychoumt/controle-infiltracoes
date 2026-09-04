import {CONVENIOS, MEDICACOES, MEDICOS, ARTICULACOES, LADOS, PROCESS_CONDITIONS, FIELD_LABELS, processLabel} from './domain.js?v=5';
export const $ = (selector,root=document) => root.querySelector(selector);
export function node(tag,text,className) { const el=document.createElement(tag); if(text != null) el.textContent=text; if(className) el.className=className; return el; }
export function fillOptions(root=document,references=null,reset=false) {
  const choices={convenio:references?.convenios || CONVENIOS,medicacao:references?.medicacoes || MEDICACOES,executor:references?.medicos || MEDICOS,articulacao:ARTICULACOES,lado:LADOS};
  for(const [name,values] of Object.entries(choices)) {
    for(const select of root.querySelectorAll(`select[name="${name}"]`)) {
      if(reset)while(select.options.length>1)select.remove(1);
      for(const value of values)select.add(new Option(value,value));
    }
  }
  for(const select of root.querySelectorAll('select[name="condicaoProcesso"]')) {
    if(reset)select.replaceChildren();
    for(const [value,label] of PROCESS_CONDITIONS)select.add(new Option(label,value));
  }
}
export function displayDate(value) { return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')); }
export function summary(container,fields,labels=FIELD_LABELS) {
  container.replaceChildren();
  for(const [key,label] of Object.entries(labels)) {
    const value=key==='numeroAplicacao' && fields[key] ? `${fields[key]}ª de 3` : key==='data' && fields[key] ? displayDate(fields[key]) : key==='condicaoProcesso' ? processLabel(fields) : fields[key];
    container.append(node('dt',label),node('dd',value || 'Não informado'));
  }
}
export function closeDialogs() {
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
}
