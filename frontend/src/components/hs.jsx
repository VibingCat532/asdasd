import { Flag, Info, Loader2 } from "lucide-react";
import { panelMonogram, panelTint } from "../lib/panels";

// Players read "nowe" as a wait; staff read it as their queue.
const STATUS = {
  nowe: { player: "Czeka na decyzję", staff: "Nowe", className: "hs-pill-new" },
  zaakceptowane: { player: "Zaakceptowane", staff: "Zaakceptowane", className: "hs-pill-ok" },
  odrzucone: { player: "Odrzucone", staff: "Odrzucone", className: "hs-pill-bad" },
};

export function StatusPill({ status, audience = "staff", className = "", ...props }) {
  const config = STATUS[status] || STATUS.nowe;
  return (
    <span className={`hs-pill ${config.className} ${className}`} {...props}>
      <span aria-hidden="true" className="hs-pill-dot bg-current" />
      {config[audience]}
    </span>
  );
}

export function PanelMark({ recruitment, name, themeColor, category, size = 48 }) {
  const panelName = name ?? recruitment?.name;
  const color = themeColor ?? recruitment?.theme_color;
  const isComplaint = (category ?? recruitment?.category) === "complaints";
  const tint = panelTint(color);
  const radius = size >= 56 ? 12 : size >= 44 ? 10 : 8;
  return (
    <span
      aria-hidden="true"
      className="flex-none inline-flex items-center justify-center hs-display"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: tint.background,
        color: tint.color,
        fontSize: Math.round(size * 0.36),
        lineHeight: 1,
        letterSpacing: "0.02em",
      }}
    >
      {isComplaint ? <Flag style={{ width: size * 0.4, height: size * 0.4 }} strokeWidth={1.8} /> : panelMonogram(panelName)}
    </span>
  );
}

export function Spinner({ label = "Ładowanie", className = "py-32", ...props }) {
  return (
    <div className={`flex justify-center ${className}`} role="status" aria-label={label} {...props}>
      <Loader2 className="w-7 h-7 animate-spin text-hs-accent" />
    </div>
  );
}

// Full class names, so Tailwind keeps every tone in the build.
const NOTE_TONES = {
  notice: "hs-note-notice",
  bad: "hs-note-bad",
  info: "hs-note-info",
  ok: "hs-note-ok",
};

export function Notice({ tone = "notice", icon: Icon = Info, children, className = "", ...props }) {
  return (
    <div className={`hs-note ${NOTE_TONES[tone] || NOTE_TONES.notice} ${className}`} {...props}>
      <Icon className="w-4 h-4 flex-none mt-0.5" strokeWidth={1.8} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function UserInitial({ name, size = 36 }) {
  const label = (name || "?").trim()[0]?.toUpperCase() || "?";
  // A stable pale tint per person, so the same name always reads the same.
  const hue = [...(name || "?")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden="true"
      className="flex-none inline-flex items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: `hsl(${hue} 30% 17%)`,
        color: `hsl(${hue} 70% 80%)`,
      }}
    >
      {label}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, ...props }) {
  return (
    <div className="hs-card px-6 py-14 text-center" {...props}>
      {Icon && <Icon className="w-8 h-8 text-hs-faint mx-auto mb-3" strokeWidth={1.6} aria-hidden="true" />}
      <p className="text-base font-medium text-hs-ink">{title}</p>
      {children && <div className="mt-2 text-[15px] text-hs-meta">{children}</div>}
    </div>
  );
}
