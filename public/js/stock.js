const MARCAS = {
  FILGO:     { bar: '#1A4FA8', cls: 'mb-filgo' },
  BIC:       { bar: '#C92B2B', cls: 'mb-bic'   },
  COMPACTOR: { bar: '#0E7848', cls: 'mb-compactor' },
  INTRO:     { bar: '#7B3FBB', cls: 'mb-intro'  },
  OLAMI:     { bar: '#B04800', cls: 'mb-olami'  },
};
function marcaStyle(m){ return MARCAS[m] || { bar: '#8A96B0', cls: '' }; }

let conteos = [];

function hoy(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function getInicioSemana(){
  const h = new Date();
  const dia = h.getDay();
  const lun = new Date(h);
  lun.setDate(h.getDate() - (dia === 0 ? 6 : dia - 1));
  lun.setHours(0,0,0,0);
  return lun;
}

function fechaDeConteo(c){
  if(!c.fecha) return null;
  return new Date(c.fecha.replace(' ','T'));
}

async function init(){
  try {
    const res = await axios.get('/api/conteos');
    conteos = res.data;
  } catch(e) {
    console.error('Error cargando conteos:', e);
    conteos = [];
  }
  poblarContadores();
  renderMetrics();
  renderTable();
}

function poblarContadores(){
  const lista = [...new Set(conteos.map(c => c.contador).filter(Boolean))].sort();
  document.getElementById('f-contador').innerHTML =
    '<option value="">Todos los contadores</option>' +
    lista.map(n => `<option>${n}</option>`).join('');
  const dl = document.getElementById('lista-contadores');
  if(dl) dl.innerHTML = lista.map(n => `<option value="${n}">`).join('');
}

function renderMetrics(){
  const todayStr = hoy();
  const inicioSem = getInicioSemana();

  const hoyC   = conteos.filter(c => c.fecha && c.fecha.startsWith(todayStr));
  const semC   = conteos.filter(c => { const d = fechaDeConteo(c); return d && d >= inicioSem; });
  const marcasActivas = new Set(conteos.map(c => c.marca).filter(Boolean)).size;

  document.getElementById('m-hoy').textContent   = hoyC.length;
  document.getElementById('m-uhoy').textContent  = hoyC.reduce((s,c) => s + (c.cantidad||0), 0);
  document.getElementById('m-sem').textContent   = semC.length;
  document.getElementById('m-usem').textContent  = semC.reduce((s,c) => s + (c.cantidad||0), 0);
  document.getElementById('m-marcas').textContent = marcasActivas;
}

function renderTable(){
  const q  = document.getElementById('buscar').value.toLowerCase();
  const fm = document.getElementById('f-marca').value;
  const fc = document.getElementById('f-contador').value;
  const ff = document.getElementById('f-fecha').value;
  const todayStr = hoy();
  const inicioSem = getInicioSemana();

  const fil = conteos.filter(c => {
    const txt = [c.marca, c.sku, c.contador].join(' ').toLowerCase();
    if(q && !txt.includes(q)) return false;
    if(fm && c.marca !== fm) return false;
    if(fc && c.contador !== fc) return false;
    if(ff === 'hoy' && !(c.fecha && c.fecha.startsWith(todayStr))) return false;
    if(ff === 'semana'){ const d = fechaDeConteo(c); if(!d || d < inicioSem) return false; }
    return true;
  });

  const tbody = document.getElementById('tbody');
  if(!fil.length){
    tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No se encontraron resultados para los filtros aplicados.</td></tr>';
    return;
  }

  tbody.innerHTML = fil.map(c => {
    const ms  = marcaStyle(c.marca);
    const fechaDisp = c.fecha ? c.fecha.slice(0,16) : '—';
    return `<tr>
      <td class="td-bar"><div class="bar" style="background:${ms.bar}"></div></td>
      <td style="font-size:11px;color:var(--text2)">${fechaDisp}</td>
      <td><span class="mb ${ms.cls}">${c.marca||'—'}</span></td>
      <td style="font-weight:600;max-width:280px;overflow:hidden;text-overflow:ellipsis">${c.sku||'—'}</td>
      <td style="text-align:center;font-weight:800;font-size:14px;color:#1A2233">${c.cantidad??'—'}</td>
      <td style="font-weight:600;font-size:12px;color:#0E7848">${c.contador||'—'}</td>
      <td style="text-align:center">
        <button class="btn-del" title="Eliminar" onclick="eliminar(${c.id})">✕</button>
      </td>
    </tr>`;
  }).join('');
}

async function guardarNuevo(){
  const marca    = document.getElementById('nc-marca').value.trim();
  const sku      = document.getElementById('nc-sku').value.trim();
  const cantidad = parseInt(document.getElementById('nc-cantidad').value) || 0;
  const contador = document.getElementById('nc-contador').value.trim();

  if(!marca || !sku || !contador){
    alert('Completá Marca, SKU y Contador.');
    return;
  }

  const btn = document.querySelector('#mod-nuevo .btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const fecha = new Date().toISOString().slice(0,16).replace('T',' ');

  try {
    await axios.post('/api/conteos', { fecha, marca, sku, cantidad, contador });
    await init();
    cerrar('mod-nuevo');
    ['nc-marca','nc-sku','nc-cantidad','nc-contador'].forEach(id => {
      const el = document.getElementById(id);
      if(el.tagName === 'SELECT') el.value = '';
      else el.value = '';
    });
  } catch(e) {
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Guardar conteo`;
  }
}

async function eliminar(id){
  if(!confirm('¿Eliminar este conteo?')) return;
  try {
    await axios.delete(`/api/conteos/${id}`);
    await init();
  } catch(e) {
    alert('Error al eliminar: ' + e.message);
  }
}

function abrirNuevo(){ document.getElementById('mod-nuevo').classList.add('open'); }
function cerrar(id){ document.getElementById(id).classList.remove('open'); }
function cerrarOv(id, e){ if(e.target === document.getElementById(id)) cerrar(id); }

function fmtFecha(d){
  return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function abrirReporte(){
  const inicio = getInicioSemana();
  const fin    = new Date(inicio); fin.setDate(inicio.getDate()+6); fin.setHours(23,59,59);
  const titulo = `Semana ${fmtFecha(inicio)} — ${fmtFecha(fin)}`;

  const semana = conteos.filter(c => {
    if(!c.fecha) return false;
    const d = new Date(c.fecha.replace(' ','T'));
    return d >= inicio && d <= fin;
  });

  const totalConteos  = semana.length;
  const totalUnidades = semana.reduce((s,c) => s + (c.cantidad||0), 0);
  const promUnid      = totalConteos > 0 ? Math.round(totalUnidades / totalConteos) : 0;
  const todayStr      = hoy();
  const hoyC          = conteos.filter(c => c.fecha && c.fecha.startsWith(todayStr));
  const hoyUnid       = hoyC.reduce((s,c) => s + (c.cantidad||0), 0);

  // Por día
  const diasMap  = {};
  const diasNom  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  semana.forEach(c => {
    const d   = new Date(c.fecha.replace(' ','T'));
    const key = fmtFecha(d) + ' ' + diasNom[d.getDay()];
    if(!diasMap[key]) diasMap[key] = { conteos: 0, unidades: 0 };
    diasMap[key].conteos++;
    diasMap[key].unidades += (c.cantidad||0);
  });

  // Por marca
  const marcaMap = {};
  semana.forEach(c => {
    if(!marcaMap[c.marca]) marcaMap[c.marca] = { conteos: 0, unidades: 0 };
    marcaMap[c.marca].conteos++;
    marcaMap[c.marca].unidades += (c.cantidad||0);
  });

  // Por contador
  const contMap = {};
  semana.forEach(c => {
    const k = c.contador || '—';
    if(!contMap[k]) contMap[k] = { conteos: 0, unidades: 0 };
    contMap[k].conteos++;
    contMap[k].unidades += (c.cantidad||0);
  });

  const diaRows = Object.entries(diasMap).map(([d,v]) =>
    `<tr><td><strong>${d}</strong></td><td style="text-align:center">${v.conteos}</td><td style="text-align:center;font-weight:700">${v.unidades}</td></tr>`
  ).join('') || '<tr><td colspan="3" style="color:var(--text3);text-align:center;padding:12px">Sin datos esta semana</td></tr>';

  const marcaRows = Object.entries(marcaMap).sort((a,b) => b[1].unidades - a[1].unidades).map(([m,v]) => {
    const ms = marcaStyle(m);
    return `<tr><td><span class="mb ${ms.cls}">${m}</span></td><td style="text-align:center">${v.conteos}</td><td style="text-align:center;font-weight:700">${v.unidades}</td></tr>`;
  }).join('') || '<tr><td colspan="3" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';

  const contRows = Object.entries(contMap).sort((a,b) => b[1].unidades - a[1].unidades).map(([n,v]) =>
    `<tr><td><strong>${n}</strong></td><td style="text-align:center">${v.conteos}</td><td style="text-align:center;font-weight:700">${v.unidades}</td></tr>`
  ).join('') || '<tr><td colspan="3" style="color:var(--text3);text-align:center;padding:12px">Sin datos</td></tr>';

  document.getElementById('rep-title').textContent = 'Reporte de Stock · La Llave';
  document.getElementById('rep-sub').textContent   = titulo;
  document.getElementById('rep-body').innerHTML = `
    <div class="rep-section">
      <div class="rep-section-title rep-section-title-stock">Resumen de la semana</div>
      <div class="rep-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="rep-card-stock"><div class="rep-card-val" style="color:#0E7848;font-size:22px;font-weight:800">${totalConteos}</div><div class="rep-card-lbl">Conteos semana</div></div>
        <div class="rep-card-stock"><div class="rep-card-val" style="color:#0E7848;font-size:22px;font-weight:800">${totalUnidades}</div><div class="rep-card-lbl">Unidades semana</div></div>
        <div class="rep-card-stock"><div class="rep-card-val" style="color:#0E7848;font-size:22px;font-weight:800">${hoyC.length}</div><div class="rep-card-lbl">Conteos hoy</div></div>
        <div class="rep-card-stock"><div class="rep-card-val" style="color:#0E7848;font-size:22px;font-weight:800">${hoyUnid}</div><div class="rep-card-lbl">Unidades hoy</div></div>
      </div>
    </div>
    <div class="rep-section">
      <div class="rep-section-title rep-section-title-stock">Conteos por día</div>
      <table class="rep-table rep-table-stock" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Día</th><th style="text-align:center">Conteos</th><th style="text-align:center">Unidades</th></tr></thead>
        <tbody>${diaRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title rep-section-title-stock">Por marca</div>
      <table class="rep-table rep-table-stock" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Marca</th><th style="text-align:center">SKUs contados</th><th style="text-align:center">Unidades totales</th></tr></thead>
        <tbody>${marcaRows}</tbody>
      </table>
    </div>
    <div class="rep-section">
      <div class="rep-section-title rep-section-title-stock">Por contador</div>
      <table class="rep-table rep-table-stock" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Contador</th><th style="text-align:center">SKUs contados</th><th style="text-align:center">Unidades totales</th></tr></thead>
        <tbody>${contRows}</tbody>
      </table>
    </div>
    <div class="factions">
      <button class="btn-dl-stock" onclick="descargarReporte('${titulo.replace(/'/g,'').replace(/—/g,'-')}')">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargar Excel
      </button>
      <button class="btn-cancel" onclick="cerrar('mod-reporte')">Cerrar</button>
    </div>`;
  document.getElementById('mod-reporte').classList.add('open');
}

function descargarReporte(titulo){
  const inicio = getInicioSemana();
  const fin    = new Date(inicio); fin.setDate(inicio.getDate()+6); fin.setHours(23,59,59);
  const semana = conteos.filter(c => {
    if(!c.fecha) return false;
    const d = new Date(c.fecha.replace(' ','T'));
    return d >= inicio && d <= fin;
  });

  const data = [
    ['Fecha','Marca','SKU / Artículo','Cantidad','Contador'],
    ...semana.map(c => [c.fecha, c.marca, c.sku, c.cantidad, c.contador])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Conteo Semanal');
  XLSX.writeFile(wb, `Conteo_Stock_LaLlave_${new Date().toISOString().slice(0,10)}.xlsx`);
}

init();
