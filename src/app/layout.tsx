import './globals.css';
import { Metadata } from 'next';
import RootLayoutClient from './RootLayoutClient';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'WALLCRAFT Admin',
  description: 'ระบบจัดการและแดชบอร์ด WALLCRAFT',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  openGraph: {
    title: 'WALLCRAFT Admin',
    description: 'ระบบจัดการและแดชบอร์ด WALLCRAFT',
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'WALLCRAFT Admin Logo',
      }
    ]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="antialiased selection:bg-blue-100 selection:text-blue-700 m-0 p-0 bg-[#F8FAFC]">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}