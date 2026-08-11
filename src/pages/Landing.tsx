import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

const TRUST = [
  { emoji: '📦', label: 'Amazon Wholesale' },
  { emoji: '🔌', label: 'Electronics & Accessories' },
  { emoji: '⚡', label: 'Fast Fulfillment' },
  { emoji: '🤝', label: 'Fair Pricing' },
];

const EMAIL = 'primetradingex@gmail.com';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#0a2540] to-[#10375f] text-white">
        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="font-bold tracking-[0.2em] text-base sm:text-lg">PRIME TRADE EXCHANGE</span>
          <Link
            to="/login"
            className="text-sm text-white/50 hover:text-white transition-colors"
            title="Dashboard sign in"
          >
            Dashboard Login
          </Link>
        </div>

        {/* Headline */}
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05]">
            Amazon Wholesale,
            <br />
            <span className="text-[#4a9fe8]">Made Simple.</span>
          </h1>
          <p className="mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-slate-300 leading-relaxed">
            We're wholesalers of consumer electronics and accessories — fair prices, honest
            communication, and product that shows up when we say it will.
          </p>
          <a
            href={`mailto:${EMAIL}`}
            className="mt-10 inline-block px-10 py-4 rounded-lg bg-[#3b93e8] hover:bg-[#2b83d8] text-white font-semibold tracking-wide uppercase transition-colors"
          >
            Get in touch
          </a>
        </div>

        {/* Trust strip */}
        <div className="bg-[#081a30] border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-white/90">
            {TRUST.map((t) => (
              <span key={t.label} className="flex items-center gap-2">
                <span className="text-base">{t.emoji}</span>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="flex-1 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-24 sm:py-28 text-center">
          <p className="text-xl sm:text-2xl text-slate-700 leading-relaxed">
            Prime Trade Exchange is an Amazon wholesale team moving consumer electronics and accessories
            in volume — sourced right, priced fair, and shipped on time. No runarounds. Just
            straightforward deals with people who pick up the phone.
          </p>
          <a
            href={`mailto:${EMAIL}`}
            className="mt-10 inline-flex items-center gap-2 text-brand-700 font-semibold hover:text-[#3b93e8] transition-colors"
          >
            <Mail size={18} /> {EMAIL}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} Prime Trade Exchange</span>
          <Link to="/login" className="hover:text-brand-700">
            Dashboard Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
