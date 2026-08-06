import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://lumaloop.studio"),
  title: { default: "LumaLoop — Motion showcases in your browser", template: "%s" },
  description: "Turn local images and videos into polished, seamless motion loops without leaving your browser.",
  applicationName: "LumaLoop",
  keywords: ["motion design", "showcase", "video editor", "browser video", "animation templates"],
  openGraph: { title: "LumaLoop — Make the scroll stop", description: "Motion showcases, made in your browser.", type: "website", images: [{ url: "/og.png", width: 1731, height: 909, alt: "LumaLoop browser motion editor" }] },
  twitter: { card: "summary_large_image", title: "LumaLoop", description: "Turn static work into motion people notice.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
