import { CORRECT_ANSWERS, evaluateSubmission } from './assessment.js';
import { askTutor, exportWorkbook } from './api.js';

  const steps=[...document.querySelectorAll('.step')];
  const progress=document.getElementById('progress');
  const pill=document.getElementById('stepPill');
  const timer=document.getElementById('timer');

  let current=0, started=false, startedAt=null, secs=20*60, interval=null;
  const ans={q1:null,q2:null,q3:null,q4:null,q5:null,q6:null};
  const locked={q1:false,q2:false,q3:false,q4:false,q5:false,q6:false};
  const correct=CORRECT_ANSWERS;
  let dirty=false, allowUnload=false, chatPending=false, completedSubmission=null;
  const gatedControls=[...document.querySelectorAll('.next, .prev, #finish, #download, #restart')];
  const previousDisabled=new Map();

  function setChatPending(pending){
    chatPending=pending;
    gatedControls.forEach(button=>{
      if(pending){previousDisabled.set(button,button.disabled);button.disabled=true;}
      else button.disabled=previousDisabled.get(button) ?? false;
    });
    if(!pending)previousDisabled.clear();
    document.getElementById('chatStatus').textContent=pending
      ? 'Esperando al tutor. Al terminar podrás continuar; tu escrito sigue en esta pestaña.'
      : '';
  }

  document.querySelectorAll('.step h2, #result h2').forEach(heading=>heading.tabIndex=-1);
  document.addEventListener('input',()=>{dirty=true;});
  window.addEventListener('beforeunload',event=>{
    if(dirty && !allowUnload){event.preventDefault();event.returnValue='';}
  });

  const feedback={
    q1:{
      ok:'Bien. Antes del desenlace sí sabemos que Alicia empeora, pero todavía no conocemos con certeza qué lo provoca.',
      a:'La personalidad de Jordán puede orientar una sospecha, pero el relato no demuestra que él cause la enfermedad.',
      c:'La atmósfera de la casa es inquietante, pero eso no demuestra una causa sobrenatural.'
    },
    q2:{
      ok:'Correcto. El deterioro de Alicia y la incertidumbre de los médicos aparecen expresamente en el relato.',
      a:'Esa relación causal no está demostrada; es una interpretación posible del lector.',
      b:'El relato crea una atmósfera inquietante, pero no afirma que la casa tenga voluntad propia.'
    },
    q3:{
      ok:'Muy bien. Una inferencia rigurosa también reconoce los límites de lo que todavía no puede demostrarse.',
      b:'La frialdad de Jordán puede influir en nuestra impresión, pero no constituye evidencia suficiente para atribuirle la causa.',
      c:'El texto presenta los síntomas como reales; no ofrece evidencia para afirmar que Alicia los imagine.'
    },
    q4:{
      ok:'Exacto. El desenlace permite releer esos detalles como pistas que antes parecían aisladas.',
      a:'Ese detalle contribuye a la ambientación, pero no se conecta de manera directa con la causa revelada.',
      b:'La personalidad de Jordán caracteriza la relación, pero no explica la evidencia material del desenlace.'
    },
    q5:{
      ok:'Correcto. Revisar una hipótesis cuando aparece mejor evidencia es una práctica central del pensamiento crítico.',
      b:'Mantener una idea solo por haberla pensado primero impide valorar la nueva evidencia.',
      c:'La sorpresa no impide interpretar; invita a reconstruir la explicación con la información nueva.'
    },
    q6:{
      ok:'Muy bien. El cuento muestra por qué debemos distinguir aquello que orienta nuestras expectativas de aquello que realmente sustenta una conclusión.',
      a:'Que una explicación sea posible no significa que esté igualmente sustentada por el texto.',
      c:'Una primera impresión puede ser útil como hipótesis, pero debe revisarse si aparece evidencia más sólida.'
    }
  };

  function show(n,focus=true){
    current=Math.max(0,Math.min(steps.length-1,n));
    steps.forEach((s,i)=>s.classList.toggle('hidden',i!==current));
    document.getElementById('result').classList.add('hidden');
    progress.style.width=(current/(steps.length-1)*100)+'%';
    pill.textContent='Etapa '+(current+1)+' de '+steps.length;
    progress.parentElement.setAttribute('aria-valuenow',String(current+1));
    if(focus)steps[current].querySelector('h2').focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function tick(){
    const m=Math.floor(secs/60), s=secs%60;
    timer.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    if(secs<=300) timer.style.color='#9a6a1e';
    if(secs<=60) timer.style.color='#9b4141';
    if(secs<=0){clearInterval(interval);timer.textContent='Tiempo';return;}
    secs--;
  }

  function start(){
    if(started)return;
    started=true;
    dirty=true;
    startedAt=new Date().toISOString();
    tick();
    interval=setInterval(tick,1000);
  }

  document.querySelectorAll('.next').forEach(b=>b.addEventListener('click',()=>{
    if(chatPending)return;
    if(b.id==='startBtn')start();
    show(current+1);
  }));
  document.querySelectorAll('.prev').forEach(b=>b.addEventListener('click',()=>{if(!chatPending)show(current-1);}));

  function checkSectionButton(q){
    if(q==='q1'||q==='q2'){
      document.getElementById('next2').disabled=!(locked.q1&&locked.q2);
    }else if(q==='q3'||q==='q4'){
      document.getElementById('next3').disabled=!(locked.q3&&locked.q4);
    }else if(q==='q5'||q==='q6'){
      document.getElementById('next4').disabled=!(locked.q5&&locked.q6);
    }
  }

  document.querySelectorAll('.choice').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const q=btn.dataset.q, v=btn.dataset.v;
      if(locked[q])return;

      dirty=true;
      locked[q]=true;
      ans[q]=v;

      const group=[...document.querySelectorAll('[data-q="'+q+'"]')];
      group.forEach(x=>x.disabled=true);
      btn.classList.add(v===correct[q]?'correct':'wrong');

      const fb=document.getElementById('fb'+q.slice(1));
      fb.className='feedback '+(v===correct[q]?'ok':'try');
      fb.innerHTML=(v===correct[q]?feedback[q].ok:feedback[q][v])+
        '<div class="lock-note">Tu primera respuesta quedó registrada en esta pestaña y ya no puede modificarse aquí.</div>';

      checkSectionButton(q);
    });
  });

  const chatLog=document.getElementById('chatLog');
  const chatInput=document.getElementById('chatInput');
  const chatForm=document.getElementById('chatForm');
  const chatCount=document.getElementById('chatCount');
  const turns=[];
  const botTurns=[];
  const MAX_CHAT_TURNS=5;
  let chatStage=0;

  const initialBotMessage='Quiero conocer tu lectura, no darte la mía. ¿Qué detalle del cuento te parece más importante después de conocer el desenlace y por qué?';
  const chatHistory=[{role:'assistant',content:initialBotMessage}];

  function addMsg(text,who){
    const d=document.createElement('div');
    d.className='msg '+who;
    d.textContent=(who==='bot'?'LectorLab: ':'Tú: ')+text;
    chatLog.appendChild(d);
    chatLog.scrollTop=chatLog.scrollHeight;
    return d;
  }

  function showTyping(){
    const t=document.createElement('div');
    t.className='typing';
    t.id='typingBot';
    t.setAttribute('aria-label','LectorLab está pensando');
    t.innerHTML='<i></i><i></i><i></i>';
    chatLog.appendChild(t);
    chatLog.scrollTop=chatLog.scrollHeight;
  }

  function hideTyping(){
    const t=document.getElementById('typingBot');
    if(t)t.remove();
  }

  chatForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const value=chatInput.value.trim();
    if(!value || chatPending || chatStage>=MAX_CHAT_TURNS)return;

    dirty=true;
    const nextTurn=chatStage+1;
    const pendingMessage=addMsg(value,'user');
    chatInput.value='';
    chatInput.disabled=true;
    chatForm.querySelector('button').disabled=true;
    setChatPending(true);
    showTyping();
    try{
      const reply=await askTutor(value,nextTurn,chatHistory);
      addMsg(reply,'bot');
      turns.push(value);
      botTurns.push(reply);
      chatHistory.push({role:'user',content:value},{role:'assistant',content:reply});
      chatStage=nextTurn;
      chatCount.textContent=chatStage+' de '+MAX_CHAT_TURNS+' intervenciones.';
      if(chatStage>=MAX_CHAT_TURNS){
        chatInput.placeholder='Conversación completada. Continúa con la evaluación final.';
        chatCount.textContent='Conversación completada: '+MAX_CHAT_TURNS+' de '+MAX_CHAT_TURNS+' intervenciones.';
      }
    }catch(error){
      // The failed request is not part of the successful conversation.
      // Restore the student's text so retry does not duplicate a visible turn.
      pendingMessage.remove();
      addMsg(error.message+' Tu intervención no fue contabilizada; tu texto sigue en el cuadro para reintentar.','bot');
      chatInput.value=value;
    }finally{
      hideTyping();
      setChatPending(false);
      chatInput.disabled=chatStage>=MAX_CHAT_TURNS;
      chatForm.querySelector('button').disabled=chatStage>=MAX_CHAT_TURNS;
      if(chatStage<MAX_CHAT_TURNS)chatInput.focus();
    }
  });

  function collectSubmission(){
    return {
      answers:{...ans},
      startedAt,
      completedAt:new Date().toISOString(),
      initial:document.getElementById('initial').value.trim(),
      hypothesis:document.getElementById('hypothesis').value.trim(),
      posture:document.getElementById('posture').value.trim(),
      evidence1:document.getElementById('ev1').value.trim(),
      evidence2:document.getElementById('ev2').value.trim(),
      reflection:document.getElementById('reflection').value.trim(),
      finalThought:document.getElementById('finalThought').value.trim(),
      chat:turns.map((student,index)=>({student,lectorlab:botTurns[index]})),
    };
  }

  document.getElementById('finish').addEventListener('click',()=>{
    if(chatPending)return;
    if(interval)clearInterval(interval);
    completedSubmission=collectSubmission();
    const assessment=evaluateSubmission(completedSubmission);
    const {postureOK,evidenceOK,reflectionOK}=assessment.criteria;
    steps.forEach(step=>step.classList.add('hidden'));
    const result=document.getElementById('result');
    result.classList.remove('hidden');
    progress.style.width='100%';
    progress.parentElement.setAttribute('aria-valuenow',String(steps.length));
    pill.textContent='Cierre';
    document.getElementById('score').textContent=assessment.score+'/'+assessment.maxScore;
    document.getElementById('resultText').textContent='Indicador local orientativo: seis aciertos objetivos y tres comprobaciones de completitud. La longitud y diferencia de los escritos no validan la pertinencia de las evidencias ni la calidad del razonamiento; requieren revisión docente.';
    document.getElementById('levelFormal').textContent=assessment.levelFormal;
    document.getElementById('levelTitle').textContent=assessment.levelTitle;
    document.getElementById('levelDesc').textContent=assessment.levelDesc;

    const tips=[];
    if(assessment.objectiveScore<4)tips.push('Vuelve a diferenciar hechos del relato, inferencias y explicaciones todavía no demostradas.');
    if(!postureOK)tips.push('Desarrolla tu interpretación y explica por qué va más allá del resumen.');
    if(!evidenceOK)tips.push('Completa dos evidencias distintas; después comprueba en el texto que realmente sostienen tu interpretación.');
    if(!reflectionOK)tips.push('Explica qué cambió entre tu primera hipótesis y tu lectura final.');
    document.getElementById('tips').innerHTML=tips.length
      ? '<div class="feedback try"><strong>Para seguir creciendo:</strong><ul>'+tips.map(t=>'<li>'+t+'</li>').join('')+'</ul></div>'
      : '<div class="feedback ok"><strong>Registro completado.</strong> Revisa con tu docente la pertinencia de las citas, el vínculo con tu interpretación y la revisión de hipótesis.</div>';
    result.querySelector('h2').focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('restart').addEventListener('click',()=>{
    if(chatPending)return;
    if(window.confirm('¿Reiniciar el recorrido? Se perderán las respuestas de esta pestaña. Descarga primero el Excel si deseas conservarlas.')){
      allowUnload=true;
      location.reload();
    }
  });

  document.getElementById('download').addEventListener('click',async()=>{
    if(chatPending || !completedSubmission)return;
    const button=document.getElementById('download');
    const originalText=button.textContent;
    button.disabled=true;
    button.textContent='Generando Excel…';
    try{
      // The snapshot fixes closure time. The final reflection is written after
      // finishing, so it is included without recalculating closure or score.
      const submission={...completedSubmission,finalThought:document.getElementById('finalThought').value.trim()};
      const blob=await exportWorkbook(submission);
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download='respuestas_RED_lectura_critica.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      button.textContent='✓ Excel descargado';
    }catch(error){
      window.alert(error.message||'No se pudo generar el Excel. Puedes intentarlo otra vez.');
    }finally{
      setTimeout(()=>{button.textContent=originalText;button.disabled=false;},1800);
    }
  });

  show(0,false);

// Image availability changes the fallback only, never the reading flow.
function showImageFallback(image) {
  const parent = image.parentElement;
  if (parent.classList.contains('image-unavailable')) return;
  parent.classList.add('image-unavailable');
  const caption = document.createElement('span');
  caption.className = 'image-fallback';
  caption.textContent = image.alt + ' · Imagen original no disponible en este momento.';
  parent.append(caption);
}
document.querySelectorAll('img[src^="https://upload.wikimedia.org/"]').forEach(image => {
  image.addEventListener('error', () => showImageFallback(image));
  if (image.complete && !image.naturalWidth) showImageFallback(image);
});
