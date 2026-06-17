require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.RENDER_URL || 'http://localhost:3000';
const SYNC_SECRET = process.env.SYNC_SECRET || 'secret123';

async function clearDB() {
    console.log("Borrando la base de datos...");
    try {
        const res = await axios.post(`${API_URL}/api/pedidos/restore`, [], {
            headers: { 'x-sync-secret': SYNC_SECRET }
        });
        console.log("¡Base de datos limpiada con éxito!");
    } catch (err) {
        console.error("Error al limpiar:", err.response?.data || err.message);
    }
}
clearDB();
