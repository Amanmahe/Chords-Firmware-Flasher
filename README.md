# Chords Firmware Flasher (Next.js + Tailwind)

This page flashes 15 boards from the browser. There's nothing to install on the user's PC; you need Chrome, Edge, Opera or Firefox 151+ on desktop, over HTTPS or localhost.

```bash
npm install
npm run dev        # http://localhost:3000/flasher
```

## 1. Where the firmware comes from

Each board flashes its file from the latest [Chords-Arduino-Firmware](https://github.com/upsidedownlabs/Chords-Arduino-Firmware) release. A Cloudflare Worker serves the files with CORS headers, since GitHub downloads have none. The file names are set in `src/lib/flasher/devices.ts`. To pin a release, set `NEXT_PUBLIC_FIRMWARE_BASE` (e.g. `.../firmware/v1.0.4`).

Downloaded files are saved in the browser (IndexedDB), so they don't have to be downloaded again. Users can also drop in their own file for any board.

## 2. How each board is flashed

| Protocol | Boards | API |
|---|---|---|
| esptool-js | ESP32-C6 / S3 | Web Serial |
| STK500v1 (Optiboot / old ATmegaBOOT, auto 115200 → 57600) | UNO R3, Genuino UNO, Nano | Web Serial |
| STK500v2 (Wiring bootloader) | Mega 2560 | Web Serial |
| SAM-BA via ESP32-S3 bridge, 230400 baud | UNO R4 WiFi | Web Serial |
| USB DFU 1.1 | UNO R4 Minima | WebUSB (1200-baud touch first) |
| ST DfuSe | STM32 ROM bootloader, GIGA R1 | WebUSB |
| PICOBOOT | RP2040 | WebUSB (1200-baud touch first) |

## Known limitations
- **USB bootloaders on Windows** (STM32, GIGA R1, UNO R4 Minima, Pico): the bootloader needs the WinUSB driver before WebUSB can open it. When a flash can't find or open the board, the page offers the driver installer (`public/drivers/ChordsDriverSetup.exe`), with Zadig as the alternative.
- **Safari:** doesn't have Web Serial or WebUSB.
