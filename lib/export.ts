import type { Page } from "./types";
import { renderPageImage } from "./render";

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportPagePng(page: Page, index: number) {
  const canvas = renderPageImage(page, 2);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const slug = page.title ? "_" + page.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() : "";
    download(url, `quadro_pagina-${index + 1}${slug}_${stamp()}.png`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

export async function exportPdf(pages: Page[]) {
  const { jsPDF } = await import("jspdf");
  // A4 landscape, each page fitted with margins
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 10;
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage("a4", "landscape");
    const canvas = renderPageImage(page, 2);
    const top = page.title ? 20 : M;
    if (page.title) {
      pdf.setFontSize(14);
      pdf.setTextColor(43, 47, 58);
      pdf.text(page.title, M, 13);
      pdf.setDrawColor(214, 51, 132);
      pdf.setLineWidth(0.6);
      pdf.line(M, 15.5, M + 24, 15.5);
    }
    const k = Math.min((W - 2 * M) / canvas.width, (H - top - M) / canvas.height);
    const w = canvas.width * k, h = canvas.height * k;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (W - w) / 2, top + (H - top - M - h) / 2, w, h);
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text(`${i + 1} / ${pages.length}`, W - M, H - 4, { align: "right" });
  });
  pdf.save(`quadro_${stamp()}.pdf`);
}

export function exportJson(pages: Page[], current: number) {
  const blob = new Blob([JSON.stringify({ version: 1, pages, current, savedAt: new Date().toISOString() })], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, `quadro_${stamp()}.quadro.json`);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
