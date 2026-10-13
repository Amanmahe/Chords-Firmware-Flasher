"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEVICES,
  FIRMWARE_BASE,
  deleteSavedFirmware,
  downloadFirmware,
  fileNameOf,
  firmwareCacheEvents,
  getSavedFirmware,
  listSavedFirmware,
  releaseVersion,
  type SavedFirmware as Saved,
} from "@/lib/flasher";

/** Every release file some board uses (several boards share one). */
const RELEASE_URLS = [...new Set(DEVICES.flatMap((d) => d.firmware.map((f) => f.url)))];

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const when = (t: number) =>
  new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function SavedFirmware({
  className = "",
  activeFiles,
  busy,
  log,
}: {
  className?: string;
  /** File names the selected board flashes, highlighted in the list. */
  activeFiles: string[];
  busy: boolean;
  log: (msg: string, kind?: "info" | "ok" | "err" | "warn") => void;
}) {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [latest, setLatest] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(() => {
    listSavedFirmware().then(setSaved);
  }, []);

  useEffect(() => {
    refresh();
    releaseVersion(FIRMWARE_BASE).then(setLatest);
    firmwareCacheEvents?.addEventListener("change", refresh);
    return () => firmwareCacheEvents?.removeEventListener("change", refresh);
  }, [refresh]);

  const downloadAll = async () => {
    setWorking(true);
    let ok = 0;
    for (const url of RELEASE_URLS) {
      const name = fileNameOf(url);
      try {
        const { version } = await downloadFirmware(url);
        log(`Saved ${name}${version ? ` (${version})` : ""}`);
        ok++;
      } catch (e) {
        log(`Couldn't download ${name}: ${e instanceof Error ? e.message : e}`, "err");
      }
    }
    log(`Saved ${ok} of ${RELEASE_URLS.length} firmware files.`, ok === RELEASE_URLS.length ? "ok" : "warn");
    setWorking(false);
  };

  const saveToDisk = async (name: string) => {
    const rec = await getSavedFirmware(name);
    if (!rec) return;
    const url = URL.createObjectURL(new Blob([rec.data], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <aside className={`flex min-h-0 flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Downloaded firmware</span>
        <button
          disabled={working || busy}
          onClick={downloadAll}
          className="text-xs text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50"
        >
          {working ? "Downloading…" : "Download all"}
        </button>
      </div>
      <p className="mt-1 shrink-0 text-xs text-neutral-500">
        Latest release: <span className="text-neutral-300">{latest ?? "unknown (offline?)"}</span> · saved in this
        browser
      </p>

      {saved.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          Nothing saved yet. Firmware is saved here the first time you flash or download it.
        </p>
      ) : (
        // Two lines per file, so a whole release fits without scrolling.
        <ul className="-mr-2 mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2">
          {saved.map((f) => {
            const outdated = latest && f.version && f.version !== latest;
            const current = activeFiles.includes(f.name);
            return (
              <li
                key={f.name}
                className={`rounded-lg border px-3 py-1 text-xs leading-4 ${
                  current ? "border-blue-500/50 bg-blue-500/5" : "border-neutral-800 bg-neutral-950/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-neutral-200" title={f.name}>
                    {f.name}
                  </span>
                  <span className={`shrink-0 ${outdated ? "text-amber-300" : "text-green-400"}`}>{f.version ?? "?"}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-500">
                  <span>{kb(f.size)}</span>
                  {outdated ? (
                    <span className="text-amber-300" title={`Saved ${when(f.savedAt)}`}>
                      update on next flash
                    </span>
                  ) : (
                    <span>{when(f.savedAt)}</span>
                  )}
                  <span className="ml-auto flex shrink-0 gap-3">
                    <button
                      onClick={() => saveToDisk(f.name)}
                      className="text-neutral-400 hover:text-neutral-200 hover:underline"
                      title="Save the file to this computer"
                    >
                      Save
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => deleteSavedFirmware(f.name)}
                      className="text-neutral-400 hover:text-red-300 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
