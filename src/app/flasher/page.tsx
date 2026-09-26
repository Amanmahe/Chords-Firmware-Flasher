import type { Metadata } from "next";
import Flasher from "@/components/flasher/Flasher";

export const metadata: Metadata = {
  title: "Web Firmware Flasher",
  description: "Flash ESP32, STM32, Arduino and RP2040 boards from the browser.",
};

export default function FlasherPage() {
  return <Flasher />;
}
