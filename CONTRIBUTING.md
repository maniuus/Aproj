# Panduan Kontribusi — archiTech (Aproj)

Terima kasih sudah berkontribusi. Berikut alur kerja supaya versi stabil (`main`) tidak pernah rusak.

## Alur kerja dasar

```
main (stabil — selalu bisa dirilis)
├── feature/<nama-fitur>
├── fix/<nama-bug>
└── hotfix/<nama-urgent>
```

1. **Jangan commit langsung ke `main`.** Cabang `main` dilindungi: push langsung diblokir, semua perubahan wajib lewat Pull Request.
2. **Buat cabang dari `main` terbaru** dengan nama deskriptif:
   ```bash
   git checkout main && git pull
   git checkout -b feature/pagination-desks
   ```
3. **Commit kecil & jelas**, dalam Bahasa Indonesia atau Inggris, pakai pesan deskriptif:
   ```
   feat: tambah pagination tabel Desk
   fix: total salah saat nota diedit
   ```
4. **Jalankan semua gate lokal** sebelum push (lihat di bawah).
5. **Buat Pull Request ke `main`** → tunggu review + CI hijau → merge.

## Quality gate — WAJIB hijau sebelum merge

```bash
npm run test:all
```

Ini menjalankan berturut-turut: `typecheck` → `build` → `test:ui` (11 E2E) → `test:flow` (8 flow) → `test:visual` (14 screenshot).

- **`test:ui` / `test:flow`** butuh app sudah di-build (`out/`), jadi selalu jalankan `test:all` (bukan test parsial) sebelum push.
- **`test:visual`** membandingkan screenshot dengan baseline di `tests/ui-visual.spec.js-snapshots/`. Kalau kamu **sengaja** mengubah tampilan, regenerate baseline:
  ```bash
  npm run test:visual:update
  ```
  Lalu sertakan perubahan PNG itu dalam PR yang sama.

## Merilis versi baru

Mengikuti **semantic versioning**:

| Perubahan                  | Bump      | Contoh tag |
|----------------------------|-----------|------------|
| Bug fix (kompatibel)       | patch     | `v0.1.1`   |
| Fitur baru (kompatibel)    | minor     | `v0.2.0`   |
| Perubahan breaking         | major     | `v1.0.0`   |

1. Naikkan `version` di `package.json`.
2. Commit perubahan (`chore: bump version ke 0.2.0`).
3. Push + tag rilis dari `main`:
   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```
4. GitHub Actions otomatis: typecheck + build + packaging installer → draft release di halaman Releases → isi catatan rilis → publish.

## Perubahan skema database

Workspace pengguna (`*.apro/project.db`) **sudah ada sebelum update** — jangan pernah merusaknya. Tiga lapis yang dijalankan `openWorkspace()` di `src/main/index.ts`:

1. `db.exec(SCHEMA)` — semua `CREATE TABLE IF NOT EXISTS` (tabel lama tidak disentuh).
2. `runMigrations()` — `migrateColumns()` → `ALTER TABLE ... ADD COLUMN` untuk kolom baru, plus migrasi data.
3. `saveDB()` — hasil migrasi langsung tersimpan.

**Aturan emas:**

- **Jangan pernah** menambah kolom/tabel baru hanya dengan mengubah isi `CREATE TABLE` di konstanta `SCHEMA` — `IF NOT EXISTS` tidak mengubah tabel yang sudah terlanjur dibuat. DB lama tidak akan dapat kolom itu.
- Tambahan kolom **selalu lewat `migrateColumns()`** di `runMigrations()`:
  ```ts
  migrateColumns('projects', [['notes', 'TEXT']])
  ```
- Tabel baru cukup di `SCHEMA` (`CREATE TABLE IF NOT EXISTS`) — DB lama otomatis dapat tabel tersebut.
- Perubahan yang berisiko (rename kolom, ubah constraint, restrukturisasi) pola amannya: **buat tabel baru → `INSERT INTO ... SELECT` → rename/drop tabel lama** — semua di dalam `runMigrations()`, eksekusi hanya saat kolom/tabel belum ada.
- Setiap perubahan skema wajib diuji dengan **workspace lama**: buka backup `.aproj.zip` dari versi sebelumnya → pastikan data tetap terbaca dan fitur baru berfungsi. (Gunakan seed/backup versi lama di `tests/`.)
- Tambahkan baris entry migrasi di `90-meta/changelog.md` proyek agar riwayat skema terlacak.

## Menambahkan dependensi

Repo memakai `npm install --legacy-peer-deps` (konflik peer vite vs electron-vite):
```bash
npm install <pkg> --legacy-peer-deps
npm install -D <pkg> --legacy-peer-deps
```

## Lingkungan

- Node 22+ (CI memakai 22)
- Windows (target utama); path `dist/win-unpacked/aproj.exe` untuk app ter-package

## Prinsip

- **Data pengguna jangan pernah masuk repo.** Workspace `.apro`, backup `.aproj.zip`, dan file lokal lain sudah di `.gitignore`.
- Screenshot baseline adalah bagian dari test — jangan hapus tanpa mengganti yang baru.
