import './globals.css';
import type { Metadata } from 'next';
import MuiThemeProvider from './providers/mui-theme-provider';

export const metadata: Metadata = {
  title: 'Node Tree Editor',
  description: 'Next.js + MUI + Tailwind',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir='rtl'>
      <body>
        <MuiThemeProvider>{children}</MuiThemeProvider>
      </body>
    </html>
  );
}
