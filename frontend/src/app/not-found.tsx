import Link from 'next/link';

const noiseSvg =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.45'/%3E%3C/svg%3E\")";

export default function NotFound() {
  return (
    <main className="relative min-h-[calc(100vh-56px)] overflow-hidden bg-[#02040b] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_10%_15%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(900px_700px_at_85%_20%,rgba(139,92,246,0.14),transparent_60%),radial-gradient(800px_600px_at_75%_90%,rgba(14,165,233,0.12),transparent_60%)]" />
        <div className="absolute -top-56 right-[-180px] h-[520px] w-[520px] rounded-full bg-cyan-400/15 blur-[160px]" />
        <div className="absolute -bottom-56 left-[-160px] h-[520px] w-[520px] rounded-full bg-indigo-500/15 blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-soft-light"
          style={{ backgroundImage: noiseSvg }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-56px)] max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/15 bg-white/5 p-8 backdrop-blur-2xl shadow-[0_40px_120px_rgba(2,6,23,0.7)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs uppercase tracking-[0.4em] text-white/60">Not Found</div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70">
              404
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">
            This route does not exist.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            The page you requested might have been moved, renamed, or it was never published.
            If this was a live preview link, the session may have expired.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-white/55">Try this</div>
              <p className="mt-2 text-sm text-white/70">
                Return to the dashboard to generate new code and refresh your preview.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-white/55">Need help</div>
              <p className="mt-2 text-sm text-white/70">
                Check that your URL is correct or open the editor and rebuild the page.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/20"
            >
              Back Home
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85 transition hover:bg-white/5"
            >
              Open Editor
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
