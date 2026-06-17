require('dotenv').config();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');

const API_URL = process.env.RENDER_URL || 'http://localhost:3000';
const SYNC_SECRET = process.env.SYNC_SECRET || 'secret123';
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 7;

function excelDateToStr(v){
  if(!v) return '';
  if(typeof v === 'string' && v.includes('-')) return v;
  if(typeof v === 'number'){
    const d = new Date(Math.round((v - 25569)*86400*1000));
    const y = d.getUTCFullYear(), mo = String(d.getUTCMonth()+1).padStart(2,'0'), dy = String(d.getUTCDate()).padStart(2,'0');
    const h = String(d.getUTCHours()).padStart(2,'0'), mi = String(d.getUTCMinutes()).padStart(2,'0');
    return `${y}-${mo}-${dy} ${h}:${mi}`;
  }
  return String(v);
}

function normTransp(t){
  if(!t) return '';
  const s = String(t).toLowerCase();
  if(s.includes('ser nea') || s.includes('sernea')) return 'Ser Nea';
  if(s.includes('niclis')) return 'Niclis';
  if(s.includes('propio')) return 'Propio';
  return t;
}

async function runSync() {
    console.log("=== INICIANDO SINCRONIZACIÓN ===");
    
    // 1. Ensure directories exist
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR);
        console.log("❌ Carpeta 'data' no existía, la he creado. Pon los Excels ahí y vuelve a intentar.");
        return;
    }
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

    // 2. Find excel files
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (files.length === 0) {
        console.log("❌ No se encontraron archivos Excel en la carpeta 'data/'.");
        return;
    }

    let fileItems = files.find(f => f.toLowerCase().includes('item'));
    let fileOrd = files.find(f => f.toLowerCase().includes('orden') && !f.toLowerCase().includes('item'));

    if (!fileOrd && files.length > 0 && !fileItems) fileOrd = files[0];
    if (!fileItems && files.length > 1) fileItems = files[1];

    if (!fileOrd || !fileItems) {
        console.log("❌ Se necesitan 2 archivos: uno de órdenes y otro de ítems.");
        return;
    }

    console.log(`📄 Leyendo Órdenes: ${fileOrd}`);
    console.log(`📄 Leyendo Ítems: ${fileItems}`);

    try {
        const wbOrd = xlsx.readFile(path.join(DATA_DIR, fileOrd));
        const xlsOrd = xlsx.utils.sheet_to_json(wbOrd.Sheets[wbOrd.SheetNames[0]], {defval:''});

        const wbItems = xlsx.readFile(path.join(DATA_DIR, fileItems));
        const xlsItems = xlsx.utils.sheet_to_json(wbItems.Sheets[wbItems.SheetNames[0]], {defval:''});

        console.log("🌐 Obteniendo datos actuales del servidor...");
        const res = await axios.get(`${API_URL}/api/pedidos`);
        const pedidos = res.data;

        console.log("⚙️ Procesando archivos...");
        const mapaItems = {};
        xlsItems.forEach(row => {
            const nOrden = String(row['Número de Orden preparacion'] || row['Numero de Orden preparacion'] || row['N° Orden'] || '').replace(/^0+/,'');
            const cant = parseFloat(row['Cantidad'] || 0) || 0;
            if(!nOrden) return;
            if(!mapaItems[nOrden]) mapaItems[nOrden] = {lineas:0, unidades:0};
            mapaItems[nOrden].lineas++;
            mapaItems[nOrden].unidades += cant;
        });

        const maxId = pedidos.reduce((m,p)=>Math.max(m,p.id),0);
        let nextId = maxId + 1;
        const nuevos = [];
        const actualizados = [];

        xlsOrd.forEach(row => {
            const nOrden = String(row['Número'] || row['N° Orden'] || '').replace(/^0+/,'');
            const nPed   = String(row['Número de Pedido'] || '').replace(/^0+/,'');
            const nOrdenPad = nOrden.padStart(6,'0');

            const existe = pedidos.find(p => String(p.n) === nOrden || String(p.n).padStart(6,'0') === nOrdenPad);
            const itInfo = mapaItems[nOrden] || mapaItems[nOrdenPad] || {lineas:0, unidades:0};

            const transporte = normTransp(row['Medio transporte de Pedido'] || '');
            const fecha = excelDateToStr(row['Fecha de creación'] || row['Fecha de creacion'] || '');
            const cliente = String(row['Cliente'] || '').toUpperCase();
            const ciudad  = String(row['Ciudad de Ciudad de Domicilio de Cliente'] || row['Ciudad'] || '').toUpperCase();
            const vendedor= String(row['Vendedor de Pedido'] || row['Vendedor'] || '');
            const usuario = String(row['Usuario'] || '');
            const tipo    = String(row['Tipo operacion'] || row['Tipo'] || 'Normal');
            const obs     = String(row['Observaciones'] || '');

            if(existe){
                actualizados.push({
                    id: existe.id,
                    items: itInfo.lineas,
                    unidad: String(Math.round(itInfo.unidades))
                });
            } else {
                nuevos.push({
                    id: nextId++,
                    n: parseInt(nOrden) || 0,
                    ped: parseInt(nPed) || 0,
                    fecha, cliente, transporte, ciudad,
                    usuario, vendedor, tipo, obs,
                    estado: 'Ingresada',
                    picker:'', ctrl: '',
                    inicioP:'', finP:'', inicioC:'', finC:'', fechaC:'',
                    items: itInfo.lineas,
                    unidad: String(Math.round(itInfo.unidades))
                });
            }
        });

        console.log(`🚀 Enviando datos al servidor (${nuevos.length} nuevas, ${actualizados.length} a actualizar)...`);
        await axios.post(`${API_URL}/api/pedidos/batch`, 
            { nuevos, actualizados }, 
            { headers: { 'x-sync-secret': SYNC_SECRET } }
        );
        console.log("✅ Datos guardados correctamente en la base de datos.");

        // Crear Backup
        console.log("💾 Generando backup de seguridad...");
        const res2 = await axios.get(`${API_URL}/api/pedidos`);
        const todos = res2.data;
        const backupName = `backup_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        fs.writeFileSync(path.join(BACKUP_DIR, backupName), JSON.stringify(todos, null, 2));
        console.log(`✅ Backup guardado en backups/${backupName}`);

        // Rotar backups
        const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
        if (backups.length > MAX_BACKUPS) {
            const aBorrar = backups.slice(0, backups.length - MAX_BACKUPS);
            for (const f of aBorrar) {
                fs.unlinkSync(path.join(BACKUP_DIR, f));
                console.log(`🗑️ Backup antiguo eliminado: ${f}`);
            }
        }

        console.log("=== SINCRONIZACIÓN EXITOSA ===");

    } catch (err) {
        console.error("❌ ERROR AL SINCRONIZAR:", err.response?.data || err.message);
    }
}

runSync();
