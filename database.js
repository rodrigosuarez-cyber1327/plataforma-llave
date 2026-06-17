const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');

const DB_FILE = './database.sqlite';

async function setupDatabase() {
    const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    return db;
}

module.exports = {
    setupDatabase
};
