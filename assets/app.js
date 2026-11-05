'use strict';

/* ============================================================
   PulseTrade AI — client-side market intelligence engine
   All data is deterministically generated for this demo.
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n, d = 2) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n), d)}`;
const signedMoney = (n, d = 2) => `${n >= 0 ? '+' : '-'}$${fmt(Math.abs(n), d)}`;
const signedPct = (n, d = 2) => `${n >= 0 ? '+' : ''}${fmt(n, d)}%`;
const compact = (n) => {
  if (Math.abs(n) >= 1e12) return `${fmt(n / 1e12, 2)}T`;
  if (Math.abs(n) >= 1e9) return `${fmt(n / 1e9, 2)}B`;
  if (Math.abs(n) >= 1e6) return `${fmt(n / 1e6, 1)}M`;
  if (Math.abs(n) >= 1e3) return `${fmt(n / 1e3, 1)}K`;
  return fmt(n, 0);
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const fmtDateLong = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const relativeTime = (d) => {
  const secs = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function store(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ---------------- Sources ---------------- */
const SOURCES = [
  { id: 'yahoo', name: 'Yahoo Finance', short: 'YF', color: '#a78bfa', credibility: 88, desk: 'Markets' },
  { id: 'nyse', name: 'New York Stock Exchange', short: 'NYSE', color: '#62a8ff', credibility: 96, desk: 'Exchange' },
  { id: 'bloomberg', name: 'Bloomberg', short: 'BB', color: '#ffb454', credibility: 95, desk: 'Terminal' },
  { id: 'reuters', name: 'Reuters', short: 'R', color: '#ff7a59', credibility: 96, desk: 'Wire' },
  { id: 'cnbc', name: 'CNBC', short: 'CNBC', color: '#4db8ff', credibility: 86, desk: 'Broadcast' },
  { id: 'marketwatch', name: 'MarketWatch', short: 'MW', color: '#4ade80', credibility: 83, desk: 'Markets' },
  { id: 'wsj', name: 'Wall Street Journal', short: 'WSJ', color: '#cbd5e1', credibility: 94, desk: 'Business' },
  { id: 'barrons', name: "Barron's", short: "B", color: '#e7c65b', credibility: 90, desk: 'Investing' },
  { id: 'ft', name: 'Financial Times', short: 'FT', color: '#f9a8b8', credibility: 94, desk: 'Global' },
  { id: 'investing', name: 'Investing.com', short: 'INV', color: '#6ea8fe', credibility: 79, desk: 'Markets' },
  { id: 'seekingalpha', name: 'Seeking Alpha', short: 'SA', color: '#34e5ad', credibility: 76, desk: 'Research' },
  { id: 'fool', name: 'The Motley Fool', short: 'MF', color: '#a3e635', credibility: 72, desk: 'Retail' }
];
const SOURCE_MAP = Object.fromEntries(SOURCES.map(s => [s.id, s]));

/* ---------------- Universe ---------------- */
const SECTOR_COLORS = {
  Semiconductors: '#62a8ff', Technology: '#34e5ad', Communication: '#a78bfa',
  Consumer: '#ffb454', Financials: '#4dd4ac', Energy: '#ff8a5c',
  Healthcare: '#f472b6', Software: '#6ee7ff', Crypto: '#f7b955'
};

const STOCK_DEFS = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors', anchor: 178.42, vol: 0.027, earningsIn: 16, pe: 52.1, cap: '4.35T' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', anchor: 232.18, vol: 0.015, earningsIn: 24, pe: 34.6, cap: '3.51T' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', anchor: 468.35, vol: 0.016, earningsIn: 19, pe: 36.2, cap: '3.48T' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer', anchor: 341.76, vol: 0.034, earningsIn: 12, pe: 78.4, cap: '1.10T' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer', anchor: 224.09, vol: 0.019, earningsIn: 21, pe: 39.8, cap: '2.36T' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Communication', anchor: 611.84, vol: 0.021, earningsIn: 27, pe: 28.3, cap: '1.55T' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication', anchor: 196.12, vol: 0.018, earningsIn: 18, pe: 26.9, cap: '2.39T' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors', anchor: 166.53, vol: 0.031, earningsIn: 14, pe: 47.5, cap: '270B' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', anchor: 267.90, vol: 0.014, earningsIn: 31, pe: 13.4, cap: '750B' },
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', anchor: 118.34, vol: 0.016, earningsIn: 22, pe: 14.1, cap: '520B' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication', anchor: 904.60, vol: 0.023, earningsIn: 20, pe: 43.7, cap: '386B' },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Software', anchor: 77.85, vol: 0.037, earningsIn: 11, pe: 112.6, cap: '177B' },
  { symbol: 'COIN', name: 'Coinbase Global', sector: 'Crypto', anchor: 309.45, vol: 0.041, earningsIn: 15, pe: 61.2, cap: '78B' },
  { symbol: 'LLY', name: 'Eli Lilly & Co.', sector: 'Healthcare', anchor: 892.40, vol: 0.020, earningsIn: 26, pe: 58.4, cap: '848B' }
];

const INDEX_DEFS = [
  { symbol: 'SPX', name: 'S&P 500', anchor: 6112.40, vol: 0.009, type: 'index' },
  { symbol: 'NDX', name: 'Nasdaq 100', anchor: 22184.70, vol: 0.012, type: 'index' },
  { symbol: 'DJI', name: 'Dow Jones', anchor: 44621.30, vol: 0.008, type: 'index' },
  { symbol: 'VIX', name: 'CBOE Volatility', anchor: 15.62, vol: 0.055, type: 'vol' }
];

/* ---------------- History generation ---------------- */
function tradingDates(count) {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.unshift(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}
const DATES = tradingDates(300);

function generateSeries(symbol, anchor, vol) {
  const random = rng(hashStr(`${symbol}:series:v4`));
  const dates = DATES;
  let price = anchor * (0.62 + random() * 0.22);
  const raw = [];
  for (let i = 0; i < dates.length; i++) {
    const cycle = Math.sin((i + (hashStr(symbol) % 90)) / 41) * vol * 0.22;
    const drift = 0.00055 + cycle;
    const shock = (random() - 0.5) * 2;
    const gap = (random() - 0.5) * vol * 0.45;
    const open = Math.max(0.5, price * (1 + gap));
    const ret = drift + shock * vol + (random() < 0.025 ? (random() - 0.5) * vol * 3.2 : 0);
    const close = Math.max(0.5, open * (1 + ret));
    const high = Math.max(open, close) * (1 + random() * vol * 0.55);
    const low = Math.min(open, close) * (1 - random() * vol * 0.55);
    const volume = (16 + random() * 48) * (1 + Math.abs(ret) * 11) * 1e6;
    raw.push({ date: dates[i], o: open, h: high, l: low, c: close, v: volume });
    price = close;
  }
  const scale = anchor / raw[raw.length - 1].c;
  return raw.map(d => ({ date: d.date, o: d.o * scale, h: d.h * scale, l: d.l * scale, c: d.c * scale, v: d.v }));
}

const STOCKS = STOCK_DEFS.map(def => {
  const series = generateSeries(def.symbol, def.anchor, def.vol);
  return { ...def, series, ...deriveQuote(series), ...computeIndicators(series) };
});
const STOCK_MAP = Object.fromEntries(STOCKS.map(s => [s.symbol, s]));

const MARKET = INDEX_DEFS.map(def => {
  const series = generateSeries(def.symbol, def.anchor, def.vol);
  return { ...def, series, ...deriveQuote(series), ...computeIndicators(series) };
});
const MARKET_MAP = Object.fromEntries(MARKET.map(m => [m.symbol, m]));
const SPX = MARKET_MAP.SPX;

function deriveQuote(series) {
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const chg = last.c - prev.c;
  return { price: last.c, prevClose: prev.c, change: chg, changePct: (chg / prev.c) * 100 };
}

/* ---------------- Indicators ---------------- */
function smaSeries(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
function emaSeries(values, period) {
  const out = new Array(values.length).fill(null);
  if (!values.length) return out;
  const k = 2 / (period + 1);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}
function rsiSeries(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}
function atrSeries(series, period = 14) {
  const out = new Array(series.length).fill(null);
  if (series.length <= period) return out;
  const trs = series.map((d, i) => {
    if (i === 0) return d.h - d.l;
    const p = series[i - 1].c;
    return Math.max(d.h - d.l, Math.abs(d.h - p), Math.abs(d.l - p));
  });
  let atr = trs.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = atr;
  for (let i = period + 1; i < series.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out[i] = atr;
  }
  return out;
}
function stdSeries(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}
function computeIndicators(series) {
  const closes = series.map(d => d.c);
  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const sma200 = smaSeries(closes, 200);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macd = closes.map((_, i) => (ema12[i] != null && ema26[i] != null) ? ema12[i] - ema26[i] : null);
  const macdSignal = emaSeries(macd.map(v => v ?? 0), 9);
  const macdHist = macd.map((v, i) => (v != null && macdSignal[i] != null) ? v - macdSignal[i] : null);
  const rsi = rsiSeries(closes);
  const atr = atrSeries(series);
  const std20 = stdSeries(closes, 20);
  const bbUpper = sma20.map((v, i) => v != null && std20[i] != null ? v + 2 * std20[i] : null);
  const bbLower = sma20.map((v, i) => v != null && std20[i] != null ? v - 2 * std20[i] : null);
  const volAvg = smaSeries(series.map(d => d.v), 30);
  const last = closes.length - 1;
  return {
    closes, sma20, sma50, sma200, ema12, ema26, macd, macdSignal, macdHist, rsi, atr,
    bbUpper, bbLower, volAvg,
    last: {
      sma20: sma20[last], sma50: sma50[last], sma200: sma200[last],
      macd: macd[last], macdSignal: macdSignal[last], macdHist: macdHist[last],
      rsi: rsi[last], atr: atr[last], bbUpper: bbUpper[last], bbLower: bbLower[last],
      volAvg: volAvg[last]
    }
  };
}

/* ---------------- News ---------------- */
const RAW_ARTICLES = [
  { source: 'reuters', title: 'Nvidia suppliers signal record data-center orders ahead of Q3 earnings', summary: 'Three Asian contract manufacturers guided to double-digit sequential growth in AI server components, suggesting demand is running ahead of consensus heading into Nvidia\'s next print.', tickers: ['NVDA', 'AMD'], sentiment: 0.86, impact: 5, minutesAgo: 12, category: 'Earnings' },
  { source: 'yahoo', title: 'Fed minutes point to a slower easing path as core inflation cools', summary: 'Policymakers favored a gradual approach to rate cuts, with several members flagging sticky services inflation. Rate-sensitive sectors could see a modest repricing at the open.', tickers: ['JPM', 'SPX'], sentiment: -0.18, impact: 4, minutesAgo: 24, category: 'Macro' },
  { source: 'bloomberg', title: 'Apple services revenue seen topping $30B as AI features roll out', summary: 'Channel checks point to accelerating App Store and iCloud revenue, while the new on-device AI suite is lifting upgrade intent among premium iPhone users.', tickers: ['AAPL'], sentiment: 0.74, impact: 4, minutesAgo: 38, category: 'Earnings' },
  { source: 'cnbc', title: 'Tesla delivery forecasts cut by two more Wall Street analysts', summary: 'Analysts cited softer European registrations and a slower Model Y refresh cycle. The cuts add pressure to a name already trading at a premium multiple.', tickers: ['TSLA'], sentiment: -0.72, impact: 4, minutesAgo: 46, category: 'Analyst' },
  { source: 'wsj', title: 'Microsoft expands AI capacity with $12B data-center lease', summary: 'The multi-year agreement is one of the largest ever signed and underscores how cloud demand is outpacing available GPU capacity in key US regions.', tickers: ['MSFT', 'NVDA'], sentiment: 0.68, impact: 4, minutesAgo: 55, category: 'Capex' },
  { source: 'marketwatch', title: 'AMD gains server CPU share for a third straight quarter, survey shows', summary: 'A survey of 140 enterprise buyers found AMD winning incremental workloads in both cloud and on-premise deployments, with pricing power improving.', tickers: ['AMD'], sentiment: 0.71, impact: 3, minutesAgo: 68, category: 'Competition' },
  { source: 'barrons', title: 'Why JPMorgan could surprise on net interest income this quarter', summary: 'Deposit costs are stabilizing faster than modeled and loan growth remains positive. The setup supports another beat on net interest income.', tickers: ['JPM'], sentiment: 0.57, impact: 3, minutesAgo: 82, category: 'Earnings' },
  { source: 'ft', title: 'Oil slips as OPEC+ weighs a larger output increase', summary: 'Brent fell below a key technical level after reports that several producers favor accelerating the unwind of voluntary cuts. Energy equities may open under pressure.', tickers: ['XOM'], sentiment: -0.55, impact: 4, minutesAgo: 94, category: 'Commodities' },
  { source: 'investing', title: 'Meta ad checks point to resilient Q4 spending, says research firm', summary: 'Advertiser budgets are holding up better than feared, with Reels monetization improving and AI creative tools driving higher return on ad spend.', tickers: ['META'], sentiment: 0.52, impact: 3, minutesAgo: 108, category: 'Advertising' },
  { source: 'seekingalpha', title: 'Palantir valuation leaves little room for error, bears argue', summary: 'A widely read bear note questions whether commercial growth can sustain a triple-digit earnings multiple, warning that any deceleration could trigger a sharp de-rating.', tickers: ['PLTR'], sentiment: -0.66, impact: 3, minutesAgo: 121, category: 'Valuation' },
  { source: 'fool', title: 'Is Amazon\'s next leg higher already priced in?', summary: 'The retail and cloud businesses are both accelerating, but the stock has already re-rated. The debate now centers on AWS margin expansion into next year.', tickers: ['AMZN'], sentiment: 0.22, impact: 2, minutesAgo: 133, category: 'Analysis' },
  { source: 'reuters', title: 'Coinbase volumes jump as institutional crypto allocations rise', summary: 'Spot and derivatives volumes rose sharply month over month, with institutional clients accounting for a growing share of activity. Fee capture is improving.', tickers: ['COIN'], sentiment: 0.82, impact: 4, minutesAgo: 147, category: 'Crypto' },
  { source: 'yahoo', title: 'Netflix ad tier reaches 120M monthly users, early data shows', summary: 'The ad-supported plan is scaling faster than internal targets, giving Netflix a second growth engine as subscriber growth matures in developed markets.', tickers: ['NFLX'], sentiment: 0.63, impact: 3, minutesAgo: 158, category: 'Streaming' },
  { source: 'nyse', title: 'NYSE opens higher as chip stocks lead a broad rally', summary: 'Semiconductors outperformed at the open on heavy volume, with breadth improving across technology and industrials. The tape is constructive but concentrated.', tickers: ['NVDA', 'AMD', 'SPX'], sentiment: 0.61, impact: 3, minutesAgo: 172, category: 'Markets' },
  { source: 'bloomberg', title: 'Alphabet\'s cloud backlog hits a fresh high on AI demand', summary: 'Google Cloud bookings expanded faster than Azure and AWS on a constant-currency basis, according to people familiar with the numbers. Capex guidance is the key risk.', tickers: ['GOOGL'], sentiment: 0.73, impact: 4, minutesAgo: 188, category: 'Cloud' },
  { source: 'cnbc', title: 'VIX falls to its lowest since summer as volatility sellers return', summary: 'Implied volatility across major indices compressed again, historically a supportive backdrop for risk assets but one that leaves markets exposed to sharp reversals.', tickers: ['SPX'], sentiment: 0.31, impact: 2, minutesAgo: 204, category: 'Volatility' },
  { source: 'wsj', title: 'Treasury yields steady ahead of Friday\'s jobs report', summary: 'The 10-year yield held in a tight range as traders awaited payrolls data. A hot print would challenge the soft-landing narrative.', tickers: ['JPM', 'SPX'], sentiment: -0.08, impact: 3, minutesAgo: 219, category: 'Macro' },
  { source: 'marketwatch', title: 'Retail investors pour $4.2B into tech ETFs in one week', summary: 'Fund-flow data shows the largest weekly inflow since March, concentrated in mega-cap technology and semiconductor funds. Crowding risk is rising.', tickers: ['SPX', 'NVDA'], sentiment: 0.44, impact: 3, minutesAgo: 236, category: 'Flows' },
  { source: 'reuters', title: 'Exclusive: Nvidia in talks to expand AI chip supply with Samsung', summary: 'The potential agreement would add advanced packaging capacity and reduce single-supplier risk. Terms are still under discussion, according to three people familiar with the matter.', tickers: ['NVDA'], sentiment: 0.69, impact: 4, minutesAgo: 254, category: 'Supply chain' },
  { source: 'barrons', title: 'Apple upgrade cycle may be stronger than feared, analysts say', summary: 'Carrier promotions and AI-driven replacement demand could push upgrade rates above the prior cycle peak, supporting consensus revenue estimates.', tickers: ['AAPL'], sentiment: 0.49, impact: 3, minutesAgo: 271, category: 'Analyst' },
  { source: 'ft', title: 'Global fund managers rotate into quality growth', summary: 'The latest survey shows allocations shifting toward companies with strong free cash flow and low leverage, a tailwind for mega-cap software and healthcare.', tickers: ['MSFT', 'GOOGL', 'LLY'], sentiment: 0.34, impact: 2, minutesAgo: 289, category: 'Flows' },
  { source: 'seekingalpha', title: 'Tesla\'s margin reset is not priced in, warns analyst', summary: 'Price cuts and higher fixed costs are compressing automotive gross margins. The bear case sees earnings estimates falling another 15% over the next two quarters.', tickers: ['TSLA'], sentiment: -0.74, impact: 4, minutesAgo: 304, category: 'Valuation' },
  { source: 'investing', title: 'Goldman lifts S&P 500 target, citing earnings breadth', summary: 'The upgrade reflects stronger-than-expected earnings revisions outside mega-cap technology, which historically supports a higher multiple.', tickers: ['SPX'], sentiment: 0.64, impact: 3, minutesAgo: 322, category: 'Strategy' },
  { source: 'fool', title: 'Three reasons AMD could double by 2028', summary: 'The bull case rests on AI accelerator share gains, server CPU momentum and improving free cash flow. Execution risk remains the central debate.', tickers: ['AMD'], sentiment: 0.46, impact: 2, minutesAgo: 341, category: 'Analysis' },
  { source: 'cnbc', title: 'Oilfield services warning ripples through the energy sector', summary: 'A major supplier flagged softer North American activity, pressuring the broader energy complex. Integrated majors are holding up better than services names.', tickers: ['XOM'], sentiment: -0.42, impact: 3, minutesAgo: 358, category: 'Energy' },
  { source: 'yahoo', title: 'Meta faces fresh EU scrutiny over its ad model', summary: 'Regulators are examining whether the company\'s consent framework complies with privacy rules. Financial exposure is unclear, but headline risk is rising.', tickers: ['META'], sentiment: -0.38, impact: 3, minutesAgo: 376, category: 'Regulation' },
  { source: 'bloomberg', title: 'JPMorgan traders post their best quarter in three years', summary: 'Fixed-income and equities trading revenues beat expectations by a wide margin, offsetting softer investment-banking fees.', tickers: ['JPM'], sentiment: 0.55, impact: 3, minutesAgo: 392, category: 'Earnings' },
  { source: 'nyse', title: 'NYSE Arca launches new options suite for retail investors', summary: 'The exchange is expanding access to multi-leg options strategies with clearer risk disclosures. The move could support retail participation and volumes.', tickers: [], sentiment: 0.18, impact: 1, minutesAgo: 408, category: 'Exchange' },
  { source: 'reuters', title: 'Amazon AWS wins $3B government cloud deal', summary: 'The multi-year contract covers secure cloud infrastructure and AI services for several federal agencies. It adds visibility to AWS\'s forward backlog.', tickers: ['AMZN'], sentiment: 0.62, impact: 4, minutesAgo: 426, category: 'Cloud' },
  { source: 'wsj', title: 'Netflix content spend to peak next year, analysts say', summary: 'A slower content cycle could support free cash flow but may weigh on engagement growth. Management has signaled discipline over volume.', tickers: ['NFLX'], sentiment: -0.16, impact: 2, minutesAgo: 449, category: 'Streaming' },
  { source: 'barrons', title: 'Eli Lilly\'s next-gen obesity drug clears another hurdle', summary: 'Phase 3 data showed competitive weight loss with a cleaner tolerability profile, strengthening the company\'s position in a rapidly expanding market.', tickers: ['LLY'], sentiment: 0.78, impact: 5, minutesAgo: 468, category: 'Biotech' },
  { source: 'bloomberg', title: 'Coinbase expands institutional custody with new prime brokerage tools', summary: 'The rollout targets hedge funds that want unified custody, financing and execution. It should deepen wallet share with high-volume clients.', tickers: ['COIN'], sentiment: 0.58, impact: 3, minutesAgo: 486, category: 'Crypto' },
  { source: 'marketwatch', title: 'Semiconductor ETF sees largest weekly outflow since August', summary: 'Profit-taking hit chip funds even as fundamentals remain strong, a sign that positioning — not the business cycle — is driving near-term flows.', tickers: ['NVDA', 'AMD'], sentiment: -0.29, impact: 2, minutesAgo: 512, category: 'Flows' }
];

const ARTICLES = RAW_ARTICLES.map((a, i) => {
  const source = SOURCE_MAP[a.source];
  return {
    ...a,
    id: `art-${i}`,
    source,
    time: new Date(Date.now() - a.minutesAgo * 60000)
  };
});

/* ---------------- Sentiment + signal model ---------------- */
function sentimentFor(symbol) {
  const list = ARTICLES.filter(a => a.tickers.includes(symbol));
  if (!list.length) return { score: 0, articles: [], count: 0, bullish: 0, bearish: 0 };
  let weighted = 0, weight = 0;
  list.forEach(a => {
    const recency = Math.exp(-a.minutesAgo / 480);
    const w = (a.impact / 5) * (a.source.credibility / 100) * (0.35 + 0.65 * recency);
    weighted += a.sentiment * w;
    weight += w;
  });
  const score = weight ? weighted / weight : 0;
  return {
    score,
    articles: list.slice().sort((a, b) => (b.impact * 1000 - b.minutesAgo) - (a.impact * 1000 - a.minutesAgo)),
    count: list.length,
    bullish: list.filter(a => a.sentiment > 0.15).length,
    bearish: list.filter(a => a.sentiment < -0.15).length
  };
}

function buildSignal(stock) {
  const { series, ind, price, changePct } = stock;
  const last = ind.last;
  const prev5 = series[series.length - 6]?.c ?? series[0].c;
  const prev20 = series[series.length - 21]?.c ?? series[0].c;
  const chg5 = (price / prev5 - 1) * 100;
  const chg20 = (price / prev20 - 1) * 100;
  const dist20 = (price / last.sma20 - 1) * 100;
  const dist50 = (price / last.sma50 - 1) * 100;
  const dist200 = (price / last.sma200 - 1) * 100;
  const macdHistPct = (last.macdHist / price) * 100;
  const vol5 = series.slice(-5).reduce((a, b) => a + b.v, 0) / 5;
  const volRatio = vol5 / (last.volAvg || vol5);
  const bbPos = clamp(((price - last.bbLower) / Math.max(last.bbUpper - last.bbLower, 0.0001)) * 100, 0, 100);
  const atrPct = (last.atr / price) * 100;

  let tech = 50;
  tech += clamp(dist20 * 1.5, -15, 15);
  tech += clamp(dist50 * 0.9, -11, 11);
  tech += clamp(macdHistPct * 55, -13, 13);
  tech += (last.rsi - 50) * 0.25;
  if (last.rsi > 72) tech -= (last.rsi - 72) * 0.95;
  if (last.rsi < 28) tech += (28 - last.rsi) * 0.85;
  tech += clamp(chg20 * 0.55, -11, 11);
  tech += clamp((volRatio - 1) * 10 * (chg5 >= 0 ? 1 : -1), -6, 6);
  tech += price > last.sma200 ? 2.5 : -2.5;
  tech += (bbPos - 50) * 0.06;
  tech = clamp(tech, 3, 97);

  const sent = sentimentFor(stock.symbol);
  const sentScore = clamp(50 + sent.score * 46, 3, 97);
  const jitter = state.scanCount ? (rng(hashStr(`${stock.symbol}:scan:${state.scanCount}`))() - 0.5) * 3.2 : 0;
  let composite = tech * 0.64 + sentScore * 0.36;
  composite = clamp(50 + (composite - 50) * 1.28 + jitter, 2, 98);

  const action = composite >= 60 ? 'buy' : composite <= 40 ? 'sell' : 'hold';
  let confidence = Math.round(clamp(54 + Math.abs(composite - 50) * 1.5, 55, 97));
  if (action === 'hold') confidence = Math.min(confidence, 76);

  const stopPct = clamp(atrPct * 1.75, 2.1, 7.2);
  const stopDist = price * stopPct / 100;
  const rr = clamp(1.9 + (confidence - 60) / 100 * 1.25, 1.9, 3.1);
  const long = action === 'buy' || (action === 'hold' && composite >= 50);
  const entry = action === 'hold' ? price + (long ? 0.35 : -0.35) * last.atr : price;
  const stop = long ? entry - stopDist : entry + stopDist;
  const target = long ? entry + stopDist * rr : entry - stopDist * rr;

  const plan = {
    entry, stop, target, rr, stopDist, stopPct, atrPct,
    trigger: action === 'hold' ? entry : null,
    long,
    shares: Math.max(1, Math.floor(1000 / stopDist)),
    riskDollars: 1000
  };

  const sig = {
    ...stock, tech, sentScore, composite, action, confidence, plan,
    sentiment: sent, chg5, chg20, dist20, dist50, dist200, macdHistPct, volRatio, bbPos, atrPct,
    earningsIn: stock.earningsIn
  };
  sig.thesis = buildThesis(sig);
  sig.summary = buildSummary(sig);
  sig.horizon = confidence >= 86 ? '2–4 weeks' : confidence >= 74 ? '3–6 weeks' : '4–8 weeks';
  sig.risk = atrPct > 3.4 ? 'High' : atrPct > 2.1 ? 'Medium' : 'Low';
  return sig;
}

function buildThesis(sig) {
  const drivers = [];
  if (sig.dist20 > 0) drivers.push(`price is ${fmt(sig.dist20, 1)}% above its 20-day`);
  else drivers.push(`price is ${fmt(Math.abs(sig.dist20), 1)}% below its 20-day`);
  if (sig.ind.last.macdHist > 0) drivers.push('MACD momentum has rolled higher');
  else drivers.push('MACD momentum is still negative');
  if (sig.ind.last.rsi >= 45 && sig.ind.last.rsi <= 65) drivers.push(`RSI at ${fmt(sig.ind.last.rsi, 0)} leaves room`);
  else if (sig.ind.last.rsi > 70) drivers.push(`RSI at ${fmt(sig.ind.last.rsi, 0)} is stretched`);
  else if (sig.ind.last.rsi < 35) drivers.push(`RSI at ${fmt(sig.ind.last.rsi, 0)} is oversold`);

  const top = sig.sentiment.articles[0];
  const news = top
    ? `${top.source.short} coverage is ${top.sentiment > 0.15 ? 'constructive' : top.sentiment < -0.15 ? 'defensive' : 'mixed'}`
    : 'news flow is quiet';
  if (sig.action === 'buy') return `${drivers[0].charAt(0).toUpperCase() + drivers[0].slice(1)}, ${drivers[1]}, and ${news}. Trend and sentiment are aligned into the next catalyst.`;
  if (sig.action === 'sell') return `Relative strength is deteriorating — ${drivers[0]}, ${drivers[1]}, and ${news}. The setup favors trimming exposure or shorting into strength.`;
  return `Signals are mixed: ${drivers[0]}, but ${drivers[1]}. ${news.charAt(0).toUpperCase() + news.slice(1)}. Wait for a decisive close before committing capital.`;
}

function buildSummary(sig) {
  const top = sig.sentiment.articles[0];
  const trend = sig.price > sig.ind.last.sma20 && sig.price > sig.ind.last.sma50
    ? 'a constructive trend structure'
    : sig.price < sig.ind.last.sma20 && sig.price < sig.ind.last.sma50
      ? 'a deteriorating trend structure'
      : 'a conflicted trend structure';
  const rsiText = sig.ind.last.rsi > 70 ? 'overbought' : sig.ind.last.rsi < 30 ? 'oversold' : 'neutral';
  return `${sig.name} is printing ${trend}, with the stock ${sig.dist20 >= 0 ? 'above' : 'below'} its 20-day average by ${fmt(Math.abs(sig.dist20), 1)}%. RSI(14) sits at ${fmt(sig.ind.last.rsi, 1)} (${rsiText}) and the MACD histogram is ${sig.ind.last.macdHist >= 0 ? 'positive' : 'negative'}, while 20-day momentum reads ${signedPct(sig.chg20)}. ${top ? `The highest-impact headline in the current window is "${top.title}" from ${top.source.name}, which the model scores ${top.sentiment > 0.15 ? 'constructive' : top.sentiment < -0.15 ? 'negative' : 'neutral'} on a ${top.impact}/5 impact scale.` : 'No high-impact single-name headlines are in the current scan window.'} The resulting ${sig.action.toUpperCase()} signal carries ${sig.confidence}% conviction with a ${sig.risk.toLowerCase()}-risk profile.`;
}

let SIGNALS = [];
function rebuildSignals() {
  SIGNALS = STOCKS.map(buildSignal).sort((a, b) => b.confidence - a.confidence);
  SIGNALS.forEach(s => { STOCK_MAP[s.symbol].signal = s; });
}

/* ---------------- App state ---------------- */
const DEFAULT_WATCHLIST = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'AMD', 'PLTR'];

const state = {
  view: 'dashboard',
  scanCount: 0,
  lastScan: new Date(Date.now() - 7 * 60000),
  selectedSymbol: null,
  chartRange: '3M',
  signalFilter: 'all',
  signalSort: 'confidence',
  newsFilter: 'all',
  newsSource: 'all',
  newsSearch: '',
  searchQuery: '',
  watchlist: store('pulsetrade_watchlist_v1', DEFAULT_WATCHLIST).filter(s => STOCK_MAP[s]),
  portfolio: loadPortfolio(),
  ticket: { symbol: null, side: 'long', qty: 0 },
  confirmAction: null,
  scanning: false
};

function loadPortfolio() {
  const saved = store('pulsetrade_portfolio_v1', null);
  if (!saved || typeof saved.cash !== 'number') {
    return { cash: 100000, starting: 100000, positions: [], trades: [], realized: 0, created: Date.now() };
  }
  saved.positions = Array.isArray(saved.positions) ? saved.positions.filter(p => STOCK_MAP[p.symbol]) : [];
  saved.trades = Array.isArray(saved.trades) ? saved.trades : [];
  saved.starting = saved.starting || 100000;
  saved.realized = saved.realized || 0;
  return saved;
}
function savePortfolio() { save('pulsetrade_portfolio_v1', state.portfolio); }

function quoteFor(symbol) { return STOCK_MAP[symbol] || MARKET_MAP[symbol] || null; }
function positionMarketValue(p) {
  const q = quoteFor(p.symbol);
  const px = q ? q.price : p.entry;
  if (p.side === 'long') return p.qty * px;
  return p.qty * p.entry + (p.entry - px) * p.qty;
}
function positionPnl(p) {
  const q = quoteFor(p.symbol);
  const px = q ? q.price : p.entry;
  return p.side === 'long' ? (px - p.entry) * p.qty : (p.entry - px) * p.qty;
}
function portfolioEquity() {
  return state.portfolio.cash + state.portfolio.positions.reduce((sum, p) => sum + positionMarketValue(p), 0);
}
function portfolioInvested() {
  return state.portfolio.positions.reduce((sum, p) => sum + Math.abs(p.entry * p.qty), 0);
}
function portfolioDayPnl() {
  return state.portfolio.positions.reduce((sum, p) => {
    const q = quoteFor(p.symbol);
    if (!q) return sum;
    return sum + (p.side === 'long' ? (q.price - q.prevClose) : (q.prevClose - q.price)) * p.qty;
  }, 0);
}
function portfolioTotalPnl() { return portfolioEquity() - state.portfolio.starting; }

function mergePosition(symbol, side, qty, price) {
  const existing = state.portfolio.positions.find(p => p.symbol === symbol && p.side === side);
  if (existing) {
    const totalQty = existing.qty + qty;
    existing.entry = (existing.entry * existing.qty + price * qty) / totalQty;
    existing.qty = totalQty;
  } else {
    state.portfolio.positions.push({
      id: `pos-${Date.now()}-${Math.round(Math.random() * 9999)}`,
      symbol, side, qty, entry: price, openedAt: new Date().toISOString()
    });
  }
}

function executeTrade(symbol, side, qty, priceOverride) {
  const q = quoteFor(symbol);
  if (!q) return { ok: false, error: 'Unknown symbol.' };
  const price = priceOverride ?? q.price;
  const qtyInt = Math.floor(Number(qty));
  if (!Number.isFinite(qtyInt) || qtyInt <= 0) return { ok: false, error: 'Enter a whole share quantity greater than zero.' };
  const notional = qtyInt * price;
  if (notional > state.portfolio.cash) {
    return { ok: false, error: `Insufficient buying power. This order needs ${money(notional)} but only ${money(state.portfolio.cash)} is available.` };
  }
  state.portfolio.cash -= notional;
  mergePosition(symbol, side, qtyInt, price);
  state.portfolio.trades.unshift({
    id: `tr-${Date.now()}`, symbol, action: side === 'long' ? 'BUY' : 'SHORT', side,
    qty: qtyInt, price, total: notional, time: new Date().toISOString()
  });
  savePortfolio();
  return { ok: true, notional, price };
}

function closePosition(id) {
  const idx = state.portfolio.positions.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const p = state.portfolio.positions[idx];
  const q = quoteFor(p.symbol);
  const px = q ? q.price : p.entry;
  const pnl = positionPnl(p);
  const returned = p.side === 'long' ? p.qty * px : p.qty * p.entry + pnl;
  state.portfolio.cash += returned;
  state.portfolio.realized += pnl;
  state.portfolio.positions.splice(idx, 1);
  state.portfolio.trades.unshift({
    id: `tr-${Date.now()}`, symbol: p.symbol, action: p.side === 'long' ? 'SELL' : 'COVER', side: p.side,
    qty: p.qty, price: px, total: p.qty * px, pnl, time: new Date().toISOString()
  });
  savePortfolio();
  return { pnl, symbol: p.symbol, qty: p.qty, side: p.side };
}

function resetPortfolio() {
  state.portfolio = { cash: 100000, starting: 100000, positions: [], trades: [], realized: 0, created: Date.now() };
  savePortfolio();
  renderPortfolio();
  toast('Portfolio reset', 'Your paper account is back to $100,000 in cash.', 'success');
}

/* ---------------- Market session ---------------- */
function getMarketSession() {
  const now = new Date();
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit'
    }).formatToParts(now);
  } catch {
    return { open: false, label: 'US market', value: 'Closed' };
  }
  const get = type => parts.find(p => p.type === type)?.value || '';
  const weekday = get('weekday');
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const mins = hour * 60 + minute;
  if (weekday === 'Sat' || weekday === 'Sun') return { open: false, label: 'US market', value: 'Weekend' };
  if (mins >= 570 && mins < 960) return { open: true, label: 'US market', value: 'Open' };
  if (mins >= 240 && mins < 570) return { open: false, label: 'Pre-market', value: 'Opens 9:30' };
  if (mins >= 960 && mins < 1200) return { open: false, label: 'After hours', value: 'Closed' };
  return { open: false, label: 'US market', value: 'Closed' };
}

function updateMarketClock() {
  const session = getMarketSession();
  const el = $('#marketStatus');
  if (el) {
    el.classList.toggle('closed', !session.open);
    const label = $('.status-label', el);
    const value = $('.status-value', el);
    if (label) label.textContent = session.label;
    if (value) value.textContent = session.value;
  }
  const tickerTime = $('#tickerTime');
  if (tickerTime) {
    try {
      const et = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
      tickerTime.textContent = `${et} ET`;
    } catch { tickerTime.textContent = ''; }
  }
  const eyebrow = $('#dashEyebrow');
  if (eyebrow) {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    eyebrow.innerHTML = `<span class="eyebrow-line"></span> ${day} · ${session.open ? 'Live market intelligence' : session.label}`;
  }
}

/* ---------------- SVG chart helpers ---------------- */
let sparkSeq = 0;
function sparkline(values, opts = {}) {
  const { w = 120, h = 36, color = '#34e5ad', stroke = 1.6, fill = true, areaOpacity = 0.24 } = opts;
  const data = values.slice(-34);
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 2.5 - ((v - min) / span) * (h - 5)
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  const id = `spark${++sparkSeq}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="${areaOpacity}"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${fill ? `<polygon points="${area}" fill="url(#${id})"/>` : ''}
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2" fill="${color}"/>
  </svg>`;
}

function heroChartSVG(values, color) {
  const w = 620, h = 96;
  const data = values.slice(-70);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 8 - ((v - min) / span) * (h - 18)
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `hero${++sparkSeq}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="0" y1="${h - 12}" x2="${w}" y2="${h - 12}" stroke="rgba(148,170,198,.1)" stroke-width="1" stroke-dasharray="3 5"/>
    <polygon points="0,${h} ${line} ${w},${h}" fill="url(#${id})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3" fill="${color}"/>
    <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="7" fill="${color}" opacity=".18"/>
  </svg>`;
}

/* ---------------- Candlestick chart ---------------- */
const RANGE_DAYS = { '1W': 5, '1M': 22, '3M': 66, '6M': 132, '1Y': 252 };

function drawCandleChart(canvas, symbol, range) {
  const source = STOCK_MAP[symbol] || MARKET_MAP[symbol];
  if (!source) return;
  const days = RANGE_DAYS[range] || 66;
  const series = source.series.slice(-days);
  canvas._chart = {
    symbol, range, series,
    sma20: source.sma20.slice(-days),
    sma50: source.sma50.slice(-days),
    hover: null
  };
  if (!canvas.dataset.chartBound) {
    canvas.dataset.chartBound = '1';
    canvas.addEventListener('pointermove', (e) => {
      const c = canvas._chart;
      if (!c) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const padL = 8, padR = 54;
      const innerW = Math.max(1, rect.width - padL - padR);
      const slot = innerW / c.series.length;
      const i = clamp(Math.floor((x - padL) / slot), 0, c.series.length - 1);
      c.hover = { i, x, y };
      renderCandleChart(canvas);
    });
    canvas.addEventListener('pointerleave', () => {
      if (!canvas._chart) return;
      canvas._chart.hover = null;
      renderCandleChart(canvas);
      const tt = canvas.parentElement.querySelector('.chart-tooltip');
      if (tt) tt.style.display = 'none';
    });
  }
  renderCandleChart(canvas);
}

function renderCandleChart(canvas) {
  const c = canvas._chart;
  if (!c) return;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  if (w < 20 || h < 20) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { series, sma20, sma50 } = c;
  const n = series.length;
  const padL = 8, padR = 54, padT = 12, padB = 26;
  const volH = 42, gap = 12;
  const priceBottom = h - padB - volH - gap;
  const priceH = Math.max(30, priceBottom - padT);
  const innerW = Math.max(20, w - padL - padR);
  const slot = innerW / n;

  let min = Infinity, max = -Infinity;
  series.forEach(d => { min = Math.min(min, d.l); max = Math.max(max, d.h); });
  [...sma20, ...sma50].forEach(v => { if (v != null) { min = Math.min(min, v); max = Math.max(max, v); } });
  const pad = (max - min || 1) * 0.06;
  min -= pad; max += pad;
  const span = max - min || 1;
  const yFor = (v) => padT + (1 - (v - min) / span) * priceH;

  ctx.font = '9px "SFMono-Regular", Consolas, monospace';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (priceH * i) / 4;
    ctx.strokeStyle = 'rgba(148,170,198,.075)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + innerW, y); ctx.stroke();
    ctx.fillStyle = '#66758a';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(max - (span * i) / 4, 2), padL + innerW + 6, y);
  }

  // Volume
  const maxVol = Math.max(...series.map(d => d.v));
  const volBottom = h - padB;
  series.forEach((d, i) => {
    const x = padL + slot * (i + 0.5);
    const bh = (d.v / maxVol) * volH;
    ctx.fillStyle = d.c >= d.o ? 'rgba(52,229,173,.28)' : 'rgba(255,93,122,.26)';
    ctx.fillRect(x - Math.max(1, slot * 0.3), volBottom - bh, Math.max(1.5, slot * 0.6), bh);
  });
  ctx.strokeStyle = 'rgba(148,170,198,.1)';
  ctx.beginPath(); ctx.moveTo(padL, volBottom + 3); ctx.lineTo(padL + innerW, volBottom + 3); ctx.stroke();

  // Candles
  const bodyW = Math.max(1.5, Math.min(9, slot * 0.62));
  series.forEach((d, i) => {
    const x = padL + slot * (i + 0.5);
    const up = d.c >= d.o;
    const color = up ? '#34e5ad' : '#ff5d7a';
    const yO = yFor(d.o), yC = yFor(d.c), yH = yFor(d.h), yL = yFor(d.l);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
    ctx.fillStyle = up ? 'rgba(52,229,173,.85)' : 'rgba(255,93,122,.85)';
    const top = Math.min(yO, yC);
    const bh = Math.max(1, Math.abs(yC - yO));
    ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
  });

  // Moving averages
  const drawMA = (arr, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    let started = false;
    arr.forEach((v, i) => {
      if (v == null) { started = false; return; }
      const x = padL + slot * (i + 0.5);
      const y = yFor(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawMA(sma20, 'rgba(98,168,255,.8)');
  drawMA(sma50, 'rgba(255,200,87,.72)');

  // Last price marker
  const last = series[n - 1];
  const lastY = yFor(last.c);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = last.c >= last.o ? 'rgba(52,229,173,.35)' : 'rgba(255,93,122,.35)';
  ctx.beginPath(); ctx.moveTo(padL, lastY); ctx.lineTo(padL + innerW, lastY); ctx.stroke();
  ctx.setLineDash([]);
  const tagColor = last.c >= last.o ? '#34e5ad' : '#ff5d7a';
  const tagW = padR - 8, tagH = 15;
  ctx.fillStyle = tagColor;
  roundRect(ctx, padL + innerW + 3, lastY - tagH / 2, tagW, tagH, 3);
  ctx.fill();
  ctx.fillStyle = '#04130e';
  ctx.font = '600 8.5px "SFMono-Regular", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(fmt(last.c, 2), padL + innerW + 3 + tagW / 2, lastY + 0.5);

  // Date labels
  ctx.fillStyle = '#66758a';
  ctx.font = '9px "Inter", -apple-system, sans-serif';
  const labelIdx = [0, Math.floor((n - 1) / 3), Math.floor((n - 1) * 2 / 3), n - 1];
  labelIdx.forEach((idx, k) => {
    const x = padL + slot * (idx + 0.5);
    ctx.textAlign = k === 0 ? 'left' : k === labelIdx.length - 1 ? 'right' : 'center';
    ctx.fillText(fmtDate(series[idx].date), x, h - 8);
  });

  // Crosshair
  const tt = canvas.parentElement.querySelector('.chart-tooltip');
  if (c.hover) {
    const { i, x, y } = c.hover;
    const cx = padL + slot * (i + 0.5);
    const cy = clamp(y, padT, priceBottom);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(233,238,247,.22)';
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, volBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, cy); ctx.lineTo(padL + innerW, cy); ctx.stroke();
    ctx.setLineDash([]);
    const d = series[i];
    const chg = i > 0 ? (d.c / series[i - 1].c - 1) * 100 : (d.c / d.o - 1) * 100;
    if (tt) {
      tt.innerHTML = `<div class="tt-date">${fmtDateLong(d.date)}</div>
        <div class="tt-row"><span>Open</span><b>${fmt(d.o)}</b></div>
        <div class="tt-row"><span>High</span><b>${fmt(d.h)}</b></div>
        <div class="tt-row"><span>Low</span><b>${fmt(d.l)}</b></div>
        <div class="tt-row"><span>Close</span><b>${fmt(d.c)}</b></div>
        <div class="tt-row"><span>Volume</span><b>${compact(d.v)}</b></div>
        <div class="tt-row"><span>Change</span><b style="color:${chg >= 0 ? '#34e5ad' : '#ff5d7a'}">${signedPct(chg)}</b></div>`;
      tt.style.display = 'block';
      const tw = tt.offsetWidth || 132;
      const th = tt.offsetHeight || 112;
      let left = x + 14;
      if (left + tw > w - 4) left = x - tw - 14;
      let top = y - th / 2;
      top = clamp(top, 4, h - th - 4);
      tt.style.left = `${Math.max(4, left)}px`;
      tt.style.top = `${top}px`;
    }
  } else if (tt) {
    tt.style.display = 'none';
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- Report helpers ---------------- */
function spxMomentum() {
  const s = SPX.series;
  return (s[s.length - 1].c / s[s.length - 21].c - 1) * 100;
}

function technicalChecks(sig) {
  const rsi = sig.ind.last.rsi;
  const rel = sig.chg20 - spxMomentum();
  return [
    {
      label: 'Trend', value: `${signedPct(sig.dist20, 1)} vs 20D`,
      pct: clamp(50 + sig.dist20 * 4, 4, 96),
      status: sig.dist20 > 1 && sig.dist50 > 0 ? 'bull' : sig.dist20 < -1 ? 'bear' : 'neutral'
    },
    {
      label: 'Momentum', value: `${signedPct(sig.chg20, 1)} 20D`,
      pct: clamp(50 + sig.chg20 * 2.4, 4, 96),
      status: sig.chg20 > 1 ? 'bull' : sig.chg20 < -1 ? 'bear' : 'neutral'
    },
    {
      label: 'RSI (14)', value: fmt(rsi, 1),
      pct: clamp(rsi, 3, 97),
      status: rsi > 70 ? 'bear' : rsi < 30 ? 'bull' : rsi >= 50 ? 'bull' : 'neutral'
    },
    {
      label: 'MACD', value: sig.ind.last.macdHist >= 0 ? 'Positive' : 'Negative',
      pct: clamp(50 + sig.macdHistPct * 140, 4, 96),
      status: sig.ind.last.macdHist > 0 ? 'bull' : 'bear'
    },
    {
      label: 'Volume', value: `${fmt(sig.volRatio * 100, 0)}% avg`,
      pct: clamp(sig.volRatio * 50, 6, 96),
      status: sig.volRatio > 1.12 ? 'bull' : sig.volRatio < 0.85 ? 'bear' : 'neutral'
    },
    {
      label: 'Rel. strength', value: `${signedPct(rel, 1)} vs SPX`,
      pct: clamp(50 + rel * 2.2, 4, 96),
      status: rel > 1 ? 'bull' : rel < -1 ? 'bear' : 'neutral'
    }
  ];
}

function scenarioData(sig) {
  const bullProb = clamp(Math.round(sig.confidence * 0.48), 24, 54);
  const bearProb = clamp(Math.round((100 - sig.confidence) * 0.42), 12, 28);
  const baseProb = 100 - bullProb - bearProb;
  if (sig.plan.long) {
    return [
      { name: 'Bull case', color: '#34e5ad', price: sig.plan.target, prob: bullProb, note: 'Target hit' },
      { name: 'Base case', color: '#62a8ff', price: sig.price * (1 + sig.plan.stopPct / 100 * 0.28), prob: baseProb, note: 'Grind higher' },
      { name: 'Bear case', color: '#ff5d7a', price: sig.plan.stop, prob: bearProb, note: 'Stop triggered' }
    ];
  }
  return [
    { name: 'Bull case', color: '#34e5ad', price: sig.plan.stop, prob: bearProb, note: 'Stop triggered' },
    { name: 'Base case', color: '#62a8ff', price: sig.price * (1 - sig.plan.stopPct / 100 * 0.28), prob: baseProb, note: 'Drift lower' },
    { name: 'Bear case', color: '#ff5d7a', price: sig.plan.target, prob: bullProb, note: 'Target hit' }
  ];
}

function riskItems(sig) {
  const items = [];
  items.push(`A ${fmt(sig.atrPct, 1)}% average true range means normal daily noise can test the ${money(sig.plan.stop)} invalidation level. Keep the full stop loss below 1% of account equity.`);
  items.push(`The next earnings report is roughly ${sig.earningsIn} days away. A surprise gap could move the stock beyond the stop before it can be executed.`);
  if (sig.ind.last.rsi > 70) items.push(`RSI at ${fmt(sig.ind.last.rsi, 0)} is stretched. Momentum can stay overbought, but the risk of a mean-reversion snapback is elevated.`);
  if (sig.ind.last.rsi < 32) items.push(`RSI at ${fmt(sig.ind.last.rsi, 0)} is oversold. Falling knives can stay cheap longer than a stop allows; wait for confirmation.`);
  if (sig.action === 'sell') items.push('Short positions carry unlimited theoretical loss. This plan is only valid while price stays below the stop on a daily closing basis.');
  if (sig.sentiment.count < 2) items.push('News coverage is thin, so sentiment receives a smaller weight in the composite score. Price action is the dominant driver.');
  items.push('Macro risk: a hotter-than-expected inflation print or a hawkish shift in rate expectations could compress multiples across high-growth names.');
  return items.slice(0, 4);
}

function sizingFor(sig, account, riskPct) {
  const riskDollars = account * riskPct / 100;
  const qty = Math.max(0, Math.floor(riskDollars / Math.max(0.01, sig.plan.stopDist)));
  const notional = qty * sig.price;
  return { qty, notional, riskDollars, pctAccount: account ? notional / account * 100 : 0 };
}

/* ---------------- Report modal ---------------- */
function openSignal(symbol) {
  const sig = STOCK_MAP[symbol]?.signal;
  if (!sig) return;
  state.selectedSymbol = symbol;
  state.chartRange = '3M';
  const checks = technicalChecks(sig);
  const scenarios = scenarioData(sig);
  const risks = riskItems(sig);
  const topArticles = sig.sentiment.articles.slice(0, 3);
  const uniqueSources = [...new Map(sig.sentiment.articles.map(a => [a.source.id, a.source])).values()];
  const sizing = sizingFor(sig, 100000, 1);
  const accountDefault = Math.round(portfolioEquity() / 1000) * 1000;

  const modal = $('#detailModal');
  modal.innerHTML = `<div class="modal modal-report">
    <div class="modal-head">
      <div class="report-id">
        <span class="report-logo" style="${logoStyle(sig.symbol)}">${logoText(sig.symbol)}</span>
        <div>
          <div class="report-sym">${sig.symbol} ${actionPill(sig)}</div>
          <div class="report-name">${sig.name} · ${sig.sector} · ${sig.horizon} horizon</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="report-price-block">
          <div class="report-price">${money(sig.price)}</div>
          <div class="report-chg ${sig.changePct >= 0 ? 'up' : 'down'}">${signedPct(sig.changePct)} today</div>
        </div>
        <div class="conf-ring sm ${sig.action === 'buy' ? '' : sig.action}" style="--p:${sig.confidence}"><div class="conf-in"><strong>${sig.confidence}</strong><span>CONVICTION</span></div></div>
        <button class="modal-close" data-action="close-modal" data-modal="detailModal" aria-label="Close report">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <div class="modal-body">
      <div class="report-meta-strip">
        <div class="report-meta-item"><span>AI action</span><strong>${actionPill(sig, true)}</strong></div>
        <div class="report-meta-item"><span>Conviction</span><strong>${sig.confidence}% · ${sig.risk} risk</strong></div>
        <div class="report-meta-item"><span>Trade horizon</span><strong>${sig.horizon}</strong></div>
        <div class="report-meta-item"><span>Next catalyst</span><strong>Earnings in ${sig.earningsIn}d</strong></div>
      </div>

      <div class="report-section">
        <div class="section-title">Price action &amp; indicators</div>
        <div class="chart-card">
          <div class="chart-toolbar">
            <div class="chart-ranges">
              ${Object.keys(RANGE_DAYS).map(r => `<button class="chart-range ${state.chartRange === r ? 'active' : ''}" data-action="chart-range" data-range="${r}">${r}</button>`).join('')}
            </div>
            <div class="chart-legend">
              <span><i style="background:#62a8ff"></i>SMA 20</span>
              <span><i style="background:#ffc857"></i>SMA 50</span>
              <span><i style="background:rgba(148,170,198,.4)"></i>Volume</span>
            </div>
          </div>
          <div class="chart-canvas-wrap">
            <canvas id="reportChart" aria-label="${sig.symbol} candlestick chart"></canvas>
            <div class="chart-tooltip"></div>
          </div>
          <div class="chart-note">Simulated OHLCV · hover for detail · adjusted for the demo feed</div>
        </div>
      </div>

      <div class="report-section">
        <div class="section-title">AI executive summary</div>
        <p class="report-lead">${sig.summary}</p>
      </div>

      <div class="report-section report-grid-2">
        <div class="report-box">
          <div class="report-box-title">Trade plan</div>
          <div class="trade-plan-grid">
            <div class="plan-cell entry"><span>${sig.action === 'hold' ? 'Trigger' : sig.plan.long ? 'Entry (long)' : 'Entry (short)'}</span><strong>${money(sig.plan.entry)}</strong></div>
            <div class="plan-cell target"><span>Target</span><strong>${money(sig.plan.target)}</strong></div>
            <div class="plan-cell stop"><span>Stop loss</span><strong>${money(sig.plan.stop)}</strong></div>
            <div class="plan-cell rr"><span>Risk / reward</span><strong>${fmt(sig.plan.rr, 2)}×</strong></div>
          </div>
          <p class="plan-note">Suggested stop distance is <strong>${fmt(sig.plan.stopPct, 1)}%</strong> (${money(sig.plan.stopDist)} per share), derived from 1.75× ATR. Target assumes volatility stays near the current regime. Invalidation is a daily close beyond the stop.</p>
        </div>
        <div class="report-box">
          <div class="report-box-title">Position sizing calculator</div>
          <div class="sizing-inputs">
            <label>Account value <span class="sizing-field"><i>$</i><input id="sizingAccount" type="number" min="1000" step="1000" value="${accountDefault || 100000}" aria-label="Account value"></span></label>
            <label>Risk per trade <span class="sizing-field"><input id="sizingRisk" type="number" min="0.1" max="5" step="0.1" value="1" aria-label="Risk percent"><i>%</i></span></label>
          </div>
          <div class="sizing-output">
            <div><span>Risk budget</span><strong id="sizingBudget">${money(sizing.riskDollars)}</strong></div>
            <div><span>Suggested size</span><strong id="sizingQty">${sizing.qty} sh</strong></div>
            <div><span>Notional</span><strong id="sizingNotional">${money(sizing.notional, 0)}</strong></div>
            <div><span>% of account</span><strong id="sizingPct">${fmt(sizing.pctAccount, 1)}%</strong></div>
          </div>
          <p class="plan-note" id="sizingHint">At ${money(100000, 0)} with 1.0% risk, a full stop costs about ${money(sizing.riskDollars, 0)}. This keeps one bad trade from damaging the portfolio.</p>
        </div>
      </div>

      <div class="report-section report-grid-2">
        <div class="report-box">
          <div class="report-box-title">Technical scorecard</div>
          <div class="tech-list">
            ${checks.map(c => `<div class="tech-row">
              <span class="tech-ind">${c.label}</span>
              <span class="tech-meter"><span class="${c.status === 'bear' ? 'neg' : c.status === 'neutral' ? 'mid' : ''}" style="width:${c.pct}%"></span></span>
              <span class="tech-val">${c.value}</span>
              <span class="tech-status ${c.status}">${c.status === 'bull' ? 'Bull' : c.status === 'bear' ? 'Bear' : 'Neut'}</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="report-box">
          <div class="report-box-title">Catalysts &amp; news read</div>
          <div class="catalyst-list">
            ${topArticles.length ? topArticles.map(a => `<div class="catalyst-item">
              <span class="catalyst-dot ${a.sentiment >= 0 ? 'pos' : 'neg'}"></span>
              <div class="catalyst-body">
                <div class="catalyst-title">${a.title}</div>
                <div class="catalyst-meta">${a.source.name} · ${relativeTime(a.time)} · ${sentLabel(a.sentiment)} · impact ${a.impact}/5</div>
              </div>
            </div>`).join('') : `<div class="catalyst-item"><span class="catalyst-dot pos"></span><div class="catalyst-body"><div class="catalyst-title">No high-impact single-name headlines in the current window.</div><div class="catalyst-meta">Price and volume action are the dominant drivers.</div></div></div>`}
          </div>
        </div>
      </div>

      <div class="report-section report-grid-2">
        <div class="report-box">
          <div class="report-box-title">Risk factors</div>
          <div class="risk-list">
            ${risks.map(r => `<div class="risk-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${r}</span></div>`).join('')}
          </div>
        </div>
        <div class="report-box">
          <div class="report-box-title">Scenario analysis</div>
          <table class="scenario-table">
            <thead><tr><th>Scenario</th><th>Probability</th><th>Price</th><th>Return</th></tr></thead>
            <tbody>
              ${scenarios.map(s => {
                const ret = (s.price / sig.price - 1) * 100;
                return `<tr>
                  <td class="scenario-name"><span class="dot" style="background:${s.color}"></span>${s.name}</td>
                  <td><span class="scenario-prob"><span class="prob-bar"><span style="width:${s.prob}%;background:${s.color}"></span></span>${s.prob}%</span></td>
                  <td>${money(s.price)}</td>
                  <td class="${ret >= 0 ? 'up' : 'down'}">${signedPct(ret)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <p class="plan-note">Probabilities are model-implied, not guarantees. They blend technical regime, news sentiment and volatility.</p>
        </div>
      </div>

      <div class="report-section">
        <div class="section-title">Sources analyzed</div>
        <div class="sources-row">
          ${uniqueSources.length ? uniqueSources.map(s => `<span class="source-pill"><i style="background:${s.color}"></i>${s.name} · ${s.credibility}% trust</span>`).join('') : '<span class="source-pill">Price &amp; volume feed · 100% trust</span>'}
          <span class="source-pill"><i style="background:#8fa3bd"></i>Technical feed · 14 factors</span>
        </div>
      </div>

      <div class="report-footer">
        <p class="report-disclaimer">Generated by the Pulse-4 ensemble from simulated price data and synthetic headlines. This is an educational research tool, not investment advice. Past performance does not guarantee future results.</p>
        <div class="report-actions">
          <button class="btn btn-ghost" data-action="toggle-watch" data-symbol="${sig.symbol}">${state.watchlist.includes(sig.symbol) ? '★ Watching' : '☆ Watchlist'}</button>
          <button class="btn ${sig.action === 'sell' ? 'btn-danger' : 'btn-primary'}" data-action="open-ticket" data-symbol="${sig.symbol}" data-side="${sig.plan.long ? 'long' : 'short'}">${sig.action === 'sell' ? 'Short this idea' : sig.action === 'hold' ? 'Paper trade' : 'Buy this idea'}</button>
        </div>
      </div>
    </div>
  </div>`;
  openModal('detailModal');
  requestAnimationFrame(() => {
    const canvas = $('#reportChart');
    if (canvas) drawCandleChart(canvas, symbol, state.chartRange);
  });
}

function updateSizing() {
  const accountEl = $('#sizingAccount');
  const riskEl = $('#sizingRisk');
  if (!accountEl || !riskEl) return;
  const sig = STOCK_MAP[state.selectedSymbol]?.signal;
  if (!sig) return;
  const account = Math.max(1000, Number(accountEl.value) || 100000);
  const risk = clamp(Number(riskEl.value) || 1, 0.1, 5);
  const s = sizingFor(sig, account, risk);
  $('#sizingBudget').textContent = money(s.riskDollars);
  $('#sizingQty').textContent = `${s.qty} sh`;
  $('#sizingNotional').textContent = money(s.notional, 0);
  $('#sizingPct').textContent = `${fmt(s.pctAccount, 1)}%`;
  const hint = $('#sizingHint');
  if (hint) hint.textContent = `At ${money(account, 0)} with ${fmt(risk, 1)}% risk, a full stop costs about ${money(s.riskDollars, 0)}. This keeps one bad trade from damaging the portfolio.`;
}

function equityChartSVG(values) {
  const w = 900, h = 230;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || 1) * 0.15;
  const lo = min - pad, hi = max + pad;
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    16 + (1 - (v - lo) / span) * (h - 40)
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `eq${++sparkSeq}`;
  const positive = values[values.length - 1] >= values[0];
  const color = positive ? '#34e5ad' : '#ff5d7a';
  const grid = [0.25, 0.5, 0.75].map(t => `<line x1="0" y1="${(16 + t * (h - 40)).toFixed(1)}" x2="${w}" y2="${(16 + t * (h - 40)).toFixed(1)}" stroke="rgba(148,170,198,.08)" stroke-width="1"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <polygon points="0,${h} ${line} ${w},${h}" fill="url(#${id})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3.5" fill="${color}"/>
  </svg>`;
}

/* ---------------- Shared render helpers ---------------- */
function logoText(symbol) { return symbol.length > 4 ? symbol.slice(0, 3) : symbol; }
function logoStyle(symbol) {
  const s = STOCK_MAP[symbol];
  const color = s ? (SECTOR_COLORS[s.sector] || '#8fa3bd') : '#8fa3bd';
  return `color:${color};background:${color}14;border-color:${color}2e`;
}
function sourceLogo(source, cls = 'feed-source') {
  return `<span class="${cls}" style="color:${source.color};background:${source.color}14;border-color:${source.color}2e">${source.short}</span>`;
}
function actionLabel(sig) {
  if (sig.action === 'buy') return sig.confidence >= 86 ? 'Strong buy' : 'Buy';
  if (sig.action === 'sell') return sig.confidence >= 86 ? 'Strong sell' : 'Sell';
  return 'Hold';
}
function actionPill(sig, ghost = false) {
  const cls = sig.action;
  return `<span class="action-pill ${ghost ? 'ghost ' : ''}${cls}">${actionLabel(sig)}</span>`;
}
function sentClass(score) { return score > 0.15 ? 'pos' : score < -0.15 ? 'neg' : 'mid'; }
function sentLabel(score) { return score > 0.15 ? 'Bullish' : score < -0.15 ? 'Bearish' : 'Neutral'; }
function impactBars(impact, sentiment) {
  return `<span class="impact-bars ${sentiment < -0.15 ? 'neg' : ''}" title="Impact ${impact}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= impact ? 'on' : ''}" style="height:${3 + i * 1.5}px"></i>`).join('')}</span>`;
}
function watchStar(symbol) {
  const on = state.watchlist.includes(symbol);
  return `<button class="watch-star ${on ? 'on' : ''}" data-action="toggle-watch" data-symbol="${symbol}" aria-label="${on ? 'Remove' : 'Add'} ${symbol} ${on ? 'from' : 'to'} watchlist" title="${on ? 'Remove from watchlist' : 'Add to watchlist'}">
    <svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.6Z" stroke-linejoin="round"/></svg>
  </button>`;
}

/* ---------------- Render: ticker ---------------- */
function renderTicker() {
  const track = $('#tickerTrack');
  if (!track) return;
  const items = [...MARKET, ...STOCKS.slice(0, 10)];
  const html = items.map(s => {
    const up = s.changePct >= 0;
    const cls = up ? 'up' : 'down';
    return `<div class="ticker-item">
      <span class="ticker-sym">${s.symbol}</span>
      <span class="ticker-price">${s.type === 'index' ? fmt(s.price, 2) : money(s.price)}</span>
      <span class="ticker-chg ${cls}">${up ? '▲' : '▼'} ${fmt(Math.abs(s.changePct), 2)}%</span>
    </div>`;
  }).join('');
  track.innerHTML = html + html;
}

/* ---------------- Render: dashboard ---------------- */
function renderMarketStrip() {
  const el = $('#marketStrip');
  if (!el) return;
  el.innerHTML = MARKET.map(m => {
    const up = m.changePct >= 0;
    const color = m.symbol === 'VIX' ? (up ? '#ff5d7a' : '#34e5ad') : (up ? '#34e5ad' : '#ff5d7a');
    return `<div class="market-card">
      <div class="market-top"><span class="market-name">${m.name}</span><span class="market-sym">${m.symbol}</span></div>
      <div class="market-bottom">
        <div>
          <div class="market-val">${fmt(m.price, m.symbol === 'VIX' ? 2 : 2)}</div>
          <div class="market-chg ${up ? 'up' : 'down'}">${signedPct(m.changePct)}</div>
        </div>
        <div class="market-spark">${sparkline(m.closes, { w: 82, h: 30, color })}</div>
      </div>
    </div>`;
  }).join('');
}

function renderHero() {
  const el = $('#heroCard');
  if (!el) return;
  const buys = SIGNALS.filter(s => s.action === 'buy');
  const sig = (buys.length ? buys : SIGNALS).slice().sort((a, b) => b.confidence - a.confidence)[0];
  if (!sig) return;
  const up = sig.changePct >= 0;
  const color = sig.action === 'sell' ? '#ff5d7a' : sig.action === 'hold' ? '#ffc857' : '#34e5ad';
  el.innerHTML = `<div class="hero-inner">
    <div class="hero-eyebrow">
      <span class="hero-eyebrow-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3Z" stroke-linejoin="round"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" stroke-linejoin="round"/></svg>
        Top AI conviction
      </span>
      <span class="hero-updated">Scan #${state.scanCount + 1} · ${relativeTime(state.lastScan)}</span>
    </div>
    <div class="hero-main">
      <div>
        <div class="hero-id">
          <span class="ticker-logo" style="${logoStyle(sig.symbol)}">${logoText(sig.symbol)}</span>
          <div>
            <div class="hero-sym">${sig.symbol}</div>
            <div class="hero-name">${sig.name}<span class="sector-tag">${sig.sector}</span></div>
          </div>
        </div>
        <div class="hero-price-row">
          <span class="hero-price">${money(sig.price)}</span>
          <span class="hero-change ${up ? 'up' : 'down'}">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${up ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'}" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${signedPct(sig.changePct)}
          </span>
        </div>
        <p class="hero-thesis">${sig.thesis}</p>
        <div class="hero-tags">
          <span class="hero-tag">RSI ${fmt(sig.ind.last.rsi, 0)}</span>
          <span class="hero-tag">Sentiment ${sig.sentiment.score >= 0 ? '+' : ''}${fmt(sig.sentiment.score, 2)}</span>
          <span class="hero-tag">${sig.sentiment.count} headlines</span>
          <span class="hero-tag">${sig.risk} risk</span>
        </div>
      </div>
      <div class="hero-right">
        ${actionPill(sig)}
        <div class="conf-ring ${sig.action === 'buy' ? '' : sig.action}" style="--p:${sig.confidence}">
          <div class="conf-in"><strong>${sig.confidence}</strong><span>CONVICTION</span></div>
        </div>
      </div>
    </div>
    <div class="hero-chart">${heroChartSVG(sig.closes, color)}</div>
    <div class="hero-bottom">
      <div class="hero-stats">
        <div class="hero-stat"><span>Entry</span><strong>${money(sig.plan.entry)}</strong></div>
        <div class="hero-stat"><span>Target</span><strong class="mint">${money(sig.plan.target)}</strong></div>
        <div class="hero-stat"><span>Stop</span><strong class="red">${money(sig.plan.stop)}</strong></div>
        <div class="hero-stat"><span>R : R</span><strong>${fmt(sig.plan.rr, 1)}×</strong></div>
      </div>
      <div class="hero-actions">
        <button class="btn btn-ghost" data-action="open-signal" data-symbol="${sig.symbol}">Full AI report</button>
        <button class="btn btn-primary" data-action="open-ticket" data-symbol="${sig.symbol}" data-side="${sig.action === 'sell' ? 'short' : 'long'}">Trade now</button>
      </div>
    </div>
  </div>`;
}

function renderScanCard() {
  const el = $('#scanCard');
  if (!el) return;
  const avg = Math.round(SIGNALS.reduce((a, s) => a + s.confidence, 0) / SIGNALS.length);
  const buyCount = SIGNALS.filter(s => s.action === 'buy').length;
  el.innerHTML = `<div class="scan-inner">
    <div class="scan-head">
      <div>
        <div class="panel-title">AI scan engine <span class="live-chip"><span class="live-dot"></span>Live</span></div>
        <div class="panel-sub">Multi-source NLP + technical ensemble</div>
      </div>
      <button class="icon-btn small" data-action="run-scan" aria-label="Run a new scan" title="Run a new scan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="scan-radar">
      <div class="radar-sweep"></div>
      <div class="radar-core"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 17l4-5 3 2 4-6 5 4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 21h16" stroke-linecap="round"/></svg></div>
    </div>
    <div class="scan-grid">
      <div class="scan-stat"><span>Sources</span><strong>12<em>/12</em></strong></div>
      <div class="scan-stat"><span>Headlines</span><strong>${ARTICLES.length}</strong></div>
      <div class="scan-stat"><span>Buy signals</span><strong class="up">${buyCount}</strong></div>
      <div class="scan-stat"><span>Avg conviction</span><strong>${avg}%</strong></div>
    </div>
    <div class="scan-footer">
      <span class="scan-last">Last scan <strong>${relativeTime(state.lastScan)}</strong> · ${STOCKS.length} tickers</span>
      <button class="btn btn-soft btn-sm" data-action="run-scan">Rescan</button>
    </div>
  </div>`;
}

function renderIdeas() {
  const el = $('#ideasGrid');
  if (!el) return;
  const buys = SIGNALS.filter(s => s.action === 'buy').sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  const sells = SIGNALS.filter(s => s.action === 'sell').sort((a, b) => b.confidence - a.confidence).slice(0, 1);
  const chosen = [...buys, ...sells];
  const remaining = SIGNALS.filter(s => !chosen.includes(s)).sort((a, b) => b.confidence - a.confidence);
  while (chosen.length < 6 && remaining.length) chosen.push(remaining.shift());
  const ideas = chosen.slice(0, 6);
  $('#ideaCount').textContent = ideas.length;
  el.innerHTML = ideas.map(sig => {
    const up = sig.changePct >= 0;
    return `<div class="idea-card ${sig.action}" role="button" tabindex="0" data-action="open-signal" data-symbol="${sig.symbol}" aria-label="Open ${sig.symbol} AI report">
      <div class="idea-top">
        <div class="idea-id">
          <span class="idea-logo" style="${logoStyle(sig.symbol)}">${logoText(sig.symbol)}</span>
          <div><div class="idea-sym">${sig.symbol}</div><div class="idea-name">${sig.name}</div></div>
        </div>
        <div class="idea-right">
          <div class="idea-price">${money(sig.price)}</div>
          <div class="idea-chg ${up ? 'up' : 'down'}">${signedPct(sig.changePct)}</div>
        </div>
      </div>
      <p class="idea-thesis">${sig.thesis}</p>
      <div class="idea-foot">
        ${actionPill(sig, true)}
        <div class="idea-conf">
          <span class="conf-bar"><span style="width:${sig.confidence}%"></span></span>
          <em>${sig.confidence}%</em>
        </div>
        <span class="idea-rr">R:R <strong>${fmt(sig.plan.rr, 1)}</strong></span>
        <span class="idea-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
    </div>`;
  }).join('');
}

const HEAT_SECTORS = ['Technology', 'Semiconductors', 'Communication', 'Consumer', 'Financials', 'Energy', 'Healthcare', 'Industrials', 'Utilities', 'Materials', 'Real Estate'];
function sectorPerformance() {
  const map = {};
  STOCKS.forEach(s => {
    if (!map[s.sector]) map[s.sector] = [];
    map[s.sector].push(s.changePct);
  });
  return HEAT_SECTORS.map(name => {
    let change;
    if (map[name]?.length) change = map[name].reduce((a, b) => a + b, 0) / map[name].length;
    else {
      const r = rng(hashStr(`sector:${name}`));
      change = (r() - 0.46) * 2.6;
    }
    return { name, change, count: map[name]?.length || 0 };
  });
}
function renderHeatmap() {
  const el = $('#sectorHeatmap');
  if (!el) return;
  const sectors = sectorPerformance().sort((a, b) => b.change - a.change);
  el.innerHTML = sectors.map(s => {
    const pos = s.change >= 0;
    const alpha = clamp(0.055 + Math.abs(s.change) / 2.4 * 0.24, 0.055, 0.3);
    const color = pos ? '52,229,173' : '255,93,122';
    return `<div class="heat-tile" style="background:rgba(${color},${alpha});border-color:rgba(${color},.16)">
      <span class="heat-name">${s.name}</span>
      <span class="heat-val ${pos ? 'up' : 'down'}">${signedPct(s.change, 1)}</span>
    </div>`;
  }).join('');
}

function articleScore(a) { return a.impact * 1200 - a.minutesAgo; }
function renderFeed() {
  const el = $('#feedList');
  if (!el) return;
  const list = ARTICLES.slice().sort((a, b) => articleScore(b) - articleScore(a)).slice(0, 6);
  el.innerHTML = list.map(a => {
    const sc = sentClass(a.sentiment);
    return `<button class="feed-item" data-action="open-article" data-article="${a.id}">
      ${sourceLogo(a.source)}
      <div class="feed-body">
        <div class="feed-title">${a.title}</div>
        <div class="feed-meta">
          <span>${a.source.short}</span><span class="sep"></span>
          <span>${relativeTime(a.time)}</span><span class="sep"></span>
          <span>${a.category}</span>
        </div>
      </div>
      <div class="feed-right">
        <span class="sent-pill ${sc}">${sentLabel(a.sentiment)}</span>
        ${impactBars(a.impact, a.sentiment)}
      </div>
    </button>`;
  }).join('');
}

function renderWatchlist() {
  const el = $('#watchTable');
  if (!el) return;
  const rows = state.watchlist.map(sym => STOCK_MAP[sym]).filter(Boolean);
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state" style="padding:30px 16px"><strong>No tickers yet</strong><p>Add names from AI Signals to track them here.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="watch-head"><span>Ticker</span><span>Price</span><span>Change</span><span>AI score</span><span></span></div>` +
    rows.map(s => {
      const sig = s.signal;
      const up = s.changePct >= 0;
      const score = sig ? Math.round(sig.composite) : 50;
      const barColor = sig?.action === 'sell' ? '#ff5d7a' : sig?.action === 'hold' ? '#ffc857' : '#34e5ad';
      return `<div class="watch-row" data-action="open-signal" data-symbol="${s.symbol}" role="button" tabindex="0">
        <div class="watch-id">
          <span class="watch-logo" style="${logoStyle(s.symbol)}">${logoText(s.symbol)}</span>
          <div><div class="watch-sym">${s.symbol}</div><div class="watch-name">${s.name}</div></div>
        </div>
        <div class="watch-price">${money(s.price)}</div>
        <div class="watch-chg ${up ? 'up' : 'down'}">${signedPct(s.changePct)}</div>
        <div class="watch-score"><span class="score-num" style="color:${barColor}">${score}</span><span class="score-bar"><span style="width:${score}%;background:${barColor}"></span></span></div>
        ${watchStar(s.symbol)}
      </div>`;
    }).join('');
}

/* ---------------- Render: signals view ---------------- */
function filteredSignals() {
  let list = SIGNALS.slice();
  if (state.signalFilter !== 'all') list = list.filter(s => s.action === state.signalFilter);
  if (state.signalSort === 'confidence') list.sort((a, b) => b.confidence - a.confidence);
  else if (state.signalSort === 'score') list.sort((a, b) => Math.abs(b.composite - 50) - Math.abs(a.composite - 50));
  else if (state.signalSort === 'change') list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  else if (state.signalSort === 'risk') list.sort((a, b) => a.atrPct - b.atrPct);
  return list;
}

function signalCard(sig) {
  const up = sig.changePct >= 0;
  return `<div class="signal-card ${sig.action}" role="button" tabindex="0" data-action="open-signal" data-symbol="${sig.symbol}" aria-label="Open ${sig.symbol} AI research report">
    <div class="sig-top">
      <div class="sig-id">
        <span class="sig-logo" style="${logoStyle(sig.symbol)}">${logoText(sig.symbol)}</span>
        <div><div class="sig-sym">${sig.symbol}</div><div class="sig-name">${sig.name}</div></div>
      </div>
      <div class="sig-price-wrap">
        <div class="sig-price">${money(sig.price)}</div>
        <div class="sig-chg ${up ? 'up' : 'down'}">${signedPct(sig.changePct)}</div>
      </div>
    </div>
    <div class="sig-mid">
      <p class="sig-thesis">${sig.thesis}</p>
      <div class="sig-spark">${sparkline(sig.closes, { w: 88, h: 34, color: sig.action === 'sell' ? '#ff5d7a' : sig.action === 'hold' ? '#ffc857' : '#34e5ad' })}</div>
    </div>
    <div class="sig-metrics">
      <div class="sig-metric"><span>Target</span><strong class="up">${money(sig.plan.target)}</strong></div>
      <div class="sig-metric"><span>Stop</span><strong class="down">${money(sig.plan.stop)}</strong></div>
      <div class="sig-metric"><span>R : R</span><strong>${fmt(sig.plan.rr, 1)}×</strong></div>
    </div>
    <div class="sig-foot">
      ${actionPill(sig, true)}
      <div class="sig-conf"><span class="conf-bar"><span style="width:${sig.confidence}%;background:${sig.action === 'sell' ? '#ff5d7a' : sig.action === 'hold' ? '#ffc857' : '#34e5ad'}"></span></span><em>${sig.confidence}%</em></div>
      <span class="sig-open">${sig.risk} risk <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </div>
    <div class="sig-actions">
      <button class="btn btn-ghost" data-action="open-signal" data-symbol="${sig.symbol}">AI report</button>
      <button class="btn ${sig.action === 'sell' ? 'btn-danger' : 'btn-primary'}" data-action="open-ticket" data-symbol="${sig.symbol}" data-side="${sig.action === 'sell' ? 'short' : 'long'}">${sig.action === 'sell' ? 'Short' : sig.action === 'hold' ? 'Watch' : 'Buy'}</button>
    </div>
  </div>`;
}

function renderSignalsView() {
  const grid = $('#signalsGrid');
  if (!grid) return;
  const list = filteredSignals();
  const buys = SIGNALS.filter(s => s.action === 'buy');
  const sells = SIGNALS.filter(s => s.action === 'sell');
  const avg = Math.round(SIGNALS.reduce((a, s) => a + s.confidence, 0) / SIGNALS.length);
  const strongest = SIGNALS.slice().sort((a, b) => b.confidence - a.confidence)[0];
  $('#signalsAvgConf').textContent = `${avg}%`;
  $('#navSignalCount').textContent = SIGNALS.length;
  const stats = $('#signalStats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card mint">
        <div class="stat-label">Buy signals</div>
        <div class="stat-value">${buys.length}</div>
        <div class="stat-note">Across <strong>${STOCKS.length} tickers</strong> scanned</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17l5-6 4 3 4-7 5 4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Sell / avoid</div>
        <div class="stat-value">${sells.length}</div>
        <div class="stat-note">Overbought or deteriorating</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7l5 6 4-3 4 7 5-4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
      <div class="stat-card amber">
        <div class="stat-label">Avg conviction</div>
        <div class="stat-value">${avg}%</div>
        <div class="stat-note">Model confidence across all ideas</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2" stroke-linecap="round"/></svg></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Top conviction</div>
        <div class="stat-value">${strongest.symbol}</div>
        <div class="stat-note"><strong>${strongest.confidence}%</strong> · ${actionLabel(strongest)} · ${strongest.horizon}</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3Z" stroke-linejoin="round"/></svg></div>
      </div>`;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><strong>No signals match this filter</strong><p>Try a different action or run a fresh AI scan.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(signalCard).join('');
}

/* ---------------- Render: news view ---------------- */
function sourceStats(source) {
  const list = ARTICLES.filter(a => a.source.id === source.id);
  const pos = list.filter(a => a.sentiment > 0.15).length;
  const neg = list.filter(a => a.sentiment < -0.15).length;
  const mid = list.length - pos - neg;
  return { list, pos, neg, mid };
}
function renderNewsView() {
  const total = ARTICLES.length;
  const bull = ARTICLES.filter(a => a.sentiment > 0.15).length;
  const avgImpact = (ARTICLES.reduce((a, b) => a + b.impact, 0) / total).toFixed(1);
  const stats = $('#newsStats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card mint"><div class="stat-label">Sources online</div><div class="stat-value">12<span style="font-size:12px;color:var(--muted-2)">/12</span></div><div class="stat-note">All newsroom feeds responding</div><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z" stroke-linejoin="round"/><path d="M17 8h3v9a2 2 0 0 1-2 2h-1M7 9h7M7 12h7M7 15h4" stroke-linecap="round"/></svg></div></div>
      <div class="stat-card"><div class="stat-label">Headlines scanned</div><div class="stat-value">${total}</div><div class="stat-note">Parsed in the last 12 hours</div><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z" stroke-linejoin="round"/><path d="M8 8h8M8 12h8M8 16h5" stroke-linecap="round"/></svg></div></div>
      <div class="stat-card mint"><div class="stat-label">Bullish share</div><div class="stat-value">${Math.round(bull / total * 100)}%</div><div class="stat-note"><strong>${bull}</strong> constructive · <strong>${ARTICLES.filter(a => a.sentiment < -0.15).length}</strong> negative</div><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17l5-6 4 3 4-7 5 4" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
      <div class="stat-card amber"><div class="stat-label">Avg impact</div><div class="stat-value">${avgImpact}</div><div class="stat-note">Out of 5 · weighted by source trust</div><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" stroke-linejoin="round"/></svg></div></div>`;
  }
  $('#sourcesOnline').textContent = '12 / 12';
  $('#headlinesScanned').textContent = total;

  const strip = $('#sourceStrip');
  if (strip) {
    strip.innerHTML = SOURCES.map(s => {
      const st = sourceStats(s);
      const totalPct = Math.max(1, st.list.length);
      return `<button class="source-card ${state.newsSource === s.id ? 'active' : ''}" data-action="filter-source" data-source="${s.id}" title="Filter by ${s.name}">
        <div class="source-top">
          <span class="source-logo" style="color:${s.color};background:${s.color}14;border-color:${s.color}2e">${s.short}</span>
          <div style="min-width:0"><div class="source-name">${s.name}</div><div class="source-count">${st.list.length} stories · ${s.credibility}% trust</div></div>
        </div>
        <div class="source-sent">
          <span class="s-pos" style="width:${st.pos / totalPct * 100}%"></span>
          <span class="s-neg" style="width:${st.neg / totalPct * 100}%"></span>
          <span class="s-mid" style="width:${st.mid / totalPct * 100}%"></span>
        </div>
      </button>`;
    }).join('');
  }

  const select = $('#newsSourceFilter');
  if (select && select.options.length <= 1) {
    select.innerHTML = `<option value="all">All sources</option>` + SOURCES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  if (select) select.value = state.newsSource;

  let list = ARTICLES.slice();
  if (state.newsFilter !== 'all') {
    list = list.filter(a => {
      if (state.newsFilter === 'bullish') return a.sentiment > 0.15;
      if (state.newsFilter === 'bearish') return a.sentiment < -0.15;
      return a.sentiment >= -0.15 && a.sentiment <= 0.15;
    });
  }
  if (state.newsSource !== 'all') list = list.filter(a => a.source.id === state.newsSource);
  if (state.newsSearch) {
    const q = state.newsSearch.toLowerCase();
    list = list.filter(a => `${a.title} ${a.summary} ${a.source.name} ${a.tickers.join(' ')}`.toLowerCase().includes(q));
  }
  list.sort((a, b) => articleScore(b) - articleScore(a));
  const sub = $('#newsFeedSub');
  if (sub) sub.textContent = `${list.length} stories · ${state.newsSource === 'all' ? 'all sources' : SOURCE_MAP[state.newsSource].name} · ranked by impact`;

  const newsList = $('#newsList');
  if (newsList) {
    if (!list.length) {
      newsList.innerHTML = `<div class="empty-state" style="border:0"><strong>No headlines found</strong><p>Try clearing the filters or search query.</p></div>`;
    } else {
      newsList.innerHTML = list.map(a => {
        const sc = sentClass(a.sentiment);
        const tickers = a.tickers.slice(0, 3).map(t => {
          const sig = STOCK_MAP[t]?.signal;
          const cls = sig?.action === 'buy' ? 'buy' : sig?.action === 'sell' ? 'sell' : '';
          return `<span class="ticker-tag ${cls}">${t}</span>`;
        }).join('');
        return `<button class="news-row" data-action="open-article" data-article="${a.id}">
          ${sourceLogo(a.source, 'news-row-logo')}
          <div class="news-row-body">
            <div class="news-row-meta">
              <span class="news-row-source">${a.source.name}</span><span>·</span><span>${relativeTime(a.time)}</span><span>·</span><span>${a.category}</span>
            </div>
            <div class="news-row-title">${a.title}</div>
            <div class="news-row-summary">${a.summary}</div>
            <div class="news-row-tags">${tickers}<span class="sent-pill ${sc}">${sentLabel(a.sentiment)}</span></div>
          </div>
          <div class="news-row-right">
            <span class="sent-pill ${sc}">${sentLabel(a.sentiment)}</span>
            ${impactBars(a.impact, a.sentiment)}
          </div>
        </button>`;
      }).join('');
    }
  }

  const counts = {};
  ARTICLES.forEach(a => a.tickers.forEach(t => { if (STOCK_MAP[t]) counts[t] = (counts[t] || 0) + 1; }));
  const trending = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const trendEl = $('#trendingList');
  if (trendEl) {
    trendEl.innerHTML = trending.map(([sym, count], i) => {
      const s = STOCK_MAP[sym];
      const sig = s.signal;
      return `<button class="trending-row" data-action="open-signal" data-symbol="${sym}">
        <span class="trend-rank">${i + 1}</span>
        <span class="watch-logo" style="${logoStyle(sym)}">${logoText(sym)}</span>
        <div class="trending-id"><div><div class="trending-sym">${sym}</div><div class="trending-name">${s.name}</div></div></div>
        <div class="trending-meta">
          <div class="trending-chg ${s.changePct >= 0 ? 'up' : 'down'}">${signedPct(s.changePct)}</div>
          <div class="trending-count">${count} stories · ${sig ? actionLabel(sig) : '—'}</div>
        </div>
      </button>`;
    }).join('');
  }

  const reliability = SOURCES.slice().sort((a, b) => b.credibility - a.credibility).slice(0, 7);
  const relEl = $('#reliabilityList');
  if (relEl) {
    relEl.innerHTML = reliability.map(s => `<div class="reliability-row">
      <span class="reliability-name">${s.name}</span>
      <span class="reliability-bar"><span style="width:${s.credibility}%"></span></span>
      <span class="reliability-val">${s.credibility}</span>
    </div>`).join('');
  }
}

/* ---------------- Render: portfolio view ---------------- */
function equityHistory(days = 30) {
  const out = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    let eq = state.portfolio.cash;
    state.portfolio.positions.forEach(p => {
      const s = STOCK_MAP[p.symbol];
      if (!s) return;
      const idx = Math.max(0, s.series.length - 1 - offset);
      const px = s.series[idx].c;
      if (p.side === 'long') eq += p.qty * px;
      else eq += p.qty * p.entry + (p.entry - px) * p.qty;
    });
    out.push(eq);
  }
  return out;
}

function renderPortfolio() {
  const eq = portfolioEquity();
  const totalPnl = portfolioTotalPnl();
  const dayPnl = portfolioDayPnl();
  const invested = portfolioInvested();
  const cash = state.portfolio.cash;
  const totalReturn = (eq / state.portfolio.starting - 1) * 100;
  const posCount = state.portfolio.positions.length;

  const stats = $('#portfolioStats');
  if (stats) {
    stats.innerHTML = `
      <div class="pstat primary">
        <div class="pstat-label">Total equity</div>
        <div class="pstat-value">${money(eq)}</div>
        <div class="pstat-sub ${totalPnl >= 0 ? 'up' : 'down'}"><strong>${signedMoney(totalPnl)}</strong> all-time · ${signedPct(totalReturn)}</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17l5-6 4 3 4-7 5 4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
      <div class="pstat">
        <div class="pstat-label">Cash available</div>
        <div class="pstat-value">${money(cash, 0)}</div>
        <div class="pstat-sub"><strong>${(cash / Math.max(eq, 1) * 100).toFixed(0)}%</strong> of equity · buying power</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14h3" stroke-linecap="round"/></svg></div>
      </div>
      <div class="pstat">
        <div class="pstat-label">Invested</div>
        <div class="pstat-value">${money(invested, 0)}</div>
        <div class="pstat-sub"><strong>${posCount}</strong> open position${posCount === 1 ? '' : 's'}</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 8h14M5 16h14" stroke-linecap="round"/></svg></div>
      </div>
      <div class="pstat">
        <div class="pstat-label">Today's P&amp;L</div>
        <div class="pstat-value ${dayPnl >= 0 ? 'up' : 'down'}">${signedMoney(dayPnl)}</div>
        <div class="pstat-sub ${dayPnl >= 0 ? 'up' : 'down'}"><strong>${signedPct(eq ? dayPnl / eq * 100 : 0)}</strong> since prior close</div>
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 7v5l3 2" stroke-linecap="round"/><circle cx="12" cy="12" r="8"/></svg></div>
      </div>`;
  }
  $('#positionCount').textContent = posCount;

  const eqEl = $('#equityChart');
  if (eqEl) {
    const hist = equityHistory(30);
    const first = hist[0];
    const last = hist[hist.length - 1];
    const ret = (last / first - 1) * 100;
    const chip = $('#equityReturnChip');
    if (chip) {
      chip.textContent = signedPct(ret);
      chip.className = `chip ${ret >= 0 ? 'chip-mint' : ''}`;
      if (ret < 0) { chip.style.color = 'var(--red)'; chip.style.borderColor = 'rgba(255,93,122,.25)'; chip.style.background = 'var(--red-dim)'; }
      else { chip.style.color = ''; chip.style.borderColor = ''; chip.style.background = ''; }
    }
    const d0 = STOCK_MAP[STOCKS[0].symbol].series;
    const startDate = d0[Math.max(0, d0.length - 30)].date;
    const endDate = d0[d0.length - 1].date;
    eqEl.innerHTML = `
      <div style="position:absolute;left:18px;top:2px;font-family:var(--mono);font-size:11px;color:var(--muted)">${money(last)}</div>
      <div style="position:absolute;right:18px;top:2px;font-size:9.5px;color:${ret >= 0 ? 'var(--mint)' : 'var(--red)'};font-family:var(--mono)">${signedPct(ret)} / 30d</div>
      <div style="position:absolute;left:18px;bottom:12px;font-size:9px;color:var(--muted-2)">${fmtDate(startDate)}</div>
      <div style="position:absolute;right:18px;bottom:12px;font-size:9px;color:var(--muted-2)">${fmtDate(endDate)}</div>
      <div style="position:absolute;inset:22px 10px 28px">${equityChartSVG(hist)}</div>`;
  }

  const allocEl = $('#allocBody');
  if (allocEl) {
    const values = state.portfolio.positions.map(p => ({ symbol: p.symbol, value: positionMarketValue(p) }));
    const grouped = values.slice();
    let items = grouped.map((v, i) => ({ ...v, color: SECTOR_COLORS[STOCK_MAP[v.symbol]?.sector] || '#62a8ff' }));
    items.push({ symbol: 'Cash', value: Math.max(0, cash), color: '#3a475c' });
    items = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    let acc = 0;
    const stops = items.map(i => {
      const start = acc / total * 100;
      acc += i.value;
      const end = acc / total * 100;
      return `${i.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(', ');
    const investedPct = Math.round((1 - Math.max(0, cash) / total) * 100);
    allocEl.innerHTML = `<div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops})"></div>
      <div class="donut-center"><div><strong>${investedPct}%</strong><span>Invested</span></div></div>
    </div>
    <div class="alloc-legend">${items.slice(0, 7).map(i => `<div class="alloc-row">
      <span class="alloc-dot" style="background:${i.color}"></span>
      <span class="alloc-name">${i.symbol}</span>
      <span class="alloc-val">${money(i.value, 0)}</span>
      <span class="alloc-pct">${(i.value / total * 100).toFixed(0)}%</span>
    </div>`).join('')}</div>`;
  }

  const holdEl = $('#holdingsTable');
  if (holdEl) {
    if (!state.portfolio.positions.length) {
      holdEl.innerHTML = `<div class="empty-holdings">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" stroke-linecap="round"/></svg></div>
        <strong>No open positions</strong>
        <p>Execute an AI signal to start building your paper portfolio. Every trade is simulated with real position sizing and P&amp;L.</p>
        <button class="btn btn-primary btn-sm" data-action="switch-view" data-view="signals">Browse AI signals</button>
      </div>`;
    } else {
      holdEl.innerHTML = `<div class="hold-head"><span>Position</span><span>Qty</span><span>Entry</span><span>Last</span><span>Market value</span><span>P&amp;L</span><span>Return</span><span></span></div>` +
        state.portfolio.positions.map(p => {
          const q = quoteFor(p.symbol);
          const pnl = positionPnl(p);
          const pct = (pnl / Math.max(1, p.entry * p.qty)) * 100;
          return `<div class="hold-row">
            <div class="hold-id">
              <span class="hold-logo" style="${logoStyle(p.symbol)}">${logoText(p.symbol)}</span>
              <div><div class="hold-sym">${p.symbol}<span class="side-tag ${p.side}">${p.side}</span></div><div class="hold-name">${q?.name || ''}</div></div>
            </div>
            <div class="hold-cell">${p.qty}</div>
            <div class="hold-cell">${money(p.entry)}</div>
            <div class="hold-cell">${money(q?.price ?? p.entry)}</div>
            <div class="hold-cell">${money(positionMarketValue(p), 0)}</div>
            <div class="hold-cell pnl ${pnl >= 0 ? 'up' : 'down'}">${signedMoney(pnl)}<span class="sub">${signedPct(pct)}</span></div>
            <div class="hold-cell ${pct >= 0 ? 'up' : 'down'}">${signedPct(pct)}</div>
            <div class="hold-close"><button data-action="close-position" data-position="${p.id}">Close</button></div>
          </div>`;
        }).join('');
    }
  }

  const histEl = $('#historyTable');
  if (histEl) {
    const trades = state.portfolio.trades.slice(0, 10);
    if (!trades.length) {
      histEl.innerHTML = `<div style="padding:26px 16px;text-align:center;color:var(--muted-2);font-size:11px">No trades yet. Your executions will appear here.</div>`;
    } else {
      histEl.innerHTML = `<div class="hist-head"><span>Time</span><span>Action</span><span>Ticker</span><span>Qty</span><span>Price</span><span>Value</span><span style="text-align:right">Realized P&amp;L</span></div>` +
        trades.map(t => {
          const cls = t.action === 'BUY' || t.action === 'COVER' ? (t.action === 'BUY' ? 'buy' : 'sell') : (t.action === 'SELL' ? 'sell' : 'buy');
          return `<div class="hist-row">
            <span class="hist-time">${relativeTime(new Date(t.time))}</span>
            <span class="hist-side ${cls}">${t.action}</span>
            <span class="hist-sym">${t.symbol}</span>
            <span class="hist-num">${t.qty}</span>
            <span class="hist-num">${money(t.price)}</span>
            <span class="hist-num">${money(t.total, 0)}</span>
            <span class="hist-num ${t.pnl != null ? (t.pnl >= 0 ? 'up' : 'down') : ''}">${t.pnl != null ? signedMoney(t.pnl) : '—'}</span>
          </div>`;
        }).join('');
    }
  }
}



