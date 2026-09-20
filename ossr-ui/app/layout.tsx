import type { Metadata } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'OSSR — Open Stacks Sponsor Relay',
  description: 'The open protocol for sponsored Stacks transactions. Move sBTC without holding STX.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
