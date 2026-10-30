"use client";

import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const notes = [
  "A clear desk for every channel",
  "One story system, from brief to publish",
  "Built for the work behind the camera",
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-remember": remember ? "true" : "false",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_minmax(480px,0.92fr)] bg-paper text-ink selection:bg-signal/20 selection:text-signal overflow-x-hidden">
      {/* Left editorial section */}
      <section className="relative min-h-full flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-paper border-b lg:border-b-0 lg:border-r border-line overflow-hidden">
        {/* Editorial ambient circle decoration */}
        <div 
          aria-hidden="true" 
          className="absolute -bottom-48 -left-48 w-96 h-96 sm:w-[500px] sm:h-[500px] rounded-full border border-ink/5 pointer-events-none" 
        />

        <div className="relative z-10 max-w-xl my-auto py-8">
          <a href="#top" className="inline-flex items-center gap-3 text-ink group" aria-label="Faceless 2.0 home">
            <div className="w-8 h-8 rounded-sm bg-signal flex items-center justify-center text-white shadow-sm shadow-signal/30 group-hover:bg-signal-hover transition-colors">
              <span className="w-3 h-3 bg-paper [clip-path:polygon(0_0,100%_50%,0_100%)] ml-0.5" />
            </div>
            <div className="flex flex-col tracking-wider leading-none">
              <strong className="text-xs font-bold font-mono tracking-widest text-ink">FACELESS</strong>
              <span className="text-[9px] font-mono tracking-[0.25em] text-signal font-semibold mt-0.5">2.0</span>
            </div>
          </a>

          <div className="flex items-center gap-2 mt-12 mb-5 font-mono text-[11px] font-medium tracking-wider text-ink-muted uppercase">
            <span className="w-6 h-px bg-signal" />
            <span>Creator operations, edited</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-semibold tracking-tight text-ink leading-[1.05]">
            Make the invisible,<br />
            <em className="italic text-signal font-normal font-display">visible.</em>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-ink-muted leading-relaxed max-w-md">
            The production desk for creators directing faceless YouTube channels with the Faceless 2.0 system.
          </p>

          <ul className="mt-8 space-y-3.5">
            {notes.map((note) => (
              <li key={note} className="flex items-center gap-3 text-sm text-ink/80 font-medium">
                <span className="w-5 h-5 rounded-full border border-ink/20 flex items-center justify-center text-signal bg-paper-card shrink-0">
                  <Check size={12} strokeWidth={2.6} />
                </span>
                {note}
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative z-10 pt-8 border-t border-line/60 flex items-center justify-between text-xs font-mono text-ink-muted tracking-wider">
          <span>© 2026 Faceless 2.0</span>
          <span>Private by design</span>
        </footer>
      </section>

      {/* Right form section */}
      <section id="top" className="relative flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-linear-to-br from-[#cdd7f3]/50 via-paper-deep to-[#f1d9d2]/40">
        <div className="w-full max-w-md bg-paper-card/95 backdrop-blur-md p-8 sm:p-10 rounded-2xl border border-white/80 shadow-2xl shadow-signal/5 animate-card-rise relative">
          {/* Subtle cut-corner accent */}
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-line bg-paper-dark rounded-bl-sm" />

          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-semibold tracking-wider uppercase mb-3">
              <Sparkles size={13} /> MEMBER ACCESS
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              Return to the work.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-ink-muted leading-relaxed">
              Enter your studio credentials to access your production desk.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="email">
                Email address
              </label>
              <div className="relative flex items-center rounded-lg border border-line-dark bg-white focus-within:border-signal focus-within:ring-3 focus-within:ring-signal/15 transition-all">
                <Mail size={17} className="absolute left-3.5 text-ink-muted shrink-0" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  placeholder="admin@facelessstudio.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-ink/80" htmlFor="password">
                  Password
                </label>
                <button type="button" className="text-xs font-semibold text-signal hover:underline">
                  Forgot?
                </button>
              </div>
              <div className="relative flex items-center rounded-lg border border-line-dark bg-white focus-within:border-signal focus-within:ring-3 focus-within:ring-signal/15 transition-all">
                <LockKeyhole size={17} className="absolute left-3.5 text-ink-muted shrink-0" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full h-11 pl-10 pr-10 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/50 font-mono"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-ink-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-lg border border-rose-200" role="alert">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <label className="flex items-center gap-2.5 text-xs text-ink-muted cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="w-4 h-4 rounded border-line-dark text-signal accent-signal focus:ring-signal"
              />
              <span>Keep this desk open for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 mt-2 rounded-lg bg-signal hover:bg-signal-hover active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-signal/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Checking credentials…</span>
                </>
              ) : (
                <>
                  <span>Enter Faceless 2.0</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-5 border-t border-line flex items-center justify-between text-xs text-ink-muted">
            <span>New to the studio?</span>
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-ink hover:text-signal transition-colors">
              Request invitation <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

