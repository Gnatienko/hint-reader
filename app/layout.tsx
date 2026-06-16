import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hint reader",
  description:
    "A web app for reading foreign-language texts with per-word translation hints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
