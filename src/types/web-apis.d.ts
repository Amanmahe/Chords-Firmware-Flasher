// Web Serial + WebUSB types come from:
//   npm i -D @types/w3c-web-serial @types/w3c-web-usb
/// <reference types="w3c-web-serial" />
/// <reference types="w3c-web-usb" />

// File System Access API (not yet in lib.dom for every TS version)
interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string;
  }): Promise<FileSystemDirectoryHandle>;
}
