import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="bg-paper text-ink">
      {/* HERO */}
      <section className="relative min-h-[calc(100vh-64px)] overflow-hidden">
        {/* Hero Image */}
        <img
          src="/images/pickleball-hero.jpg"
          alt="Pickleball court"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Dark / green overlay */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl items-center px-6 py-20 sm:px-8 lg:px-12">
          <div className="max-w-3xl text-white">
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-court" />
              <span className="text-xs font-semibold tracking-[0.2em]">
                PLAY. BOOK. ENJOY.
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              YOUR COURT.
              <br />
              <span className="text-court">YOUR TIME.</span>
              <br />
              YOUR GAME.
            </h1>

            {/* Description */}
            <p className="mt-7 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
              Reserve your pickleball court quickly and easily.
              Choose your court, pick your schedule, and get ready to play.
            </p>

            {/* CTA */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/booking"
                className="btn-court inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-semibold shadow-lg"
              >
                Book a Court
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                to="/find-booking"
                className="inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Find My Booking
              </Link>
            </div>

            {/* Trust / Quick Info */}
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-court" />
                Easy online booking
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-court" />
                Flexible schedules
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-court" />
                Secure your slot
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/60 sm:flex">
          <span className="text-[10px] font-semibold tracking-[0.25em]">
            SCROLL TO EXPLORE
          </span>

          <span className="h-8 w-px bg-white/40" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-court">
              HOW IT WORKS
            </p>

            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              From booking to playing in minutes.
            </h2>

            <p className="mt-4 text-sm leading-6 text-muted sm:text-base">
              No complicated process. Pick your court, choose your time,
              and confirm your reservation.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Step 1 */}
            <div className="group rounded-2xl border border-line bg-paper p-7 transition hover:-translate-y-1 hover:border-court">
              <span className="font-display text-5xl font-semibold text-court/30 transition group-hover:text-court">
                01
              </span>

              <h3 className="mt-6 font-display text-xl font-semibold text-ink">
                Choose your court
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted">
                Select from the available courts and find the one that
                fits your game.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group rounded-2xl border border-line bg-paper p-7 transition hover:-translate-y-1 hover:border-court">
              <span className="font-display text-5xl font-semibold text-court/30 transition group-hover:text-court">
                02
              </span>

              <h3 className="mt-6 font-display text-xl font-semibold text-ink">
                Pick your time
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted">
                Choose your preferred date and available time slot.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group rounded-2xl border border-line bg-paper p-7 transition hover:-translate-y-1 hover:border-court">
              <span className="font-display text-5xl font-semibold text-court/30 transition group-hover:text-court">
                03
              </span>

              <h3 className="mt-6 font-display text-xl font-semibold text-ink">
                Confirm and play
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted">
                Enter your details, confirm your booking, and get ready
                for your game.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-line bg-paper">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-court/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-court/5 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-court">
            READY TO PLAY?
          </p>

          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Grab a court.
            <br />
            Start the game.
          </h2>

          <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-muted sm:text-base">
            Your next pickleball game is just a few clicks away.
          </p>

          <Link
            to="/booking"
            className="btn-court mt-9 inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold"
          >
            Book a Court
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              PickleReserve
            </p>

            <p className="mt-1 text-xs text-muted">
              Your court. Your time. Your game.
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs text-muted">
            <Link
              to="/booking"
              className="transition hover:text-court"
            >
              Book a Court
            </Link>

            <Link
              to="/find-booking"
              className="transition hover:text-court"
            >
              Find Booking
            </Link>
          </div>

          <p className="text-xs text-muted">
            © 2026 PickleReserve · Website by Gryed
          </p>
        </div>
      </footer>
    </main>
  )
}