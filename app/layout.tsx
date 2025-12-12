import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Script from "next/script";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Script Bot",
  description: "Script Bot is a tool to help you with your scripts.", 
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const lang = cookieStore.get('app-language')?.value;
  const initialLang = (lang === 'de' || lang === 'en') ? lang : 'en';

  return (
    <html lang={initialLang} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css" />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <LanguageProvider initialLang={initialLang}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
