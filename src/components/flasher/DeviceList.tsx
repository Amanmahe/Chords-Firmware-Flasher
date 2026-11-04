"use client";

import type { DeviceDef } from "@/lib/flasher";
import { InfoButton } from "./InfoButton";

interface Props {
  devices: DeviceDef[];
  activeId: string;
  onActivate: (id: string) => void;
  /** Why a board can't be flashed in this browser, by device id. */
  unavailable: Record<string, string>;
}

export function DeviceList({ devices, activeId, onActivate, unavailable }: Props) {
  return (
    <ul className="flex flex-col gap-1" role="listbox" aria-label="Devices">
      {devices.map((d) => {
        const active = d.id === activeId;
        const reason = unavailable[d.id];
        return (
          <li key={d.id}>
            <div
              role="option"
              aria-selected={active}
              aria-disabled={!!reason}
              tabIndex={reason ? -1 : 0}
              onClick={() => !reason && onActivate(d.id)}
              onKeyDown={(e) => {
                if (!reason && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onActivate(d.id);
                }
              }}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-[0.3rem] text-sm leading-5 outline-none transition-colors
                focus-visible:ring-2 focus-visible:ring-blue-500
                ${
                  reason
                    ? "cursor-not-allowed border-neutral-800/60 bg-neutral-950/20 text-neutral-500"
                    : active
                      ? "cursor-default border-blue-500/50 bg-blue-500/10 text-white"
                      : "cursor-pointer border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:border-blue-500/40 hover:bg-blue-500/5"
                }`}
            >
              {/* Hover or click the warning to see why the board is greyed out */}
              {reason && (
                <InfoButton label={`why ${d.name} is unavailable`} warning>
                  {reason}
                </InfoButton>
              )}
              <span className="min-w-0 flex-1 truncate font-medium" title={d.name}>
                {d.name}
              </span>
              {reason ? (
                <span className="shrink-0 text-xs text-neutral-600">Unavailable</span>
              ) : (
                active && <span className="shrink-0 text-xs text-blue-300">Selected</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
