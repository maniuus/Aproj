# archiTech (Aproj)

Aplikasi desktop **Administrasi Proyek Konstruksi** — pencatatan kas harian, rekap per projek, kelola master data, dan laporan. Dibangun dengan Electron + React + TypeScript, database lokal SQLite (via sql.js).

## Fitur

- **Daily Cashflow** — input nota keluar (material, tenaga, alat, lain-lain) & masuk (termin), status pembayaran (terbayar/hutang), lampiran foto nota
- **Balance Sheet & Overview** — rekap arus kas global, per projek, dan per desk
- **Desk** — kelompok projek untuk agregasi & cashflow mingguan
- **Projek** — kelola projek, owner, subkontraktor, kebutuhan material/tenaga/alat
- **Master Data** — suplier, material (dengan harga per suplier), gudang, pekerja, tenaga kerja, alat, subkon, pekerjaan
- **Workspace** — workspace terpisah per proyek/divisi, backup & restore ke satu file `.aproj.zip`
- **Laporan** — export Excel (Monthly Report) & PDF
- **Shortcut** — `Ctrl+N` buka nota baru, `Ctrl+Enter` simpan, `Escape` tutup modal

## Tampilan

![Home](tests/ui-visual.spec.js-snapshots/home-win32.png)
![Overview](tests/ui-visual.spec.js-snapshots/overview-win32.png)
![Daily Cashflow](tests/ui-visual.spec.js-snapshots/cashflow-win32.png)
![Balance Sheet](tests/ui-visual.spec.js-snapshots/balancesheet-win32.png)
![Desk](tests/ui-visual.spec.js-snapshots/desk-win32.png)
![Projek](tests/ui-visual.spec.js-snapshots/projek-win32.png)
![Master Data](tests/ui-visual.spec.js-snapshots/master-suplier-win32.png)

## Teknologi

Electron 43 · React 19 · TypeScript 7 · electron-vite 5 · Tailwind CSS 4 · sql.js 1.14 · zustand · pdfkit · xlsx · adm-zip

## Development

```bash
npm install --legacy-peer-deps   # deps (konflik peer vite di electron-vite)
npm run dev                      # jalankan aplikasi (HMR)
npm run typecheck                # typecheck node + web
```

### Test (Playwright)

```bash
npm run test:ui          # E2E fungsional UI (11 test)
npm run test:flow        # user flow input nota (8 test)
npm run test:visual      # regression screenshot (14 test)
npm run test:visual:update   # regenerate baseline screenshot
```

Semua test butuh build dulu (`npm run build`) karena menjalankan app dari `out/`.

## Build installer Windows

```bash
npm run gen:icon    # generate icon aplikasi (build/icon.ico)
npm run dist:win    # electron-vite build + electron-builder → dist/*.exe
```

Hasil: `dist/archiTech-<versi>-Setup.exe` (NSIS installer).

## Data

Semua data tersimpan di **workspace lokal** (folder `.apro`) sebagai file SQLite — tidak ada cloud. Backup dengan `Backup Workspace…` (sidebar) ke satu file `.aproj.zip`, pulihkan dengan `Restore dari Backup…`.

## Lisensi

Privat — source code dipublikasikan untuk kolaborasi pengembangan.
