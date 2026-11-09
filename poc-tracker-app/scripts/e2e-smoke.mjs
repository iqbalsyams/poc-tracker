// Smoke test end-to-end lewat browser (Edge). Mengubah data di database yang sedang dipakai,
// jadi jalankan hanya di database lokal/uji.
//
//   E2E_EMAIL=... E2E_PASSWORD=<password sementara> E2E_NEW_PASSWORD=... node scripts/e2e-smoke.mjs [outDir]

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const { E2E_EMAIL: email, E2E_PASSWORD: tempPassword, E2E_NEW_PASSWORD: newPassword } = process.env;
const outDir = process.argv[2] ?? "e2e-output";
await mkdir(outDir, { recursive: true });

const results = [];
const consoleErrors = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on(
  "console",
  (msg) => msg.type() === "error" && consoleErrors.push(`${page.url()}: ${msg.text()} [${msg.location().url}]`),
);
page.on("pageerror", (err) => consoleErrors.push(`${page.url()}: ${err.message}`));

// caret: "initial" supaya Playwright tidak menyuntikkan style caret-color yang memicu peringatan hydration
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true, caret: "initial" });
const text = () => page.locator("body").innerText();
async function noOverflow() {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

try {
  // --- Auth
  await page.goto(`${BASE}/`);
  check("Belum login: / diarahkan ke /login", page.url().endsWith("/login"));

  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check("Fokus keyboard terlihat di halaman login", outline !== "none", `outline-style: ${outline}`);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("salah-password");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.getByRole("alert").filter({ hasText: "Email atau password salah." }).first().waitFor();
  check("Password salah: pesan error tampil, email tetap terisi", (await page.getByLabel("Email").inputValue()) === email);

  await page.getByLabel("Password").fill(tempPassword);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/ganti-password");
  check("Login dengan password sementara: wajib ke /ganti-password", true);
  await page.goto(`${BASE}/`);
  check("Belum ganti password: / tetap diarahkan ke /ganti-password", page.url().endsWith("/ganti-password"));

  await page.getByLabel("Password sekarang").fill(tempPassword);
  await page.getByLabel("Password baru", { exact: true }).fill(newPassword);
  await page.getByLabel("Ulangi password baru").fill(newPassword + "x");
  await page.getByRole("button", { name: "Simpan password" }).click();
  await page.getByRole("alert").filter({ hasText: "Konfirmasi password tidak sama" }).first().waitFor();
  check("Konfirmasi password beda: pesan error tampil", true);
  await page.getByLabel("Password sekarang").fill(tempPassword);
  await page.getByLabel("Password baru", { exact: true }).fill(newPassword);
  await page.getByLabel("Ulangi password baru").fill(newPassword);
  await page.getByRole("button", { name: "Simpan password" }).click();
  await page.waitForURL(`${BASE}/`);
  check("Ganti password berhasil: masuk ke daftar POC", true);

  // --- Daftar kosong
  await page.getByText("Belum ada POC.").waitFor();
  check("Empty state daftar POC tampil", true);
  await shot("01-list-empty");

  // --- Tambah POC
  await page.getByRole("link", { name: "Tambah POC" }).first().click();
  await page.waitForURL("**/poc/baru");
  await page.getByLabel("Nama customer").fill("GTL - Supporting Pre Deals");
  await page.getByLabel("Status").selectOption("running");
  await page.getByRole("button", { name: "Simpan POC" }).click();
  await page.getByRole("alert").filter({ hasText: "Tanggal mulai wajib diisi" }).first().waitFor();
  check(
    "Validasi POC: error per field tampil, isian tidak hilang",
    (await page.getByLabel("Nama customer").inputValue()) === "GTL - Supporting Pre Deals",
  );
  await page.getByLabel("Tanggal mulai POC").fill("2026-10-05");
  await page.getByLabel("Target closed").fill("2026-12-31");
  await page.getByLabel("Potensi revenue (Rp)").fill("1.260.000.000");
  await page.getByLabel("Produk / scope").fill("FMS, Dashcam ADAS/DMS");
  await page.getByRole("button", { name: "Simpan POC" }).click();
  await page.waitForURL(/\/poc\/\d+\?tab=matrix/);
  const pocUrl = page.url().split("?")[0];
  check("POC tersimpan, diarahkan ke tab matrix", true, pocUrl);
  await page.getByText("Belum ada matrix aktif.").waitFor();
  check("Empty state matrix tampil", true);

  // --- Matrix (masih draft, tanpa konfirmasi)
  async function addMatrix(fill) {
    await page.goto(`${pocUrl}/matrix/baru`);
    await fill();
    await page.getByRole("button", { name: "Simpan matrix" }).click();
    await page.waitForURL(/tab=matrix/);
  }
  await addMatrix(async () => {
    await page.getByLabel("Nama matrix").fill("Deteksi alert DMS & ADAS");
    await page.getByLabel("Tipe matrix").selectOption("ratio");
    await page.getByLabel("Nilai target (%)").fill("80");
  });
  await addMatrix(async () => {
    await page.getByLabel("Nama matrix").fill("Rasio alert per 100 km");
    await page.getByLabel("Tipe matrix").selectOption("reduction");
    await page.getByLabel("Baseline").fill("37");
    await page.getByLabel("Satuan").fill("alert/100 km");
    await page.getByLabel("Nilai target (%)").fill("10");
  });
  await addMatrix(async () => {
    await page.getByLabel("Nama matrix").fill("Kepuasan tim operasional");
    await page.getByLabel("Tipe matrix").selectOption("qualitative");
    await page.getByLabel("Target", { exact: true }).fill("Tim ops memakai dashboard harian tanpa pendampingan");
  });
  check("3 matrix (rasio, penurunan, kualitatif) tersimpan", (await page.locator("h3").count()) === 3);
  await shot("02-matrix-tab");

  // --- Update minggu 1 + preview skor
  await page.getByRole("link", { name: "Isi update minggu ke-1" }).click();
  await page.waitForURL("**/update/baru");
  check("Periode default = tanggal mulai POC", (await page.getByLabel("Mulai")).inputValue && (await page.getByLabel("Mulai").inputValue()) === "2026-10-05");
  await page.getByLabel("Pembilang").fill("7");
  await page.getByLabel("Penyebut").fill("8");
  const ratioPreview = await page.locator("p[aria-live]").first().innerText();
  check("Preview rasio 7/8 = 87,5% Met", ratioPreview.includes("87,5") && ratioPreview.includes("Met"), ratioPreview.replace(/\s+/g, " "));
  await page.getByLabel(/Nilai minggu ini/).fill("34,1");
  const reductionPreview = await page.locator("p[aria-live]").nth(1).innerText();
  check("Preview penurunan 37 -> 34,1 = 7,84% Not met", reductionPreview.includes("7,84") && reductionPreview.includes("Not met"), reductionPreview.replace(/\s+/g, " "));
  await page.getByLabel("Hasil minggu ini").fill("Dua dari tiga shift sudah memakai dashboard");
  await page.getByLabel("Status", { exact: true }).selectOption("partial");
  await page.getByLabel("Progress").fill("Instalasi 10 unit selesai");
  await shot("03-weekly-form");
  await page.getByRole("button", { name: "Simpan update minggu ke-1" }).click();
  await page.waitForURL(/tab=update/);
  const detail = await text();
  check("Update minggu 1 tampil dengan hasil", detail.includes("7/8 = 87,5%") && detail.includes("Minggu ke-1"));
  check("Achievement otomatis = Partially Achieved", detail.includes("Partially Achieved"));
  await shot("04-update-tab");

  // --- Ubah matrix setelah ada update: wajib konfirmasi
  await page.goto(`${pocUrl}?tab=matrix`);
  await page.getByRole("link", { name: "Ubah matrix" }).first().click();
  await page.getByLabel("Nilai target (%)").fill("75");
  await page.getByRole("button", { name: "Lanjut ke konfirmasi" }).click();
  await page.getByText("Konfirmasi perubahan matrix").waitFor();
  const confirmText = await text();
  check("Layar konfirmasi menampilkan nilai lama vs baru", confirmText.includes("Nilai target") && confirmText.includes("80") && confirmText.includes("75"));
  await shot("05-matrix-confirm");
  await page.getByLabel("Alasan perubahan").fill("terlalu pendek");
  await page.getByLabel(/Saya paham/).check();
  await page.getByRole("button", { name: "Simpan sebagai versi 2" }).click();
  await page.getByRole("alert").filter({ hasText: "minimal 20 karakter" }).first().waitFor();
  check("Alasan < 20 karakter ditolak server", page.url().includes("/matrix/"));
  await page.getByLabel("Alasan perubahan").fill("Customer setuju target diturunkan karena 2 unit offline seminggu");
  await page.getByRole("button", { name: "Simpan sebagai versi 2" }).click();
  await page.waitForURL(/tab=matrix/);
  check("Versi 2 matrix tersimpan", (await text()).includes("Versi 2"));

  // --- Koreksi update
  await page.goto(`${pocUrl}?tab=update`);
  await page.getByRole("link", { name: "Koreksi" }).click();
  await page.getByLabel("Pembilang").fill("8");
  await page.getByRole("button", { name: "Simpan koreksi" }).click();
  await page.getByRole("alert").filter({ hasText: "Koreksi update wajib beralasan" }).first().waitFor();
  check("Koreksi tanpa alasan ditolak", true);
  await page.getByLabel("Alasan koreksi").fill("Salah input, event ke-8 ternyata terdeteksi");
  await page.getByRole("button", { name: "Simpan koreksi" }).click();
  await page.waitForURL(/tab=update/);
  check("Koreksi tersimpan (8/8 = 100%)", (await text()).includes("8/8 = 100%"));

  // --- Riwayat
  await page.getByRole("link", { name: "Riwayat perubahan" }).click();
  await page.waitForURL(/tab=riwayat/);
  await page.getByText("Semua perubahan dicatat otomatis").waitFor();
  const history = await text();
  check("Riwayat mencatat versi 2 beserta alasan", history.includes("Membuat versi 2") && history.includes("Customer setuju target diturunkan"));
  check("Riwayat mencatat koreksi beserta nilai lama -> baru", history.includes("Mengoreksi nilai") && history.includes("7/8"));
  await shot("06-history");

  // --- Override achievement
  await page.getByText("Override achievement").click();
  await page.getByLabel("Achievement", { exact: true }).selectOption("achieved");
  await page.locator("#override_reason").fill("Disepakati customer di meeting review");
  await page.getByRole("button", { name: "Simpan override" }).click();
  await page.waitForLoadState("networkidle");
  check("Override achievement tersimpan", (await text()).includes("(override)"));

  // --- Ubah info POC: revenue wajib alasan
  await page.goto(`${pocUrl}/ubah`);
  await page.getByLabel("Potensi revenue (Rp)").fill("1500000000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.getByRole("alert").filter({ hasText: "Tulis alasannya" }).first().waitFor();
  check("Ubah revenue tanpa alasan ditolak", true);
  await page.getByLabel("Alasan perubahan").fill("Scope bertambah 5 unit");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.waitForURL(pocUrl);
  check("Revenue baru tampil", (await text()).includes("1.500.000.000"));

  // --- Nonaktifkan matrix
  await page.goto(`${pocUrl}?tab=matrix`);
  await page.getByRole("link", { name: "Ubah matrix" }).last().click();
  await page.getByRole("button", { name: "Nonaktifkan matrix" }).click();
  await page.getByRole("alert").filter({ hasText: "Tulis alasan menonaktifkan" }).first().waitFor();
  await page.getByLabel("Alasan menonaktifkan").fill("Customer tidak lagi menilai aspek ini");
  await page.getByRole("button", { name: "Nonaktifkan matrix" }).click();
  await page.waitForURL(/tab=matrix/);
  check("Matrix dinonaktifkan dan masuk bagian nonaktif", (await text()).includes("Matrix nonaktif (1)"));

  // --- Daftar POC + filter
  await page.goto(`${BASE}/`);
  const list = await text();
  check("Daftar menampilkan badge Target diubah", list.includes("Target diubah"));
  await page.getByLabel("Cari customer").fill("tidak-ada");
  await page.getByRole("button", { name: "Terapkan filter" }).click();
  await page.getByText("Tidak ada POC yang cocok").waitFor();
  check("Filter tanpa hasil: empty state + Hapus filter", true);
  await page.getByRole("link", { name: "Hapus filter" }).first().click();
  await page.waitForURL(`${BASE}/`);
  await shot("07-list");

  // --- Pengguna
  await page.getByRole("link", { name: "Pengguna" }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Uji Coba");
  await page.getByLabel("Email", { exact: true }).fill("uji.coba@mceasy.co.id");
  await page.getByLabel("Password sementara", { exact: true }).fill("pendek");
  await page.getByRole("button", { name: "Buat akun" }).click();
  await page.getByRole("alert").filter({ hasText: "minimal 8 karakter" }).first().waitFor();
  await page.getByLabel("Password sementara", { exact: true }).fill("SementaraUji123");
  await page.getByRole("button", { name: "Buat akun" }).click();
  await page.getByText("Akun uji.coba@mceasy.co.id dibuat").waitFor();
  check("Admin membuat akun baru", (await text()).includes("Uji Coba"));
  await shot("08-users");

  // --- Mobile 390px
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, url] of [
    ["list", `${BASE}/`],
    ["detail-update", `${pocUrl}?tab=update`],
    ["detail-history", `${pocUrl}?tab=riwayat`],
    ["form-poc", `${BASE}/poc/baru`],
    ["form-update", `${pocUrl}/update/baru`],
    ["users", `${BASE}/pengguna`],
  ]) {
    await page.goto(url);
    check(`Mobile 390px tanpa overflow horizontal: ${name}`, await noOverflow());
    await shot(`m-${name}`);
  }

  // --- Mode gelap
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${pocUrl}?tab=update`);
  await shot("09-dark-detail");
  await page.goto(`${BASE}/`);
  await shot("10-dark-list");
  await page.emulateMedia({ colorScheme: "light" });

  // --- Logout
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("**/login");
  await page.goto(`${BASE}/`);
  check("Keluar: sesi berakhir, / kembali ke /login", page.url().endsWith("/login"));
} catch (err) {
  check("Skenario selesai tanpa exception", false, err.message.split("\n")[0]);
  await shot("zz-failure").catch(() => {});
} finally {
  await browser.close();
}

const relevantErrors = consoleErrors.filter((e) => !e.includes("favicon"));
check("Tidak ada error di console browser", relevantErrors.length === 0, relevantErrors.slice(0, 5).join(" | "));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
