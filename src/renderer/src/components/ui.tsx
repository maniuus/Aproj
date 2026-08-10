import { cn } from '../lib/utils'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('bg-white border border-zinc-200 rounded-xl', className)}>{children}</div>
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

export function Field({ label, req, className, children }: { label: string; req?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-xs text-zinc-500 mb-1">
        {label} {req && <b className="text-red-500">*</b>}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full px-2 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'

export const selectCls = inputCls

export function PrimaryButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
        className
      )}
    />
  )
}

export function GhostButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'bg-white border border-zinc-300 hover:border-amber-500 text-zinc-700 text-sm font-medium px-4 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
        className
      )}
    />
  )
}

export function DangerButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'text-red-600 hover:bg-red-50 text-xs font-medium px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1',
        className
      )}
    />
  )
}

export function MutedButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'text-zinc-500 hover:text-amber-600 text-xs font-medium px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
        className
      )}
    />
  )
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  onCancel,
  onConfirm
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <span className="flex-1" />
          <GhostButton onClick={onCancel}>Batal</GhostButton>
          <PrimaryButton onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            {confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-sm text-zinc-600">{message}</p>
    </Modal>
  )
}

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  wide
}: {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={cn('bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[92vh]', wide ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-baseline justify-between">
          <div>
            <span className="font-semibold text-zinc-900">{title}</span>
            {sub && <span className="text-xs text-zinc-500 ml-2">{sub}</span>}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">
            ✕
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-zinc-200 flex items-center gap-3">{footer}</div>}
      </div>
    </div>
  )
}

export function StatCard({ label, value, sub, negative, positive }: {
  label: string
  value: string
  sub?: string
  negative?: boolean
  positive?: boolean
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
        <div
          className={cn(
            'text-xl font-bold mt-1',
            negative ? 'text-red-600' : positive ? 'text-emerald-600' : 'text-zinc-900'
          )}
        >
          {value}
        </div>
        {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
      </CardBody>
    </Card>
  )
}

export function Badge({ tone, children }: { tone: 'green' | 'blue' | 'amber' | 'red' | 'zinc'; children: ReactNode }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    zinc: 'bg-zinc-100 text-zinc-600'
  }
  return <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-semibold', tones[tone])}>{children}</span>
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl z-[60]">
      {msg}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="text-sm text-zinc-400 py-4 text-center">{children}</div>
}

function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`
}

function dmyToIso(raw: string): string {
  const d = raw.match(/\d/g)
  if (!d) return ''
  const s = d.slice(0, 6).join('')
  if (s.length < 6) return ''
  const dd = s.slice(0, 2)
  const mm = s.slice(2, 4)
  const yy = s.slice(4, 6)
  const year = Number(yy) >= 70 ? `19${yy}` : `20${yy}`
  return `${year}-${mm}-${dd}`
}

export function DateInput({
  value,
  onChange,
  className,
  placeholder = 'dd/mm/yy'
}: {
  value: string
  onChange: (iso: string) => void
  className?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value ? isoToDmy(value) : '')
  const lastEmitted = useRef(value)
  const invalid = text.length > 0 && !dmyToIso(text)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setText(value ? isoToDmy(value) : '')
    }
  }, [value])

  const handle = (v: string) => {
    const iso = dmyToIso(v)
    setText(v)
    lastEmitted.current = iso
    onChange(iso)
  }

  return (
    <input
      className={cn('', invalid && 'border-red-400 text-red-600', className)}
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      onChange={(e) => handle(e.target.value)}
      title={invalid ? 'Format tanggal tidak valid' : undefined}
    />
  )
}
