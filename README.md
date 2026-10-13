# Chords Firmware Flasher (Next.js + Tailwind)

This page flashes all 17 boards from the browser. There's nothing to install on the user's PC; you need Chrome, Edge or Opera on desktop, over HTTPS or localhost.

```bash
npm install
npm run dev        # http://localhost:3000/flasher
```

## 1. Drop in your binaries

Put each board's firmware in `public/firmware/<device-id>/`. The file names are set in `src/lib/flasher/devices.ts`:

| Board(s) | File | Notes |
|---|---|---|
| NPG-LITE(-BLE)-ESP32C6, ESP32-S3 | `firmware.bin` | **merged** image at 0x0 (Arduino: *Sketch → Export Compiled Binary* → `*.merged.bin`). For separate files, list bootloader / partitions / app with their offsets in `firmware: [...]`. |
| STM32G4, F401CC, F411CE | `firmware.bin` | written at 0x08000000 |
| GIGA-R1 | `firmware.bin` | written at 0x08040000 (after the Arduino bootloader) |
| UNO-R4-MINIMA, UNO-R4-WIFI | `firmware.bin` | the Arduino `.bin` |
| RPI-PICO-RP2040 | `firmware.uf2` | a `.bin` is converted to UF2 automatically |
| AVR (all) | `firmware.hex` | the HEX **without** `with_bootloader` |

Users can also upload their own file for any board.

## 2. How each board is flashed

| Protocol | Boards | API |
|---|---|---|
| esptool-js | ESP32-C6 / S3 | Web Serial |
| STK500v1 (Optiboot / old ATmegaBOOT, auto 115200 → 57600) | UNO, Genuino, Nano, clones | Web Serial |
| STK500v2 (Wiring bootloader) | Mega 2560 | Web Serial |
| SAM-BA via ESP32-S3 bridge, 230400 baud | UNO R4 WiFi | Web Serial |
| USB DFU 1.1 | UNO R4 Minima | WebUSB (1200-baud touch first) |
| ST DfuSe | STM32 ROM bootloader, GIGA R1 | WebUSB |
| UF2 drive | RP2040 | File System Access (download fallback) |

## Known limitations
- **USB bootloaders on Windows** (STM32, GIGA R1, UNO R4 Minima, Pico): the bootloader needs the WinUSB driver before WebUSB can open it. When a flash can't find or open the board, the page offers the driver installer (`public/drivers/ChordsDriverSetup.exe`), with Zadig as the alternative.
- **RP2040:** Chrome may refuse to open some drive roots. If it does, the page downloads the `.uf2` so you can drag it onto RPI-RP2.
- **Safari and Firefox:** these browsers don't have Web Serial or WebUSB.
