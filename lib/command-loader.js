import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * CommandIndex: alias/name (huruf kecil) -> command module { name, aliases?, execute }.
 * Satu module bisa nunjuk dari banyak key (satu per alias) -- lookup command
 * tetap O(1) berapa pun banyaknya alias yang dimiliki.
 *
 * Ini Map yang SAMA terus dari awal sampai bot mati (referensinya gak pernah
 * ganti). Jadi voxel.js cukup simpan satu referensi ke Map ini, dan hot-reload
 * di bawah otomatis update isinya di tempat -- gak perlu panggil loadCommands()
 * ulang tiap butuh command yang paling baru.
 */
export const CommandIndex = new Map();

// filePath -> { command, keysUsed, mtimeMs, size }
// Disimpan supaya waktu file berubah/dihapus, kita tau persis alias mana yang
// harus dicabut dari CommandIndex tanpa perlu nebak dari isi file yang lama.
const FileCache = new Map();

const normalize = (value) => String(value).trim().toLowerCase();
const isCommandFile = (fileName) => fileName.endsWith('.js') || fileName.endsWith('.mjs');

function registerCommand(command) {
	const keys = [command.name, ...(Array.isArray(command.aliases) ? command.aliases : [])]
		.filter(Boolean)
		.map(normalize);
	for (const key of keys) CommandIndex.set(key, command);
	return keys;
}

function unregisterFile(filePath) {
	const cached = FileCache.get(filePath);
	if (!cached) return;
	for (const key of cached.keysUsed) {
		// Cuma hapus kalau key itu masih nunjuk ke command dari file INI --
		// jaga-jaga dua file kebetulan pakai alias yang sama, jangan sampai
		// menghapus command milik file lain waktu salah satunya berubah.
		if (CommandIndex.get(key) === cached.command) CommandIndex.delete(key);
	}
	FileCache.delete(filePath);
}

async function loadFile(filePath) {
	try {
		const stats = fs.statSync(filePath);
		const url = pathToFileURL(filePath).href + `?update=${Date.now()}`;
		const mod = await import(url);
		const command = mod.default;

		if (!command?.name || typeof command.execute !== 'function') {
			console.warn(`[COMMAND] Format tidak valid (diabaikan): ${filePath}`);
			return null;
		}

		// Bersihin dulu pendaftaran lama file ini (jaga-jaga name/aliases-nya
		// berubah di antara dua reload) sebelum daftar ulang yang baru.
		unregisterFile(filePath);
		const keysUsed = registerCommand(command);
		FileCache.set(filePath, { command, keysUsed, mtimeMs: stats.mtimeMs, size: stats.size });

		return command;
	} catch (error) {
		console.error(`[COMMAND] Gagal memuat: ${filePath}`, error);
		return null;
	}
}

function walkDirectory(directory, onFile) {
	const entries = fs.readdirSync(directory, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) walkDirectory(fullPath, onFile);
		else if (entry.isFile() && isCommandFile(entry.name)) onFile(fullPath);
	}
}

/**
 * Pantau SELURUH pohon folder secara rekursif -- termasuk subfolder kategori
 * kayak commands/download/, commands/games/, commands/owner/, dst -- bukan
 * cuma folder commands/ di level paling atas.
 *
 * fs.watch({recursive:true}) Node.js baru stabil di semua platform belakangan
 * ini, tapi supaya aman di versi Node yang lebih lama / platform Linux lawas,
 * di sini tiap folder di-watch manual satu-satu, dan subfolder BARU yang
 * dibuat belakangan otomatis ikut di-watch juga (dicek tiap kali ada event).
 */
function watchTree(rootDirectory, debounceMs = 400) {
	const watchedDirs = new Set();
	const pendingReload = new Map(); // filePath -> timeout handle (debounce)

	function handleFileEvent(fullPath) {
		if (!isCommandFile(fullPath)) return;

		clearTimeout(pendingReload.get(fullPath));
		pendingReload.set(fullPath, setTimeout(async () => {
			pendingReload.delete(fullPath);

			if (!fs.existsSync(fullPath)) {
				const hadEntry = FileCache.has(fullPath);
				unregisterFile(fullPath);
				if (hadEntry) console.log(`[COMMAND] Dihapus: ${fullPath}`);
				return;
			}

			const stats = fs.statSync(fullPath);
			const cached = FileCache.get(fullPath);
			const changed = !cached || cached.mtimeMs !== stats.mtimeMs || cached.size !== stats.size;
			if (!changed) return;

			const command = await loadFile(fullPath);
			if (command) console.log(`[COMMAND] ${cached ? 'Diperbarui' : 'Ditambahkan'}: ${fullPath} (${command.name})`);
		}, debounceMs));
	}

	function watchDir(dir) {
		if (watchedDirs.has(dir)) return;
		watchedDirs.add(dir);

		try {
			fs.watch(dir, (eventType, fileName) => {
				if (!fileName) return;
				const fullPath = path.join(dir, fileName);

				// Folder kategori baru yang baru dibuat belakangan (mis. commands/owner/
				// ditambah setelah bot nyala) -- langsung di-watch DAN langsung di-scan
				// isinya sekarang juga. Cuma pasang watcher buat kejadian nanti gak
				// cukup: kalau file di dalamnya sempat dibuat duluan sebelum watcher
				// baru ini nempel (race condition -- folder+file dibuat berurutan
				// cepat, umum kalau dibuat lewat script), file itu bakal ke-skip
				// selamanya kalau kita cuma nunggu event berikutnya.
				if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
					watchDir(fullPath);
					walkDirectory(fullPath, (existingFile) => handleFileEvent(existingFile));
					return;
				}

				handleFileEvent(fullPath);
			});
		} catch (error) {
			console.error(`[COMMAND] Gagal memantau folder: ${dir}`, error);
		}

		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) watchDir(path.join(dir, entry.name));
		}
	}

	watchDir(rootDirectory);
}

/**
 * Scan seluruh folder `commands/` secara REKURSIF -- boleh dikelompokkan per
 * kategori lewat subfolder (commands/download/, commands/games/, commands/owner/,
 * dst) -- lalu pasang hot-reload buat SELURUH pohon folder itu. Setiap file
 * harus export default { name, aliases?, execute }; `aliases` boleh diisi
 * berapa pun banyaknya, semuanya ikut kedaftar nunjuk ke command yang sama.
 *
 * Nilai baliknya adalah CommandIndex -- referensinya tetap sama sepanjang
 * proses berjalan, jadi pemanggil cukup simpan satu referensi Map ini dan
 * baca dari situ terus; hot-reload otomatis mengubah ISI map yang sama,
 * tidak perlu panggil loadCommands() lagi buat dapat versi terbaru.
 */
export async function loadCommands(directory = './commands') {
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
		return CommandIndex;
	}

	const files = [];
	walkDirectory(directory, (filePath) => files.push(filePath));

	for (const filePath of files) {
		const command = await loadFile(filePath);
		if (command) console.log(`[COMMAND] Loaded: ${command.name} (${path.relative(directory, filePath)})`);
	}

	watchTree(directory);

	return CommandIndex;
}
