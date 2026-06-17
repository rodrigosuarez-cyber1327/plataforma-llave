require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { setupDatabase } = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SYNC_SECRET = process.env.SYNC_SECRET || 'secret123'; // Default secret if not set

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let db;

// Middleware to check secret for sensitive routes
function checkSecret(req, res, next) {
    const providedSecret = req.headers['x-sync-secret'];
    if (providedSecret !== SYNC_SECRET) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Sync Secret' });
    }
    next();
}

// Initialize DB and start server
setupDatabase().then(database => {
    db = database;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error("Failed to setup database", err);
});

// API Routes

// Get all orders (Public for read)
app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidos = await db.all('SELECT * FROM pedidos ORDER BY id DESC');
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new order (from modal)
app.post('/api/pedidos', async (req, res) => {
    try {
        const { n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, obs, estado } = req.body;
        const result = await db.run(`
            INSERT INTO pedidos (n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, inicioC, finC, fechaC, obs, estado, usuario, vendedor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, '', '')
        `, [n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, obs, estado || 'Ingresada']);
        
        res.status(201).json({ id: result.lastID, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update an order (from modal)
app.put('/api/pedidos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { picker, fechaP, inicioP, finP, ctrl, inicioC, finC, fechaC, estado, items } = req.body;
        
        await db.run(`
            UPDATE pedidos 
            SET picker = ?, fechaP = ?, inicioP = ?, finP = ?, ctrl = ?, inicioC = ?, finC = ?, fechaC = ?, estado = ?, items = ?
            WHERE id = ?
        `, [picker, fechaP, inicioP, finP, ctrl, inicioC, finC, fechaC, estado, items, id]);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch insert/update (Protected, used by sync.js)
app.post('/api/pedidos/batch', checkSecret, async (req, res) => {
    try {
        const { nuevos, actualizados } = req.body;

        await db.exec('BEGIN TRANSACTION');

        try {
            // Insertar nuevos
            for (const p of nuevos) {
                await db.run(`
                    INSERT INTO pedidos (id, n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, inicioC, finC, fechaC, obs, estado, usuario, vendedor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [p.id, p.n, p.ped, p.fecha, p.cliente, p.transporte, p.ciudad, p.items, p.unidad, p.tipo, p.picker, p.fechaP, p.ctrl, p.inicioP, p.finP, p.inicioC, p.finC, p.fechaC, p.obs, p.estado, p.usuario, p.vendedor]);
            }

            // Actualizar items de los existentes
            for (const p of actualizados) {
                await db.run(`
                    UPDATE pedidos SET items = ?, unidad = ? WHERE id = ?
                `, [p.items, p.unidad, p.id]);
            }

            await db.exec('COMMIT');
            res.json({ success: true, inserted: nuevos.length, updated: actualizados.length });
        } catch (err) {
            await db.exec('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error("Batch error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Restore whole database (Protected, used by restore.js)
app.post('/api/pedidos/restore', checkSecret, async (req, res) => {
    try {
        const pedidos = req.body;
        if (!Array.isArray(pedidos)) {
            return res.status(400).json({ error: 'Payload must be an array of orders' });
        }

        await db.exec('BEGIN TRANSACTION');
        try {
            await db.exec('DELETE FROM pedidos');
            for (const p of pedidos) {
                await db.run(`
                    INSERT INTO pedidos (id, n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, inicioC, finC, fechaC, obs, estado, usuario, vendedor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [p.id, p.n, p.ped, p.fecha, p.cliente, p.transporte, p.ciudad, p.items, p.unidad, p.tipo, p.picker, p.fechaP, p.ctrl, p.inicioP, p.finP, p.inicioC, p.finC, p.fechaC, p.obs, p.estado, p.usuario, p.vendedor]);
            }
            await db.exec('COMMIT');
            res.json({ success: true, restoredCount: pedidos.length });
        } catch (err) {
            await db.exec('ROLLBACK');
            throw err;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
