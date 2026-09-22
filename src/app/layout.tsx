import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TrueLens — AI Content Detection & Attribution',
  description: 'An editorial-grade pluggable text and image AI-generation detection suite.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${playfair.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-[#EDE4D3]">
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
