import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Menyajikan folder 'birthday' dan 'flappybird' sebagai static files
const app = express();
app.use('/birthday', express.static(path.join(__dirname, 'birthday')));
app.use('/flappybird', express.static(path.join(__dirname, 'flappybird')));

const PORT = process.env.WEB_PORT || 3000;

/**
 * Start server lokal tanpa tunnel publik. Ini dipilih supaya bot tetap bisa
 * melayani file web seperti birthday/flappybird di Android/Termux tanpa
 * dependency cloudflared yang tidak kompatibel dengan platform "android".
 */
function startWebServer() {
	app.listen(PORT, () => {
		console.log(chalk.cyan(`[WEB] Server lokal jalan di port :${PORT}`));
		global.webBaseUrl = null;
	});
}

export { startWebServer, app };
