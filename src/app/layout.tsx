import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Inter } from "next/font/google";
import { authOptions } from "../lib/auth/options";
import "../styles/globals.css";
import { Providers } from "../components/Providers";
import { GlobalThemeToggle } from "../components/layout/GlobalThemeToggle";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ENVER CRM",
  description: "CRM/ERP-система для меблевого та сервісного бізнесу",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const themeBootScript = `
    (function () {
      try {
        var key = "enver-crm-theme";
        var saved = window.localStorage.getItem(key);
        var theme = saved === "dark" || saved === "light" ? saved : "light";
        var root = document.documentElement;
        root.setAttribute("data-theme", theme);
        root.style.colorScheme = theme;
      } catch (_) {
        var fallbackRoot = document.documentElement;
        fallbackRoot.setAttribute("data-theme", "light");
        fallbackRoot.style.colorScheme = "light";
      }
    })();
  `;

  return (
    <html
      lang="uk"
      data-theme="light"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <GlobalThemeToggle />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
