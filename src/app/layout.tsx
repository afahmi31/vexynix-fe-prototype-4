"use client";

// Global CSS — FontAwesome + Bootstrap Icons (needed by all route groups)
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fortawesome/fontawesome-free/css/all.css";

// Portal CSS — base Bootstrap + portal theme (player + public pages)
import "@/styles/portal.scss";

import { useEffect } from "react";
import { Providers } from "@/app/providers";
import { ThemeApplier } from "@/components/portal/ThemeApplier";
import TemplateSwitcher from "@/components/portal/TemplateSwitcher";
import { Open_Sans, Orbitron, Playfair_Display } from "next/font/google";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
});

// Display faces used by the optional visual templates (see lib/lobby-templates).
// preload:false — only the template that is actually active pulls the file down.
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  preload: false,
  variable: "--font-orbitron",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  preload: false,
  variable: "--font-playfair",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    let isMounted = true;

    const loadBootstrap = async () => {
      try {
        const bootstrap = await import("bootstrap");
        if (isMounted) {
          window.bootstrap = bootstrap;
        }
      } catch (error) {
        console.error("Error loading Bootstrap:", error);
      }
    };

    if (typeof window !== "undefined") {
      loadBootstrap();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <html
      lang="en"
      className={`${openSans.className} ${orbitron.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        <title>Game Portal</title>
      </head>
      <body>
        <Providers>
          <ThemeApplier />
          {children}
          <TemplateSwitcher />
        </Providers>
      </body>
    </html>
  );
}
