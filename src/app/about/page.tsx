import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="studio-shell min-h-screen px-4 py-6 text-slate-100 lg:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="studio-panel space-y-6 px-6 py-6 lg:px-8">
          <div className="space-y-3">
            <p className="studio-label">About</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Studi03D SVG Isometric Trail Studio
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
              Import simple line or flat-fill SVG icons, project them into a faux-isometric angle,
              duplicate them into rhythmic trails, and export transparent SVG or PNG assets for
              illustration systems, icons, and graphic explorations.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="studio-section space-y-3 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/84">
                Current focus
              </h2>
              <p className="text-sm leading-7 text-slate-300">
                The editor is tuned for single-color stroked or flat-filled SVGs, fast trail exploration,
                local draft saving, and transparent export.
              </p>
            </section>
            <section className="studio-section space-y-3 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/84">
                Next directions
              </h2>
              <p className="text-sm leading-7 text-slate-300">
                Prompt-based generation, richer per-trail styling, and more precise composition controls
                can land after the core studio feels visually right.
              </p>
            </section>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="studio-button studio-button-primary" href="/">
              Open studio
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
