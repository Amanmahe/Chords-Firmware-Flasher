"use client";

import type { DeviceDef } from "@/lib/flasher";
import { CheckCircle, ErrorCircle, IdleCircle, Spinner, WaitCircle } from "./icons";

export type DeviceStatus = "idle" | "flashing" | "done" | "error" | "waiting";

interface Props {
  devices: DeviceDef[];
  activeId: string;
  status: Record<string, DeviceStatus>;
  onActivate: (id: string) => void;
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

export function DeviceList({ devices, activeId, status, onActivate }: Props) {
  return (
    <ul className="flex flex-col gap-0.5" role="listbox" aria-label="Devices">
      {devices.map((d) => {
        const active = d.id === activeId;
        return (
          <li key={d.id} className="relative">
            {active && <span className="absolute -left-2 top-1.5 bottom-1.5 w-1 rounded-full bg-blue-500" />}
            <div
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onActivate(d.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onActivate(d.id);
                }
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 text-[0.9375rem] outline-none transition-colors
                focus-visible:ring-2 focus-visible:ring-blue-500
                ${active ? "bg-neutral-800 font-semibold text-white" : "text-neutral-200 hover:bg-neutral-800/60"}`}
            >
              <span className="shrink-0">
                <StatusIcon s={status[d.id] ?? "idle"} />
              </span>
              <span className="min-w-0 flex-1 break-words leading-snug">{d.name}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
