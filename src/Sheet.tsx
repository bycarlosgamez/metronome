import { useEffect, useRef, type ReactNode } from "react"

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"

// Bottom sheet shared by every popup: closes on Escape, a backdrop click or Done; moves focus in on open,
// keeps Tab inside while open, and hands focus back to whatever opened it on close.
export function Sheet(props: { label: string; open: boolean; onClose(): void; children: ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!props.open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      const opener = openerRef.current
      if (opener && opener.isConnected) opener.focus()
    }
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
      if (e.key !== "Tab" || !sheetRef.current) return
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  return (
    <div
      ref={overlayRef}
      inert={!props.open}
      aria-hidden={!props.open}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label={props.label}
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet" ref={sheetRef}>
        <div className="sheet-handle" />
        {props.children}
        <button type="button" className="sheet-done" onClick={props.onClose}>Done</button>
      </div>
    </div>
  )
}
