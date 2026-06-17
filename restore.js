require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = process.env.RENDER_URL || 'http://localhost:3000';
const SYNC_SECRET = process.env.SYNC_SECRET || 'secret123';
const BACKUP_DIR = path.join(__dirname, 'backups');

async function runRestore() {
    const filename = process.argv[2];
    if (!filename) {
        console.log("❌ Debes especificar el nombre del archivo de backup.");
        console.log("Ejemplo: npm run restore backup_2026-06-17T12-00-00.json");
        return;
    }

    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
        console.log(`❌ No se encontró el archivo: ${filepath}`);
        return;
    }

    try {
        console.log(`📄 Leyendo backup: ${filename}...`);
        const data = fs.readFileSync(filepath, 'utf-8');
        const pedidos = JSON.parse(data);

        if (!Array.isArray(pedidos)) {
            console.log("❌ El archivo no tiene el formato correcto.");
            return;
        }

        console.log(`🚀 Restaurando ${pedidos.length} órdenes en el servidor... ESTO REEMPLAZARÁ LA BASE DE DATOS ACTUAL.`);
        
        const res = await axios.post(`${API_URL}/api/pedidos/restore`, pedidos, {
            headers: { 'x-sync-secret': SYNC_SECRET }
        });

        if (res.data.success) {
            console.log(`✅ Backup restaurado con éxito. ${res.data.restoredCount} órdenes procesadas.`);
        } else {
            console.log("⚠️ Respuesta inesperada del servidor:", res.data);
        }

    } catch (err) {
        console.error("❌ ERROR AL RESTAURAR:", err.response?.data || err.message);
    }
}

runRestore();
