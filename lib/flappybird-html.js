import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const flappyHtmlPath = path.join(__dirname, '..', 'web', 'flappybird', 'index.html');

export async function loadFlappyBirdHtml() {
    return fs.readFile(flappyHtmlPath, 'utf8');
}
