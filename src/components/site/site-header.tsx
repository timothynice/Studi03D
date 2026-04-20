"use client";

import Image from "next/image";
import Link from "next/link";

import { useStudioUiStore } from "@/lib/ui/store";

function BrandLockup() {
  const theme = useStudioUiStore((state) => state.theme);
  const markSrc = theme === "dark" ? "/studi0/logo-mark-on-dark.svg" : "/studi0/logo-mark.svg";

  return (
    <span className="brand-lockup">
      <Image alt="" className="brand-mark" height={28} src={markSrc} unoptimized width={28} />
      <span className="brand-copy">
        <span className="brand-name">Studi03D</span>
        <span className="brand-meta">SVG trail studio</span>
      </span>
    </span>
  );
}

export function SiteHeader({
  active,
  actions,
}: Readonly<{
  active: "home" | "studio";
  actions?: React.ReactNode;
}>) {
  const theme = useStudioUiStore((state) => state.theme);
  const toggleTheme = useStudioUiStore((state) => state.toggleTheme);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand-link" href="/">
          <BrandLockup />
        </Link>

        <nav aria-label="Primary" className="site-nav">
          <Link className={`site-nav-link ${active === "home" ? "is-active" : ""}`} href="/">
            Product
          </Link>
          <Link className={`site-nav-link ${active === "studio" ? "is-active" : ""}`} href="/studio">
            Studio
          </Link>
        </nav>

        <div className="site-header-actions">
          {actions}
          <button className="ui-button ui-button-ghost" type="button" onClick={toggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </div>
    </header>
  );
}
