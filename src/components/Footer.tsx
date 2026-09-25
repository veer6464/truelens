'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();

  // Hide the footer on the login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <footer className="border-t border-border py-5 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center text-xs font-mono text-muted mt-auto bg-white/40">
      <div className="flex items-center space-x-2">
        <span>&copy; {new Date().getFullYear()} TrueLens Inc.</span>
        <span>•</span>
        <span className="text-foreground/70">Pluggable Multimodal Forensics</span>
      </div>
      <div className="flex items-center space-x-4 mt-2 md:mt-0 text-[11px]">
        <span className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
          <span>Latency ~280ms</span>
        </span>
        <span>•</span>
        <a href="/admin" className="hover:text-foreground hover:underline transition">
          Engine Orchestrator
        </a>
      </div>
    </footer>
  );
}
