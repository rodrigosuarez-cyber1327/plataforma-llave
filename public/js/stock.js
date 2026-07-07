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

// ── SUBIR EXCEL ───────────────────────────────────────────────────────────────

let excelData = [];

function procesarExcel(input){
  const file = input.files[0]; if(!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    const wb  = XLSX.read(e.target.result, { type: 'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    if(!raw.length){ alert('El archivo está vacío'); return; }

    const cabecera = raw[0].map(c => String(c).toUpperCase().trim());
    const iMarca = cabecera.findIndex(c => c.includes('MARCA'));
    const iSku   = cabecera.findIndex(c => c.includes('SKU') || c.includes('ARTÍCULO') || c.includes('ARTICULO') || c.includes('DESCRIPCION') || c.includes('DESCRIPCIÓN'));
    const iCant  = cabecera.findIndex(c => c.includes('CANTIDAD') || c.includes('CANT'));
    const iCont  = cabecera.findIndex(c => c.includes('CONTADOR') || c.includes('RESPONSABLE'));

    const filas = raw.slice(1).filter(r => r.some(v => String(v).trim()));
    excelData = filas.map(r => ({
      marca:    iMarca>=0 ? String(r[iMarca]||'').toUpperCase().trim() : '',
      sku:      iSku>=0   ? String(r[iSku]||'').trim()                 : String(r[1]||'').trim(),
      cantidad: iCant>=0  ? parseInt(r[iCant])||0                      : parseInt(r[2])||0,
      contador: iCont>=0  ? String(r[iCont]||'').trim()                : '',
    })).filter(r => r.sku || r.marca);

    if(!excelData.length){ alert('No se encontraron filas con datos'); return; }

    const sinMarca = excelData.filter(r => !r.marca).length;
    document.getElementById('excel-info').innerHTML =
      `<strong>${excelData.length} filas</strong> detectadas del archivo <em>${file.name}</em>`;
    document.getElementById('excel-warn').textContent =
      sinMarca > 0 ? `⚠️ ${sinMarca} filas no tienen marca asignada` : '';

    const preview = excelData.slice(0,15);
    document.getElementById('excel-preview').innerHTML = `
      <thead><tr style="background:#E6F8EE">
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#0A5020">MARCA</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#0A5020">SKU / ARTÍCULO</th>
        <th style="padding:6px 10px;text-align:center;font-size:10px;color:#0A5020">CANTIDAD</th>
        <th style="padding:6px 10px;text-align:left;font-size:10px;color:#0A5020">CONTADOR</th>
      </tr></thead>
      <tbody>${preview.map(r=>`<tr>
        <td style="padding:5px 10px;border-bottom:1px solid #F0FFF6"><span class="mb ${marcaStyle(r.marca).cls||''}">${r.marca||'—'}</span></td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0FFF6;font-size:11px">${r.sku||'—'}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0FFF6;text-align:center;font-weight:700">${r.cantidad}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0FFF6;color:#0E7848;font-size:11px">${r.contador||'—'}</td>
      </tr>`).join('')}
      ${excelData.length>15?`<tr><td colspan="4" style="padding:8px 10px;color:#9CA3AF;font-size:11px;text-align:center">... y ${excelData.length-15} filas más</td></tr>`:''}</tbody>`;

    document.getElementById('mod-excel').classList.add('open');
  };
  reader.readAsArrayBuffer(file);
}

async function confirmarImportacion(){
  if(!excelData.length) return;
  const btn = document.querySelector('#mod-excel .btn-save');
  btn.disabled = true; btn.textContent = 'Importando…';
  try {
    const res = await axios.post('/api/conteos/batch', excelData);
    cerrar('mod-excel');
    await init();
    alert(`✅ ${res.data.imported} artículos importados correctamente`);
  } catch(e){
    alert('Error al importar: ' + (e.response?.data?.error || e.message));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Confirmar importación';
  }
}

// ── INFORME GERENCIAL STOCK ───────────────────────────────────────────────────

function abrirGerencialStock(){
  const totalConteos  = conteos.length;
  const totalUnidades = conteos.reduce((s,c)=>s+(c.cantidad||0),0);
  const marcasSet     = new Set(conteos.map(c=>c.marca).filter(Boolean));
  const todayStr      = hoy();
  const hoyC          = conteos.filter(c=>c.fecha&&c.fecha.startsWith(todayStr));

  // Por marca
  const mMap = {};
  conteos.forEach(c=>{
    const k = c.marca||'Sin marca';
    if(!mMap[k]) mMap[k]={conteos:0,unidades:0};
    mMap[k].conteos++; mMap[k].unidades+=(c.cantidad||0);
  });

  // Top 10 SKUs
  const skuMap = {};
  conteos.forEach(c=>{
    const k=c.sku||'—';
    if(!skuMap[k]) skuMap[k]={marca:c.marca,cantidad:0,conteos:0};
    skuMap[k].cantidad+=(c.cantidad||0); skuMap[k].conteos++;
  });
  const top10 = Object.entries(skuMap).sort((a,b)=>b[1].cantidad-a[1].cantidad).slice(0,10);

  // Por contador
  const cMap = {};
  conteos.forEach(c=>{
    const k=c.contador||'—';
    if(!cMap[k]) cMap[k]={conteos:0,unidades:0};
    cMap[k].conteos++; cMap[k].unidades+=(c.cantidad||0);
  });

  const marcaRows = Object.entries(mMap).sort((a,b)=>b[1].unidades-a[1].unidades).map(([m,v])=>{
    const ms=marcaStyle(m);
    const pct=totalUnidades>0?Math.round(v.unidades/totalUnidades*100):0;
    return `<tr>
      <td><span class="mb ${ms.cls}">${m}</span></td>
      <td style="text-align:center">${v.conteos}</td>
      <td style="text-align:center;font-weight:700">${v.unidades}</td>
      <td style="text-align:center">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;background:#E5E7EB;border-radius:4px;height:8px;overflow:hidden">
            <div style="width:${pct}%;background:#0E7848;height:100%;border-radius:4px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#0E7848;min-width:30px">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:12px">Sin datos</td></tr>';

  const skuRows = top10.map(([sku,v])=>{
    const ms=marcaStyle(v.marca||'');
    return `<tr>
      <td style="font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sku}</td>
      <td><span class="mb ${ms.cls}">${v.marca||'—'}</span></td>
      <td style="text-align:center;font-weight:700">${v.cantidad}</td>
      <td style="text-align:center">${v.conteos}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:12px">Sin datos</td></tr>';

  const contRows = Object.entries(cMap).sort((a,b)=>b[1].unidades-a[1].unidades).map(([n,v])=>
    `<tr><td><strong style="color:#0E7848">${n}</strong></td><td style="text-align:center">${v.conteos}</td><td style="text-align:center;font-weight:700">${v.unidades}</td></tr>`
  ).join('')||'<tr><td colspan="3" style="text-align:center;color:#9CA3AF;padding:12px">Sin datos</td></tr>';

  const hoyStr = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  document.getElementById('ger-stock-sub').textContent = `La Llave · Depósito Ruta 11 · ${hoyStr}`;

  document.getElementById('ger-stock-body').innerHTML = `
    <div class="rep-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="rep-card-stock"><div class="rep-card-val">${totalConteos}</div><div class="rep-card-lbl">Total conteos</div></div>
      <div class="rep-card-stock"><div class="rep-card-val">${totalUnidades}</div><div class="rep-card-lbl">Unidades totales</div></div>
      <div class="rep-card-stock"><div class="rep-card-val">${marcasSet.size}</div><div class="rep-card-lbl">Marcas activas</div></div>
      <div class="rep-card-stock"><div class="rep-card-val">${hoyC.length}</div><div class="rep-card-lbl">Conteos hoy</div></div>
    </div>
    <div class="rep-section">
      <div class="rep-section-title-stock">Unidades por marca</div>
      <table class="rep-table rep-table-stock">
        <thead><tr><th>Marca</th><th style="text-align:center">Conteos</th><th style="text-align:center">Unidades</th><th style="text-align:center">% del total</th></tr></thead>
        <tbody>${marcaRows}</tbody>
      </table>
    </div>
    <div class="rep-section" style="margin-top:16px">
      <div class="rep-section-title-stock">Top 10 SKUs por cantidad</div>
      <table class="rep-table rep-table-stock">
        <thead><tr><th>SKU / Artículo</th><th>Marca</th><th style="text-align:center">Unidades</th><th style="text-align:center">Conteos</th></tr></thead>
        <tbody>${skuRows}</tbody>
      </table>
    </div>
    <div class="rep-section" style="margin-top:16px">
      <div class="rep-section-title-stock">Productividad por contador</div>
      <table class="rep-table rep-table-stock">
        <thead><tr><th>Contador</th><th style="text-align:center">SKUs contados</th><th style="text-align:center">Unidades totales</th></tr></thead>
        <tbody>${contRows}</tbody>
      </table>
    </div>
    <div class="factions" style="margin-top:16px">
      <button class="btn-dl-stock" onclick="imprimirGerencialStock()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir / PDF
      </button>
      <button class="btn-cancel" onclick="cerrar('mod-gerencial-stock')">Cerrar</button>
    </div>`;

  document.getElementById('mod-gerencial-stock').classList.add('open');
}

function imprimirGerencialStock(){
  const hoyStr = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const body   = document.getElementById('ger-stock-body').innerHTML
    .replace(/<div class="factions"[\s\S]*?<\/div>\s*<\/div>/, '');
  const w = window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe Gerencial Stock · La Llave</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
@page{size:A4;margin:18mm 15mm 15mm;}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1F2937;font-size:11px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:3px solid #0A4A28;margin-bottom:16px;}
.co{font-size:20px;font-weight:900;color:#0A4A28;}.co-sub{font-size:11px;color:#6B7280;margin-top:2px;}
.rep-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}
.rep-card-stock{border:1.5px solid #90DBA8;border-radius:8px;padding:12px;text-align:center;background:#F0FFF6;}
.rep-card-val{font-size:26px;font-weight:900;color:#0E7848;}.rep-card-lbl{font-size:10px;color:#6B7280;font-weight:600;margin-top:3px;}
.rep-section{margin-bottom:14px;}
.rep-section-title-stock{font-size:10px;font-weight:800;text-transform:uppercase;color:#156E3C;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid #C0EDD0;}
.rep-table-stock{width:100%;border-collapse:collapse;font-size:10px;}
.rep-table-stock th{background:#0A4A28;color:#fff;padding:5px 8px;text-align:left;}
.rep-table-stock td{padding:4px 8px;border-bottom:1px solid #F0FFF6;}
.rep-table-stock tr:nth-child(even) td{background:#F9FAFB;}
.mb{display:inline-flex;align-items:center;font-size:9px;font-weight:800;padding:2px 8px;border-radius:20px;border:1px solid;}
.mb-filgo{background:#EBF1FF;color:#1A4FA8;border-color:#90B8F0;}
.mb-bic{background:#FFF0F0;color:#C92B2B;border-color:#F5C0C0;}
.mb-compactor{background:#E6F8EE;color:#0E7848;border-color:#80D8A8;}
.mb-intro{background:#F5EEFF;color:#7B3FBB;border-color:#C9A0F0;}
.mb-olami{background:#FFF0E0;color:#B04800;border-color:#F0C090;}
.foot{margin-top:14px;border-top:1px solid #E5E7EB;padding-top:8px;display:flex;justify-content:space-between;color:#9CA3AF;font-size:9px;}
</style></head><body>
<div class="hdr">
  <div><div class="co">La Llave · Informe Gerencial de Stock</div><div class="co-sub">Depósito Ruta 11 · ${hoyStr}</div></div>
  <div style="color:#9CA3AF;font-size:10px">Generado el ${hoyStr}</div>
</div>
${body}
<div class="foot"><span>La Llave · Sistema de Gestión de Depósito</span><span>${hoyStr}</span></div>
</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

init();
