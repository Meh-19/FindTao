"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Box, Calculator, Truck } from "lucide-react";
import { useStore } from "@/lib/store";
import { convertCny, formatMoney, CURRENCIES, type Currency } from "@/lib/currency";

const inputClass =
  "w-full rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function Card({ icon: Icon, title, blurb, children }: { icon: typeof Box; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="card-pop rounded-none border border-white/5 bg-ink-800/80 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-mist-300">
        <Icon size={15} aria-hidden="true" className="text-neon-300" /> {title}
      </h2>
      <p className="mt-1 text-xs text-mist-500">{blurb}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-mist-500">{label}</span>
      {children}
    </label>
  );
}

/** L×W×H → volumetric weight, and the chargeable weight couriers actually bill. */
function VolumetricCalc() {
  const [l, setL] = useState("");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [divisor, setDivisor] = useState("6000");
  const [actual, setActual] = useState("");

  const vol = useMemo(() => {
    const d = num(divisor) || 6000;
    return (num(l) * num(w) * num(h)) / d; // kg
  }, [l, w, h, divisor]);
  const chargeable = Math.max(vol, num(actual));

  return (
    <Card icon={Box} title="Volumetric weight" blurb="Couriers bill the greater of actual and volumetric weight. Enter the box dimensions to see which wins.">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Length cm"><input value={l} onChange={(e) => setL(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Length in cm" className={inputClass} /></Field>
        <Field label="Width cm"><input value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Width in cm" className={inputClass} /></Field>
        <Field label="Height cm"><input value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Height in cm" className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Divisor">
          <select value={divisor} onChange={(e) => setDivisor(e.target.value)} aria-label="Volumetric divisor" className={inputClass}>
            <option value="6000">6000 (air standard)</option>
            <option value="5000">5000 (express)</option>
          </select>
        </Field>
        <Field label="Actual weight kg"><input value={actual} onChange={(e) => setActual(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Actual weight in kg" className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
        <div className="border border-white/5 bg-ink-900/60 px-3 py-2">
          <span className="block text-[11px] text-mist-500">Volumetric</span>
          <span className="font-semibold tabular-nums text-mist-100">{vol.toFixed(2)} kg</span>
        </div>
        <div className="border border-neon-400/30 bg-neon-500/10 px-3 py-2">
          <span className="block text-[11px] text-mist-500">Chargeable</span>
          <span className="font-semibold tabular-nums text-neon-200">{chargeable.toFixed(2)} kg</span>
        </div>
      </div>
    </Card>
  );
}

/** Rough shipping cost = chargeable weight × ¥/kg, shown in ¥ and your currency. */
function ShippingCalc() {
  const { prefs, rates, fmtConverted } = useStore();
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");
  const [firstKg, setFirstKg] = useState("");

  const totalCny = useMemo(() => {
    const w = num(weight);
    const perKg = num(rate);
    const base = num(firstKg);
    if (w <= 0) return 0;
    // base = flat first-kg fee (optional); remaining weight billed per kg.
    return base > 0 ? base + Math.max(0, w - 1) * perKg : w * perKg;
  }, [weight, rate, firstKg]);

  return (
    <Card icon={Truck} title="Shipping estimate" blurb="Plug in your forwarder's line rate (¥ per kg) to ballpark the parcel before you pay.">
      <Field label="Chargeable weight kg"><input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Chargeable weight in kg" className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="¥ per kg"><input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="e.g. 55" aria-label="Yuan per kg" className={inputClass} /></Field>
        <Field label="¥ first kg (optional)"><input value={firstKg} onChange={(e) => setFirstKg(e.target.value)} inputMode="decimal" placeholder="flat" aria-label="Flat first-kilo fee in yuan" className={inputClass} /></Field>
      </div>
      <div className="border border-neon-400/30 bg-neon-500/10 px-3 py-2.5 text-sm">
        <span className="block text-[11px] text-mist-500">Estimated shipping</span>
        <span className="font-bold tabular-nums text-mist-100">
          {formatMoney(totalCny, "CNY")} <span className="flow-text">≈ {fmtConverted(totalCny)}</span>
        </span>
        <span className="mt-0.5 block text-[10px] text-mist-500">
          Rate to {prefs.currency}: {(rates[prefs.currency] ?? 0).toFixed(4)}
        </span>
      </div>
    </Card>
  );
}

/** Quick ¥ ⇄ your currency, using the app's live rate. */
function CurrencyCalc() {
  const { prefs, rates } = useStore();
  const [cny, setCny] = useState("");
  const [target, setTarget] = useState<Currency>(prefs.currency);
  const rate = rates[target] ?? 0;
  const converted = num(cny) * rate;

  return (
    <Card icon={ArrowRightLeft} title="Currency" blurb="Convert a yuan price to your currency at the app's current rate.">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount ¥"><input value={cny} onChange={(e) => setCny(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Amount in yuan" className={inputClass} /></Field>
        <Field label="To">
          <select value={target} onChange={(e) => setTarget(e.target.value as Currency)} aria-label="Convert to currency" className={inputClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="border border-neon-400/30 bg-neon-500/10 px-3 py-2.5 text-sm">
        <span className="block text-[11px] text-mist-500">≈</span>
        <span className="font-bold tabular-nums text-mist-100">{formatMoney(converted, target)}</span>
      </div>
    </Card>
  );
}

export default function CalculatorsPage() {
  const { hydrated } = useStore();
  if (!hydrated) return null;

  return (
    <div className="fade-up py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
          <Calculator size={26} aria-hidden="true" className="text-neon-300" />
          Haul <span className="flow-text">calculators</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Weigh a parcel, ballpark the shipping, and convert the price — everything runs on your device.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VolumetricCalc />
        <ShippingCalc />
        <CurrencyCalc />
      </div>
    </div>
  );
}
