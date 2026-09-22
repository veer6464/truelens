'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide the navigation header completely on the login page
  if (pathname === '/login') {
    return null;
  }

  const handleSignOut = () => {
    document.cookie = 'truelens_auth=; path=/; max-age=0; SameSite=Lax';
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="border-b border-[#E2DDD5]/80 py-3.5 px-6 md:px-12 flex justify-between items-center bg-background/85 backdrop-blur-md sticky top-0 z-50 transition-all">
      <div className="flex items-center space-x-3">
        {/* Precision Optical Lens Mark */}
        <a href="/" className="flex items-center space-x-2.5 group">
          <div className="w-7 h-7 rounded-sm bg-[#1A1A1A] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
            </svg>
          </div>
          <span className="font-serif font-black text-xl tracking-tight text-[#1A1A1A]">
            TrueLens
          </span>
        </a>
        <span className="text-[9px] uppercase tracking-widest bg-[#1A1A1A] text-white px-2 py-0.5 font-mono font-bold rounded-xs shadow-xs">
          AI
        </span>
        {/* Live Engine Status Badge */}
        <div className="hidden sm:flex items-center space-x-1.5 pl-3 border-l border-border/80 text-[10px] font-mono text-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-foreground/80">Engines Online</span>
        </div>
      </div>

      <nav className="flex items-center space-x-5 text-xs font-mono">
        <a
          href="/"
          className={`tracking-wider py-1 transition ${
            pathname === '/'
              ? 'text-foreground font-bold border-b-2 border-[#1A1A1A]'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Scanner
        </a>
        <a
          href="/admin"
          className={`transition flex items-center space-x-1.5 py-1 ${
            pathname === '/admin'
              ? 'text-foreground font-bold border-b-2 border-[#1A1A1A]'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <span>Console</span>
          <span className="text-[8px] bg-border/80 px-1.5 py-0.5 rounded-xs font-mono font-medium uppercase tracking-wider text-muted">
            Admin
          </span>
        </a>
        <button
          onClick={handleSignOut}
          className="text-muted hover:text-rose-600 border border-border/80 hover:border-rose-300 px-2.5 py-1 rounded-xs transition duration-150 flex items-center space-x-1.5 cursor-pointer font-medium"
          title="Sign Out"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Sign Out</span>
        </button>
      </nav>
    </header>
  );
}
