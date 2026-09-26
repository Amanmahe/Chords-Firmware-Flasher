"use client";

import type { DeviceDef } from "@/lib/flasher";
import { CheckCircle, ErrorCircle, IdleCircle, Reflash, Spinner, WaitCircle } from "./icons";

export type DeviceStatus = "idle" | "flashing" | "done" | "error" | "waiting";

interface Props {
  devices: DeviceDef[];
  activeId: string;
  selected: Set<string>;
  status: Record<string, DeviceStatus>;
  busy: boolean;
  onActivate: (id: string) => void;
  onToggle: (id: string) => void;
  onQuickFlash: (id: string) => void;
}

function StatusIcon({ s }: { s: DeviceStatus }) {
  switch (s) {
    case "flashing":
      return <Spinner />;
    case "done":
      return <CheckCircle />;
    case "error":
      return <ErrorCircle />;
    case "waiting":
      return <WaitCircle />;
    default:
      return <IdleCircle />;
  }
}

export function DeviceList({ devices, activeId, selected, status, busy, onActivate, onToggle, onQuickFlash }: Props) {
  return (
    <ul className="flex flex-col gap-0.5" role="listbox" aria-label="Devices">
      {devices.map((d) => {
        const active = d.id === activeId;
        const isSel = selected.has(d.id);
        return (
          <li key={d.id} className="relative">
            {active && <span className="absolute -left-2 top-1.5 bottom-1.5 w-1 rounded-full bg-blue-500" />}
            <div
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onActivate(d.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onActivate(d.id);
                if (e.key === " ") {
                  e.preventDefault();
                  onToggle(d.id);
                }
              }}
              className={`group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] outline-none transition-colors
                focus-visible:ring-2 focus-visible:ring-blue-500
                ${active ? "bg-neutral-800 font-semibold text-white" : "text-neutral-200 hover:bg-neutral-800/60"}`}
            >
              <span className="shrink-0">
                <StatusIcon s={status[d.id] ?? "idle"} />
              </span>
              <span className="min-w-0 flex-1 break-words leading-snug">{d.name}</span>

              <button
                type="button"
                title="Flash this board now"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickFlash(d.id);
                }}
                className="hidden rounded-md p-1 text-neutral-400 hover:bg-neutral-700 hover:text-white disabled:opacity-40 group-hover:block"
              >
                <Reflash />
              </button>

              <input
                type="checkbox"
                aria-label={`Add ${d.name} to batch`}
                checked={isSel}
                disabled={busy}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggle(d.id)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-600 bg-neutral-900 accent-blue-500"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
