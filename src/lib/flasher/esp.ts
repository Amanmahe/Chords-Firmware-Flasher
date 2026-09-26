import type { FlashJob } from "./types";
import { pickSerialPort } from "./serial";

export async function flashEsp({ device, parts, options, cb }: FlashJob) {
  // esptool-js touches `window`, so load it only in the browser.
  const { ESPLoader, Transport } = await import("esptool-js");

  const port = await pickSerialPort();
  const transport = new Transport(port, false);

  const loader = new ESPLoader({
    transport,
    baudrate: device.espBaud ?? 921600,
    romBaudrate: 115200,
    terminal: {
      clean: () => {},
      writeLine: (s) => cb.log(s),
      write: (s) => {
        const t = s.trim();
        if (t) cb.log(t);
      },
    },
  });

  try {
    cb.log("Connecting to ESP bootloader…");
    const chip = await loader.main();
    cb.log(`Detected ${chip}`);

    const total = parts.reduce((a, p) => a + p.data.length, 0);
    const done: number[] = parts.map(() => 0);

    await loader.writeFlash({
      fileArray: parts.map((p) => ({ data: p.data, address: p.address })),
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: options.eraseAll,
      compress: true,
      reportProgress: (i, written, size) => {
        done[i] = (written / size) * parts[i].data.length;
        const pct = (done.reduce((a, v) => a + v, 0) / total) * 100;
        cb.progress(pct, `Writing ${parts[i].name}`);
      },
    });

    cb.log("Resetting board…");
    await loader.after("hard_reset");
  } finally {
    await transport.disconnect().catch(() => {});
  }
}
