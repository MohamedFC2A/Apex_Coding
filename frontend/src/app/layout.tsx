import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import '@/styles/globals.css';
import '@/styles/theme.css';
import './globals.css';

import { BrandFooter } from '@/components/BrandFooter';
import { StyledComponentsRegistry } from '@/components/StyledComponentsRegistry';
import { Providers } from '@/app/providers';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexusapex.ai';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap'
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Nexus Apex — Code at the Speed of Thought',
    template: '%s | Nexus Apex'
  },
  description: 'The first graph-based AI IDE that understands your project structure, not just your files.',
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Nexus Apex — Code at the Speed of Thought',
    description: 'The first graph-based AI IDE that understands your project structure, not just your files.',
    siteName: 'Nexus Apex'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Apex — Code at the Speed of Thought',
    description: 'The first graph-based AI IDE that understands your project structure, not just your files.'
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' }
    ]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress 404 errors for missing static files in production
              if (typeof window !== 'undefined') {
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args[0]?.toString() || '';
                  if (
                    message.includes('404') ||
                    message.includes('NOT_FOUND') ||
                    message.includes('Failed to load resource') ||
                    message.includes('dxb1::')
                  ) {
                    // Silently ignore 404 errors for missing static files
                    return;
                  }
                  originalError.apply(console, args);
                };
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-black text-white antialiased`} suppressHydrationWarning>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1 min-h-0">
            <StyledComponentsRegistry>
              <Providers>{children}</Providers>
            </StyledComponentsRegistry>
          </div>
        </div>
      </body>
    </html>
  );
}
