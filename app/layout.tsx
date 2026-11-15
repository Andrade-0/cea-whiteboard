import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const math = Inter({ subsets: ["latin", "greek"], variable: "--font-math", display: "swap" });
const ui = Space_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const DESCRIPTION =
  "Quadro digital para resolver matrizes: escrita fluida com o rato, escalonamento passo a passo, determinantes (Sarrus e Laplace), matriz inversa por Gauss-Jordan, verificação com frações exatas e partilha ao vivo por link. Grátis, direto no browser.";

export const metadata: Metadata = {
  title: "Quadro CEA · Quadro digital para matrizes",
  description: DESCRIPTION,
  applicationName: "Quadro CEA",
  keywords: ["quadro digital", "matrizes", "determinantes", "matriz inversa", "Gauss-Jordan", "Sarrus", "Laplace", "escalonamento", "sistemas de equações", "álgebra linear", "ISAF", "CEA"],
  authors: [{ name: "CEA · Coordenação de Excelência Académica" }],
  openGraph: {
    type: "website",
    locale: "pt_PT",
    siteName: "Quadro CEA",
    title: "Quadro CEA · Quadro digital para matrizes",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Quadro CEA · Quadro digital para matrizes",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#D63384",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${math.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
