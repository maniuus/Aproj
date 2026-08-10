import { dialog, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'

type Row = Record<string, unknown>
type SqlValue = number | string | Uint8Array | null

const JENIS_LABEL: Record<string, string> = {
  'keluar-material': 'Keluar (Material)',
  'keluar-tenaga': 'Keluar (Tenaga)',
  'keluar-alat': 'Keluar (Alat)',
  'keluar-lain': 'Keluar (Lain-lain)',
  masuk: 'Masuk (Termin)'
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function fmtDate(d?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '')
  if (!m) return d || '-'
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

function rp(n: number): string {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
}

export interface ReportOpts {
  type: 'weekly' | 'monthly' | 'project'
  format: 'xlsx' | 'pdf'
  start?: string
  end?: string
  projectId?: string | null
}

interface ReportData {
  workspace: string
  title: string
  periode: string
  scope: string
  project: Row | null
  outflow: number
  inflow: number
  byJenis: { jenis: string; count: number; total: number }[]
  daily: { date: string; outflow: number; inflow: number; count: number }[]
  notas: Row[]
  items: Row[]
}

function buildReportData(opts: ReportOpts, all: (sql: string, params?: SqlValue[]) => Row[], one: (sql: string, params?: SqlValue[]) => Row | undefined): ReportData {
  const workspace = String(one(`SELECT value FROM meta WHERE key = 'name'`)?.value ?? 'Workspace')

  const where: string[] = []
  const params: SqlValue[] = []
  if (opts.type === 'project') {
    where.push('n.project_id = ?')
    params.push(opts.projectId ?? '')
  } else {
    if (opts.start) { where.push('n.date >= ?'); params.push(opts.start) }
    if (opts.end) { where.push('n.date <= ?'); params.push(opts.end) }
    if (opts.projectId) { where.push('n.project_id = ?'); params.push(opts.projectId) }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const notas = all(
    `SELECT n.*, p.name AS project_name, s.name AS suplier_name
     FROM notas n
     LEFT JOIN projects p ON n.project_id = p.id
     LEFT JOIN supliers s ON n.suplier_id = s.id
     ${whereSql} ORDER BY n.date ASC, n.created_at ASC`,
    params
  )

  const items = all(
    `SELECT ni.*, n.date AS n_date, n.jenis AS n_jenis
     FROM nota_items ni
     JOIN notas n ON ni.nota_id = n.id
     ${whereSql.replaceAll('n.', 'n.')} ORDER BY n.date ASC, ni.sort_order ASC`,
    params
  )

  const byJenisMap: Record<string, { count: number; total: number }> = {}
  let outflow = 0
  let inflow = 0
  const dailyMap: Record<string, { outflow: number; inflow: number; count: number }> = {}
  for (const n of notas) {
    const j = String(n.jenis ?? '')
    const t = Number(n.total) || 0
    byJenisMap[j] = byJenisMap[j] || { count: 0, total: 0 }
    byJenisMap[j].count++
    byJenisMap[j].total += t
    if (j === 'masuk') inflow += t
    else outflow += t
    const d = String(n.date ?? '')
    dailyMap[d] = dailyMap[d] || { outflow: 0, inflow: 0, count: 0 }
    dailyMap[d].count++
    if (j === 'masuk') dailyMap[d].inflow += t
    else dailyMap[d].outflow += t
  }
  const byJenis = Object.entries(byJenisMap)
    .map(([jenis, v]) => ({ jenis, ...v }))
    .sort((a, b) => JENIS_LABEL[a.jenis]?.localeCompare(JENIS_LABEL[b.jenis] ?? '') || a.jenis.localeCompare(b.jenis))
  const daily = Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  let scope = 'Semua Projek'
  let project: Row | null = null
  if (opts.type === 'project') {
    project =
      one(
        `SELECT p.*, o.name AS owner_name, d.name AS desk_name,
                (SELECT GROUP_CONCAT(sk.name, ', ') FROM project_subkons ps JOIN subkontraktors sk ON ps.subkon_id = sk.id WHERE ps.project_id = p.id) AS subkon_names
         FROM projects p
         LEFT JOIN owners o ON p.owner_id = o.id
         LEFT JOIN desks d ON p.desk_id = d.id
         WHERE p.id = ?`,
        [opts.projectId ?? '']
      ) ?? null
    scope = String(project?.name ?? 'Projek')
  } else if (opts.projectId) {
    const p = one('SELECT name FROM projects WHERE id = ?', [opts.projectId])
    scope = String(p?.name ?? 'Projek')
  }

  const typeTitle = opts.type === 'weekly' ? 'Laporan Mingguan' : opts.type === 'monthly' ? 'Laporan Bulanan' : 'Laporan Full Projek'
  const periode =
    opts.type === 'project'
      ? `Seluruh periode — ${fmtDate(String(project?.start_date ?? ''))} s/d ${fmtDate(String(project?.end_date ?? ''))}`
      : `${fmtDate(opts.start)} — ${fmtDate(opts.end)}`

  return { workspace, title: typeTitle, periode, scope, project, outflow, inflow, byJenis, daily, notas, items }
}

function defaultFileName(opts: ReportOpts, data: ReportData): string {
  const ext = opts.format === 'pdf' ? 'pdf' : 'xlsx'
  const scope = data.scope.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
  if (opts.type === 'project') return `Project-Report-${scope}.${ext}`
  const label = opts.type === 'weekly' ? 'Weekly' : 'Monthly'
  return `${label}-Report-${scope}-${opts.start}_${opts.end}.${ext}`
}

// ---------------------------------------------------------------- XLSX

function exportXlsx(data: ReportData, filePath: string) {
  const wb = XLSX.utils.book_new()

  const headerRows = [
    ['APROJ — Administrasi Proyek'],
    [data.title],
    [`Workspace: ${data.workspace}`],
    [`Periode: ${data.periode}`],
    [`Projek: ${data.scope}`],
    []
  ]
  const summary = [
    ['RINGKASAN'],
    ['Total Pengeluaran', data.outflow],
    ['Total Pemasukan', data.inflow],
    ['Net', data.inflow - data.outflow],
    [],
    ['Rekap per Jenis'],
    ['Jenis', 'Jumlah Nota', 'Total']
  ]
  for (const j of data.byJenis) summary.push([JENIS_LABEL[j.jenis] || j.jenis, j.count, j.total])
  const wsSummary = XLSX.utils.aoa_to_sheet([...headerRows, ...summary])
  wsSummary['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

  const wsDaily = XLSX.utils.aoa_to_sheet([
    ...headerRows,
    ['RINCIAN PER TANGGAL'],
    ['Tanggal', 'Pengeluaran', 'Pemasukan', 'Jumlah Nota'],
    ...data.daily.map((d) => [fmtDate(d.date), d.outflow, d.inflow, d.count])
  ])
  wsDaily['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Per Tanggal')

  const wsNota = XLSX.utils.aoa_to_sheet([
    ...headerRows,
    ['DAFTAR NOTA'],
    ['Tanggal', 'Jenis', 'Uraian', 'Projek', 'Rekening', 'Status', 'Total'],
    ...data.notas.map((n) => [
      fmtDate(String(n.date ?? '')),
      JENIS_LABEL[String(n.jenis ?? '')] || String(n.jenis ?? ''),
      String(n.suplier_name ?? n.keterangan ?? ''),
      String(n.project_name ?? (n.project_id ? '' : 'Tanpa projek')),
      String(n.rekening ?? ''),
      String(n.payment_status ?? 'terbayar'),
      Number(n.total) || 0
    ])
  ])
  wsNota['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsNota, 'Nota')

  const wsItems = XLSX.utils.aoa_to_sheet([
    ...headerRows,
    ['DETAIL ITEM'],
    ['Tanggal', 'Item', 'Jenis Item', 'Satuan', 'Qty', 'Harga', 'Subtotal'],
    ...data.items.map((i) => [
      fmtDate(String(i.n_date ?? '')),
      String(i.name ?? ''),
      String(i.item_type ?? ''),
      String(i.unit ?? ''),
      Number(i.qty) || 0,
      Number(i.price) || 0,
      Number(i.subtotal) || 0
    ])
  ])
  wsItems['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsItems, 'Detail Item')

  XLSX.writeFile(wb, filePath)
}

// ---------------------------------------------------------------- PDF

const PDF_MARGIN = 48
const PDF_WIDTH = 595.28
const PDF_CONTENT_W = PDF_WIDTH - PDF_MARGIN * 2 // 499.28
const PDF_BOTTOM_LIMIT = 780

// palet minimalis
const INK = '#1a1a1a'
const BODY = '#3f3f46'
const GRAY = '#71717a'
const FAINT = '#a1a1aa'
const LINE = '#d4d4d8'
const LINE_LIGHT = '#e4e4e7'
const FILL = '#f7f7f7'
const FILL_HEADER = '#f2f2f3'

function drawPdfHeader(doc: PDFKit.PDFDocument, data: ReportData, nomor: string) {
  // brand kiri
  doc.rect(PDF_MARGIN, 45, 11, 11).fill(INK)
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text('A', PDF_MARGIN + 3, 47.5)
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('APROJ', PDF_MARGIN + 17, 43)
  doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text('ADMINISTRASI PROYEK', PDF_MARGIN + 17, 56.5)

  // nomor + tanggal kanan
  doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(`Nomor  : ${nomor}`, 0, 45, { align: 'right', width: PDF_WIDTH - PDF_MARGIN })
  doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(`Tanggal: ${fmtDate(new Date().toISOString().slice(0, 10))}`, 0, 56.5, { align: 'right', width: PDF_WIDTH - PDF_MARGIN })

  // garis tipis
  doc.moveTo(PDF_MARGIN, 74).lineTo(PDF_WIDTH - PDF_MARGIN, 74).lineWidth(0.6).strokeColor(LINE).stroke()

  // judul di tengah
  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(data.title, PDF_MARGIN, 86, { align: 'center', width: PDF_CONTENT_W })
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(
    `Workspace: ${data.workspace}   •   Periode: ${data.periode}   •   Projek: ${data.scope}`,
    PDF_MARGIN,
    106,
    { align: 'center', width: PDF_CONTENT_W }
  )
  doc.y = 126
}

function drawPdfSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(1)
  doc.x = PDF_MARGIN
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(title, PDF_MARGIN, doc.y, { width: PDF_CONTENT_W })
  doc.moveTo(PDF_MARGIN, doc.y + 3).lineTo(PDF_WIDTH - PDF_MARGIN, doc.y + 3).lineWidth(0.5).strokeColor(LINE).stroke()
  doc.x = PDF_MARGIN
  doc.y = doc.y + 9
}

function drawPdfContinuationHeader(doc: PDFKit.PDFDocument) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('APROJ — ADMINISTRASI PROYEK', PDF_MARGIN, PDF_MARGIN)
  doc.font('Helvetica').fontSize(7).fillColor(FAINT).text('Lanjutan', 0, PDF_MARGIN + 1, { align: 'right', width: PDF_WIDTH - PDF_MARGIN })
  doc.moveTo(PDF_MARGIN, PDF_MARGIN + 14).lineTo(PDF_WIDTH - PDF_MARGIN, PDF_MARGIN + 14).lineWidth(0.5).strokeColor(LINE).stroke()
  doc.y = PDF_MARGIN + 20
}

function drawInfoProject(doc: PDFKit.PDFDocument, p: Row) {
  const labels: [string, string][] = [
    ['Owner', String(p.owner_name ?? '—')],
    ['Subkontraktor', String(p.subkon_names ?? '—')],
    ['Nilai Kontrak', rp(Number(p.contract_value) || 0)],
    ['Tanggal Mulai', fmtDate(String(p.start_date ?? ''))],
    ['Durasi MOU', String(p.durasi_mou ?? '—')],
    ['Status', String(p.status ?? '—')]
  ]
  const colW = PDF_CONTENT_W / 2
  const rowH = 30
  let y = doc.y
  const drawRow = (pair: [string, string][]) => {
    if (y + rowH > PDF_BOTTOM_LIMIT) {
      doc.addPage()
      drawPdfContinuationHeader(doc)
      y = doc.y
    }
    pair.forEach(([k, v], i) => {
      const x = PDF_MARGIN + i * colW
      doc.rect(x, y, colW - 6, rowH).fill(FILL)
      doc.rect(x, y, colW - 6, rowH).lineWidth(0.4).stroke(LINE_LIGHT)
      doc.font('Helvetica').fontSize(6.5).fillColor(GRAY).text(k.toUpperCase(), x + 9, y + 5, { characterSpacing: 0.5 })
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(v, x + 9, y + 16)
    })
    y += rowH
  }
  drawRow([labels[0], labels[1]])
  drawRow([labels[2], labels[3]])
  drawRow([labels[4], labels[5]])
  doc.x = PDF_MARGIN
  doc.y = y
}

function drawPdfCards(doc: PDFKit.PDFDocument, data: ReportData) {
  const cards: [string, string][] = [
    ['TOTAL PENGELUARAN', rp(data.outflow)],
    ['TOTAL PEMASUKAN', rp(data.inflow)],
    ['NET (MASUK − KELUAR)', rp(data.inflow - data.outflow)]
  ]
  const cardW = (PDF_CONTENT_W - 16) / 3
  const cardH = 50
  let y = doc.y
  cards.forEach(([label, val], i) => {
    const x = PDF_MARGIN + i * (cardW + 8)
    doc.rect(x, y, cardW, cardH).fill(FILL)
    doc.rect(x, y, cardW, cardH).lineWidth(0.4).stroke(LINE_LIGHT)
    doc.font('Helvetica').fontSize(6.5).fillColor(GRAY).text(label, x + 10, y + 8, { characterSpacing: 0.4 })
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(INK).text(val, x + 10, y + 22)
  })
  doc.x = PDF_MARGIN
  doc.y = y + cardH + 6
}

function drawPdfTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], widths: number[], opts: { footer?: [string, string] } = {}) {
  const rowH = 17
  const headerH = 19
  const colX: number[] = []
  let x = PDF_MARGIN
  const totalW = widths.reduce((s, w) => s + w, 0)
  for (const w of widths) {
    colX.push(x)
    x += w
  }
  let y = doc.y

  const drawHeaderAt = (y2: number) => {
    doc.rect(PDF_MARGIN, y2, totalW, headerH).fill(FILL_HEADER)
    doc.font('Helvetica-Bold').fontSize(7.5)
    const lh = doc.currentLineHeight()
    headers.forEach((h, i) => {
      const w = widths[i]
      const tw = doc.widthOfString(h)
      doc.fillColor(BODY).text(h, colX[i] + (w - tw) / 2, y2 + (headerH - lh) / 2, { lineBreak: false, ellipsis: true })
    })
    doc.moveTo(PDF_MARGIN, y2 + headerH).lineTo(PDF_MARGIN + totalW, y2 + headerH).lineWidth(0.5).strokeColor(LINE).stroke()
  }

  const ensureSpace = (h: number) => {
    if (y + h > PDF_BOTTOM_LIMIT) {
      doc.addPage()
      y = PDF_MARGIN
      drawHeaderAt(y)
      y += headerH
    }
  }

  drawHeaderAt(y)
  y += headerH

  rows.forEach((r, ri) => {
    ensureSpace(rowH)
    if (ri % 2 === 1) doc.rect(PDF_MARGIN, y, totalW, rowH).fill(FILL)
    doc.font('Helvetica').fontSize(8).fillColor(BODY)
    const lh = doc.currentLineHeight()
    const ty = y + (rowH - lh) / 2
    r.forEach((cell, i) => {
      const text = String(cell ?? '')
      const w = widths[i]
      const tw = doc.widthOfString(text)
      doc.text(text, colX[i] + (w - tw) / 2, ty, { lineBreak: false, ellipsis: true })
    })
    y += rowH
    doc.moveTo(PDF_MARGIN, y).lineTo(PDF_MARGIN + totalW, y).lineWidth(0.3).strokeColor(LINE_LIGHT).stroke()
  })

  if (opts.footer) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK)
    const lh = doc.currentLineHeight()
    const fy = y + (20 - lh) / 2
    const tw0 = doc.widthOfString(opts.footer[0])
    const tw1 = doc.widthOfString(opts.footer[1])
    doc.text(opts.footer[0], PDF_MARGIN + (totalW - tw0 - tw1) / 2, fy, { lineBreak: false })
    doc.text(opts.footer[1], PDF_MARGIN + (totalW - tw0 - tw1) / 2 + tw0 + 12, fy, { lineBreak: false })
    y += 20
  }

  doc.x = PDF_MARGIN
  doc.y = y + 6
}

function drawPdfSignatures(doc: PDFKit.PDFDocument) {
  drawPdfSectionTitle(doc, 'PENGESAHAN')
  doc.moveDown(2)
  const colW = PDF_CONTENT_W / 2 - 40
  const left = PDF_MARGIN + 30
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text('Dibuat oleh,', left)
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text('Diketahui oleh,', left + colW + 60)
  doc.moveDown(4.5)
  doc.font('Helvetica').fontSize(8.5).fillColor(INK).text('(____________________)', left)
  doc.font('Helvetica').fontSize(8.5).fillColor(INK).text('(____________________)', left + colW + 60)
  doc.x = PDF_MARGIN
}

function drawPdfFooter(doc: PDFKit.PDFDocument) {
  const total = doc.bufferedPageRange().count
  const range = doc.bufferedPageRange()
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i)
    doc.moveTo(PDF_MARGIN, 812).lineTo(PDF_WIDTH - PDF_MARGIN, 812).lineWidth(0.5).strokeColor(LINE).stroke()
    doc.font('Helvetica').fontSize(7).fillColor(FAINT).text('APROJ — Administrasi Proyek', PDF_MARGIN, 817)
    doc.font('Helvetica').fontSize(7).fillColor(FAINT).text(`Halaman ${i + 1} dari ${total}`, 0, 817, { align: 'right', width: PDF_WIDTH - PDF_MARGIN })
  }
}

function exportPdf(data: ReportData, filePath: string) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN, bufferPages: true })
  const stream = require('fs').createWriteStream(filePath)
  doc.pipe(stream)

  const nomor = `APJ/${data.title.replace(/\s+/g, '').slice(0, 8).toUpperCase()}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/001`

  drawPdfHeader(doc, data, nomor)

  if (data.project) {
    drawPdfSectionTitle(doc, 'INFORMASI PROJEK')
    drawInfoProject(doc, data.project)
  }

  drawPdfSectionTitle(doc, 'RINGKASAN KEUANGAN')
  drawPdfCards(doc, data)

  drawPdfSectionTitle(doc, 'REKAP PER JENIS')
  drawPdfTable(
    doc,
    ['Jenis Pengeluaran / Pemasukan', 'Jumlah Nota', 'Total'],
    data.byJenis.map((j) => [JENIS_LABEL[j.jenis] || j.jenis, String(j.count), rp(j.total)]),
    [PDF_CONTENT_W - 200, 80, 120],
    { footer: ['TOTAL', rp(data.outflow + data.inflow)] }
  )

  drawPdfSectionTitle(doc, 'RINCIAN PER TANGGAL')
  drawPdfTable(
    doc,
    ['Tanggal', 'Pengeluaran', 'Pemasukan', 'Jumlah Nota'],
    data.daily.map((d) => [fmtDate(d.date), rp(d.outflow), rp(d.inflow), String(d.count)]),
    [160, 130, 130, 79]
  )

  drawPdfSectionTitle(doc, 'DAFTAR NOTA')
  drawPdfTable(
    doc,
    ['Tanggal', 'Jenis', 'Uraian', 'Projek', 'Rekening', 'Total'],
    data.notas.map((n) => [
      fmtDate(String(n.date ?? '')),
      JENIS_LABEL[String(n.jenis ?? '')] || String(n.jenis ?? ''),
      String(n.suplier_name ?? n.keterangan ?? ''),
      String(n.project_name ?? (n.project_id ? '' : 'Tanpa projek')),
      String(n.rekening ?? ''),
      rp(Number(n.total) || 0)
    ]),
    [70, 92, 120, 110, 62, 45]
  )

  doc.moveDown(0.5)
  drawPdfSignatures(doc)
  drawPdfFooter(doc)
  doc.end()
}

// ---------------------------------------------------------------- entry

export async function exportReport(
  opts: ReportOpts,
  helpers: { all: (sql: string, params?: SqlValue[]) => Row[]; one: (sql: string, params?: SqlValue[]) => Row | undefined }
): Promise<{ ok: boolean; path?: string; canceled?: boolean }> {
  const data = buildReportData(opts, helpers.all, helpers.one)
  const win = BrowserWindow.getFocusedWindow() ?? undefined
  const fileName = defaultFileName(opts, data)
  const res = await dialog.showSaveDialog(win!, {
    title: `Export ${data.title}`,
    defaultPath: join(app.getPath('downloads'), fileName),
    filters: opts.format === 'pdf' ? [{ name: 'PDF', extensions: ['pdf'] }] : [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, canceled: true }
  if (opts.format === 'pdf') exportPdf(data, res.filePath)
  else exportXlsx(data, res.filePath)
  return { ok: true, path: res.filePath }
}
