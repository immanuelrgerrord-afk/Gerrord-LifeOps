import type { jsPDF } from "jspdf";

const FONT_FILE = "NotoSans-Regular.ttf";
const FONT_NAME = "NotoSans";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

let fontReady: Promise<void> | null = null;

export function setupPdfFont(doc: jsPDF): Promise<void> {
  if (!fontReady) {
    fontReady = fetch("/fonts/NotoSans-Regular.ttf")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load PDF font");
        return res.arrayBuffer();
      })
      .then((buf) => {
        const base64 = arrayBufferToBase64(buf);
        doc.addFileToVFS(FONT_FILE, base64);
        doc.addFont(FONT_FILE, FONT_NAME, "normal");
        doc.addFont(FONT_FILE, FONT_NAME, "bold");
      });
  }
  return fontReady.then(() => {
    doc.setFont(FONT_NAME, "normal");
  });
}

export const PDF_FONT = FONT_NAME;
