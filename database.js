const { Pool } = require('pg');

let pool;

async function setupDatabase() {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Create table if it doesn't exist
    await pool.query(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id SERIAL PRIMARY KEY,
            n INTEGER,
            ped INTEGER,
            fecha TEXT,
            cliente TEXT,
            transporte TEXT,
            ciudad TEXT,
            usuario TEXT,
            vendedor TEXT,
            tipo TEXT,
            obs TEXT,
            estado TEXT,
            picker TEXT,
            fechaP TEXT,
            ctrl TEXT,
            inicioP TEXT,
            finP TEXT,
            inicioC TEXT,
            finC TEXT,
            fechaC TEXT,
            items INTEGER,
            unidad TEXT
        )
    `);

    // Migraciones de columnas nuevas
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS fechadespacho TEXT`);
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS fechafinp TEXT`);
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS fechafinc TEXT`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS conteos (
            id SERIAL PRIMARY KEY,
            fecha TEXT,
            marca TEXT,
            sku TEXT,
            cantidad INTEGER,
            contador TEXT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS abastecimiento (
            id SERIAL PRIMARY KEY,
            fecha TEXT,
            hora_inicio TEXT,
            hora_fin TEXT,
            sucursal TEXT,
            bultos INTEGER,
            estado TEXT,
            responsable TEXT,
            obs TEXT,
            created_at TEXT
        )
    `);

    // Columnas nuevas para abastecimiento
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Pedido'`);
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS fecha2 TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS hora_inicio2 TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS hora_fin2 TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS controlador TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS ctrl_items INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE abastecimiento ADD COLUMN IF NOT EXISTS ctrl_unidades INTEGER DEFAULT 0`);

    return pool;
}

module.exports = {
    setupDatabase
};
