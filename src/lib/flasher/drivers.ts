/**
 * Windows only lets the browser see a USB bootloader (UNO R4 Minima, STM32,
 * GIGA R1, Pico) that uses the WinUSB driver, and a website can't install
 * drivers. Two ways to set WinUSB up once per PC:
 *  - the Chords installer (public/drivers): double-click, no board needed;
 *    covers every board here, Zadig stays as the manual alternative;
 *  - Zadig (official libwdi release): any board, picked by hand.
 */
export const ZADIG_URL = "https://github.com/pbatard/libwdi/releases/download/v1.5.1/zadig-2.9.exe";

// public/ is served under the site's base path (e.g. /Chords-Firmware-Flasher on GitHub Pages).
export const DRIVER_INSTALLER_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/drivers/ChordsDriverSetup.exe`;

/** Bootloaders (vendor:product) the Chords installer sets up; others need Zadig. */
const INSTALLER_IDS = ["0483:df11", "2341:0369", "2341:0366", "2341:0466", "2e8a:0003"];

/** "0483:df11" for a filter with both IDs, else null. */
export function usbIdOf(filter: USBDeviceFilter | undefined) {
  if (filter?.vendorId === undefined || filter.productId === undefined) return null;
  return `${filter.vendorId.toString(16).padStart(4, "0")}:${filter.productId.toString(16).padStart(4, "0")}`;
}

export function driverInstallerCovers(filter: USBDeviceFilter | undefined) {
  const id = usbIdOf(filter);
  return id !== null && INSTALLER_IDS.includes(id);
}
