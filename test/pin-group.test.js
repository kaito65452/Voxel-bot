// Self-check .pinm + .group.
// Jalankan: node test/pin-group.test.js   (tanpa npm install)
//
// .pinm SENDIRI nggak bisa di-import (masih di dalam switch gede voxel.js),
// jadi bentuk pemanggilan pin dicek langsung terhadap KONTRAK library yang
// dipake bot -- persis baris yang bikin .pinm lama diam-diam gagal.
import assert from 'node:assert';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../voxel.js', import.meta.url), 'utf8');

// --- .pinm: kontrak WAProto.Message.PinInChatMessage -------------------------
// Library baca `pin` sebagai MessageKey LANGSUNG + `type` di luar `pin`.
// Bentuk lama { pin: { type, time, key } } bikin key-nya objek ngawur dan
// type-nya UNKNOWN_TYPE(0).
const pinCall = src.match(/voxel\.sendMessage\(m\.chat, \{ pin: .*?\}\)/s)?.[0];
assert.ok(pinCall, 'panggilan pin di voxel.js hilang');
assert.match(pinCall, /\{ pin: key, type: unpin \? 2 : 1, time: \d+ \}/, `bentuk pin salah: ${pinCall}`);
assert.doesNotMatch(pinCall, /pin: \{/, 'pin harus MessageKey langsung, bukan objek {type,time,key}');

// Key WA yang wajib: remoteJid + id (+ participant buat pesan orang lain).
const keyCall = src.match(/const key = \{[^}]*\}/)?.[0];
assert.ok(keyCall, 'pembentuk key pin hilang');
for (const wajib of ['remoteJid', 'fromMe', 'id', 'participant']) {
	assert.ok(keyCall.includes(wajib), `key pin kurang "${wajib}": ${keyCall}`);
}
// type 1 = PIN_FOR_ALL, 2 = UNPIN_FOR_ALL (bukan 0 = UNKNOWN_TYPE).
assert.match(src, /type: unpin \? 2 : 1/, 'type pin/unpin harus 1/2, bukan 0');
// `.unpin` harus jadi alias resmi -- user sockaddr ngetik `.unpin` (bukan `unpinm`),
// dan `.unpin` nggak dipakai command lain (`.pin` aja yangtaken Pinterest).
assert.match(src, /case 'pinm': case 'unpinm': case 'unpin':/, 'alias .unpin hilang');
assert.doesNotMatch(src, /case 'unpin': case '/, 'case .unpin jangan digabung dgn command lain');
// Penentu arah pin/unpin: startsWith('unpin') harus cocok buat ke-3 nama itu.
assert.match(src, /const unpin = command\.startsWith\('unpin'\)/, 'penentu unpin harus startsWith(\'unpin\')');
assert.ok('unpin'.startsWith('unpin') && 'unpinm'.startsWith('unpin') && !'pinm'.startsWith('unpin'),
	'startsWith harus bedain .unpin/.unpinm (true) dari .pinm (false)');
// Menu ngiklan command yang nggak ada -> bikin user ngetik .pin (itu Pinterest).
assert.doesNotMatch(src, /\$\{prefix\}pin\n/, 'menu masih nulis .pin (itu alias Pinterest)');
assert.match(src, /\$\{prefix\}pinm \(reply pesan\)/, 'menu harus nulis .pinm');
// .pin jangan dibajak jadi pin-message, .pin milik Pinterest.
assert.doesNotMatch(src, /case 'pin': case 'pinm'/, '.pin milik command Pinterest');
// Wajib reply pesan, kalau tidak bakal nge-pin pesan command-nya sendiri.
assert.match(src, /case 'pinm':[\s\S]{0,400}?if \(!m\.quoted\) return m\.reply\(global\.mess\.quoted\)/, 'pinm harus reply pesan');

// Blok .group sudah pindah ke commands/group/group.js -- regex argumen-nya dicek
// secara perilaku (bukan scanning teks) di test/group.test.js.

// --- cross-check sama library kalau terpasang -------------------------------
const lib = 'node_modules/@sairidev/baileys-new/lib/Utils/messages.js';
if (fs.existsSync(lib)) {
	const libSrc = fs.readFileSync(lib, 'utf8');
	assert.match(libSrc, /m\.pinInChatMessage\.key = message\.pin/, 'library berubah: cek ulang .pinm');
	assert.match(libSrc, /m\.pinInChatMessage\.type = message\.type/, 'library berubah: cek ulang .pinm');
	console.log('OK: .pinm / .group (kontrak library terpasang ikut dicek)');
} else {
	console.log('OK: .pinm / .group (node_modules belum ada, cek kontrak library dilewati)');
}