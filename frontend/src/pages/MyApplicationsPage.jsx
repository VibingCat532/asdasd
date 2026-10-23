import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { FileText } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import axios from "axios";
import { API } from "../lib/api";
import { EmptyState, PanelMark, Spinner, StatusPill } from "../components/hs";
import { pluralApplications } from "../lib/panels";

const formatDate = (iso) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

export default function MyApplicationsPage() {
  const { user, loading: authLoading, login } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API}/applications`, { withCredentials: true })
      .then((res) => setApplications(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLoadError("Nie udało się pobrać zgłoszeń. Odśwież stronę, żeby spróbować ponownie."))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return <Spinner />;
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center" data-testid="login-required">
        <h1 className="hs-display text-[44px] sm:text-[56px]">Zaloguj się</h1>
        <p className="mt-3 text-[17px] text-hs-chrome">Musisz być zalogowany, żeby zobaczyć swoje zgłoszenia.</p>
        <button type="button" onClick={login} className="mt-7 hs-btn hs-btn-primary hs-btn-lg" data-testid="login-button-applications">
          <SiDiscord className="w-5 h-5" />
          Zaloguj przez Discord
        </button>
      </div>
    );
  }

  const pending = applications.filter((app) => app.status === "nowe").length;

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-20">
      <h1 className="hs-display text-[48px] sm:text-[64px]" data-testid="my-applications-title">Moje zgłoszenia</h1>
      {!loading && !loadError && applications.length > 0 && (
        <p className="mt-3 text-[17px] sm:text-lg text-hs-chrome">
          {applications.length} {pluralApplications(applications.length)}
          {pending > 0 && ` · ${pending} ${pending === 1 ? "czeka" : "czekają"} na decyzję staffu`}
        </p>
      )}

      <div className="mt-8 sm:mt-10 flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-start">
        <div className="flex-1 min-w-0">
          {loading ? (
            <Spinner className="py-20" data-testid="loading-applications" />
          ) : loadError ? (
            <p className="hs-card p-6 text-hs-negative" role="alert">{loadError}</p>
          ) : applications.length === 0 ? (
            <EmptyState icon={FileText} title="Nie masz jeszcze żadnych zgłoszeń" data-testid="no-applications">
              <Link to="/" className="hs-link" data-testid="browse-recruitments-link">Przeglądaj otwarte panele</Link>
            </EmptyState>
          ) : (
            <ul className="hs-card p-2" data-testid="applications-list">
              {applications.map((app) => {
                const snapshot = app.recruitment_snapshot || {};
                const isComplaint = snapshot.category === "complaints";
                return (
                  <li key={app.id}>
                    <Link
                      to={`/my-applications/${app.id}`}
                      className="group flex items-center gap-3.5 sm:gap-4 p-3 sm:p-4 rounded-lg text-hs-ink hover:bg-[#12171A]"
                      data-testid={`application-item-${app.id}`}
                    >
                      <PanelMark name={app.recruitment_name} themeColor={snapshot.theme_color} category={snapshot.category} size={48} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[17px] sm:text-lg font-semibold leading-snug truncate">{app.recruitment_name}</span>
                        <span className="block text-sm text-hs-meta">
                          {isComplaint ? "Skarga · wysłana" : "Podanie · wysłane"} {formatDate(app.created_at)}
                        </span>
                        {app.status === "odrzucone" && app.rejection_reason && (
                          <span className="mt-1 block text-sm text-hs-negative line-clamp-2">Powód: {app.rejection_reason}</span>
                        )}
                        <StatusPill status={app.status} audience="player" className="sm:hidden mt-2" />
                      </span>
                      <StatusPill status={app.status} audience="player" className="hidden sm:inline-flex" />
                      <span aria-hidden="true" className="text-lg text-hs-faint transition-transform group-hover:translate-x-1 group-hover:text-hs-ink">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside aria-labelledby="statusy" className="lg:w-[360px] flex-none rounded-xl bg-hs-sunken p-6">
          <h2 id="statusy" className="text-base font-semibold">Co oznaczają statusy</h2>
          <dl className="mt-4 flex flex-col gap-4">
            <div>
              <dt className="text-[15px] font-semibold text-hs-accent-soft">Czeka na decyzję</dt>
              <dd className="mt-0.5 text-[15px] text-hs-muted">Staff jeszcze nie rozpatrzył zgłoszenia.</dd>
            </div>
            <div>
              <dt className="text-[15px] font-semibold text-hs-positive">Zaakceptowane</dt>
              <dd className="mt-0.5 text-[15px] text-hs-muted">Podanie przyjęte. Jeśli panel nadaje rolę, dostaniesz ją na Discordzie. W razie potrzeby możesz złożyć kolejne.</dd>
            </div>
            <div>
              <dt className="text-[15px] font-semibold text-hs-negative">Odrzucone</dt>
              <dd className="mt-0.5 text-[15px] text-hs-muted">Jeśli staff podał powód, zobaczysz go przy zgłoszeniu. Sprawdź wymagania panelu, zanim złożysz kolejne.</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
