import { Link } from 'react-router-dom';
import {
  Mail,
  Smartphone,
  Tablet,
  Watch,
  Headphones,
  ShieldCheck,
  Truck,
  Boxes,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const EMAIL = 'primetradingex@gmail.com';

/** What we actually move. Kept concrete — buyers scan for their category first. */
const CATEGORIES = [
  {
    icon: Smartphone,
    title: 'Smartphones',
    body: 'iPhone and Android in volume — unlocked and carrier stock, current and previous generations.',
  },
  {
    icon: Tablet,
    title: 'Tablets',
    body: 'iPad and Android tablets, Wi-Fi and cellular, across storage tiers.',
  },
  {
    icon: Watch,
    title: 'Wearables',
    body: 'Apple Watch, Pixel Watch and similar — cellular and GPS models.',
  },
  {
    icon: Headphones,
    title: 'Accessories',
    body: 'Audio, charging and everyday consumer electronics accessories.',
  },
];

/**
 * Grades are the first thing a wholesale buyer asks about. Naming them plainly does
 * more for credibility than any amount of marketing copy.
 */
const GRADES = [
  { grade: 'New / Sealed', body: 'Factory sealed, untouched retail packaging.' },
  { grade: 'CPO', body: 'Certified pre-owned — refurbished and re-certified stock.' },
  { grade: 'Grade A', body: 'Fully tested and functional, minimal to no visible wear.' },
  { grade: 'Grade B / C', body: 'Fully functional with cosmetic wear, graded and disclosed honestly.' },
];

const PROMISES = [
  {
    icon: ShieldCheck,
    title: 'Graded honestly',
    body: 'Every unit is tested and graded before it ships. What is on the list is what lands on your dock — no surprise downgrades.',
  },
  {
    icon: Boxes,
    title: 'Real volume',
    body: 'Lists move in hundreds and thousands of units. If we quote it, we have it or we can source it.',
  },
  {
    icon: Truck,
    title: 'Ships when we say',
    body: 'Fulfillment on the timeline we quoted, with tracking. Dates we commit to are dates we hit.',
  },
];

const STEPS = [
  { n: '01', title: 'Tell us what you need', body: 'Models, grades, quantities and destination.' },
  { n: '02', title: 'We quote from live stock', body: 'Current availability and pricing, not a stale sheet.' },
  { n: '03', title: 'Lock it and it ships', body: 'Confirm the lot, we invoice, it moves with tracking.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      {/* ---------------------------------------------------------------- hero */}
      <header className="bg-gradient-to-b from-brand-900 to-[#10375f] text-white">
        <nav className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="font-bold tracking-[0.2em] text-base sm:text-lg">
            PRIME TRADE EXCHANGE
          </span>
          <div className="flex items-center gap-6 text-sm">
            <a href="#stock" className="hidden sm:inline text-white/70 hover:text-white transition-colors">
              What we stock
            </a>
            <a href="#grades" className="hidden sm:inline text-white/70 hover:text-white transition-colors">
              Grading
            </a>
            <a href={`mailto:${EMAIL}`} className="text-white/70 hover:text-white transition-colors">
              Contact
            </a>
            {/* Deliberately low-contrast: this is a staff door, not a call to action. */}
            <Link
              to="/login"
              className="text-white/40 hover:text-white/80 transition-colors"
              title="Staff dashboard"
            >
              Dashboard
            </Link>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <p className="text-brand-300 font-semibold tracking-[0.18em] text-xs sm:text-sm uppercase">
            Electronics &amp; Phone Wholesale
          </p>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.06]">
            Phones and electronics,
            <br />
            <span className="text-brand-400">wholesale. Done right.</span>
          </h1>
          <p className="mt-7 max-w-2xl mx-auto text-lg text-slate-300 leading-relaxed">
            We move smartphones, tablets, wearables and accessories in volume — graded
            accurately, priced fairly, and shipped on the date we quoted.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`mailto:${EMAIL}?subject=Wholesale%20enquiry`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold tracking-wide transition-colors"
            >
              Request current stock list <ArrowRight size={18} />
            </a>
            <a
              href="#stock"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg border border-white/20 hover:border-white/50 text-white font-semibold transition-colors"
            >
              See what we carry
            </a>
          </div>
        </div>

        <div className="bg-[#081a30] border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-y-4 text-center">
            {[
              ['Phones & Electronics', 'Core categories'],
              ['New · CPO · A/B/C', 'Graded stock'],
              ['Bulk quantities', 'Volume ready'],
              ['Tracked shipping', 'Every order'],
            ].map(([big, small]) => (
              <div key={big}>
                <div className="text-sm sm:text-base font-semibold text-white">{big}</div>
                <div className="text-xs text-white/50 mt-0.5">{small}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- stock */}
      <section id="stock" className="bg-surface-0 scroll-mt-8">
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-900 text-center">
            What we stock
          </h2>
          <p className="mt-4 text-center text-slate-600 max-w-2xl mx-auto">
            Consumer electronics moving in wholesale quantities. Availability changes daily —
            ask for the current list.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-surface-0 border border-surface-200 rounded-[0.75rem] shadow-card hover:shadow-card-hover transition-shadow p-6"
              >
                <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-brand-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- grades */}
      <section id="grades" className="bg-surface-50 border-y border-surface-200 scroll-mt-8">
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-900">
                Grading you can quote against
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                Every lot is tested and graded before it leaves us, and the grade on the
                invoice is the grade in the box. If a unit does not meet the grade, we make it
                right — that is the whole business.
              </p>
              <a
                href={`mailto:${EMAIL}?subject=Grading%20question`}
                className="mt-7 inline-flex items-center gap-2 text-brand-700 font-semibold hover:text-brand-500 transition-colors"
              >
                Questions on grading <ArrowRight size={16} />
              </a>
            </div>

            <div className="space-y-3">
              {GRADES.map(({ grade, body }) => (
                <div
                  key={grade}
                  className="bg-surface-0 border border-surface-200 rounded-[0.75rem] p-5 flex gap-4"
                >
                  <CheckCircle2 className="text-status-green shrink-0 mt-0.5" size={20} />
                  <div>
                    <div className="font-semibold text-brand-900">{grade}</div>
                    <div className="text-sm text-slate-600 mt-1">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- promise */}
      <section className="bg-surface-0">
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
          <div className="grid gap-8 md:grid-cols-3">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="w-11 h-11 rounded-lg bg-brand-900 text-white flex items-center justify-center">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-brand-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- steps */}
      <section className="bg-surface-50 border-y border-surface-200">
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-900 text-center">
            How it works
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="relative">
                <span className="text-5xl font-extrabold text-brand-100 leading-none">{n}</span>
                <h3 className="mt-4 text-lg font-semibold text-brand-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- contact */}
      <section className="bg-brand-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-20 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Tell us what you need
          </h2>
          <p className="mt-5 text-slate-300 leading-relaxed">
            Send the models, grades and quantities you are after and we will come back with
            current availability and pricing.
          </p>
          <a
            href={`mailto:${EMAIL}?subject=Wholesale%20enquiry`}
            className="mt-9 inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand-500 hover:bg-brand-600 font-semibold tracking-wide transition-colors"
          >
            <Mail size={18} /> {EMAIL}
          </a>
        </div>
      </section>

      {/* -------------------------------------------------------------- footer */}
      <footer className="bg-surface-0 border-t border-surface-200 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} Prime Trade Exchange · Electronics &amp; phone wholesale</span>
          <div className="flex items-center gap-6">
            <a href={`mailto:${EMAIL}`} className="hover:text-brand-700 transition-colors">
              {EMAIL}
            </a>
            <Link to="/login" className="hover:text-brand-700 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
