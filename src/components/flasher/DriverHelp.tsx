"use client";

import { useEffect } from "react";
import { DRIVER_INSTALLER_URL, ZADIG_URL, driverInstallerCovers, usbIdOf, type DeviceDef } from "@/lib/flasher";

const primary = "inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500";
const outline = "inline-block rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800";

/**
 * Shown on Windows after the board's USB bootloader couldn't be found or
 * opened: it needs the WinUSB driver once per PC, which a website can't install.
 * A dialog, so the one-screen layout doesn't have to make room for it.
 */
export function DriverHelp({
  device,
  reason,
  onClose,
}: {
  device: DeviceDef;
  reason: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filter = device.usbFilters?.[0];
  // "0483 DF11", as Zadig shows it.
  const usbId = (usbIdOf(filter) ?? "").replace(":", " ").toUpperCase();

  const zadigSteps = (
    <ol className="list-decimal space-y-1 pl-5 text-neutral-300">
      <li>
        Keep the board in bootloader mode, download Zadig and open it (click <b>Yes</b>).
      </li>
      <li>
        Choose <b>Options → List All Devices</b> and pick the device with USB ID <b>{usbId}</b>.
      </li>
      <li>
        Make sure <b>WinUSB</b> is selected and click <b>Install Driver</b> (or <b>Replace Driver</b>).
      </li>
      <li>Come back here and press Flash again.</li>
    </ol>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-help-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-[40rem] max-w-full flex-col gap-3 rounded-xl border border-amber-500/40 bg-neutral-900 px-5 py-4 text-sm shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <p id="driver-help-title" className="font-medium text-amber-200">
            Install the USB driver to flash this board (once per PC)
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-0.5 rounded-md px-1.5 text-base leading-6 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>
        {reason && <p className="text-amber-300">{reason}</p>}
        {driverInstallerCovers(filter) ? (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-neutral-300">
              <li>Download the installer and double-click it. The board doesn&apos;t need to be plugged in.</li>
              <li>
                If Windows says <b>&quot;Windows protected your PC&quot;</b>, click <b>More info → Run anyway</b>.
              </li>
              <li>
                Click <b>Yes</b> when Windows asks for permission, and wait for <b>Done!</b>
              </li>
              <li>Replug the board, then press Flash again.</li>
            </ol>
            <div>
              <a href={DRIVER_INSTALLER_URL} download="ChordsDriverSetup.exe" className={primary}>
                Download driver installer
              </a>
            </div>
            {/* Alternative: Zadig, for when the installer can't be used. */}
            <div className="flex flex-col gap-2 border-t border-amber-500/30 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-neutral-400">Or install it with Zadig:</span>
                <a href={ZADIG_URL} target="_blank" rel="noopener noreferrer" className={outline}>
                  Download Zadig
                </a>
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-neutral-400">Zadig steps</summary>
                <div className="mt-2">{zadigSteps}</div>
              </details>
            </div>
          </>
        ) : (
          <>
            {zadigSteps}
            <div>
              <a href={ZADIG_URL} target="_blank" rel="noopener noreferrer" className={primary}>
                Download Zadig
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
