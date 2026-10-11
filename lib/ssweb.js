/**
 * Screenshot website pakai Firefox beneran yang jalan LOKAL di device sendiri.
 * Fitur ini bersifat OPTIONAL dan TIDAK BOLEH crash startup bot di Android/
 * Termux ketika Playwright/Firefox build-nya tidak kompatibel dengan platform.
 *
 * Karena `playwright-core` gagal di platform `android` saat import, kita tidak
 * boleh import-nya di top-level. Loading harus dipindah ke runtime dan dibungkus
 * try/catch agar bot tetap bisa start, lalu fungsi screenshot hanya aktif kalau
 * environment support benar-benar siap.
 */
async function screenshotWebsite(url, { fullPage = true, width = 1280, height = 800, timeout = 45000 } = {}) {
	let firefox;
	try {
		({ firefox } = await import('playwright-core'));
	} catch (error) {
		throw new Error(`Screenshot gagal: Playwright tidak kompatibel di platform ${process.platform}. ${error?.message || error}`);
	}

	const browser = await firefox.launch({ headless: true }).catch((error) => {
		throw new Error(`Gagal menjalankan Firefox Playwright: ${error?.message || error}`);
	});
	try {
		const page = await browser.newPage({
			viewport: { width, height },
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0'
		});
		await page.goto(url, { waitUntil: 'networkidle', timeout });
		return await page.screenshot({ fullPage, type: 'png' });
	} finally {
		await browser.close().catch(() => {});
	}
}

export { screenshotWebsite };
