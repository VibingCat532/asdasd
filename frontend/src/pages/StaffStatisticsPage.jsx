import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
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
    { label: "Zaakceptowane", value: summary.accepted, color: "#3FC07A" },
    { label: "Odrzucone", value: summary.rejected, color: "#E5566F" },
    { label: "Oczekujące", value: summary.pending, color: "#4CC6D1" },
  ] : [];
  const acceptedPercent = summary?.total ? summary.accepted / summary.total * 100 : 0;
  const rejectedPercent = summary?.total ? summary.rejected / summary.total * 100 : 0;
  const dailyMax = Math.max(1, ...(data?.daily || []).map(day => day.count));
  const kpis = summary ? [
    { label: "Wszystkie zgłoszenia", value: summary.total, className: "text-hs-ink" },
    { label: "Sprawdzone", value: summary.reviewed, className: "text-hs-ink" },
    { label: "Zaakceptowane", value: summary.accepted, className: "text-hs-positive" },
    { label: "Odrzucone", value: summary.rejected, className: "text-hs-negative" },
  ] : [];

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-16" data-testid="staff-statistics-page">
      <Link to="/staff" className="hs-back">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} /> Panel staff
      </Link>
      <div className="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="hs-display text-[40px] sm:text-[44px] leading-[0.95] break-words">{data?.recruitment.name || "Statystyki panelu"}</h1>
          {data && <p className="mt-2.5 text-base text-hs-chrome">Statystyki · {data.recruitment.category === "complaints" ? "skargi" : "podania"} od utworzenia panelu</p>}
        </div>
        {user && <button type="button" onClick={() => fetchStatistics()} disabled={loading} className="hs-btn hs-btn-ghost">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} /> Odśwież
        </button>}
      </div>

      {authLoading || loading ? <div className="flex justify-center py-24" role="status" aria-label="Ładowanie statystyk"><Loader2 className="w-7 h-7 animate-spin text-hs-accent" /></div>
        : !user ? <p className="text-hs-chrome">Zaloguj się, aby zobaczyć statystyki.</p>
        : error ? <p role="alert" className="hs-note hs-note-bad p-6">{error}</p>
        : data && <div className="flex flex-col gap-4">
          <dl className="hs-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
            {kpis.map((item, index) => (
              <div
                key={item.label}
                className={`px-6 py-5 ${index % 2 === 1 ? "border-l border-hs-line" : ""} ${index >= 2 ? "border-t lg:border-t-0 border-hs-line" : ""} ${index === 2 ? "lg:border-l" : ""}`}
              >
                <dt className="text-sm text-hs-meta">{item.label}</dt>
                <dd className={`mt-1.5 text-[28px] font-semibold leading-none tabular-nums ${item.className}`}>{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="hs-card p-5 sm:p-6">
              <h2 className="text-base font-semibold mb-6">Status zgłoszeń</h2>
              <div className="flex flex-wrap items-center gap-7">
                <div role="img" aria-label={`Łącznie ${summary.total} zgłoszeń: ${summary.accepted} zaakceptowanych, ${summary.rejected} odrzuconych, ${summary.pending} oczekujących`} className="w-40 h-40 rounded-full flex items-center justify-center flex-none" style={{ background: summary.total ? `conic-gradient(#3FC07A 0% ${acceptedPercent}%, #E5566F ${acceptedPercent}% ${acceptedPercent + rejectedPercent}%, #4CC6D1 ${acceptedPercent + rejectedPercent}% 100%)` : "#1A2023" }}>
                  <div className="rounded-full bg-hs-surface w-[136px] h-[136px] flex flex-col justify-center items-center">
                    <span className="text-[28px] font-semibold tabular-nums">{formatNumber(summary.pending)}</span>
                    <span className="text-[13px] text-hs-meta mt-1">oczekujących</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-4 flex-1 min-w-40">
                  {statuses.map(status => <li key={status.label} className="flex items-center gap-2.5 text-[15px]">
                    <span className="w-2 h-2 rounded-full" style={{ background: status.color }} />
                    <span className="text-hs-muted">{status.label}</span>
                    <span className="ml-auto tabular-nums">{formatNumber(status.value)}</span>
                  </li>)}
                </ul>
              </div>
              <div className="mt-6 pt-5 border-t border-hs-raised grid grid-cols-2 gap-4 text-[15px]">
                <div><p className="text-hs-meta mb-1 text-sm">Rozpatrzono</p><p>{summary.total ? Math.round(summary.reviewed / summary.total * 100) : 0}% zgłoszeń</p></div>
                <div><p className="text-hs-meta mb-1 text-sm">Średni czas do decyzji</p><p>{summary.average_review_hours === null ? "Brak decyzji" : `${formatNumber(summary.average_review_hours)} godz.`}</p></div>
              </div>
            </section>

            <section className="hs-card p-5 sm:p-6">
              <h2 className="text-base font-semibold">Nowe zgłoszenia</h2>
              <p className="text-[13px] text-hs-meta mt-1">Ostatnie 14 dni · czas polski</p>
              <div className="mt-7 flex gap-1.5 sm:gap-2 items-end h-44" role="img" aria-label="Liczba zgłoszeń każdego dnia. Wartości są dostępne pod wykresem.">
                {data.daily.map(day => <div key={day.date} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2" title={`${day.date}: ${day.count}`}>
                  <span className="text-[11px] sm:text-xs text-hs-muted tabular-nums">{day.count}</span>
                  <div className="w-full bg-hs-accent rounded-t-[3px]" style={{ height: `${day.count / dailyMax * 120}px`, minHeight: day.count ? 2 : 0 }} />
                  <span className="text-[11px] text-hs-meta">{day.date.slice(-2)}</span>
                </div>)}
              </div>
              <div className="flex justify-between text-[13px] text-hs-meta mt-3 border-t border-hs-raised pt-2"><span>{data.daily[0]?.date}</span><span>{data.daily[data.daily.length - 1]?.date}</span></div>
              <details className="text-[13px] text-hs-muted mt-4">
                <summary className="cursor-pointer hover:text-white">Pokaż dane wykresu</summary>
                <ul className="grid grid-cols-2 gap-2 mt-3 tabular-nums">{data.daily.map(day => <li key={day.date}>{day.date}: {day.count}</li>)}</ul>
              </details>
            </section>
          </div>

          <section className="hs-card overflow-hidden">
            <div className="px-5 sm:px-6 pt-5 pb-3"><h2 className="text-base font-semibold">Aktywność sprawdzających</h2><p className="text-[15px] text-hs-meta mt-1">Kto rozpatrzył zgłoszenia i jakie podjął decyzje.</p></div>
            {data.reviewers.length === 0 ? <p className="px-6 pb-8 text-hs-meta">Nie rozpatrzono jeszcze żadnego zgłoszenia.</p> : <div className="overflow-x-auto">
              <table className="w-full text-[15px] text-left">
                <thead className="text-[13px] text-hs-meta"><tr>{["Sprawdzający", "Sprawdzone", "Zaakceptowane", "Odrzucone", "Udział"].map((label, index) => <th key={label} scope="col" className={`px-5 sm:px-6 py-2.5 font-normal whitespace-nowrap border-b border-hs-line ${index > 0 && index < 4 ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
                <tbody>{data.reviewers.map(reviewer => <tr key={reviewer.user_id || "unknown"} className="border-t border-hs-raised first:border-t-0">
                  <th scope="row" className="px-5 sm:px-6 py-3.5 font-semibold"><span className="block">{reviewer.name}</span>{reviewer.username && <span className="text-[13px] font-normal text-hs-meta">@{reviewer.username}</span>}</th>
                  <td className="px-5 sm:px-6 py-3.5 text-right tabular-nums">{formatNumber(reviewer.reviewed)}</td>
                  <td className="px-5 sm:px-6 py-3.5 text-right text-hs-positive tabular-nums">{formatNumber(reviewer.accepted)}</td>
                  <td className="px-5 sm:px-6 py-3.5 text-right text-hs-negative tabular-nums">{formatNumber(reviewer.rejected)}</td>
                  <td className="px-5 sm:px-6 py-3.5 min-w-32"><div className="text-[13px] text-hs-muted mb-1.5 tabular-nums">{Math.round(reviewer.reviewed / summary.reviewed * 100)}%</div><div className="h-1.5 rounded-full bg-hs-line"><div className="h-full rounded-full bg-hs-accent" style={{ width: `${reviewer.reviewed / summary.reviewed * 100}%` }} /></div></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </section>
          <p className="text-[13px] text-hs-meta leading-relaxed">Sprawdzone = zaakceptowane + odrzucone.</p>
        </div>}
    </div>
  );
}
