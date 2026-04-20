import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/components/site/site-header";

const FEATURE_CARDS = [
  {
    eyebrow: "Import",
    title: "Bring in clean SVGs.",
    body: "Paste markup or drop a file, then normalize single-color line or flat-fill icons without leaving the studio.",
  },
  {
    eyebrow: "Project",
    title: "Push them into space.",
    body: "Faux-isometric controls reshape the full SVG group into the quieter stacked perspective that the reference imagery needs.",
  },
  {
    eyebrow: "Trail",
    title: "Build the stack rhythm.",
    body: "Start with clean defaults, then open advanced trail controls only when you need custom gaps, opacity shifts, or denser matte slots.",
  },
  {
    eyebrow: "Export",
    title: "Ship transparent assets.",
    body: "Preview against any background, but export transparent SVG and PNG output for icons, illustrations, and systems work.",
  },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <SiteHeader
        active="home"
        actions={
          <Link className="ui-button ui-button-key" href="/studio">
            Open studio
          </Link>
        }
      />

      <section className="landing-shell">
        <div className="landing-hero">
          <div className="landing-copy">
            <p className="eyebrow">Studi0 system · adapted for Studi03D</p>
            <div className="hero-wordmark">
              <Image
                alt="Studi0 wordmark"
                className="hero-wordmark-image"
                height={20}
                src="/studi0/logo-wordmark.svg"
                unoptimized
                width={240}
              />
            </div>
            <h1 className="landing-title">A quieter workspace for building isometric SVG trails.</h1>
            <p className="landing-lede">
              Studi03D turns simple line illustrations and flat icons into layered isometric stacks
              with restrained chrome, cleaner defaults, and exports that stay transparent.
            </p>
            <div className="landing-actions">
              <Link className="ui-button ui-button-key" href="/studio">
                Enter studio
              </Link>
              <a className="ui-button ui-button-secondary" href="#features">
                See what changed
              </a>
            </div>
            <div className="hero-meta-row">
              <div className="hero-meta-card">
                <span className="eyebrow">Focus</span>
                <p>Single-color SVG tooling for icons, line art, and lightweight illustration systems.</p>
              </div>
              <div className="hero-meta-card">
                <span className="eyebrow">Now</span>
                <p>Import, project, trail, recolor, save drafts, and export without extra product noise.</p>
              </div>
            </div>
          </div>

          <div className="hero-media-card">
            <div className="hero-media-frame">
              <Image
                alt="Isometric monochrome machinery illustration"
                className="hero-media-image"
                height={1200}
                priority
                src="/studi0/illustration-machines.png"
                sizes="(min-width: 880px) 40vw, 100vw"
                width={1600}
              />
            </div>
            <div className="hero-caption">
              <span className="accent-tick" />
              <p>Built around restrained line-work, cool neutrals, and one precise accent.</p>
            </div>
          </div>
        </div>

        <section className="landing-section" id="features">
          <div className="section-head">
            <p className="eyebrow">Capabilities</p>
            <h2 className="section-title">The product stays focused. The controls get out of the way.</h2>
          </div>
          <div className="feature-grid">
            {FEATURE_CARDS.map((card) => (
              <article key={card.title} className="surface-card">
                <p className="eyebrow">{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="story-grid">
            <article className="surface-card surface-card-emphasis">
              <p className="eyebrow">Interface</p>
              <h3>Landing and studio now belong to the same system.</h3>
              <p>
                The product front door becomes typographic and brand-led, while the editor shifts to a
                darker, calmer shell with a fixed glass nav, a collapsible library rail, and a quieter
                settings surface.
              </p>
            </article>
            <article className="surface-card">
              <p className="eyebrow">Why it matters</p>
              <h3>More room for the artwork.</h3>
              <p>
                The preview stage now dominates the studio, and advanced controls stay tucked away until
                you explicitly open them. The result is closer to the reference posture and easier to tune.
              </p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
