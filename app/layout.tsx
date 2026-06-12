import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "KickTok — a vertical feed for Kick clips",
  description:
    "An open-source vertical clip feed for Kick.com. Scroll through the best moments from Kick streamers.",
};

export const viewport: Viewport = {
  themeColor: "#060805",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="no-scrollbar">
      <body
        className={`${bricolage.variable} ${archivo.variable} ${plexMono.variable} grain antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
