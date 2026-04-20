import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono, Michroma, Space_Grotesk } from "next/font/google";

import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const michroma = Michroma({
  subsets: ["latin"],
  variable: "--font-michroma",
  weight: "400",
});

const nos = localFont({
  display: "swap",
  src: "../assets/fonts/NOS.otf",
  variable: "--font-nos",
});

const themeInitializer = `
  (() => {
    try {
      const raw = localStorage.getItem("studi03d-ui-store");
      const parsed = raw ? JSON.parse(raw) : null;
      const theme = parsed?.state?.theme === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export const metadata: Metadata = {
  title: {
    default: "Studi03D",
    template: "%s | Studi03D",
  },
  description:
    "A quieter workspace for importing SVG icons, projecting them into faux-isometric stacks, and exporting transparent SVG or PNG trails.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      data-theme="dark"
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} ${michroma.variable} ${nos.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
