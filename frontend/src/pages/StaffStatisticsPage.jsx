import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2, RefreshCw } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const formatNumber = (value) => Number(value).toLocaleString("pl-PL");

export default function StaffStatisticsPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchStatistics = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await axios.get(`${API}/staff/recruitments/${id}/statistics`, { withCredentials: true, signal });
      setData(response.data);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err.response?.data?.error || "Nie udało się pobrać statystyk. Spróbuj ponownie.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setData(null); setLoading(false); return; }
    const controller = new AbortController();
    fetchStatistics(controller.signal);
    return () => controller.abort();
  }, [user, authLoading, fetchStatistics]);

  const summary = data?.summary;
  const statuses = summary ? [
    { label: "Zaakceptowane", value: summary.accepted, color: "#34d399" },
    { label: "Odrzucone", value: summary.rejected, color: "#f87171" },
    { label: "Oczekujące", value: summary.pending, color: "#00E5FF" },
  ] : [];
  const acceptedPercent = summary?.total ? summary.accepted / summary.total * 100 : 0;
  const rejectedPercent = summary?.total ? summary.rejected / summary.total * 100 : 0;
  const dailyMax = Math.max(1, ...(data?.daily || []).map(day => day.count));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" data-testid="staff-statistics-page">
      <Link to="/staff" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-7">
        <ArrowLeft className="w-4 h-4" /> Panel Staff
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#00E5FF] mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Statystyki</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 break-words">{data?.recruitment.name || "Statystyki panelu"}</h1>
          {data && <p className="text-sm text-zinc-400 mt-2">{data.recruitment.category === "complaints" ? "Skargi" : "Podania"} · Podsumowanie od utworzenia panelu</p>}
        </div>
        {user && <button onClick={() => fetchStatistics()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Odśwież
        </button>}
      </div>

      {authLoading || loading ? <div className="flex justify-center py-24" role="status" aria-label="Ładowanie statystyk"><Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" /></div>
        : !user ? <p className="text-zinc-400">Zaloguj się, aby zobaczyć statystyki.</p>
        : error ? <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-red-300">{error}</p>
        : data && <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Wszystkie zgłoszenia", value: summary.total, color: "#fafafa" },
              { label: "Sprawdzone", value: summary.reviewed, color: "#a78bfa" },
              { label: "Zaakceptowane", value: summary.accepted, color: "#34d399" },
              { label: "Odrzucone", value: summary.rejected, color: "#f87171" },
            ].map(item => <div key={item.label} className="rounded-xl border border-white/10 bg-[#141418] p-5">
              <p className="text-xs sm:text-sm text-zinc-400 mb-3">{item.label}</p>
              <p className="text-3xl font-semibold tabular-nums" style={{ color: item.color }}>{formatNumber(item.value)}</p>
            </div>)}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-white/10 bg-[#141418] p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-zinc-100 mb-6">Status zgłoszeń</h2>
              <div className="flex flex-wrap items-center gap-7">
                <div role="img" aria-label={`Łącznie ${summary.total} zgłoszeń: ${summary.accepted} zaakceptowanych, ${summary.rejected} odrzuconych, ${summary.pending} oczekujących`} className="w-40 h-40 rounded-full flex items-center justify-center shrink-0" style={{ background: summary.total ? `conic-gradient(#34d399 0% ${acceptedPercent}%, #f87171 ${acceptedPercent}% ${acceptedPercent + rejectedPercent}%, #00E5FF ${acceptedPercent + rejectedPercent}% 100%)` : "#27272a" }}>
                  <div className="rounded-full bg-[#141418] w-32 h-32 flex flex-col justify-center items-center">
                    <span className="text-3xl font-semibold text-zinc-100 tabular-nums">{formatNumber(summary.pending)}</span>
                    <span className="text-xs text-zinc-400 mt-1">oczekujących</span>
                  </div>
                </div>
                <ul className="space-y-4 flex-1 min-w-40">
                  {statuses.map(status => <li key={status.label} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />
                    <span className="text-zinc-400">{status.label}</span>
                    <span className="ml-auto text-zinc-100 tabular-nums">{formatNumber(status.value)}</span>
                  </li>)}
                </ul>
              </div>
              <div className="mt-6 pt-5 border-t border-white/5 grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-zinc-500 mb-1">Rozpatrzono</p><p className="text-zinc-100">{summary.total ? Math.round(summary.reviewed / summary.total * 100) : 0}% zgłoszeń</p></div>
                <div><p className="text-zinc-500 mb-1">Średni czas do decyzji</p><p className="text-zinc-100">{summary.average_review_hours === null ? "Brak decyzji" : `${formatNumber(summary.average_review_hours)} godz.`}</p></div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#141418] p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-zinc-100">Nowe zgłoszenia</h2>
              <p className="text-xs text-zinc-500 mt-1">Ostatnie 14 dni · czas polski</p>
              <div className="mt-7 flex gap-1.5 sm:gap-2 items-end h-44" role="img" aria-label="Liczba zgłoszeń każdego dnia. Wartości są dostępne pod wykresem.">
                {data.daily.map(day => <div key={day.date} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2" title={`${day.date}: ${day.count}`}>
                  <span className="text-[10px] sm:text-xs text-zinc-400 tabular-nums">{day.count}</span>
                  <div className="w-full bg-[#00E5FF]/70 rounded-t-sm" style={{ height: `${day.count / dailyMax * 120}px`, minHeight: 2, opacity: day.count ? 1 : 0.2 }} />
                  <span className="text-[10px] text-zinc-500">{day.date.slice(-2)}</span>
                </div>)}
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-3"><span>{data.daily[0]?.date}</span><span>{data.daily[data.daily.length - 1]?.date}</span></div>
              <details className="text-xs text-zinc-400 mt-5">
                <summary className="cursor-pointer hover:text-zinc-100">Pokaż dane wykresu</summary>
                <ul className="grid grid-cols-2 gap-2 mt-3">{data.daily.map(day => <li key={day.date}>{day.date}: {day.count}</li>)}</ul>
              </details>
            </section>
          </div>

          <section className="rounded-xl border border-white/10 bg-[#141418] overflow-hidden">
            <div className="p-5 sm:p-6"><h2 className="text-lg font-semibold text-zinc-100">Aktywność sprawdzających</h2><p className="text-sm text-zinc-400 mt-1">Kto rozpatrzył zgłoszenia i jakie podjął decyzje.</p></div>
            {data.reviewers.length === 0 ? <p className="px-6 pb-8 text-zinc-500">Nie rozpatrzono jeszcze żadnego zgłoszenia.</p> : <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/[0.03] text-zinc-400"><tr>{["Sprawdzający", "Sprawdzone", "Zaakceptowane", "Odrzucone", "Udział"].map(label => <th key={label} scope="col" className="px-5 py-3 font-medium whitespace-nowrap">{label}</th>)}</tr></thead>
                <tbody>{data.reviewers.map(reviewer => <tr key={reviewer.user_id || "unknown"} className="border-t border-white/5">
                  <th scope="row" className="px-5 py-4 font-medium text-zinc-100"><span className="block">{reviewer.name}</span>{reviewer.username && <span className="text-xs font-normal text-zinc-500">@{reviewer.username}</span>}</th>
                  <td className="px-5 py-4 text-zinc-100 tabular-nums">{formatNumber(reviewer.reviewed)}</td>
                  <td className="px-5 py-4 text-emerald-400 tabular-nums">{formatNumber(reviewer.accepted)}</td>
                  <td className="px-5 py-4 text-red-400 tabular-nums">{formatNumber(reviewer.rejected)}</td>
                  <td className="px-5 py-4 min-w-32"><div className="text-xs text-zinc-400 mb-2">{Math.round(reviewer.reviewed / summary.reviewed * 100)}%</div><div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-[#00E5FF]" style={{ width: `${reviewer.reviewed / summary.reviewed * 100}%` }} /></div></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </section>
          <p className="text-xs text-zinc-500 leading-relaxed">Sprawdzone = zaakceptowane + odrzucone.</p>
        </div>}
    </div>
  );
}
