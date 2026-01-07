import type { Metadata } from 'next';

import '@/styles/globals.css';
import '@/styles/theme.css';

import { BrandFooter } from '@/components/BrandFooter';
import { StyledComponentsRegistry } from '@/components/StyledComponentsRegistry';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexusapex.ai';

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
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#0B0F14] text-white antialiased">
        <div className="min-h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
          </div>
          <BrandFooter />
        </div>
      </body>
    </html>
  );
}
