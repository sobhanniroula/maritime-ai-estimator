import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Maritime AI Estimator",
  description:
    "AI-powered floating infrastructure cost estimator. Click a coastal location to get instant product recommendations and budget estimates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      {/* suppressHydrationWarning: silences warnings caused by browser extensions
          (e.g. Grammarly) that inject extra attributes onto <body> after React renders */}
      <body className={`${inter.className} h-full`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
