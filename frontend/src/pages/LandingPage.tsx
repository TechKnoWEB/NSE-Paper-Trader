import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const TICKER_SYMBOLS = [
  { name: 'NIFTY', price: 24532.45, chg: '+0.42%' },
  { name: 'BANKNIFTY', price: 52186.30, chg: '+0.68%' },
  { name: 'FINNIFTY', price: 21742.15, chg: '-0.23%' },
  { name: 'SENSEX', price: 81328.90, chg: '+0.35%' },
  { name: 'INDIA VIX', price: 14.28, chg: '-2.15%' },
  { name: 'NIFTY 24600 CE', price: 155.30, chg: '+3.22%' },
  { name: 'NIFTY 24600 PE', price: 152.80, chg: '-2.85%' },
  { name: 'NIFTY', price: 24532.45, chg: '+0.42%' },
  { name: 'BANKNIFTY', price: 52186.30, chg: '+0.68%' },
  { name: 'FINNIFTY', price: 21742.15, chg: '-0.23%' },
];

const FAQ_ITEMS = [
  {
    q: 'Do I need a brokerage account?',
    a: 'No — you only need an email address to sign up. This is a paper trading platform. No real brokerage account, no KYC, and no deposit required. All market data is streamed through our backend infrastructure.',
  },
  {
    q: 'Is this really free?',
    a: 'The Free plan is completely free forever. You get ₹2,000 virtual capital, live NIFTY & BANK NIFTY data, and basic features. Upgrade to Basic (₹99/mo), Pro (₹299/mo), or Elite (₹999/mo) for up to ₹1,00,00,000 virtual capital. No credit card required to start.',
  },
  {
    q: 'How realistic is the paper trading engine?',
    a: 'Very. We model real-world slippage, SPAN margin requirements, STT, brokerage, and exchange charges. Our engine uses live market data with configurable slippage models. Your virtual P&L closely mirrors what you\'d get with real orders.',
  },
  {
    q: 'What instruments are available?',
    a: 'NIFTY, BANK NIFTY, FIN NIFTY, MIDCPNIFTY, SENSEX, and all stock F&O securities traded on NSE. We maintain an up-to-date instruments database with accurate lot sizes, expiry dates, and contract specifications.',
  },
  {
    q: 'Can I reset my virtual capital?',
    a: 'Yes. Pro users can reset their virtual portfolio at any time from the Settings page. Free plan users can reset once every 30 days. Your trade journal is preserved even after reset.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. We use encrypted storage for all sensitive data and JWT tokens for session management. No real orders are ever placed. All communications are over HTTPS/WSS.',
  },
];

const PLANS = [
  {
    name: 'Free',
    desc: 'Perfect for beginners',
    price: '₹0',
    period: ' / month',
    featured: false,
    btnLabel: 'Get Started Free',
    btnVariant: 'btn-secondary' as const,
    features: [
      '₹2,000 virtual capital',
      'Live NIFTY & BANK NIFTY data',
      'Basic Greeks display',
      '5 open positions max',
      'Basic P&L tracking',
    ],
  },
  {
    name: 'Basic',
    desc: 'For aspiring traders',
    price: '₹99',
    period: ' / month',
    featured: false,
    badge: undefined,
    btnLabel: 'Subscribe',
    btnVariant: 'btn-primary' as const,
    features: [
      '₹1,00,000 virtual capital',
      'Everything in Free',
      'All F&O stocks + indices',
      'Unrealized P&L on every tick',
      '20 open positions max',
      'Multi-leg strategy builder',
    ],
  },
  {
    name: 'Pro',
    desc: 'Serious traders',
    price: '₹299',
    period: ' / month',
    featured: true,
    badge: 'Most Popular',
    btnLabel: 'Subscribe',
    btnVariant: 'btn-primary' as const,
    features: [
      '₹50,00,000 virtual capital',
      'Everything in Basic',
      'Unlimited open positions',
      'Advanced analytics & trade journal',
      'Live Greeks on every position',
      'Priority support',
    ],
    note: '7-day free trial. Cancel anytime.',
  },
  {
    name: 'Elite',
    desc: 'Power traders & institutions',
    price: '₹999',
    period: ' / month',
    featured: false,
    badge: undefined,
    btnLabel: 'Subscribe',
    btnVariant: 'btn-primary' as const,
    features: [
      '₹1,00,00,000 virtual capital',
      'Everything in Pro',
      'Real-time WebSocket ticks',
      'API access for custom tools',
      'Dedicated onboarding',
      'White-label option',
    ],
  },
];

function renderTickerItem(s: typeof TICKER_SYMBOLS[number]) {
  const isUp = s.chg.startsWith('+');
  return (
    <span key={s.name + s.price} className="inline-flex items-center gap-2 text-xs font-mono">
      <span className="text-terminal-text font-medium">{s.name}</span>
      <span className="text-terminal-text">{s.price.toFixed(2)}</span>
      <span className={isUp ? 'text-profit' : 'text-loss'}>{s.chg}</span>
      <span className="text-terminal-border">|</span>
    </span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);
  const animObserved = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const els = document.querySelectorAll('[data-animate]');
    els.forEach((el) => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.transform = 'translateY(20px)';
      (el as HTMLElement).style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-ui">
      <style>{`
        .gradient-text {
          background: linear-gradient(135deg, #2979FF 0%, #00C853 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-border {
          position: relative;
          border-radius: 12px;
        }
        .gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(41,121,255,0.5), rgba(0,200,83,0.5));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .grid-pattern {
          background-image: radial-gradient(circle at 1px 1px, rgba(232,234,240,0.05) 1px, transparent 0);
          background-size: 32px 32px;
        }
        .glow-card {
          transition: all 0.3s ease;
        }
        .glow-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(41,121,255,0.15);
          border-color: rgba(41,121,255,0.3);
        }
        .ticker-wrapper {
          overflow: hidden;
          white-space: nowrap;
        }
        .btn-primary {
          background: linear-gradient(135deg, #2979FF, #00C853);
          color: #fff;
          font-weight: 600;
          padding: 12px 32px;
          border-radius: 10px;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          cursor: pointer;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,200,83,0.3);
        }
        .btn-secondary {
          background: transparent;
          color: #E8EAF0;
          font-weight: 600;
          padding: 12px 32px;
          border-radius: 10px;
          border: 1px solid #1E2028;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .btn-secondary:hover {
          border-color: #2979FF;
          background: rgba(41,121,255,0.1);
        }
        .live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00C853;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .pricing-card {
          transition: all 0.4s ease;
        }
        .pricing-card.featured {
          border: 1px solid rgba(41,121,255,0.4);
          background: linear-gradient(180deg, rgba(41,121,255,0.08) 0%, rgba(17,19,24,1) 100%);
        }
        .pricing-card.featured:hover {
          border-color: #2979FF;
          box-shadow: 0 0 40px rgba(41,121,255,0.2);
        }
        .pricing-card:hover {
          border-color: rgba(41,121,255,0.3);
        }
        .nav-link {
          position: relative;
          color: #5C6070;
          transition: color 0.2s;
          cursor: pointer;
          background: none;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .nav-link:hover { color: #E8EAF0; }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: #2979FF;
          transition: width 0.3s;
        }
        .nav-link:hover::after { width: 100%; }
        .faq-item {
          border-bottom: 1px solid #1E2028;
        }
        .faq-question {
          cursor: pointer;
          user-select: none;
        }
        .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease, padding 0.3s ease;
        }
        .faq-item.active .faq-answer {
          max-height: 300px;
          padding-bottom: 20px;
        }
        .faq-item.active .faq-icon {
          transform: rotate(45deg);
        }
        .faq-icon {
          transition: transform 0.3s ease;
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(41,121,255,0.1);
        }
        .chart-mockup {
          background: linear-gradient(180deg, #111318 0%, #0A0B0D 100%);
          border: 1px solid #1E2028;
          border-radius: 12px;
          overflow: hidden;
        }
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .mobile-menu-open .nav-links {
            display: flex;
            flex-direction: column;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #111318;
            border-bottom: 1px solid #1E2028;
            padding: 16px;
            gap: 12px;
          }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* NAVIGATION */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-terminal-bg/80 backdrop-blur-xl border-b border-terminal-border/50 ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-profit flex items-center justify-center text-white font-bold text-sm font-mono">P</div>
            <span className="text-terminal-text font-semibold text-lg font-ui">Paper<span className="text-accent">Trader</span></span>
          </button>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('features')} className="nav-link">Features</button>
            <button onClick={() => scrollTo('how-it-works')} className="nav-link">How It Works</button>
            <button onClick={() => scrollTo('pricing')} className="nav-link">Pricing</button>
            <button onClick={() => scrollTo('faq')} className="nav-link">FAQ</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-terminal-muted hover:text-terminal-text transition-colors hidden sm:block cursor-pointer">
              Sign In
            </button>
            <button onClick={() => navigate('/login')} className="btn-primary text-sm !py-2 !px-5 cursor-pointer">
              Start Free Trial
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-terminal-muted hover:text-terminal-text cursor-pointer"
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
          <div className="nav-links md:hidden">
            <button onClick={() => { scrollTo('features'); setMobileMenuOpen(false); }} className="text-sm text-terminal-muted hover:text-terminal-text py-2">Features</button>
            <button onClick={() => { scrollTo('how-it-works'); setMobileMenuOpen(false); }} className="text-sm text-terminal-muted hover:text-terminal-text py-2">How It Works</button>
            <button onClick={() => { scrollTo('pricing'); setMobileMenuOpen(false); }} className="text-sm text-terminal-muted hover:text-terminal-text py-2">Pricing</button>
            <button onClick={() => { scrollTo('faq'); setMobileMenuOpen(false); }} className="text-sm text-terminal-muted hover:text-terminal-text py-2">FAQ</button>
            <button onClick={() => navigate('/login')} className="btn-primary text-sm !py-2 text-center mt-2 cursor-pointer">Sign In</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-profit/10 rounded-full blur-[100px]" />

        <div className="absolute top-20 left-0 right-0 h-10 bg-terminal-surface/60 border-y border-terminal-border overflow-hidden">
          <div className="ticker-wrapper">
            <div ref={tickerRef} className="inline-flex items-center gap-8 animate-ticker py-2">
              {TICKER_SYMBOLS.map(renderTickerItem)}
            </div>
            <div className="inline-flex items-center gap-8 animate-ticker py-2">
              {TICKER_SYMBOLS.map(renderTickerItem)}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-full px-4 py-1.5 mb-8 animate-fade-in">
            <span className="live-dot" />
            <span className="text-xs font-mono text-profit font-medium">Live Market Data — Real-Time NSE Feed</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-ui leading-[1.1] tracking-tight mb-6 animate-fade-in-up">
            Trade Options.<br />
            <span className="gradient-text">Without Losing a Rupee.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-terminal-muted leading-relaxed mb-10 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            Master NSE options trading with <strong className="text-terminal-text">up to ₹1,00,00,000 in virtual capital</strong>.
            Real-time NIFTY &amp; BANK NIFTY data, live Greeks, multi-leg strategies —
            <span className="text-profit font-medium"> 100% risk-free.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <button onClick={() => navigate('/login')} className="btn-primary text-base cursor-pointer">
              Start Trading Free
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => scrollTo('how-it-works')} className="btn-secondary text-base cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M10 8l6 4-6 4V8z" /></svg>
              See How It Works
            </button>
          </div>

          <div className="mt-16 flex flex-col items-center gap-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <p className="text-xs text-terminal-muted font-medium uppercase tracking-widest">Trusted by 500+ Retail Traders</p>
            <div className="flex -space-x-2">
              {['AK', 'RS', 'PM', 'SG'].map((initials, i) => {
                const gradients = ['from-accent to-terminal-bg', 'from-profit to-terminal-bg', 'from-atm to-terminal-bg', 'from-loss to-terminal-bg'];
                return (
                  <div key={initials} className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradients[i]} border-2 border-terminal-bg flex items-center justify-center text-xs font-bold text-white`}>
                    {initials}
                  </div>
                );
              })}
              <div className="w-9 h-9 rounded-full bg-terminal-border border-2 border-terminal-bg flex items-center justify-center text-xs font-medium text-terminal-muted">+500</div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST METRICS */}
      <section className="relative -mt-20 z-10 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-terminal-border rounded-2xl overflow-hidden">
            {[
              { value: '₹10L', label: 'Virtual Capital' },
              { value: '50+', label: 'NSE Instruments' },
              { value: '99.9%', label: 'Uptime (Market Hours)' },
              { value: '₹0', label: 'Real Money Risk' },
            ].map((m) => (
              <div key={m.value} className="bg-terminal-surface p-6 sm:p-8 text-center">
                <p className="text-3xl sm:text-4xl font-bold font-mono gradient-text">{m.value}</p>
                <p className="text-xs sm:text-sm text-terminal-muted mt-2 font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-accent font-semibold tracking-widest uppercase bg-accent/10 px-4 py-1.5 rounded-full">Features</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">Built for Serious Traders</h2>
            <p className="max-w-2xl mx-auto text-terminal-muted text-lg">Everything you need to practice, analyze, and perfect your options trading strategy — without putting real capital at risk.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-terminal-border rounded-2xl overflow-hidden">
            {[
              {
                icon: <><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></>,
                title: 'Live Option Chain',
                desc: 'Real-time NIFTY & BANK NIFTY option chain with LTP, OI, IV, and all 5 Greeks updated every 30 seconds during market hours.',
              },
              {
                icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
                title: 'Live Greeks & P&L',
                desc: 'Delta, Gamma, Theta, Vega, Rho — updated on every tick. Your MTM P&L moves in real-time as the market moves. No refresh needed.',
              },
              {
                icon: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
                title: 'Multi-Leg Strategies',
                desc: 'Build straddles, iron condors, vertical spreads, and custom multi-leg strategies. Visual payoff diagrams update instantly as you add legs.',
              },
              {
                icon: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
                title: 'Market Hours Aware',
                desc: 'Automatically switches between pre-open, live, and post-market modes. No trading on holidays. Scheduler handles limit orders and expiry.',
              },
              {
                icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></>,
                title: 'Trade Journal & Analytics',
                desc: 'Every trade logged. Win rate, P&L charts, maximum drawdown, trade journal — analyze your performance like a professional.',
              },
              {
                icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
                title: 'Risk Management',
                desc: 'Set daily loss limits, position size warnings, and automatic stop-losses. Learn risk discipline without real consequences.',
              },
            ].map((f) => (
              <div key={f.title} className="glow-card bg-terminal-surface p-8 group">
                <div className="feature-icon mb-5 group-hover:bg-accent/20 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2979FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                </div>
                <h3 className="text-lg font-semibold font-ui mb-3">{f.title}</h3>
                <p className="text-sm text-terminal-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-terminal-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-profit font-semibold tracking-widest uppercase bg-profit/10 px-4 py-1.5 rounded-full">How It Works</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">Start in 60 Seconds</h2>
            <p className="max-w-2xl mx-auto text-terminal-muted text-lg">No KYC, no bank details, no deposit. Start with ₹2,000 and scale up to ₹1,00,00,000 in virtual capital.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-20 left-[16%] right-[16%] h-px bg-gradient-to-r from-accent via-profit to-accent/20" />
            {[
              { num: '1', numColor: 'text-accent', borderColor: 'border-accent', bgColor: 'bg-accent/20', title: 'Create Your Account', desc: 'Sign up with your email. Get virtual capital instantly — from ₹2,000 on Free to ₹1,00,00,000 on Elite. No deposit needed.' },
              { num: '2', numColor: 'text-profit', borderColor: 'border-profit', bgColor: 'bg-profit/20', title: 'Build Your Strategy', desc: 'Browse the live option chain, analyze Greeks, and build single or multi-leg strategies with instant payoff visualizations.' },
              { num: '3', numColor: 'text-accent', borderColor: 'border-accent', bgColor: 'bg-accent/20', title: 'Track & Improve', desc: 'Watch your P&L move in real-time with live market data. Review your trade journal, analyze performance, and refine your strategy.' },
            ].map((step) => (
              <div key={step.num} className="text-center relative" data-animate>
                <div className={`w-14 h-14 rounded-full ${step.bgColor} border-2 ${step.borderColor} flex items-center justify-center mx-auto mb-6 relative z-10`}>
                  <span className={`text-2xl font-bold font-mono ${step.numColor}`}>{step.num}</span>
                </div>
                <h3 className="text-xl font-semibold font-ui mb-3">{step.title}</h3>
                <p className="text-sm text-terminal-muted leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP PREVIEW */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-atm font-semibold tracking-widest uppercase bg-atm/10 px-4 py-1.5 rounded-full">Live Demo</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">See It In Action</h2>
            <p className="max-w-2xl mx-auto text-terminal-muted text-lg">A professional trading terminal experience — right in your browser.</p>
          </div>

          <div className="chart-mockup max-w-5xl mx-auto shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-terminal-border">
              <div className="w-3 h-3 rounded-full bg-loss" />
              <div className="w-3 h-3 rounded-full bg-atm" />
              <div className="w-3 h-3 rounded-full bg-profit" />
              <div className="ml-4 text-xs font-mono text-terminal-muted">NSE Paper Trader — Dashboard</div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-mono text-profit">● LIVE</span>
                <span className="text-xs font-mono text-terminal-muted">NIFTY 24,532.45</span>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Virtual Cash', value: <><span className="text-profit">₹</span>9,87,450</> },
                  { label: 'MTM P&L', value: <><span className="text-profit">+</span>₹12,550</>, cls: 'text-profit' },
                  { label: 'Open Positions', value: '4' },
                  { label: 'Win Rate', value: '67%', cls: 'text-profit' },
                ].map((c) => (
                  <div key={c.label} className="bg-terminal-bg rounded-lg p-3 border border-terminal-border">
                    <p className="text-[10px] text-terminal-muted font-mono uppercase tracking-wider">{c.label}</p>
                    <p className={`text-base sm:text-lg font-bold font-mono text-terminal-text mt-1 ${c.cls ?? ''}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-terminal-bg rounded-lg border border-terminal-border overflow-hidden">
                <div className="grid grid-cols-7 gap-0 text-[10px] font-mono text-terminal-muted uppercase tracking-wider border-b border-terminal-border">
                  <div className="px-3 py-2 text-right">OI</div>
                  <div className="px-3 py-2 text-right">IV</div>
                  <div className="px-3 py-2 text-right">LTP</div>
                  <div className="px-3 py-2 text-center font-semibold text-atm">STRIKE</div>
                  <div className="px-3 py-2 text-left">LTP</div>
                  <div className="px-3 py-2 text-left">IV</div>
                  <div className="px-3 py-2 text-left">OI</div>
                </div>
                <div className="divide-y divide-terminal-border/50 text-xs font-mono">
                  {[
                    { oi: '1,25,430', iv: '14.2', ltpCE: <span className="text-profit">282.45</span>, strike: '24400', ltpPE: <span className="text-loss">276.30</span>, ivPE: '14.8', oiPE: '1,18,720' },
                    { oi: '1,52,800', iv: '13.9', ltpCE: <span className="text-profit">215.60</span>, strike: '24500', ltpPE: <span className="text-loss">210.55</span>, ivPE: '14.3', oiPE: '1,43,500' },
                    null,
                    { oi: '2,15,600', iv: '19.4', ltpCE: <span className="text-profit">98.75</span>, strike: '24700', ltpPE: <span className="text-loss">96.30</span>, ivPE: '19.8', oiPE: '2,02,300' },
                    { oi: '2,42,100', iv: '22.1', ltpCE: <span className="text-profit">52.40</span>, strike: '24800', ltpPE: <span className="text-loss">51.85</span>, ivPE: '22.5', oiPE: '2,35,900' },
                  ].map((row, i) => {
                    if (row === null) {
                      return (
                        <div key={i} className="grid grid-cols-7 gap-0 bg-atm/5 border-y border-atm/20">
                          <div className="px-3 py-2 text-right text-terminal-muted">1,98,150</div>
                          <div className="px-3 py-2 text-right">16.8</div>
                          <div className="px-3 py-2 text-right text-profit">155.30</div>
                          <div className="px-3 py-2 text-center text-atm font-bold">24600</div>
                          <div className="px-3 py-2 text-left text-loss">152.80</div>
                          <div className="px-3 py-2 text-left">17.2</div>
                          <div className="px-3 py-2 text-left text-terminal-muted">1,87,400</div>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="grid grid-cols-7 gap-0 hover:bg-terminal-border/20 transition-colors">
                        <div className="px-3 py-2 text-right text-terminal-muted">{row.oi}</div>
                        <div className="px-3 py-2 text-right">{row.iv}</div>
                        <div className="px-3 py-2 text-right">{row.ltpCE}</div>
                        <div className="px-3 py-2 text-center text-terminal-border font-bold">{row.strike}</div>
                        <div className="px-3 py-2 text-left">{row.ltpPE}</div>
                        <div className="px-3 py-2 text-left">{row.ivPE}</div>
                        <div className="px-3 py-2 text-left text-terminal-muted">{row.oiPE}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-terminal-muted">
                <span>Last updated: 3s ago</span>
                <span className="text-accent cursor-pointer" onClick={() => navigate('/option-chain')}>View full option chain →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="py-20 sm:py-28 bg-terminal-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-loss font-semibold tracking-widest uppercase bg-loss/10 px-4 py-1.5 rounded-full">Why PaperTrader</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">Your First ₹50,000 Loss Should Be Virtual</h2>
            <p className="max-w-2xl mx-auto text-terminal-muted text-lg">Real options trading is unforgiving. Learn the hard lessons on our platform — not with your savings.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="gradient-border p-6" data-animate>
              <h3 className="text-base font-semibold font-ui mb-4 text-loss flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                Real Trading
              </h3>
              <ul className="space-y-3 text-sm text-terminal-muted">
                {['₹5L+ minimum capital required', 'Real money at stake every trade', 'KYC, bank paperwork, margin deposits', 'STT, brokerage, exchange fees on every trade', 'Emotional pressure distorts decisions'].map((item) => (
                  <li key={item} className="flex items-center gap-3"><span className="text-loss">✕</span> {item}</li>
                ))}
              </ul>
            </div>
            <div className="gradient-border p-6" data-animate>
              <h3 className="text-base font-semibold font-ui mb-4 text-profit flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                PaperTrader
              </h3>
              <ul className="space-y-3 text-sm text-terminal-muted">
                {['Up to ₹1,00,00,000 virtual capital', 'Real market data, zero financial risk', 'No KYC, no paperwork, no deposit', 'All charges simulated (STT, brokerage included)', 'Practice without pressure. Learn faster.'].map((item) => (
                  <li key={item} className="flex items-center gap-3"><span className="text-profit">✓</span> {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-profit font-semibold tracking-widest uppercase bg-profit/10 px-4 py-1.5 rounded-full">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">What Traders Say</h2>
            <p className="max-w-2xl mx-auto text-terminal-muted text-lg">Join 500+ traders who use PaperTrader to sharpen their skills.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { initials: 'AK', gradient: 'from-accent to-terminal-bg', name: 'Arun K.', role: 'NIFTY Options Trader, Mumbai', text: '"I lost ₹60,000 in my first month of real options trading. With PaperTrader, I\'ve practiced 50+ strategies without losing a rupee. My win rate went from 35% to 68% before I went back to real trading."' },
              { initials: 'RS', gradient: 'from-profit to-terminal-bg', name: 'Ritu S.', role: 'Derivatives Analyst, Bengaluru', text: '"The option chain UI is beautiful — better than what most brokers offer. Live Greeks, ATM highlighting, and the strategy builder with payoff charts helped me understand options pricing intuitively."' },
              { initials: 'PM', gradient: 'from-atm to-terminal-bg', name: 'Priya M.', role: 'Software Engineer, Pune', text: '"I\'m a full-time software engineer learning F&O trading. PaperTrader\'s real-time data and risk management features helped me understand position sizing and Greeks without risking my savings. Absolute game-changer."' },
            ].map((t) => (
              <div key={t.initials} className="bg-terminal-surface border border-terminal-border rounded-xl p-6 glow-card" data-animate>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} className="w-4 h-4 text-atm" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  ))}
                </div>
                <p className="text-sm text-terminal-muted leading-relaxed mb-4">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.gradient} border-2 border-terminal-bg flex items-center justify-center text-xs font-bold text-white`}>{t.initials}</div>
                  <div>
                    <p className="text-sm font-medium font-ui">{t.name}</p>
                    <p className="text-xs text-terminal-muted font-mono">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 sm:py-28 bg-terminal-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-accent font-semibold tracking-widest uppercase bg-accent/10 px-4 py-1.5 rounded-full">Pricing</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">Simple, Transparent Pricing</h2>
            <p className="max-w-2xl mx-auto text-terminal-muted text-lg">Start free. Upgrade when you're ready for more.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`pricing-card bg-terminal-surface border rounded-2xl p-8 relative ${plan.featured ? 'featured' : 'border-terminal-border'}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold font-mono px-4 py-1 rounded-full uppercase tracking-wider">{plan.badge}</div>
                )}
                <h3 className="text-lg font-semibold font-ui">{plan.name}</h3>
                <p className="text-terminal-muted text-sm mt-1">{plan.desc}</p>
                <div className="mt-6 mb-8">
                  <span className="text-4xl font-bold font-mono text-terminal-text">{plan.price}</span>
                  <span className="text-terminal-muted text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <svg className="w-4 h-4 text-profit mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate('/login')} className={`${plan.btnVariant} text-sm w-full justify-center cursor-pointer`}>
                  {plan.btnLabel}
                </button>
                {plan.note && <p className="text-[10px] text-center text-terminal-muted mt-3 font-mono">{plan.note}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-animate>
            <span className="text-xs font-mono text-atm font-semibold tracking-widest uppercase bg-atm/10 px-4 py-1.5 rounded-full">FAQ</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mt-6 mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-0">
            {FAQ_ITEMS.map((faq, idx) => (
              <div key={idx} className={`faq-item py-5 ${openFaqIndex === idx ? 'active' : ''}`}>
                <div className="faq-question flex items-center justify-between" onClick={() => toggleFaq(idx)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleFaq(idx)}>
                  <h3 className="text-base font-medium font-ui pr-4">{faq.q}</h3>
                  <span className="faq-icon text-xl text-terminal-muted shrink-0 leading-none">+</span>
                </div>
                <div className="faq-answer text-sm text-terminal-muted leading-relaxed pt-3">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10" data-animate>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-ui mb-6">
            Start Trading Like a Pro.<br />
            <span className="gradient-text">Without the Risk.</span>
          </h2>
          <p className="text-lg text-terminal-muted max-w-2xl mx-auto mb-10">
            Join 500+ traders who use PaperTrader to master options trading. Get up to ₹1,00,00,000 in virtual capital and live market data — instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/login')} className="btn-primary text-base animate-glow cursor-pointer">
              Start Your Free Trial
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => navigate('/login')} className="btn-secondary text-base cursor-pointer">
              Sign In
            </button>
          </div>
          <p className="text-xs text-terminal-muted mt-6 font-mono">No credit card required. 7-day free Pro trial included.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-terminal-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 mb-4 cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-profit flex items-center justify-center text-white font-bold text-sm font-mono">P</div>
                <span className="text-terminal-text font-semibold font-ui">Paper<span className="text-accent">Trader</span></span>
              </button>
              <p className="text-xs text-terminal-muted leading-relaxed max-w-xs">Master NSE options trading with virtual capital. Real data, zero risk.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-terminal-text uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Features', href: 'features' },
                  { label: 'Pricing', href: 'pricing' },
                  { label: 'FAQ', href: 'faq' },
                  { label: 'Market Data', href: null },
                ].map((l) => (
                  <li key={l.label}>
                    {l.href ? (
                      <button onClick={() => scrollTo(l.href!)} className="text-sm text-terminal-muted hover:text-terminal-text transition-colors cursor-pointer">{l.label}</button>
                    ) : (
                      <span className="text-sm text-terminal-muted">{l.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-terminal-text uppercase tracking-wider mb-4">Resources</h4>
              <ul className="space-y-2.5">
                {['Documentation', 'API Reference', 'Blog', 'Community'].map((l) => (
                  <li key={l}><span className="text-sm text-terminal-muted hover:text-terminal-text transition-colors cursor-default">{l}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-terminal-text uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service', 'Disclaimer'].map((l) => (
                  <li key={l}><span className="text-sm text-terminal-muted hover:text-terminal-text transition-colors cursor-default">{l}</span></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-terminal-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-terminal-muted font-mono">&copy; 2026 PaperTrader. All rights reserved. Not SEBI registered.</p>
            <div className="flex items-center gap-4">
              <p className="text-[10px] text-terminal-muted font-mono"><span className="text-profit font-semibold">Paper trading only.</span> No real orders are ever placed.</p>
              <div className="flex items-center gap-2">
                <span className="text-terminal-muted text-xs">Made with</span>
                <span className="text-loss text-xs">&#9829;</span>
                <span className="text-terminal-muted text-xs">for Indian traders</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
