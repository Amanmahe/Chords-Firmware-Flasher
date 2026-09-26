"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEVICES,
  PROTOCOL_LABEL,
  NeedsUserGesture,
  browserSupport,
  flashDevice,
  forgetDevices,
  needsApi,
  resetToBootloader,
  type DeviceDef,
} from "@/lib/flasher";
import { DeviceList, type DeviceStatus } from "./DeviceList";
import { Bolt, Upload } from "./icons";

type LogLine = { t: string; msg: string; kind: "info" | "ok" | "err" | "warn" };

const now = () => new Date().toLocaleTimeString([], { hour12: false });

export default function Flasher() {
  const [activeId, setActiveId] = useState(DEVICES[0].id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, DeviceStatus>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [espAddr, setEspAddr] = useState("0x0");
  const [eraseAll, setEraseAll] = useState(false);
  const [verify, setVerify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [support, setSupport] = useState({ serial: true, usb: true, fsAccess: true });
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSupport(browserSupport()), []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const active = useMemo(() => DEVICES.find((d) => d.id === activeId)!, [activeId]);
  const log = useCallback(
    (msg: string, kind: LogLine["kind"] = "info") => setLogs((l) => [...l.slice(-500), { t: now(), msg, kind }]),
    [],
  );

  // Batch queue: selected devices, in list order, not yet flashed OK
  const queue = DEVICES.filter((d) => selected.has(d.id));
  const pending = queue.filter((d) => status[d.id] !== "done");
  const nextInBatch = pending[0];

  const setDevStatus = (id: string, s: DeviceStatus) => setStatus((m) => ({ ...m, [id]: s }));

  const runFlash = async (device: DeviceDef, opts: { skipTouch?: boolean } = {}) => {
    if (busy) return;
    setActiveId(device.id);
    setBusy(true);
    setProgress({ pct: 0, label: "Starting" });
    setDevStatus(device.id, "flashing");
    log(`── ${device.name} ──`, "warn");

    const addr = parseInt(espAddr, 16);
    try {
      await flashDevice(
        {
          device,
          file: files[device.id] ?? null,
          customAddress: Number.isFinite(addr) ? addr : undefined,
          eraseAll,
          verify,
          skipTouch: opts.skipTouch,
        },
        {
          log: (m) => log(m),
          progress: (pct, label) => setProgress({ pct: Math.max(0, Math.min(100, pct)), label: label ?? "" }),
        },
      );
      setProgress({ pct: 100, label: "Done" });
      setDevStatus(device.id, "done");
      log(`${device.name} flashed successfully`, "ok");

      // advance the batch
      const rest = DEVICES.filter((d) => selected.has(d.id) && d.id !== device.id && status[d.id] !== "done");
      if (rest.length) {
        setActiveId(rest[0].id);
        log(`Next: connect ${rest[0].name} and press Flash.`, "warn");
      }
    } catch (e) {
      if (e instanceof NeedsUserGesture) {
        setDevStatus(device.id, "waiting");
        log(e.message, "warn");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setDevStatus(device.id, "error");
        log(
          /No port selected|No device selected|NotFoundError|aborted a request/i.test(msg)
            ? "Cancelled: no device was selected."
            : `Error: ${msg}`,
          "err",
        );
      }
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const api = needsApi(active);
  const apiMissing =
    (api === "serial" && !support.serial) || (api === "usb" && (!support.usb || (active.touch1200 && !support.serial)));
  const customFile = files[active.id];
  const isDfuTouch =
    (active.protocol === "dfu" || active.protocol === "dfuse" || active.protocol === "picoboot") && active.touch1200;
  const flashTarget = active;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bolt className="h-5 w-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Web Firmware Flasher</h1>
          </div>
          <p className="hidden text-sm text-neutral-400 sm:block">Chrome · Edge · Opera (desktop)</p>
        </div>
      </header>

      {(!support.serial || !support.usb) && (
        <div className="mx-auto mt-4 max-w-6xl px-6">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            This browser is missing {!support.serial && "Web Serial"}
            {!support.serial && !support.usb && " and "}
            {!support.usb && "WebUSB"}. Open this page in desktop Chrome or Edge over HTTPS (or localhost).
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[300px_1fr]">
        {/* ------------------------------------------------ device list */}
        <aside className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 pl-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Devices · {selected.size} in batch
            </span>
            <div className="flex gap-2 text-xs">
              <button
                disabled={busy}
                onClick={() => setSelected(new Set(DEVICES.map((d) => d.id)))}
                className="text-blue-400 hover:underline disabled:opacity-40"
              >
                All
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setSelected(new Set());
                  setStatus({});
                }}
                className="text-neutral-400 hover:underline disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
          <DeviceList
            devices={DEVICES}
            activeId={activeId}
            selected={selected}
            status={status}
            busy={busy}
            onActivate={setActiveId}
            onToggle={toggle}
            onQuickFlash={(id) => runFlash(DEVICES.find((d) => d.id === id)!)}
          />
        </aside>

        {/* ------------------------------------------------ detail panel */}
        <section className="flex min-w-0 flex-col gap-5">
          {queue.length > 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Batch</span>
                <span className="text-neutral-400">
                  {queue.length - pending.length} / {queue.length} flashed
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${((queue.length - pending.length) / queue.length) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                {nextInBatch
                  ? `Next: plug in ${nextInBatch.name}, then press Flash. Each board needs one click because the browser asks you to pick the port.`
                  : "All selected boards are flashed."}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{active.name}</h2>
                <p className="mt-1 text-sm text-neutral-400">{active.family}</p>
              </div>
              <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
                {PROTOCOL_LABEL[active.protocol]}
              </span>
            </div>

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-neutral-300">
              {active.instructions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>

            {/* firmware source */}
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Firmware</p>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-neutral-700 bg-neutral-950/50 px-4 py-3 text-sm hover:border-neutral-500">
                <Upload className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate">
                  {customFile ? (
                    <>
                      <span className="text-neutral-100">{customFile.name}</span>{" "}
                      <span className="text-neutral-500">({(customFile.size / 1024).toFixed(1)} KB)</span>
                    </>
                  ) : active.firmware.length ? (
                    <span className="text-neutral-400">
                      Bundled: <code className="text-neutral-300">{active.firmware.map((f) => f.url).join(", ")}</code>
                      <span className="text-neutral-500"> · click to use your own file ({active.accept})</span>
                    </span>
                  ) : (
                    <span className="text-neutral-400">Choose a firmware file ({active.accept})</span>
                  )}
                </span>
                <input
                  type="file"
                  accept={active.accept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFiles((m) => ({ ...m, [active.id]: f }));
                    e.target.value = "";
                  }}
                />
              </label>
              {customFile && (
                <button
                  onClick={() => setFiles((m) => ({ ...m, [active.id]: null }))}
                  className="mt-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:underline"
                >
                  Use bundled firmware instead
                </button>
              )}
            </div>

            {/* options */}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              {active.protocol === "esptool" ? (
                <>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={eraseAll} onChange={(e) => setEraseAll(e.target.checked)} className="accent-blue-500" />
                    Erase entire flash first
                  </label>
                  {customFile && (
                    <label className="flex items-center gap-2">
                      Offset
                      <input
                        value={espAddr}
                        onChange={(e) => setEspAddr(e.target.value)}
                        className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs"
                      />
                      <span className="text-xs text-neutral-500">0x0 for merged images, 0x10000 for app-only</span>
                    </label>
                  )}
                </>
              ) : (
                active.protocol !== "uf2" &&
                active.protocol !== "dfu" &&
                active.protocol !== "dfuse" && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} className="accent-blue-500" />
                    Verify after writing
                  </label>
                )
              )}
            </div>

            {/* actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                disabled={busy || apiMissing}
                onClick={() => runFlash(flashTarget, { skipTouch: status[flashTarget.id] === "waiting" })}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Bolt />
                {busy ? "Flashing…" : `Flash ${flashTarget.name}`}
              </button>

              {isDfuTouch && (
                <button
                  disabled={busy}
                  onClick={() => runFlash(active, { skipTouch: true })}
                  className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
                  title="Use this after double-tapping RESET"
                >
                  Board is already in bootloader
                </button>
              )}

              <button
                disabled={busy}
                onClick={async () => {
                  try {
                    const { usb, serial } = await forgetDevices();
                    setStatus((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== "waiting")));
                    log(
                      `Forgot ${usb} USB device(s) and ${serial} serial port(s). The next flash will ask for them again. ` +
                        "Old entries still shown in the browser's device list disappear after restarting the browser.",
                      "warn",
                    );
                  } catch (e) {
                    log(`Error: ${e instanceof Error ? e.message : e}`, "err");
                  }
                }}
                className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
                title="Remove this site's access to all boards it remembers"
              >
                Forget devices
              </button>

              {active.protocol === "uf2" && (
                <button
                  disabled={busy || !support.serial}
                  onClick={async () => {
                    try {
                      await resetToBootloader();
                      log("Reset sent. Wait for the RPI-RP2 drive, then press Flash.", "warn");
                    } catch (e) {
                      log(`Error: ${e instanceof Error ? e.message : e}`, "err");
                    }
                  }}
                  className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  Reset to BOOTSEL
                </button>
              )}
            </div>

            {/* progress */}
            {progress && (
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-neutral-400">
                  <span>{progress.label}</span>
                  <span className="tabular-nums">{progress.pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full transition-[width] duration-150 ${progress.pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* log */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
              <span className="text-sm font-medium">Log</span>
              <div className="flex gap-3 text-xs text-neutral-400">
                <button
                  onClick={() => navigator.clipboard.writeText(logs.map((l) => `[${l.t}] ${l.msg}`).join("\n"))}
                  className="hover:text-neutral-200"
                >
                  Copy
                </button>
                <button onClick={() => setLogs([])} className="hover:text-neutral-200">
                  Clear
                </button>
              </div>
            </div>
            <div ref={logRef} className="h-64 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <p className="text-neutral-500">Select a board and press Flash.</p>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.kind === "err"
                        ? "text-red-400"
                        : l.kind === "ok"
                          ? "text-green-400"
                          : l.kind === "warn"
                            ? "text-amber-300"
                            : "text-neutral-300"
                    }
                  >
                    <span className="text-neutral-600">[{l.t}]</span> {l.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
