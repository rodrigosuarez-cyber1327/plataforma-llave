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

    return pool;
}

module.exports = {
    setupDatabase
};
