import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
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
      className={`${playfair.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {/* Navigation */}
        <header className="border-b border-border py-4 px-6 md:px-12 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <span className="font-serif font-black text-xl tracking-tight">TrueLens</span>
            <span className="text-[10px] uppercase tracking-widest bg-foreground text-background px-2 py-0.5 font-mono font-medium rounded-sm">
              AI
            </span>
          </div>
          <nav className="flex items-center space-x-6 text-sm font-mono">
            <a 
              href="/" 
              className="hover:underline transition duration-150 decoration-ai underline-offset-4"
            >
              Scanner
            </a>
            <a 
              href="/admin" 
              className="text-muted hover:text-foreground transition duration-150 flex items-center space-x-1"
            >
              <span>Console</span>
              <span className="text-[8px] bg-border px-1 py-0.2 rounded font-mono font-normal">Admin</span>
            </a>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center text-xs font-mono text-muted mt-auto">
          <div>
            &copy; {new Date().getFullYear()} TrueLens. Pluggable Detection System.
          </div>
          <div className="flex space-x-4 mt-2 md:mt-0">
            <span>Server Status: Online</span>
            <span>•</span>
            <a href="/admin" className="hover:underline">Manage Engines</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
