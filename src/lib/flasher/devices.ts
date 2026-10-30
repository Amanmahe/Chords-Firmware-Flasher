import type { DeviceDef } from "./types";

/**
 * Device catalogue.
 *
 * Each device's `firmware` points at its file in the latest Chords release
 * (see FIRMWARE_BASE). Every device also accepts a custom file upload in the UI.
 *
 *  - ESP32:      merged image (Arduino "Export compiled binary" -> *.merged.bin) at 0x0,
 *                or list bootloader / partitions / app separately with their offsets.
 *  - AVR:        Intel HEX (*.hex, the one WITHOUT "with_bootloader") or a raw .bin.
 *  - STM32/GIGA: raw .bin
 *  - UNO R4:     raw .bin
 *  - RP2040:     .uf2 (a .bin is converted to UF2 automatically)
 */

/**
 * Firmware comes from the latest Chords-Arduino-Firmware GitHub release,
 * served with CORS headers by a Cloudflare Worker (GitHub downloads have none).
 * Override with NEXT_PUBLIC_FIRMWARE_BASE, e.g. to pin a tag: ".../firmware/v1.0.4".
 */
export const FIRMWARE_BASE =
  process.env.NEXT_PUBLIC_FIRMWARE_BASE ?? "https://chords-arduino-firmware.myupsidedownlab.workers.dev/firmware/latest";
const release = (file: string) => `${FIRMWARE_BASE}/${file}`;

const ARDUINO_VID = 0x2341;
const ST_VID = 0x0483;
const RPI_VID = 0x2e8a;

const STM32_DFU_STEPS = [
  "Hold BOOT0, tap NRST (reset), then release BOOT0.",
  "The board now shows up as \"STM32 BOOTLOADER\" (0483:DF11).",
  "Press Flash. If the board isn't found, the device list opens: pick \"STM32 BOOTLOADER\" (it can also be listed as \"DFU in FS Mode\"). If the same board is listed several times, any entry works.",
  "When the log says so, press NRST (without BOOT0) to start the new firmware.",
];

const AVR_STEPS = [
  "Plug the board in over USB.",
  "Close the Arduino IDE Serial Monitor or anything else using the port.",
  "Pick the board's COM / tty port when the browser asks.",
];

export const DEVICES: DeviceDef[] = [
  // ---------------------------------------------------------------- ESP32
  {
    id: "npg-lite-esp32c6",
    name: "NPG-LITE-ESP32C6",
    family: "ESP32",
    protocol: "esptool",
    firmware: [{ url: release("Chords-NPG-LITE-Serial-ESP32C6.merged.bin"), address: 0x0 }],
    accept: ".bin",
    espBaud: 921600,
    espChip: "ESP32-C6",
    instructions: [
      "Connect the board over USB.",
      "If it isn't detected, hold BOOT, tap RESET, release BOOT and try again.",
    ],
  },
  {
    id: "npg-lite-ble-esp32c6",
    name: "NPG-LITE-BLE-ESP32C6",
    family: "ESP32",
    protocol: "esptool",
    firmware: [{ url: release("Chords-NPG-LITE-BLE-ESP32C6.merged.bin"), address: 0x0 }],
    accept: ".bin",
    espBaud: 921600,
    espChip: "ESP32-C6",
    instructions: [
      "Connect the board over USB.",
      "If it isn't detected, hold BOOT, tap RESET, release BOOT and try again.",
    ],
  },
  {
    id: "esp32-s3",
    name: "ESP32-S3",
    family: "ESP32",
    protocol: "esptool",
    firmware: [{ url: release("Chords-ESP32-S3.merged.bin"), address: 0x0 }],
    accept: ".bin",
    espBaud: 921600,
    espChip: "ESP32-S3",
    instructions: [
      "Connect the board over USB (either the UART or the native USB port).",
      "If it isn't detected, hold BOOT, tap RESET, release BOOT and try again.",
    ],
  },

  // ---------------------------------------------------------------- STM32 (ROM DFU)
  {
    id: "stm32g4-core-board",
    name: "STM32G4-CORE-BOARD",
    family: "STM32",
    protocol: "dfuse",
    firmware: [{ url: release("Chords-STM32G4-CORE-BOARD.bin"), address: 0x08000000 }],
    accept: ".bin",
    usbFilters: [{ vendorId: ST_VID, productId: 0xdf11 }],
    bootloaderName: "STM32 BOOTLOADER",
    dfuseAddress: 0x08000000,
    instructions: STM32_DFU_STEPS,
  },
  {
    id: "stm32f401cc-black-pill",
    name: "STM32F401CC-BLACK-PILL",
    family: "STM32",
    protocol: "dfuse",
    firmware: [{ url: release("Chords-STM32F401CC-BLACK-PILL.bin"), address: 0x08000000 }],
    accept: ".bin",
    usbFilters: [{ vendorId: ST_VID, productId: 0xdf11 }],
    bootloaderName: "STM32 BOOTLOADER",
    dfuseAddress: 0x08000000,
    instructions: STM32_DFU_STEPS,
  },
  {
    id: "stm32f411ce-black-pill",
    name: "STM32F411CE-BLACK-PILL",
    family: "STM32",
    protocol: "dfuse",
    firmware: [{ url: release("Chords-STM32F411CE-BLACK-PILL.bin"), address: 0x08000000 }],
    accept: ".bin",
    usbFilters: [{ vendorId: ST_VID, productId: 0xdf11 }],
    bootloaderName: "STM32 BOOTLOADER",
    dfuseAddress: 0x08000000,
    instructions: STM32_DFU_STEPS,
  },

  // ---------------------------------------------------------------- Arduino GIGA (DfuSe @ 0x08040000)
  {
    id: "giga-r1",
    name: "GIGA-R1",
    family: "Arduino Mbed",
    protocol: "dfuse",
    firmware: [{ url: release("Chords-GIGA-R1.bin"), address: 0x08040000 }],
    accept: ".bin",
    // Bootloader only: 0x0266 is the running sketch, which must not be taken
    // for the bootloader (the reset would be skipped).
    usbFilters: [{ vendorId: ARDUINO_VID, productId: 0x0366 }],
    bootloaderName: "Giga",
    dfuseAddress: 0x08040000,
    touch1200: true,
    serialFilters: [{ usbVendorId: ARDUINO_VID, usbProductId: 0x0266 }],
    instructions: [
      "Connect the GIGA R1 over USB.",
      "Flash will reset it into the bootloader (or double-tap RESET: the green LED fades in and out).",
      "When asked, pick the \"GIGA\" DFU device.",
      "When the log says so, press RESET once to start the new firmware.",
    ],
  },

  // ---------------------------------------------------------------- UNO R4
  {
    id: "uno-r4-minima",
    name: "UNO-R4-MINIMA",
    family: "Arduino Renesas",
    protocol: "dfu",
    firmware: [{ url: release("Chords-UNO-R4-MINIMA.bin"), address: 0x0 }],
    accept: ".bin",
    usbFilters: [{ vendorId: ARDUINO_VID, productId: 0x0369 }],
    bootloaderName: "Santiago DFU",
    touch1200: true,
    serialFilters: [{ usbVendorId: ARDUINO_VID, usbProductId: 0x0069 }],
    instructions: [
      "Connect the UNO R4 Minima over USB and press Flash.",
      "First time only: pick the board's serial port, then press Continue and pick \"Santiago DFU\".",
      "After that, one click flashes it. The browser remembers the board.",
    ],
  },
  {
    id: "uno-r4-wifi",
    name: "UNO-R4-WIFI",
    family: "Arduino Renesas",
    protocol: "samba-r4",
    firmware: [{ url: release("Chords-UNO-R4-WIFI.bin"), address: 0x0 }],
    accept: ".bin",
    instructions: [
      "Connect the UNO R4 WiFi over USB.",
      "Pick its serial port. The USB bridge puts the RA4M1 into its bootloader automatically.",
    ],
  },

  // ---------------------------------------------------------------- RP2040
  {
    id: "rpi-pico-rp2040",
    name: "RPI-PICO-RP2040",
    family: "RP2040",
    protocol: "picoboot",
    firmware: [{ url: release("Chords-RPI-PICO-RP2040.uf2"), address: 0x10000000 }],
    accept: ".uf2,.bin",
    usbFilters: [{ vendorId: RPI_VID, productId: 0x0003 }],
    bootloaderName: "RP2 Boot",
    resetHint: "Unplug the Pico, then hold BOOTSEL while plugging it back in.",
    touch1200: true,
    serialFilters: [{ usbVendorId: RPI_VID }],
    instructions: [
      "Connect the Pico over USB and press Flash.",
      "First time only: pick the Pico's serial port, then press Continue and pick \"RP2 Boot\".",
      "New Pico or no sketch running? Hold BOOTSEL while plugging it in, then use \"Board is already in bootloader\".",
    ],
  },

  // ---------------------------------------------------------------- AVR
  {
    id: "avr-uno-r3",
    name: "AVR-UNO-R3",
    family: "AVR",
    protocol: "stk500v1",
    firmware: [{ url: release("Chords-UNO-R3.bin"), address: 0 }],
    accept: ".hex,.bin",
    // Clones with the old bootloader answer at 57600.
    baudRates: [115200, 57600],
    pageSize: 128,
    instructions: [...AVR_STEPS, "CH340 clones need the CH340 driver on Windows and older macOS."],
  },
  {
    id: "avr-genuino-uno",
    name: "AVR-GENUINO-UNO",
    family: "AVR",
    protocol: "stk500v1",
    firmware: [{ url: release("Chords-UNO-R3.bin"), address: 0 }],
    accept: ".hex,.bin",
    baudRates: [115200],
    pageSize: 128,
    instructions: AVR_STEPS,
  },
  {
    id: "avr-nano-classic",
    name: "AVR-NANO-CLASSIC",
    family: "AVR",
    protocol: "stk500v1",
    firmware: [{ url: release("Chords-NANO-CLASSIC.bin"), address: 0 }],
    accept: ".hex,.bin",
    // New Optiboot first, then the "Old Bootloader" (ATmegaBOOT) speed.
    baudRates: [115200, 57600],
    pageSize: 128,
    instructions: [...AVR_STEPS, "CH340 clones need the CH340 driver on Windows and older macOS."],
  },
  {
    id: "avr-mega-2560-r3",
    name: "AVR-MEGA-2560-R3",
    family: "AVR",
    protocol: "stk500v2",
    firmware: [{ url: release("Chords-MEGA-2560-R3.bin"), address: 0 }],
    accept: ".hex,.bin",
    baudRates: [115200],
    pageSize: 256,
    instructions: [...AVR_STEPS, "CH340 clones need the CH340 driver on Windows and older macOS."],
  },
];

export const PROTOCOL_LABEL: Record<DeviceDef["protocol"], string> = {
  esptool: "Web Serial · esptool",
  stk500v1: "Web Serial · STK500v1",
  stk500v2: "Web Serial · STK500v2",
  "samba-r4": "Web Serial · SAM-BA",
  dfu: "WebUSB · DFU",
  dfuse: "WebUSB · DfuSe",
  picoboot: "WebUSB · PICOBOOT",
};
