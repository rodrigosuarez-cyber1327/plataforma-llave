
const TCOLORES = {
  'Ser Nea':  {cls:'tc-sernea', dot:'var(--sernea)'},
  'Niclis':   {cls:'tc-niclis', dot:'var(--niclis)'},
  'Propio':   {cls:'tc-propio', dot:'var(--propio)'},
  'Otro':     {cls:'tc-sin',    dot:'var(--sin)'},
  '':         {cls:'tc-sin',    dot:'var(--sin)'},
};
function tClass(t){ return TCOLORES[t] || TCOLORES['']; }

let pedidos = [];

function esDiaHabil(d){ const dow=d.getDay(); return dow!==0&&dow!==6; }

function calcPlazo(f){
  if(!f) return null;
  const d=new Date(f.replace(' ','T'));
  const dow=d.getDay();

  // Punto de inicio: si es fin de semana → lunes 8am; si es después de las 15h → próximo día hábil 8am
  let inicio=new Date(d);
  if(dow===0||dow===6){
    while(inicio.getDay()!==1) inicio.setDate(inicio.getDate()+1);
    inicio.setHours(8,0,0,0);
  } else if(d.getHours()>=15){
    inicio.setDate(inicio.getDate()+1);
    inicio.setHours(8,0,0,0);
    while(!esDiaHabil(inicio)) inicio.setDate(inicio.getDate()+1);
  }

  // Sumar 3 días hábiles (lun-vie, sin sábado ni domingo)
  let plazo=new Date(inicio); let habiles=0;
  while(habiles<3){
    plazo.setDate(plazo.getDate()+1);
    if(esDiaHabil(plazo)) habiles++;
  }
  return plazo;
}
function getAlerta(p){
  if(p.estado==='Completada') return 'completada';
  const plazo=calcPlazo(p.fecha); if(!plazo) return 'ok';
  const r=(plazo-new Date())/3600000;
  if(r<0) return 'vencida'; if(r<=24) return 'critica'; if(r<=48) return 'atencion'; return 'ok';
}
function aStyle(t){
  if(t==='completada') return {bar:'#9CA3AF',cls:'tb-comp',dot:'#9CA3AF',label:'Completada'};
  if(t==='vencida') return {bar:'#C92B2B',cls:'tb-danger',dot:'var(--danger)',label:'Vencida'};
  if(t==='critica') return {bar:'#D47800',cls:'tb-warn',dot:'var(--warn)',label:'Crítica'};
  if(t==='atencion') return {bar:'#B8A000',cls:'tb-caut',dot:'var(--caut)',label:'Atención'};
  return {bar:'#1E9A42',cls:'tb-ok',dot:'var(--ok)',label:'Al día'};
}
function tiempoStr(f){
  const p=calcPlazo(f); if(!p) return '—';
  const r=p-new Date(); const abs=Math.round(Math.abs(r)/3600000);
  const d=Math.floor(abs/24),h=abs%24;
  const s=d>0?d+'d '+h+'h':h+' hs';
  return r<0?'-'+s:s;
}
function epClass(e){
  if(e==='Ingresada') return 'ep ep-ing';
  if(e==='En preparación') return 'ep ep-pre';
  if(e==='En control') return 'ep ep-ctrl';
  return 'ep ep-comp';
}

async function init(){
  try {
    const res = await axios.get('/api/pedidos');
    pedidos = res.data;
  } catch(e) {
    console.error("Error cargando pedidos:", e);
    pedidos = [];
  }
  poblarFiltros(); renderLeyenda(); renderTable();
}

function poblarFiltros(){
  const ctrls=[...new Set(pedidos.map(p=>p.ctrl).filter(Boolean))].sort();
  const trans=[...new Set(pedidos.map(p=>p.transporte).filter(Boolean))].sort();
  document.getElementById('f-ctrl').innerHTML='<option value="">Todos los controladores</option>'+ctrls.map(c=>`<option>${c}</option>`).join('');
  document.getElementById('f-transp').innerHTML='<option value="">Todos los transportes</option>'+trans.map(t=>`<option>${t}</option>`).join('');
}

function renderLeyenda(){
  const trans=[...new Set(pedidos.map(p=>p.transporte).filter(Boolean))];
  const leg=document.getElementById('transp-legend');
  const chips=trans.map(t=>{
    const c=tClass(t);
    return `<span class="t-chip ${c.cls}"><span class="td" style="background:${c.dot}"></span>${t}</span>`;
  }).join('');
  leg.innerHTML=`<span class="ley-lbl">Transportes</span>${chips}`;
}

function renderTable(){
  const q=document.getElementById('buscar').value.toLowerCase();
  const fe=document.getElementById('f-estado').value;
  const fa=document.getElementById('f-alerta').value;
  const fc=document.getElementById('f-ctrl').value;
  const ft=document.getElementById('f-transp').value;

  const fil=pedidos.filter(p=>{
    const txt=[p.cliente,String(p.n),String(p.ped),p.ciudad,p.ctrl,p.picker,p.transporte,p.obs].join(' ').toLowerCase();
    const al=getAlerta(p);
    return(!q||txt.includes(q))&&(!fe||p.estado===fe)&&(!fa||al===fa)&&(!fc||p.ctrl===fc)&&(!ft||p.transporte===ft);
  });

  const activos=pedidos.filter(p=>p.estado!=='Completada');
  const venc=activos.filter(p=>getAlerta(p)==='vencida').length;
  const warn=activos.filter(p=>['critica','atencion'].includes(getAlerta(p))).length;
  const okC=activos.filter(p=>getAlerta(p)==='ok').length;
  const hoyStr=new Date().toISOString().slice(0,10);
  const hoyCount=pedidos.filter(p=>p.fecha&&p.fecha.slice(0,10)===hoyStr).length;
  const despHoy=pedidos.filter(p=>p.fechaDespacho&&p.fechaDespacho.slice(0,10)===hoyStr).length;
  document.getElementById('m-total').textContent=pedidos.length;
  document.getElementById('m-venc').textContent=venc;
  document.getElementById('m-warn').textContent=warn;
  document.getElementById('m-ok').textContent=okC;
  document.getElementById('m-ctrl').textContent=new Set(pedidos.map(p=>p.ctrl).filter(Boolean)).size;
  document.getElementById('m-hoy').textContent=hoyCount;
  document.getElementById('m-desp').textContent=despHoy;

  const bw=document.getElementById('banner-wrap');
  if(venc>0) bw.innerHTML=`<div class="banner danger"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><strong>${venc} orden${venc>1?'es':''} vencida${venc>1?'s':''}</strong> — Superaron los 3 días hábiles sin despachar. Requieren atención inmediata.</div>`;
  else if(warn>0) bw.innerHTML=`<div class="banner warn"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><strong>${warn} orden${warn>1?'es':''} próxima${warn>1?'s':''} a vencer</strong> — Revisalas antes de las 72 hs.</div>`;
  else bw.innerHTML='';

  const tbody=document.getElementById('tbody');
  if(!fil.length){tbody.innerHTML='<tr><td colspan="20" class="empty-td">No se encontraron resultados para los filtros aplicados.</td></tr>';return;}

  tbody.innerHTML=fil.map(p=>{
    const al=getAlerta(p); const as=aStyle(al);
    const tc=tClass(p.transporte);
    const fecha=p.fecha?p.fecha.slice(0,16):'—';
    const cli=p.cliente.length>22?p.cliente.slice(0,22)+'…':p.cliente;
    const tip=p.tipo==='Licitacion'?'tipo-licit':'tipo-norm';
    const transp=p.transporte||'Sin asignar';
    const picker=p.picker?`<span class="picker-cell">${p.picker}</span>`:`<span style="color:#C0C8DC;font-size:11px;">—</span>`;
    const esExpress = p.items === 10;
    const itemsCell = esExpress
      ? `<span class="express-badge">⚡ ${p.items} express</span>`
      : `<span style="font-weight:700;color:#1A4FA8">${p.items||'—'}</span>`;
    return `<tr class="${esExpress?'express-row':''}" onclick="verDetalle(${p.id})">
      <td class="td-bar"><div class="bar" style="background:${esExpress?'var(--express)':as.bar}"></div></td>
      <td><span class="num-bold">${p.n}</span></td>
      <td style="color:var(--text2)">${p.ped}</td>
      <td style="font-size:11px;color:var(--text2)">${fecha}</td>
      <td>${al==='completada'?`<span class="tbadge tb-comp">✓</span>`:`<span class="tbadge ${as.cls}"><span class="td" style="background:${as.dot}"></span>${tiempoStr(p.fecha)}</span>`}</td>
      <td><span class="${epClass(p.estado)}">${p.estado}</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500">${cli}</td>
      <td><span class="tc ${tc.cls}"><span class="td" style="background:${tc.dot}"></span>${transp}</span></td>
      <td class="ciudad-cell">${p.ciudad||'—'}</td>
      <td style="text-align:center">${itemsCell}</td>
      <td style="font-size:11px;color:var(--text2)">${p.unidad||'—'}</td>
      <td>${picker}</td>
      <td class="hora-cell">${p.fechaP||'—'}</td>
      <td class="hora-cell">${p.inicioP||'—'}</td>
      <td class="hora-cell">${p.finP||'—'}</td>
      <td style="font-size:11px;color:#7B3FBB;font-weight:600">${p.vendedor||'—'}</td>
      <td><span class="ctrl-cell">${p.ctrl||'—'}</span></td>
      <td style="font-size:11px;color:var(--text2)">${p.fechaC||'—'}</td>
      <td class="hora-cell">${p.inicioC||'—'}</td>
      <td class="hora-cell">${p.finC||'—'}</td>
      <td><span class="${tip}">${p.tipo||'Normal'}</span></td>
    </tr>`;
  }).join('');
}

function verDetalle(id){
  const p=pedidos.find(x=>x.id===id); if(!p) return;
  const al=getAlerta(p); const as=aStyle(al);
  const tc=tClass(p.transporte);
  const plazo=calcPlazo(p.fecha);
  const ps=plazo?plazo.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  document.getElementById('det-title').textContent=`Orden N° ${p.n} — ${p.cliente.slice(0,30)}`;
  document.getElementById('det-sub').innerHTML=`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;margin-top:4px;color:rgba(255,255,255,.8)">Vence: ${ps} · ${tiempoStr(p.fecha)}</span>`;
  document.getElementById('det-body').innerHTML=`
    <div style="margin-bottom:14px">
      <div class="drow"><span class="dlbl">N° Pedido</span><span class="dval">${p.ped}</span></div>
      <div class="drow"><span class="dlbl">Cliente</span><span class="dval">${p.cliente}</span></div>
      <div class="drow"><span class="dlbl">Fecha creación</span><span class="dval">${p.fecha||'—'}</span></div>
      <div class="drow"><span class="dlbl">Transporte</span><span class="dval"><span class="tc ${tc.cls}">${p.transporte||'Sin asignar'}</span></span></div>
      <div class="drow"><span class="dlbl">Ciudad</span><span class="dval">${p.ciudad||'—'}</span></div>
      <div class="drow"><span class="dlbl">Ítems / Unidad</span><span class="dval">${p.items||'—'} ${p.unidad||''}</span></div>
      <div class="drow"><span class="dlbl">Tipo operación</span><span class="dval">${p.tipo||'Normal'}</span></div>
      <div class="drow"><span class="dlbl">Observaciones</span><span class="dval">${p.obs||'—'}</span></div>
    </div>
    <div class="sec-box orange">
      <div class="sec-title">Picker</div>
      <div class="fgrid" style="grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
        <div class="fg" style="grid-column:1/-1"><label class="flbl">Nombre</label><input class="finp" id="e-picker" value="${p.picker||''}" placeholder="Nombre del picker"></div>
        <div class="fg"><label class="flbl">Fecha inicio</label><input class="finp" id="e-fechaP" type="date" value="${p.fechaP||''}"></div>
        <div class="fg"><label class="flbl">Fecha fin</label><input class="finp" id="e-fechaFinP" type="date" value="${p.fechaFinP||''}"></div>
        <div class="fg"><label class="flbl">Hora inicio</label><input class="finp" id="e-inicioP" type="time" value="${p.inicioP||''}"></div>
        <div class="fg"><label class="flbl">Hora fin</label><input class="finp" id="e-finP" type="time" value="${p.finP||''}"></div>
      </div>
    </div>
    <div class="sec-box" style="margin-top:10px">
      <div class="sec-title">Controlador</div>
      <div class="fgrid" style="grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
        <div class="fg" style="grid-column:1/-1"><label class="flbl">Nombre</label><input class="finp" id="e-ctrl" value="${p.ctrl||''}" placeholder="Nombre del controlador"></div>
        <div class="fg"><label class="flbl">Fecha inicio</label><input class="finp" id="e-fechaC" type="date" value="${p.fechaC||''}"></div>
        <div class="fg"><label class="flbl">Fecha fin</label><input class="finp" id="e-fechaFinC" type="date" value="${p.fechaFinC||''}"></div>
        <div class="fg"><label class="flbl">Hora inicio</label><input class="finp" id="e-inicioC" type="time" value="${p.inicioC||''}"></div>
        <div class="fg"><label class="flbl">Hora fin</label><input class="finp" id="e-finC" type="time" value="${p.finC||''}"></div>
      </div>
    </div>
    <div class="fgrid" style="margin-top:12px;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg"><label class="flbl">Estado</label>
        <select class="fsel2" id="e-estado">
          <option ${p.estado==='Ingresada'?'selected':''}>Ingresada</option>
          <option ${p.estado==='En preparación'?'selected':''}>En preparación</option>
          <option ${p.estado==='En control'?'selected':''}>En control</option>
          <option ${p.estado==='Completada'?'selected':''}>Completada</option>
        </select>
      </div>
      <div class="fg"><label class="flbl">Ítems</label><input class="finp" id="e-items" type="number" value="${p.items||0}"></div>
    </div>
    <div class="factions">
      <button class="btn-save" id="btn-save-det" onclick="guardarDetalle(${id})">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        Guardar cambios
      </button>
      <button class="btn-cancel" onclick="cerrar('mod-det')">Cerrar</button>
    </div>`;
  document.getElementById('mod-det').classList.add('open');
}

async function guardarDetalle(id){
  const p=pedidos.find(x=>x.id===id); if(!p) return;
  const btn = document.getElementById('btn-save-det');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const updatedData = {
    picker:    document.getElementById('e-picker').value.trim(),
    fechaP:    document.getElementById('e-fechaP').value,
    fechaFinP: document.getElementById('e-fechaFinP').value,
    inicioP:   document.getElementById('e-inicioP').value,
    finP:      document.getElementById('e-finP').value,
    ctrl:      document.getElementById('e-ctrl').value.trim(),
    fechaC:    document.getElementById('e-fechaC').value,
    fechaFinC: document.getElementById('e-fechaFinC').value,
    inicioC:   document.getElementById('e-inicioC').value,
    finC:      document.getElementById('e-finC').value,
    estado:    document.getElementById('e-estado').value,
    items:     parseInt(document.getElementById('e-items').value)||0
  };

  console.log('Guardando orden', id, updatedData);
  try {
    await axios.put(`/api/pedidos/${id}`, updatedData);
    toast('Cambios guardados ✓');
    await init();
    cerrar('mod-det');
  } catch(e) {
    alert("Error al guardar: " + e.message);
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
}

function abrirNuevo(){ document.getElementById('mod-nuevo').classList.add('open'); }

async function guardarNuevo(){
  const num=document.getElementById('nn-num').value.trim();
  const cli=document.getElementById('nn-cli').value.trim();
  const ctrl=document.getElementById('nn-ctrl').value.trim();
  if(!num||!cli||!ctrl){alert('Completá N° Orden, Cliente y Controlador.');return;}
  
  const btn = document.querySelector('#mod-nuevo .btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const ahora=new Date();
  const fecha=ahora.toISOString().slice(0,16).replace('T',' ');
  
  const nuevo = {
    n:parseInt(num), 
    ped:parseInt(document.getElementById('nn-ped').value)||0,
    fecha, 
    cliente:cli.toUpperCase(),
    transporte:document.getElementById('nn-trans').value,
    ciudad:document.getElementById('nn-ciudad').value.toUpperCase(),
    items:parseInt(document.getElementById('nn-items').value)||0,
    unidad:document.getElementById('nn-unidad').value,
    tipo:document.getElementById('nn-tipo').value,
    picker:document.getElementById('nn-picker').value.trim(),
    fechaP:document.getElementById('nn-fechaP').value,
    ctrl:ctrl.toUpperCase(),
    inicioP:document.getElementById('nn-inicioP').value,
    finP:document.getElementById('nn-finP').value,
    estado:'Ingresada',
    obs:document.getElementById('nn-obs').value
  };

  try {
    await axios.post('/api/pedidos', nuevo);
    await init();
    cerrar('mod-nuevo');
    ['nn-num','nn-ped','nn-cli','nn-ciudad','nn-items','nn-unidad','nn-picker','nn-fechaP','nn-ctrl','nn-inicioP','nn-finP','nn-obs'].forEach(i=>{document.getElementById(i).value='';});
  } catch(e) {
    alert("Error al guardar: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Guardar orden`;
  }
}

function cerrar(id){document.getElementById(id).classList.remove('open');}
function cerrarOv(id,e){if(e.target===document.getElementById(id))cerrar(id);}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2500);}

function getInicioSemana(){
  const hoy = new Date();
  const dia = hoy.getDay(); 
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1));
  lunes.setHours(0,0,0,0);
  return lunes;
}

function calcHoras(ini, fin){
  if(!ini || !fin) return 0;
  const [h1,m1]=ini.split(':').map(Number);
  const [h2,m2]=fin.split(':').map(Number);
  const mins = (h2*60+m2) - (h1*60+m1);
  return mins > 0 ? mins/60 : 0;
}

function fmtHoras(h){
  const hh = Math.floor(h), mm = Math.round((h-hh)*60);
  return hh+'h '+(mm>0?mm+'m':'');
}

function abrirReporte(){
  const inicio = getInicioSemana();
  const fin = new Date(inicio); fin.setDate(inicio.getDate()+6); fin.setHours(23,59,59);

  const semana = pedidos.filter(p => {
    if(!p.fecha) return false;
    const d = new Date(p.fecha.replace(' ','T'));
    return d >= inicio && d <= fin;
  });

  const fmtFecha = d => d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const titulo = `Semana ${fmtFecha(inicio)} — ${fmtFecha(fin)}`;

  const totalPed = semana.length;
  const totalItems = semana.reduce((s,p)=>s+(p.items||0),0);
  const totalUnidades = semana.reduce((s,p)=>s+(parseInt(p.unidad)||0),0);
  const express10 = semana.filter(p=>p.items===10).length;
  const completadas = semana.filter(p=>p.estado==='Completada').length;

  const mapaPickerH = {};
  semana.forEach(p=>{
    if(!p.picker) return;
    if(!mapaPickerH[p.picker]) mapaPickerH[p.picker]={horas:0,ordenes:0,items:0,unidades:0};
    mapaPickerH[p.picker].horas    += calcHoras(p.inicioP, p.finP);
    mapaPickerH[p.picker].ordenes++;
    mapaPickerH[p.picker].items    += (p.items||0);
    mapaPickerH[p.picker].unidades += (parseInt(p.unidad)||0);
  });

  const mapaCtrlH = {};
  semana.forEach(p=>{
    if(!p.ctrl) return;
    if(!mapaCtrlH[p.ctrl]) mapaCtrlH[p.ctrl]={horas:0,ordenes:0,items:0,unidades:0};
    mapaCtrlH[p.ctrl].horas    += calcHoras(p.inicioC, p.finC);
    mapaCtrlH[p.ctrl].ordenes++;
    mapaCtrlH[p.ctrl].items    += (p.items||0);
    mapaCtrlH[p.ctrl].unidades += (parseInt(p.unidad)||0);
  });

  // Comparativo ingresos vs despachos por día
  const diasNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const flujoMap = {};
  pedidos.forEach(p=>{
    if(!p.fecha) return;
    const d = new Date(p.fecha.replace(' ','T'));
    const isoKey = p.fecha.slice(0,10);
    if(!flujoMap[isoKey]) flujoMap[isoKey]={label: fmtFecha(d)+' '+diasNom[d.getDay()], ingresos:0, despachos:0};
    flujoMap[isoKey].ingresos++;
    if(p.fechaDespacho) {
      const kd = p.fechaDespacho.slice(0,10);
      if(!flujoMap[kd]) flujoMap[kd]={label: fmtFecha(new Date(kd+'T00:00:00'))+' '+diasNom[new Date(kd+'T00:00:00').getDay()], ingresos:0, despachos:0};
      flujoMap[kd].despachos++;
    }
  });
  const flujoRows = Object.entries(flujoMap)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([,v])=>{
      const diff = v.ingresos - v.despachos;
      const diffColor = diff > 0 ? '#C92B2B' : diff < 0 ? '#1E9A42' : '#6B7280';
      const diffLabel = diff > 0 ? `+${diff} pendientes` : diff < 0 ? `${diff} extras` : '= equilibrio';
      return `<tr>
        <td><strong>${v.label}</strong></td>
        <td style="text-align:center;color:#0891B2;font-weight:700">${v.ingresos}</td>
        <td style="text-align:center;color:#059669;font-weight:700">${v.despachos}</td>
        <td style="text-align:center;font-weight:700;color:${diffColor}">${diffLabel}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';

  // Pedidos por día (histórico - solo ingresos, items, unidades)
  const diasMap = {};
  pedidos.forEach(p=>{
    if(!p.fecha) return;
    const d = new Date(p.fecha.replace(' ','T'));
    const isoKey = p.fecha.slice(0,10);
    if(!diasMap[isoKey]) diasMap[isoKey]={label: fmtFecha(d)+' '+diasNom[d.getDay()], pedidos:0,items:0,unidades:0};
    diasMap[isoKey].pedidos++;
    diasMap[isoKey].items    += (p.items||0);
    diasMap[isoKey].unidades += (parseInt(p.unidad)||0);
  });

  const pickerRows = Object.entries(mapaPickerH).sort((a,b)=>b[1].ordenes-a[1].ordenes)
    .map(([n,v])=>`
      <tr>
        <td><strong>${n}</strong></td>
        <td style="text-align:center">${v.ordenes}</td>
        <td style="text-align:center">${v.items}</td>
        <td style="text-align:center">${v.unidades}</td>
        <td style="text-align:center;color:#B04800;font-weight:700">${fmtHoras(v.horas)}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:12px">Sin datos cargados aún</td></tr>';

  const ctrlRows = Object.entries(mapaCtrlH).sort((a,b)=>b[1].ordenes-a[1].ordenes)
    .map(([n,v])=>`
      <tr>
        <td><strong>${n}</strong></td>
        <td style="text-align:center">${v.ordenes}</td>
        <td style="text-align:center">${v.items}</td>
        <td style="text-align:center">${v.unidades}</td>
        <td style="text-align:center;color:#1A4FA8;font-weight:700">${fmtHoras(v.horas)}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:12px">Sin datos cargados aún</td></tr>';

  const diaRows = Object.entries(diasMap)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([,v])=>`<tr><td><strong>${v.label}</strong></td><td style="text-align:center">${v.pedidos}</td><td style="text-align:center">${v.items}</td><td style="text-align:center">${v.unidades}</td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';

  // Vendedores — promedio de pedidos por día
  const mapaVend = {};
  pedidos.forEach(p=>{
    const k = (p.vendedor||'').trim(); if(!k) return;
    const dia = p.fecha ? p.fecha.slice(0,10) : null;
    if(!mapaVend[k]) mapaVend[k]={ordenes:0, items:0, unidades:0, dias:new Set()};
    mapaVend[k].ordenes++;
    mapaVend[k].items += (p.items||0);
    mapaVend[k].unidades += (parseInt(p.unidad)||0);
    if(dia) mapaVend[k].dias.add(dia);
  });
  const vendedorRows = Object.entries(mapaVend)
    .sort((a,b)=>b[1].ordenes-a[1].ordenes)
    .map(([n,v])=>{
      const prom = v.dias.size>0 ? (v.ordenes/v.dias.size).toFixed(1) : '—';
      return `<tr>
        <td><strong style="color:#7B3FBB">${n}</strong></td>
        <td style="text-align:center;font-weight:700">${v.ordenes}</td>
        <td style="text-align:center;font-weight:800;color:#7B3FBB;font-size:14px">${prom}</td>
        <td style="text-align:center">${v.items}</td>
        <td style="text-align:center">${v.unidades}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:12px">Sin datos de vendedor cargados</td></tr>';

  document.getElementById('rep-title').textContent = 'Reporte Semanal · La Llave';
  document.getElementById('rep-sub').textContent = titulo;
  document.getElementById('rep-body').innerHTML = `
    <div class="rep-section">
      <div class="rep-section-title">Resumen general</div>
      <div class="rep-grid">
        <div class="rep-card"><div class="rep-card-val">${totalPed}</div><div class="rep-card-lbl">Pedidos</div></div>
        <div class="rep-card"><div class="rep-card-val">${totalItems}</div><div class="rep-card-lbl">Ítems totales</div></div>
        <div class="rep-card"><div class="rep-card-val">${totalUnidades}</div><div class="rep-card-lbl">Unidades totales</div></div>
        <div class="rep-card"><div class="rep-card-val">${completadas}</div><div class="rep-card-lbl">Completadas</div></div>
        <div class="rep-card"><div class="rep-card-val" style="color:var(--express)">⚡ ${express10}</div><div class="rep-card-lbl">Express (10 ítems)</div></div>
        <div class="rep-card"><div class="rep-card-val">${totalPed>0?Math.round(totalItems/totalPed):0}</div><div class="rep-card-lbl">Ítems prom./pedido</div></div>
      </div>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">📊 Ingresos vs Despachos por día</div>
      <table class="rep-table">
        <thead><tr>
          <th>Día</th>
          <th style="text-align:center;color:#0891B2">📥 Ingresos</th>
          <th style="text-align:center;color:#059669">📦 Despachos</th>
          <th style="text-align:center">Balance</th>
        </tr></thead>
        <tbody>${flujoRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">📅 Pedidos por día (histórico)</div>
      <table class="rep-table">
        <thead><tr><th>Día</th><th style="text-align:center">Pedidos</th><th style="text-align:center">Ítems</th><th style="text-align:center">Unidades</th></tr></thead>
        <tbody>${diaRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">🛒 Vendedores — Promedio de pedidos por día</div>
      <table class="rep-table">
        <thead><tr>
          <th>Vendedor</th>
          <th style="text-align:center">Total órdenes</th>
          <th style="text-align:center;color:#7B3FBB">Prom. / día</th>
          <th style="text-align:center">Ítems</th>
          <th style="text-align:center">Unidades</th>
        </tr></thead>
        <tbody>${vendedorRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">🟠 Piqueo — Sergio Martínez · Walter Gamarra</div>
      <table class="rep-table">
        <thead><tr><th>Picker</th><th style="text-align:center">Órdenes</th><th style="text-align:center">Ítems</th><th style="text-align:center">Unidades</th><th style="text-align:center">Horas</th></tr></thead>
        <tbody>${pickerRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">🔵 Control — Julián Soto · Facundo Ríos</div>
      <table class="rep-table">
        <thead><tr><th>Controlador</th><th style="text-align:center">Órdenes</th><th style="text-align:center">Ítems</th><th style="text-align:center">Unidades</th><th style="text-align:center">Horas</th></tr></thead>
        <tbody>${ctrlRows}</tbody>
      </table>
    </div>
    <div class="factions">
      <button class="btn-dl" onclick="descargarReporte('${titulo.replace(/'/g,'').replace(/—/g,'-')}')">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargar Excel
      </button>
      <button class="btn-cancel" onclick="cerrar('mod-reporte')">Cerrar</button>
    </div>`;
  document.getElementById('mod-reporte').classList.add('open');
}

function descargarReporte(titulo){
  const inicio = getInicioSemana();
  const fin = new Date(inicio); fin.setDate(inicio.getDate()+6); fin.setHours(23,59,59);
  const semana = pedidos.filter(p=>{
    if(!p.fecha) return false;
    const d=new Date(p.fecha.replace(' ','T'));
    return d>=inicio && d<=fin;
  });

  const ws_data = [
    ['N° Orden','N° Pedido','Fecha','Cliente','Transporte','Ciudad','Estado','Ítems','Unidades','Express','Picker','Fecha Picker','Inicio Picker','Fin Picker','Controlador','Fecha Control','Inicio Control','Fin Control'],
    ...semana.map(p=>[p.n,p.ped,p.fecha,p.cliente,p.transporte,p.ciudad,p.estado,p.items,p.unidad||'',p.items===10?'SÍ':'NO',p.picker||'',p.fechaP||'',p.inicioP||'',p.finP||'',p.ctrl||'',p.fechaC||'',p.inicioC||'',p.finC||''])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte Semanal');
  XLSX.writeFile(wb, `Reporte_Semanal_LaLlave_${new Date().toISOString().slice(0,10)}.xlsx`);
}



// ── REPORTE MENSUAL ───────────────────────────────────────────────────────────

let reporteMesDate = new Date();

function cambiarMes(delta){
  reporteMesDate = new Date(reporteMesDate.getFullYear(), reporteMesDate.getMonth()+delta, 1);
  abrirReporteMensual();
}

function abrirReporteMensual(){
  const año = reporteMesDate.getFullYear();
  const mes  = reporteMesDate.getMonth();
  const inicio = new Date(año, mes, 1, 0, 0, 0);
  const fin    = new Date(año, mes+1, 0, 23, 59, 59);
  const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const titulo = `${MESES[mes]} ${año}`;
  const fmtF   = d => d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});

  const delMes = pedidos.filter(p=>{
    if(!p.fecha) return false;
    const d=new Date(p.fecha.replace(' ','T'));
    return d>=inicio && d<=fin;
  });

  const totalPed      = delMes.length;
  const totalItems    = delMes.reduce((s,p)=>s+(p.items||0),0);
  const totalUnidades = delMes.reduce((s,p)=>s+(parseInt(p.unidad)||0),0);
  const completadas   = delMes.filter(p=>p.estado==='Completada').length;
  const express10     = delMes.filter(p=>p.items===10).length;

  // Picker
  const mPick={};
  delMes.forEach(p=>{
    const k=(p.picker||'').trim(); if(!k) return;
    if(!mPick[k]) mPick[k]={horas:0,ordenes:0,items:0,unidades:0};
    mPick[k].horas+=calcHoras(p.inicioP,p.finP); mPick[k].ordenes++;
    mPick[k].items+=(p.items||0); mPick[k].unidades+=(parseInt(p.unidad)||0);
  });

  // Controlador
  const mCtrl={};
  delMes.forEach(p=>{
    const k=(p.ctrl||'').trim(); if(!k) return;
    if(!mCtrl[k]) mCtrl[k]={horas:0,ordenes:0,items:0,unidades:0};
    mCtrl[k].horas+=calcHoras(p.inicioC,p.finC); mCtrl[k].ordenes++;
    mCtrl[k].items+=(p.items||0); mCtrl[k].unidades+=(parseInt(p.unidad)||0);
  });

  // Vendedores
  const mVend={};
  delMes.forEach(p=>{
    const k=(p.vendedor||'').trim(); if(!k) return;
    if(!mVend[k]) mVend[k]={ordenes:0,items:0,unidades:0};
    mVend[k].ordenes++; mVend[k].items+=(p.items||0); mVend[k].unidades+=(parseInt(p.unidad)||0);
  });

  // Flujo ingresos vs despachos
  const flujo={};
  delMes.forEach(p=>{
    const d=new Date(p.fecha.replace(' ','T')); const k=p.fecha.slice(0,10);
    if(!flujo[k]) flujo[k]={label:fmtF(d)+' '+DIAS[d.getDay()],ingresos:0,despachos:0};
    flujo[k].ingresos++;
  });
  pedidos.forEach(p=>{
    if(!p.fechaDespacho) return;
    const kd=p.fechaDespacho.slice(0,10);
    const dD=new Date(kd+'T00:00:00');
    if(dD<inicio||dD>fin) return;
    if(!flujo[kd]) flujo[kd]={label:fmtF(dD)+' '+DIAS[dD.getDay()],ingresos:0,despachos:0};
    flujo[kd].despachos++;
  });

  const mkRow=(v)=>{const d=v.ingresos-v.despachos;const c=d>0?'#C92B2B':d<0?'#1E9A42':'#6B7280';const l=d>0?`+${d} pendientes`:d<0?`${d} extras`:'= equilibrio';
    return `<tr><td><strong>${v.label}</strong></td><td style="text-align:center;color:#0891B2;font-weight:700">${v.ingresos}</td><td style="text-align:center;color:#059669;font-weight:700">${v.despachos}</td><td style="text-align:center;font-weight:700;color:${c}">${l}</td></tr>`;};

  const flujoRows   = Object.entries(flujo).sort((a,b)=>b[0].localeCompare(a[0])).map(([,v])=>mkRow(v)).join('')||'<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';
  const pickerRows  = Object.entries(mPick).sort((a,b)=>b[1].ordenes-a[1].ordenes).map(([n,v])=>`<tr><td><strong>${n}</strong></td><td style="text-align:center">${v.ordenes}</td><td style="text-align:center">${v.items}</td><td style="text-align:center">${v.unidades}</td><td style="text-align:center;color:#B04800;font-weight:700">${fmtHoras(v.horas)}</td></tr>`).join('')||'<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';
  const ctrlRows    = Object.entries(mCtrl).sort((a,b)=>b[1].ordenes-a[1].ordenes).map(([n,v])=>`<tr><td><strong>${n}</strong></td><td style="text-align:center">${v.ordenes}</td><td style="text-align:center">${v.items}</td><td style="text-align:center">${v.unidades}</td><td style="text-align:center;color:#1A4FA8;font-weight:700">${fmtHoras(v.horas)}</td></tr>`).join('')||'<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';
  const vendRows    = Object.entries(mVend).sort((a,b)=>b[1].ordenes-a[1].ordenes).map(([n,v])=>`<tr><td><strong style="color:#7B3FBB">${n}</strong></td><td style="text-align:center;font-weight:700">${v.ordenes}</td><td style="text-align:center">${v.items}</td><td style="text-align:center">${v.unidades}</td></tr>`).join('')||'<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:12px">Sin datos de vendedor</td></tr>';

  document.getElementById('rep-title').textContent = 'Reporte Mensual · La Llave';
  document.getElementById('rep-sub').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
      <button onclick="cambiarMes(-1)" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:6px;padding:2px 12px;cursor:pointer;font-size:16px;line-height:1.4">‹</button>
      <span style="font-size:13px;font-weight:700;color:rgba(255,255,255,.95);min-width:130px;text-align:center">${titulo}</span>
      <button onclick="cambiarMes(1)" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:6px;padding:2px 12px;cursor:pointer;font-size:16px;line-height:1.4">›</button>
    </div>`;

  document.getElementById('rep-body').innerHTML = `
    <div class="rep-section">
      <div class="rep-section-title">Resumen — ${titulo}</div>
      <div class="rep-grid">
        <div class="rep-card"><div class="rep-card-val">${totalPed}</div><div class="rep-card-lbl">Pedidos</div></div>
        <div class="rep-card"><div class="rep-card-val">${totalItems}</div><div class="rep-card-lbl">Ítems totales</div></div>
        <div class="rep-card"><div class="rep-card-val">${totalUnidades}</div><div class="rep-card-lbl">Unidades totales</div></div>
        <div class="rep-card"><div class="rep-card-val">${completadas}</div><div class="rep-card-lbl">Completadas</div></div>
        <div class="rep-card"><div class="rep-card-val" style="color:var(--express)">⚡ ${express10}</div><div class="rep-card-lbl">Express (10 ítems)</div></div>
        <div class="rep-card"><div class="rep-card-val">${totalPed>0?Math.round(totalItems/totalPed):0}</div><div class="rep-card-lbl">Ítems prom./pedido</div></div>
      </div>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">📊 Ingresos vs Despachos por día</div>
      <table class="rep-table">
        <thead><tr><th>Día</th><th style="text-align:center;color:#0891B2">📥 Ingresos</th><th style="text-align:center;color:#059669">📦 Despachos</th><th style="text-align:center">Balance</th></tr></thead>
        <tbody>${flujoRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">🛒 Vendedores</div>
      <table class="rep-table">
        <thead><tr><th>Vendedor</th><th style="text-align:center">Órdenes</th><th style="text-align:center">Ítems</th><th style="text-align:center">Unidades</th></tr></thead>
        <tbody>${vendRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">🟠 Piqueo</div>
      <table class="rep-table">
        <thead><tr><th>Picker</th><th style="text-align:center">Órdenes</th><th style="text-align:center">Ítems</th><th style="text-align:center">Unidades</th><th style="text-align:center">Horas</th></tr></thead>
        <tbody>${pickerRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title">🔵 Control</div>
      <table class="rep-table">
        <thead><tr><th>Controlador</th><th style="text-align:center">Órdenes</th><th style="text-align:center">Ítems</th><th style="text-align:center">Unidades</th><th style="text-align:center">Horas</th></tr></thead>
        <tbody>${ctrlRows}</tbody>
      </table>
    </div>
    <div class="factions">
      <button class="btn-dl" onclick="descargarReporteMensual('${titulo}')">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargar Excel
      </button>
      <button class="btn-cancel" onclick="cerrar('mod-reporte')">Cerrar</button>
    </div>`;
  document.getElementById('mod-reporte').classList.add('open');
}

function descargarReporteMensual(titulo){
  const año=reporteMesDate.getFullYear(), mes=reporteMesDate.getMonth();
  const inicio=new Date(año,mes,1), fin=new Date(año,mes+1,0,23,59,59);
  const delMes=pedidos.filter(p=>{if(!p.fecha)return false;const d=new Date(p.fecha.replace(' ','T'));return d>=inicio&&d<=fin;});
  const ws_data=[
    ['N° Orden','N° Pedido','Fecha','Cliente','Transporte','Ciudad','Estado','Ítems','Unidades','Vendedor','Picker','Fecha Inicio Picker','Fecha Fin Picker','Inicio Picker','Fin Picker','Controlador','Fecha Inicio Ctrl','Fecha Fin Ctrl','Inicio Ctrl','Fin Ctrl'],
    ...delMes.map(p=>[p.n,p.ped,p.fecha,p.cliente,p.transporte,p.ciudad,p.estado,p.items,p.unidad||'',p.vendedor||'',p.picker||'',p.fechaP||'',p.fechaFinP||'',p.inicioP||'',p.finP||'',p.ctrl||'',p.fechaC||'',p.fechaFinC||'',p.inicioC||'',p.finC||''])
  ];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ws_data),'Reporte Mensual');
  XLSX.writeFile(wb,`Reporte_Mensual_LaLlave_${titulo.replace(' ','_')}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────

function cerrarClickFuera(id,e)
{if(e.target===document.getElementById(id))cerrar(id);}
init();