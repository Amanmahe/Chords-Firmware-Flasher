"use client";

import type { DeviceDef } from "@/lib/flasher";

interface Props {
  devices: DeviceDef[];
  activeId: string;
  onActivate: (id: string) => void;
}

export function DeviceList({ devices, activeId, onActivate }: Props) {
  return (
    <ul className="flex flex-col gap-1" role="listbox" aria-label="Devices">
      {devices.map((d) => {
        const active = d.id === activeId;
        return (
          <li key={d.id}>
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
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-[0.3rem] text-sm leading-5 outline-none transition-colors
                focus-visible:ring-2 focus-visible:ring-blue-500
                ${
                  active
                    ? "cursor-default border-blue-500/50 bg-blue-500/10 text-white"
                    : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:border-blue-500/40 hover:bg-blue-500/5"
                }`}
            >
              <span className="min-w-0 flex-1 truncate font-medium" title={d.name}>
                {d.name}
              </span>
              {active && <span className="shrink-0 text-xs text-blue-300">Selected</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
