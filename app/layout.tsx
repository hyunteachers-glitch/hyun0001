import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hyun0001",
  description: "Private Webtoon Archive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-white">
        <Link
          href="/"
          className="fixed left-8 top-8 z-50 block opacity-90 hover:opacity-100 transition"
        >
          <Image
            src="/logo-horizontal.png"
            alt="hyun0001"
            width={190}
            height={60}
            priority
          />
        </Link>

        {children}
      </body>
    </html>
  );
}