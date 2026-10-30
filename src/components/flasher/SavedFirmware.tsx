"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, FileDown, FileText, Loader2, Trash2, TriangleAlert } from "lucide-react";
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
import { GithubMark } from "./icons";

const FIRMWARE_REPO_URL = "https://github.com/upsidedownlabs/Chords-Arduino-Firmware";

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
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-medium text-neutral-300">Downloaded firmware</h2>
          {latest && <span className="shrink-0 text-xs text-neutral-500">({latest})</span>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <a
            href={FIRMWARE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Chords Arduino Firmware on GitHub"
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
          >
            <GithubMark className="h-4 w-4" />
          </a>
          <button
            disabled={working || busy}
            onClick={downloadAll}
            title={working ? "Downloading…" : "Download all firmware"}
            aria-label="Download all firmware"
            className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            {working ? <Loader2 className="h-4 w-4 animate-spin text-blue-300" /> : <FileDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <p className="mb-2 shrink-0 text-xs text-neutral-500">
        {latest ? "Saved in this browser" : "Latest release unknown (offline?) · saved in this browser"}
      </p>

      {saved.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-950/50 p-4 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-neutral-700" strokeWidth={1.25} />
          <p className="text-sm text-neutral-400">Nothing saved yet</p>
          <p className="mt-1 text-xs text-neutral-500">Firmware is saved here the first time you flash or download it.</p>
        </div>
      ) : (
        <ul className="-mr-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2">
          {saved.map((f) => {
            const outdated = latest && f.version && f.version !== latest;
            const current = activeFiles.includes(f.name);
            return (
              <li
                key={f.name}
                className={`group flex items-center gap-2.5 rounded-lg border px-3 py-1.5 transition-colors ${
                  current ? "border-blue-500/50 bg-blue-500/10" : "border-neutral-800 bg-neutral-950/40"
                }`}
              >
                {outdated ? (
                  <TriangleAlert className="h-4 w-4 shrink-0 text-amber-300" />
                ) : (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-100" title={f.name}>
                    {f.name}
                  </p>
                  <p className="truncate text-xs text-neutral-500" title={`Saved ${when(f.savedAt)}`}>
                    {kb(f.size)} ·{" "}
                    {outdated ? (
                      <span className="text-amber-300">update on next flash</span>
                    ) : (
                      <span>{f.version ?? when(f.savedAt)}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => saveToDisk(f.name)}
                  title="Save the file to this computer"
                  className="shrink-0 rounded-md p-1 text-neutral-500 opacity-0 transition hover:bg-neutral-800 hover:text-neutral-200 focus:opacity-100 group-hover:opacity-100"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={busy}
                  onClick={() => deleteSavedFirmware(f.name)}
                  title="Delete"
                  className="shrink-0 rounded-md p-1 text-neutral-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
