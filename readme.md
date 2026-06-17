# Plataforma de Órdenes · La Llave

Este es el sistema centralizado de órdenes de preparación para el depósito de La Llave. Como encargado, tu tarea diaria es cargar las planillas de Excel al sistema para que los chicos de depósito puedan verlas actualizadas desde su celular o computadora.

---

## ⚙️ Instalación Inicial (Sólo la primera vez)

Antes de poder usar el sistema, necesitas instalar los programas básicos en tu computadora. Esto **se hace una sola vez**.

1. **Descargar e instalar Node.js:**
   - Entra a [https://nodejs.org/](https://nodejs.org/).
   - Descarga el botón grande verde que dice **"LTS (Recomendado para la mayoría)"**.
   - Ejecuta el archivo descargado y dale a "Siguiente" en todo (Next -> Next -> Install).
2. **Preparar el proyecto:**
   - Abre la consola (Terminal o CMD) dentro de esta misma carpeta del proyecto.
   - Escribe el comando `npm install` y presiona Enter. Esto descargará unos archivos necesarios para que el programa funcione.

---

## 📅 Tu Tarea Diaria (Sincronización)

Cada día debes seguir estos pasos para cargar las nuevas órdenes al sistema:

### Paso 1: Mover los Excels
Ve a la carpeta del proyecto y entra a la carpeta llamada **`data`**. 
Ahí dentro debes pegar los **2 archivos de Excel** que descargaste del sistema:
1. `Listado_de_Orden_preparacion_...`
2. `Listado_de_Item_orden_preparacion_...`

*(No importa si los archivos de días anteriores quedan ahí, el sistema siempre buscará los correctos).*

### Paso 2: Subir los datos
1. Abre tu consola (Terminal o Símbolo de sistema) en esta misma carpeta del proyecto.
2. Escribe el siguiente comando y presiona `Enter`:
   ```bash
   npm run sync
   ```
3. Espera unos segundos. Verás mensajes en la pantalla indicando cuántas órdenes nuevas se procesaron. ¡Y listo! La web ya está actualizada para todos.

---

## 💾 Backups Automáticos

Cada vez que ejecutas el comando anterior, el sistema automáticamente guarda una copia de seguridad en la carpeta **`backups`**. 
- No tienes que hacer nada, se guardan solos.
- Sólo se guardarán las últimas 7 copias para no llenarte de archivos innecesarios.

## ⏪ Restaurar un Backup (Sólo Emergencias)
Si alguna vez pasa algo grave en la plataforma y necesitas "volver el tiempo atrás", puedes restaurar la base de datos usando una de tus copias de seguridad:

1. Ve a la carpeta **`backups`** y copia el nombre del archivo que quieras usar (ejemplo: `backup_2026-06-17T12-00-00.json`).
2. En la consola escribe el siguiente comando, pegando el nombre del archivo al final:
   ```bash
   npm run restore backup_2026-06-17T12-00-00.json
   ```
3. Esto borrará la base de datos de internet y la reemplazará por la copia exacta de ese día.

---

## 🛠️ Para el Desarrollador (Cómo levantar el proyecto)

Si necesitas hacer pruebas locales o modificar el código, aquí tienes cómo arrancar la plataforma en tu computadora:

1. **Instalar dependencias** (solo la primera vez):
   Abre la consola en esta carpeta y ejecuta:
   ```bash
   npm install
   ```

2. **Iniciar el servidor local**:
   Ejecuta:
   ```bash
   npm start
   ```
   *Esto encenderá el servidor en el puerto 3000.*
   *(Para detener el servidor, haz clic en la consola y presiona `Ctrl + C` dos veces).*

3. **Ver la página**:
   Abre tu navegador y entra a: [http://localhost:3000](http://localhost:3000)

> **Nota:** Para que el script de sincronización envíe los datos a tu servidor local en vez de a Render (durante tus pruebas), asegúrate de tener el archivo `.env` configurado con `RENDER_URL=http://localhost:3000`.