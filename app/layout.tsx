import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./contexts/ThemeContext";

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
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      {/* suppressHydrationWarning: silences warnings caused by browser extensions
          (e.g. Grammarly) that inject extra attributes onto <body> after React renders,
          and also suppresses the dark/light class mismatch during client hydration */}
      <body className={`${inter.className} h-full`} suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
