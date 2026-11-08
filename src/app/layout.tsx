import React from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { ModeProvider } from '@/context/mode-context';
import { LocationProvider } from '@/context/location-context';
import { LocationPermissionModal } from '@/components/location/location-permission-modal';

export const metadata = {
  title: 'AyudaPE · Plataforma Hiperlocal de Resiliencia y Solidaridad',
  description:
    'Plataforma hiperlocal Offline-First de oficios de proximidad, cadena de favores sin dinero y respuesta humanitaria ante emergencias.',
  manifest: '/manifest.json',
  icons: {
    icon: '/AyudaPE.svg',
    shortcut: '/AyudaPE.svg',
    apple: '/AyudaPE.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

const SW_REGISTRATION_SCRIPT = `
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTRATION_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <ModeProvider>
          <LocationProvider>
            <LocationPermissionModal />
            {children}
            <Toaster
              position="bottom-center"
              richColors
              closeButton
              swipeDirections={['left', 'right', 'bottom']}
              gap={8}
              duration={4000}
              toastOptions={{
                className: 'text-sm sm:text-base font-bold rounded-2xl border-2 shadow-card-elevated',
                duration: 4000,
              }}
            />
          </LocationProvider>
        </ModeProvider>
      </body>
    </html>
  );
}
