import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Coder Pay - 个人开发者的自动收款平台',
  description: '面向个人开发者的资金直达收款、Android 到账监听与签名回调工具。',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '256x256' }
    ],
    apple: [{ url: '/icon.png', type: 'image/png', sizes: '256x256' }]
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
