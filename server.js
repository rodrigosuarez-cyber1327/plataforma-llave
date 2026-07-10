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
        const { rows } = await db.query('SELECT * FROM pedidos ORDER BY id DESC');
        const mapped = rows.map(r => ({
            ...r,
            fechaP:        r.fechap        ?? r.fechaP,
            inicioP:       r.iniciop       ?? r.inicioP,
            finP:          r.finp          ?? r.finP,
            fechaFinP:     r.fechafinp     ?? null,
            inicioC:       r.inicioc       ?? r.inicioC,
            finC:          r.finc          ?? r.finC,
            fechaC:        r.fechac        ?? r.fechaC,
            fechaFinC:     r.fechafinc     ?? null,
            fechaDespacho: r.fechadespacho ?? null,
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new order (from modal)
app.post('/api/pedidos', async (req, res) => {
    try {
        const { n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, obs, estado } = req.body;
        const result = await db.query(`
            INSERT INTO pedidos (n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, inicioC, finC, fechaC, obs, estado, usuario, vendedor)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '', '', '', $15, $16, '', '')
            RETURNING id
        `, [n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, obs, estado || 'Ingresada']);
        
        res.status(201).json({ id: result.rows[0].id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update an order (from modal)
app.put('/api/pedidos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { picker, fechaP, inicioP, finP, fechaFinP, ctrl, inicioC, finC, fechaC, fechaFinC, estado, items } = req.body;
        console.log(`PUT /api/pedidos/${id} →`, { picker, fechaP, inicioP, finP, fechaFinP, ctrl, inicioC, finC, fechaC, fechaFinC, estado, items });

        // Si se marca como Completada, registrar fecha de despacho automáticamente
        const { rows: current } = await db.query('SELECT fechadespacho FROM pedidos WHERE id = $1', [id]);
        const yaDespacho = current[0]?.fechadespacho;
        const fechaDespacho = (estado === 'Completada' && !yaDespacho)
            ? new Date().toISOString().slice(0, 10)
            : (yaDespacho || null);

        await db.query(`
            UPDATE pedidos
            SET picker=$1, fechaP=$2, inicioP=$3, finP=$4, fechafinp=$5,
                ctrl=$6, inicioC=$7, finC=$8, fechaC=$9, fechafinc=$10,
                estado=$11, items=$12, fechadespacho=$13
            WHERE id=$14
        `, [picker, fechaP, inicioP, finP, fechaFinP||null, ctrl, inicioC, finC, fechaC, fechaFinC||null, estado, items, fechaDespacho, id]);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete an order
app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM pedidos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch insert/update (Protected, used by sync.js)
app.post('/api/pedidos/batch', checkSecret, async (req, res) => {
    try {
        const { nuevos, actualizados } = req.body;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Insertar nuevos
            for (const p of nuevos) {
                await client.query(`
                    INSERT INTO pedidos (id, n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, inicioC, finC, fechaC, obs, estado, usuario, vendedor)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                `, [p.id, p.n, p.ped, p.fecha, p.cliente, p.transporte, p.ciudad, p.items, p.unidad, p.tipo, p.picker, p.fechaP, p.ctrl, p.inicioP, p.finP, p.inicioC, p.finC, p.fechaC, p.obs, p.estado, p.usuario, p.vendedor]);
            }

            // Actualizar items de los existentes
            for (const p of actualizados) {
                await client.query(`
                    UPDATE pedidos SET items = $1, unidad = $2 WHERE id = $3
                `, [p.items, p.unidad, p.id]);
            }

            await client.query('COMMIT');
            res.json({ success: true, inserted: nuevos.length, updated: actualizados.length });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error("Batch error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ── ABASTECIMIENTO A SUCURSALES ───────────────────────────────────────────────

app.get('/api/abastecimiento', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM abastecimiento ORDER BY id DESC');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/abastecimiento', async (req, res) => {
    try {
        const { fecha, hora_inicio, hora_fin, sucursal, bultos, estado, responsable, obs, tipo, fecha2, hora_inicio2, hora_fin2 } = req.body;
        const created_at = new Date().toISOString().slice(0,16).replace('T',' ');
        const result = await db.query(
            `INSERT INTO abastecimiento (fecha, hora_inicio, hora_fin, sucursal, bultos, estado, responsable, obs, created_at, tipo, fecha2, hora_inicio2, hora_fin2)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
            [fecha, hora_inicio, hora_fin, sucursal, bultos, estado||'Pendiente', responsable, obs, created_at, tipo||'Pedido', fecha2||'', hora_inicio2||'', hora_fin2||'']
        );
        res.status(201).json({ id: result.rows[0].id, ...req.body });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/abastecimiento/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, hora_inicio, hora_fin, sucursal, bultos, estado, responsable, obs, tipo, fecha2, hora_inicio2, hora_fin2 } = req.body;
        await db.query(
            `UPDATE abastecimiento SET fecha=$1, hora_inicio=$2, hora_fin=$3, sucursal=$4, bultos=$5, estado=$6, responsable=$7, obs=$8, tipo=$9, fecha2=$10, hora_inicio2=$11, hora_fin2=$12 WHERE id=$13`,
            [fecha, hora_inicio, hora_fin, sucursal, bultos, estado, responsable, obs, tipo||'Pedido', fecha2||'', hora_inicio2||'', hora_fin2||'', id]
        );
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/abastecimiento/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM abastecimiento WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/abastecimiento/batch', async (req, res) => {
    try {
        const items = req.body;
        if(!Array.isArray(items)) return res.status(400).json({ error: 'Se esperaba un array' });
        const created_at = new Date().toISOString().slice(0,16).replace('T',' ');
        for(const it of items){
            await db.query(
                `INSERT INTO abastecimiento (fecha, hora_inicio, hora_fin, sucursal, bultos, estado, responsable, obs, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [it.fecha||'', it.hora_inicio||'', it.hora_fin||'', it.sucursal||'', parseInt(it.bultos)||0, it.estado||'Pendiente', it.responsable||'', it.obs||'', created_at]
            );
        }
        res.json({ success: true, imported: items.length });
    } catch(error){ res.status(500).json({ error: error.message }); }
});

// ── CONTEOS DE STOCK ──────────────────────────────────────────────────────────

app.get('/api/conteos', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM conteos ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/conteos', async (req, res) => {
    try {
        const { fecha, marca, sku, cantidad, contador } = req.body;
        const result = await db.query(
            'INSERT INTO conteos (fecha, marca, sku, cantidad, contador) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [fecha, marca, sku, cantidad, contador]
        );
        res.status(201).json({ id: result.rows[0].id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/conteos/batch', async (req, res) => {
    try {
        const items = req.body;
        if(!Array.isArray(items)) return res.status(400).json({ error: 'Se esperaba un array' });
        const fecha = new Date().toISOString().slice(0,16).replace('T',' ');
        for(const it of items){
            await db.query(
                'INSERT INTO conteos (fecha, marca, sku, cantidad, contador) VALUES ($1,$2,$3,$4,$5)',
                [fecha, it.marca, it.sku, it.cantidad||0, it.contador||'']
            );
        }
        res.json({ success: true, imported: items.length });
    } catch(error){ res.status(500).json({ error: error.message }); }
});

app.delete('/api/conteos/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM conteos WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────

// Restore whole database (Protected, used by restore.js)
app.post('/api/pedidos/restore', checkSecret, async (req, res) => {
    try {
        const pedidos = req.body;
        if (!Array.isArray(pedidos)) {
            return res.status(400).json({ error: 'Payload must be an array of orders' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM pedidos');
            for (const p of pedidos) {
                await client.query(`
                    INSERT INTO pedidos (id, n, ped, fecha, cliente, transporte, ciudad, items, unidad, tipo, picker, fechaP, ctrl, inicioP, finP, inicioC, finC, fechaC, obs, estado, usuario, vendedor)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                `, [p.id, p.n, p.ped, p.fecha, p.cliente, p.transporte, p.ciudad, p.items, p.unidad, p.tipo, p.picker, p.fechaP, p.ctrl, p.inicioP, p.finP, p.inicioC, p.finC, p.fechaC, p.obs, p.estado, p.usuario, p.vendedor]);
            }
            await client.query('COMMIT');
            res.json({ success: true, restoredCount: pedidos.length });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
