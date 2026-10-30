"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleHelp,
  CloudDownload,
  Copy,
  FileText,
  Info,
  Link,
  Loader2,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  Unplug,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  DEVICES,
  PROTOCOL_LABEL,
  NeedsUserGesture,
  browserSupport,
  downloadFirmware,
  fileNameOf,
  firmwareCacheEvents,
  flashDevice,
  forgetDevices,
  listSavedFirmware,
  needsApi,
  resetToBootloader,
  setPreferredSerialPort,
  type DeviceDef,
} from "@/lib/flasher";
import { DeviceList, type DeviceStatus } from "./DeviceList";
import { DriverHelp } from "./DriverHelp";
import { GithubMark } from "./icons";
import { SavedFirmware } from "./SavedFirmware";

type LogLine = { t: string; msg: string; kind: "info" | "ok" | "err" | "warn" };

const REPO_URL = "https://github.com/Amanmahe/web-flasher";
const now = () => new Date().toLocaleTimeString([], { hour12: false });

const isWindows = () => typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent);

/** On Windows, a USB flash that waits this long usually means the board's driver is missing. */
const DRIVER_WAIT_MS = 15000;

/** How long an unplugged board has to come back before Connect is shown again. */
const RECONNECT_WAIT_MS = 3000;

export default function Flasher() {
  const [activeId, setActiveId] = useState(DEVICES[0].id);
  const [status, setStatus] = useState<Record<string, DeviceStatus>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [espAddr, setEspAddr] = useState("0x0");
  // The serial port picked with Connect; flashing uses it.
  const [port, setPort] = useState<SerialPort | null>(null);
  // The connected board is unplugged (or restarting after a flash).
  const [portGone, setPortGone] = useState(false);
  // A file dragged over the firmware card.
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [support, setSupport] = useState({ serial: true, usb: true, fsAccess: true });
  const [downloading, setDownloading] = useState(false);
  // Firmware files already saved in this browser: no need to download them.
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  // What to do next while a board waits (usually in its bootloader) for Continue.
  const [waiting, setWaiting] = useState<{ id: string; msg: string } | null>(null);
  // Windows couldn't find / open a USB bootloader: it needs the WinUSB driver.
  const [needsWinUsb, setNeedsWinUsb] = useState(false);
  // Why the driver steps are shown, when it isn't obvious from the log.
  const [driverReason, setDriverReason] = useState<string | null>(null);
  // The driver steps dialog: opens by itself when the driver is found missing.
  const [driverOpen, setDriverOpen] = useState(false);
  // Fires when the browser's USB list stays open without a pick.
  const pickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fires when a USB flash shows no progress (time in a device list not counted).
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // For event handlers that outlive a render.
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => setSupport(browserSupport()), []);
  useEffect(() => {
    const refresh = () => listSavedFirmware().then((l) => setSavedNames(new Set(l.map((f) => f.name))));
    refresh();
    firmwareCacheEvents?.addEventListener("change", refresh);
    return () => firmwareCacheEvents?.removeEventListener("change", refresh);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const active = useMemo(() => DEVICES.find((d) => d.id === activeId)!, [activeId]);
  const log = useCallback(
    (msg: string, kind: LogLine["kind"] = "info") => setLogs((l) => [...l.slice(-500), { t: now(), msg, kind }]),
    [],
  );

  // Unplugging the connected board disconnects it and brings Connect back.
  // Flashing restarts some boards, which come back within seconds: those are
  // taken back, so the page waits a moment (and for the flash to end) first.
  useEffect(() => {
    if (!port || !("serial" in navigator)) return;
    const { usbVendorId, usbProductId } = port.getInfo();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const drop = () => {
      if (busyRef.current) {
        timer = setTimeout(drop, RECONNECT_WAIT_MS);
        return;
      }
      timer = undefined;
      setPreferredSerialPort(null);
      setPort(null);
      setPortGone(false);
      log("The board was unplugged. Press Connect Device to use it again.", "warn");
    };
    const onDisconnect = (e: Event) => {
      if (e.target !== port) return;
      setPortGone(true);
      setPreferredSerialPort(null);
      clearTimeout(timer);
      timer = setTimeout(drop, RECONNECT_WAIT_MS);
    };
    const onConnect = (e: Event) => {
      const p = e.target as SerialPort;
      const i = p.getInfo();
      if (timer === undefined || i.usbVendorId !== usbVendorId || i.usbProductId !== usbProductId) return;
      clearTimeout(timer);
      timer = undefined;
      setPortGone(false);
      setPreferredSerialPort(p);
      setPort(p);
    };
    navigator.serial.addEventListener("disconnect", onDisconnect);
    navigator.serial.addEventListener("connect", onConnect);
    return () => {
      clearTimeout(timer);
      navigator.serial.removeEventListener("disconnect", onDisconnect);
      navigator.serial.removeEventListener("connect", onConnect);
    };
  }, [port, log]);

  const setDevStatus = (id: string, s: DeviceStatus) => setStatus((m) => ({ ...m, [id]: s }));

  const showDriverHelp = (reason?: string) => {
    setNeedsWinUsb(true);
    if (reason) setDriverReason(reason);
    setDriverOpen(true);
  };

  const clearPickerTimer = () => {
    if (pickerTimerRef.current) clearTimeout(pickerTimerRef.current);
    pickerTimerRef.current = null;
  };
  const clearStallTimer = () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = null;
  };

  const runFlash = async (device: DeviceDef, opts: { skipTouch?: boolean } = {}) => {
    if (busy) return;
    setActiveId(device.id);
    setBusy(true);
    setWaiting(null);
    setDriverReason(null);
    setProgress({ pct: 0, label: "Starting" });
    setDevStatus(device.id, "flashing");
    log(`── ${device.name} ──`, "warn");

    // Windows, USB bootloader: no progress for a while (outside a device
    // list) usually means the driver is missing and the board never answers.
    // Long enough for a reset into the bootloader (~9 s).
    const windows = isWindows();
    const watchStall = windows && needsApi(device) === "usb";
    let started = false;
    const armStall = () => {
      clearStallTimer();
      if (!watchStall || started) return;
      stallTimerRef.current = setTimeout(() => {
        const reason =
          "Flashing hasn't started after 15 seconds. This PC most likely doesn't have the USB driver for this board.";
        showDriverHelp(reason);
        log(`${reason} Run the driver installer from "USB driver help", then press Flash again.`, "warn");
      }, DRIVER_WAIT_MS);
    };
    armStall();

    const addr = parseInt(espAddr, 16);
    try {
      await flashDevice(
        {
          device,
          file: files[device.id] ?? null,
          customAddress: Number.isFinite(addr) ? addr : undefined,
          eraseAll: true,
          verify: true,
          skipTouch: opts.skipTouch,
        },
        {
          log,
          progress: (pct, label) => {
            if (pct > 0 && !started) {
              started = true;
              clearStallTimer();
            }
            setProgress({ pct: Math.max(0, Math.min(100, pct)), label: label ?? "" });
          },
          pickerOpen: (open, list) => {
            clearPickerTimer();
            // Choosing in a list isn't a stall: pause, then restart after it.
            if (!open) {
              setProgress((p) => p && { ...p, label: "Connecting" });
              return armStall();
            }
            clearStallTimer();
            setProgress((p) => p && { ...p, label: "Waiting for you to select the board" });
            if (list !== "usb") return;
            // Nothing picked within 15 s usually means the bootloader isn't
            // listed: on Windows, its driver is missing.
            pickerTimerRef.current = setTimeout(() => {
              showDriverHelp("No board was selected within 15 seconds. If it isn't in the list, this PC needs the USB driver.");
              log(
                windows
                  ? `No board selected yet. If it isn't in the list, or selecting it fails, Windows needs the USB driver: see "USB driver help".`
                  : "No board selected yet. If it isn't in the list, make sure it's in bootloader mode, then replug it.",
                "warn",
              );
            }, DRIVER_WAIT_MS);
          },
        },
      );
      setProgress({ pct: 100, label: "Done" });
      setDevStatus(device.id, "done");
      // A USB bootloader answered, so this PC has its driver now.
      if (needsApi(device) === "usb") {
        setNeedsWinUsb(false);
        setDriverOpen(false);
      }
      log(`${device.name} flashed successfully`, "ok");
    } catch (e) {
      if (e instanceof NeedsUserGesture) {
        setDevStatus(device.id, "waiting");
        setWaiting({ id: device.id, msg: e.message });
        log(e.message, "warn");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setDevStatus(device.id, "error");
        if (/Windows is using a driver the browser can't open|only lists a bootloader that has the WinUSB driver/.test(msg)) {
          showDriverHelp();
        }
        log(
          /No port selected|No device selected|NotFoundError|aborted a request/i.test(msg)
            ? "Cancelled: no device was selected."
            : `Error: ${msg}`,
          "err",
        );
      }
      setProgress(null);
    } finally {
      clearPickerTimer();
      clearStallTimer();
      setBusy(false);
    }
  };

  // A board that waits for Continue is already in its bootloader: skip the reset.
  const flash = (device: DeviceDef) => runFlash(device, { skipTouch: status[device.id] === "waiting" });

  const api = needsApi(active);
  const apiMissing =
    (api === "serial" && !support.serial) || (api === "usb" && (!support.usb || (active.touch1200 && !support.serial)));
  const customFile = files[active.id];
  const isDfuTouch =
    (active.protocol === "dfu" || active.protocol === "dfuse" || active.protocol === "picoboot") && active.touch1200;
  const flashTarget = active;

  const connect = async () => {
    try {
      const p = await navigator.serial.requestPort();
      setPreferredSerialPort(p);
      setPort(p);
      setPortGone(false);
      log(`Connected to ${portName(p)}. Flashing uses this port.`, "ok");
    } catch (e) {
      log(
        e instanceof DOMException && e.name === "NotFoundError"
          ? "Cancelled: no port was selected."
          : `Error: ${e instanceof Error ? e.message : e}`,
        "err",
      );
    }
  };

  // Disconnect also revokes every board this site remembers, so the browser's
  // lists start clean (dead entries only go away when the browser restarts).
  const disconnect = async () => {
    setPreferredSerialPort(null);
    setPort(null);
    try {
      await forgetDevices();
      setStatus((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== "waiting")));
      log("Disconnected. The next flash will ask for the board again.", "warn");
    } catch (e) {
      log(`Error: ${e instanceof Error ? e.message : e}`, "err");
    }
  };

  const pickFile = (f: File | null) => {
    if (!f || busy) return;
    const exts = active.accept.split(",");
    if (!exts.some((x) => f.name.toLowerCase().endsWith(x.trim()))) {
      log(`${f.name} isn't a firmware file for ${active.name} (${active.accept}).`, "err");
      return;
    }
    setFiles((m) => ({ ...m, [active.id]: f }));
    log(`Selected ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
  };

  return (
    // Large windows: one screen that never scrolls, scaled to fit (globals.css).
    // Smaller ones: panels stack in one column and the page scrolls.
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100 desk:h-dvh desk:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-neutral-800 bg-neutral-950/70 px-4 py-3 backdrop-blur desk:flex-nowrap desk:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-neutral-50">Chords Firmware Flasher</h1>
          <p className="truncate text-xs text-neutral-500">Works in Chrome, Edge, Opera and Firefox 151+ on desktop</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* In the header rather than a banner, so the screen keeps its height. */}
          {!(support.serial && support.usb) && (
            <p className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              This browser is missing {!support.serial && "Web Serial"}
              {!support.serial && !support.usb && " and "}
              {!support.usb && "WebUSB"}. Open this page in desktop Chrome or Edge over HTTPS (or localhost).
            </p>
          )}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Chords Firmware Flasher on GitHub"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            <GithubMark className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${port ? (portGone ? "bg-amber-400" : "bg-emerald-500") : "bg-neutral-600"}`}
            />
            <span className={port ? "text-neutral-200" : "text-neutral-400"}>
              {port ? (portGone ? `${portName(port)} unplugged` : `${portName(port)} connected`) : "Not connected"}
            </span>
          </div>
          {port ? (
            <button
              onClick={disconnect}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={busy || !support.serial}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              <Link className="h-4 w-4" />
              Connect Device
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-col gap-4 p-4 desk:grid desk:min-h-0 desk:flex-1 desk:grid-cols-[20.5rem_minmax(0,1fr)_23rem] desk:grid-rows-[minmax(0,1fr)] desk:gap-5 desk:p-5">
        {/* ------------------------------------------------ device list */}
        <aside className="flex h-[20rem] min-h-0 min-w-0 flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 desk:h-auto">
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <h2 className="text-sm font-medium text-neutral-300">Devices</h2>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[0.625rem] tabular-nums text-blue-300">
              {DEVICES.length}
            </span>
          </div>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            <DeviceList devices={DEVICES} activeId={activeId} onActivate={setActiveId} />
          </div>
        </aside>

        {/* ------------------------------------------------ detail panel */}
        <section className="flex min-h-0 min-w-0 flex-col gap-4 desk:gap-5">
          <div className="space-y-3 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-neutral-100">{active.name}</h2>
                <p className="text-xs text-neutral-500">{active.family}</p>
              </div>
              <span className="shrink-0 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300">
                {PROTOCOL_LABEL[active.protocol]}
              </span>
            </div>

            <ol className="list-decimal space-y-1 rounded-lg border border-neutral-800 bg-neutral-950/50 py-3 pl-9 pr-4 text-sm text-neutral-300">
              {active.instructions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>

            {/* firmware: what will be flashed; drop a file on it to use your own */}
            <div
              onDragOver={(e) => {
                if (busy || !e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDragging(true);
              }}
              onDragLeave={(e) => {
                // Ignore moves between the card's own children
                if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0] ?? null);
              }}
              className={`relative flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 desk:flex-nowrap ${
                customFile
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : active.firmware.length
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-dashed border-neutral-700 bg-neutral-950/50"
              }`}
            >
              {dragging && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-emerald-500/60 bg-neutral-950">
                  <CloudDownload className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-emerald-300">Drop the file to use it ({active.accept})</p>
                </div>
              )}
              <FileText
                className={`h-5 w-5 shrink-0 ${customFile ? "text-emerald-400" : active.firmware.length ? "text-blue-400" : "text-neutral-600"}`}
                strokeWidth={1.5}
              />
              <div className="min-w-[12rem] flex-1 desk:min-w-0">
                {customFile ? (
                  <div className="flex min-w-0 items-baseline gap-2">
                    <p className="truncate font-medium text-emerald-300" title={customFile.name}>
                      {customFile.name}
                    </p>
                    <span className="shrink-0 text-xs text-neutral-500">{(customFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : active.firmware.length ? (
                  <p className="truncate font-medium text-blue-300">{active.firmware.map((f) => fileNameOf(f.url)).join(", ")}</p>
                ) : (
                  <p className="text-sm text-neutral-400">No firmware selected</p>
                )}
                <p className="mt-0.5 text-xs text-neutral-500">
                  {customFile
                    ? "Your file"
                    : active.firmware.length
                      ? "Latest release · drop a file here to use your own"
                      : `Choose or drop a file (${active.accept})`}
                </p>
              </div>
              {!customFile &&
                active.firmware.map((f) =>
                  savedNames.has(fileNameOf(f.url)) ? (
                    <span
                      key={f.url}
                      title={`${fileNameOf(f.url)} is saved in this browser`}
                      className="flex shrink-0 items-center gap-1 text-xs text-emerald-400"
                    >
                      <Check className="h-4 w-4" />
                      Saved
                    </span>
                  ) : (
                    <button
                      key={f.url}
                      disabled={downloading || busy}
                      onClick={async () => {
                        const name = fileNameOf(f.url);
                        setDownloading(true);
                        try {
                          const { version } = await downloadFirmware(f.url);
                          log(`Saved ${name}${version ? ` (${version})` : ""} in this browser.`, "ok");
                        } catch (e) {
                          log(`Couldn't download ${name}: ${e instanceof Error ? e.message : e}`, "err");
                        } finally {
                          setDownloading(false);
                        }
                      }}
                      title={`Download ${fileNameOf(f.url)} and keep it in this browser`}
                      className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                    </button>
                  ),
                )}
              <label
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 ${
                  busy ? "pointer-events-none opacity-50" : "cursor-pointer"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                {customFile ? "Change file" : "Use your own file"}
                <input
                  type="file"
                  accept={active.accept}
                  className="hidden"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {customFile && (
                <button
                  onClick={() => setFiles((m) => ({ ...m, [active.id]: null }))}
                  disabled={busy}
                  title="Use the latest release instead"
                  className="shrink-0 rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {active.protocol === "esptool" && customFile && (
              <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                Offset
                <input
                  value={espAddr}
                  onChange={(e) => setEspAddr(e.target.value)}
                  spellCheck={false}
                  className="w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-100 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs text-neutral-500">0x0 for merged images, 0x10000 for app-only</span>
              </label>
            )}

            {/* actions: the Flash button fills with progress while flashing */}
            <div className="flex items-center gap-3">
              <button
                disabled={busy || apiMissing}
                onClick={() => flash(flashTarget)}
                className="relative min-w-0 flex-1 overflow-hidden rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {busy && progress && (
                  <span
                    className="absolute inset-y-0 left-0 bg-blue-500/40 transition-[width] duration-150"
                    style={{ width: `${progress.pct}%` }}
                  />
                )}
                <span className={`relative flex items-center justify-center gap-2 truncate ${busy ? "tabular-nums text-neutral-100" : ""}`}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      {`Flashing… ${(progress?.pct ?? 0).toFixed(0)}%${progress?.label ? ` · ${progress.label}` : ""}`}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 shrink-0" />
                      {status[flashTarget.id] === "waiting" ? "Continue" : `Flash ${flashTarget.name}`}
                    </>
                  )}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {isDfuTouch && (
                <button
                  disabled={busy}
                  onClick={() => runFlash(active, { skipTouch: true })}
                  className={secondary}
                  title="Use this after double-tapping RESET"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Board is already in bootloader
                </button>
              )}

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
                  className={secondary}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset to BOOTSEL
                </button>
              )}

              {needsWinUsb && needsApi(active) === "usb" && isWindows() && (
                <button
                  onClick={() => setDriverOpen(true)}
                  className={`${secondary} border-amber-500/40 text-amber-200 hover:bg-amber-500/10`}
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                  USB driver help
                </button>
              )}
            </div>

            {status[active.id] === "waiting" && waiting?.id === active.id && (
              <div className="flex gap-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                <div>
                  <p className="font-medium text-blue-200">Next step</p>
                  <p className="mt-0.5 text-neutral-300">{waiting.msg}</p>
                </div>
              </div>
            )}
          </div>

          {/* log */}
          <div className="relative flex h-[24rem] flex-col desk:h-auto desk:min-h-[8rem] desk:flex-1">
            {/* Copy and Clear, pinned to the console's top-right corner */}
            <div className="absolute right-3 top-2.5 z-10 flex gap-1.5">
              <button
                onClick={() => navigator.clipboard.writeText(logs.map((l) => `[${l.t}] ${l.msg}`).join("\n"))}
                disabled={logs.length === 0}
                title="Copy log"
                className={consoleButton}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setLogs([])} disabled={logs.length === 0} className={consoleButton}>
                Clear
              </button>
            </div>
            <div
              ref={logRef}
              className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 pr-24 font-mono text-xs leading-relaxed break-words"
            >
              {logs.length === 0 ? (
                <p className="text-neutral-500">Select a board and press Flash.</p>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={i}
                    className={`mb-1 whitespace-pre-wrap ${
                      l.kind === "err"
                        ? "text-red-400"
                        : l.kind === "ok"
                          ? "text-emerald-400"
                          : l.kind === "warn"
                            ? "text-amber-300"
                            : "text-neutral-300"
                    }`}
                  >
                    [{l.t}] {l.kind === "ok" && "✓ "}
                    {l.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ saved firmware */}
        <SavedFirmware
          className="h-[22rem] min-w-0 desk:h-auto"
          activeFiles={active.firmware.map((f) => fileNameOf(f.url))}
          busy={busy}
          log={log}
        />
      </main>

      {driverOpen && needsApi(active) === "usb" && isWindows() && (
        <DriverHelp device={active} reason={driverReason} onClose={() => setDriverOpen(false)} />
      )}
    </div>
  );
}

const secondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";

const consoleButton =
  "flex items-center rounded-md border border-neutral-700 bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-neutral-300 backdrop-blur transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-default disabled:opacity-40";

const VENDORS: Record<number, string> = {
  0x303a: "Espressif",
  0x2341: "Arduino",
  0x2e8a: "Raspberry Pi",
  0x1a86: "CH340",
  0x10c4: "CP210x",
  0x0403: "FTDI",
  0x0483: "STM32",
};

/** A short name for a serial port, from its USB IDs. */
function portName(p: SerialPort) {
  const { usbVendorId: v, usbProductId: id } = p.getInfo();
  if (v === undefined) return "Serial port";
  const hex = (n: number) => n.toString(16).padStart(4, "0");
  return `${VENDORS[v] ?? "USB"} (${hex(v)}:${id === undefined ? "?" : hex(id)})`;
}
