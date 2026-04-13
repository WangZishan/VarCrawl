import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskMutation — search PubMed by mutation",
  description:
    "Paste a mutation in any HGVS notation and find every PubMed article that mentions it under any common name.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
