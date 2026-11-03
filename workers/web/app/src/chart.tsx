import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart, HistogramSeries } from "lightweight-charts";

interface Row { date: string; open: number | null; high: number | null; low: number | null; close: number; volume: number }

/** Adjusted daily candles + volume (Lightweight Charts, D105). Colours follow the page tokens. */
export default function PriceChart({ rows }: { rows: Row[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const chart = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: v("--bg") }, textColor: v("--muted"), attributionLogo: true },
      grid: { vertLines: { color: v("--line") }, horzLines: { color: v("--line") } },
      rightPriceScale: { borderColor: v("--line") }, timeScale: { borderColor: v("--line") },
    });
    const candles = chart.addSeries(CandlestickSeries, { upColor: v("--up"), downColor: v("--down"), wickUpColor: v("--up"), wickDownColor: v("--down"), borderVisible: false });
    candles.setData(rows.map((r) => ({ time: r.date, open: r.open ?? r.close, high: r.high ?? r.close, low: r.low ?? r.close, close: r.close })));
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", color: v("--line") });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(rows.map((r) => ({ time: r.date, value: r.volume })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [rows]);
  return <div className="chart" ref={el} role="img" aria-label={`Adjusted daily price chart, ${rows[0]?.date} to ${rows.at(-1)?.date}`} />;
}
