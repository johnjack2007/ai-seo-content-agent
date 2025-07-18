import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI SEO Content Agent',
  description: 'Production-grade AI-powered SEO content generation and management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
} 