import { lazy, Suspense, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SiDiscord } from "react-icons/si";
import { ArrowDown, CheckCircle, XCircle, X } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { PanelMark, Notice, Spinner } from "../components/hs";
import { CATEGORY_LABELS, getCategory, pluralQuestions, splitDescription } from "../lib/panels";

// three.js is large, so the 3D logo loads in its own chunk while the poster image holds its place.
const HeroLogo = lazy(() => import("../components/HeroLogo"));

const CATEGORY_FILTERS = [
  { value: "all", label: "Wszystkie" },
  { value: "factions", label: "Frakcje" },
  { value: "general", label: "Ogólne" },
];

export default function HomePage() {
  const { user, login } = useAuth();
  const [recruitments, setRecruitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    const authParam = searchParams.get("auth");
    const msg = searchParams.get("message");
    if (authParam === "success") {
      setToast({ type: "success", text: "Zalogowano pomyślnie" });
      setSearchParams({}, { replace: true });
    } else if (authParam === "error") {
      setToast({ type: "error", text: msg || "Logowanie nie powiodło się" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    axios
      .get(`${API}/recruitments`)
      .then((res) => {
        const data = res.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.recruitments)
            ? data.recruitments
            : [];

        setRecruitments(list);
        setLoadError(list === data || list === data?.recruitments ? null : "Nie udało się pobrać paneli");
      })
      .catch(() => {
        setRecruitments([]);
        setLoadError("Nie udało się pobrać paneli");
      })
      .finally(() => setLoading(false));
  }, []);

  const recruitmentList = Array.isArray(recruitments) ? recruitments : [];
  const activePanels = recruitmentList.filter((r) => r.status === "active");
  const openRecruitments = activePanels.filter((r) => getCategory(r) !== "complaints");
  const openComplaints = activePanels.filter((r) => getCategory(r) === "complaints");
  const closedPanels = recruitmentList.filter((r) => r.status !== "active");
  const filteredRecruitments = selectedCategory === "all"
    ? openRecruitments
    : openRecruitments.filter((r) => getCategory(r) === selectedCategory);
  const countFor = (value) => (value === "all" ? openRecruitments.length : openRecruitments.filter((r) => getCategory(r) === value).length);

  return (
    <div>
      {toast && (
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-4">
          <Notice
            tone={toast.type === "error" ? "bad" : "ok"}
            icon={toast.type === "error" ? XCircle : CheckCircle}
            className="items-center"
            data-testid="home-toast"
          >
            <div className="flex items-center gap-3">
              <span className="flex-1">{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100" aria-label="Zamknij">
                <X className="w-4 h-4" />
              </button>
            </div>
          </Notice>
        </div>
      )}

      <section className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-[72px] pb-10 sm:pb-14 flex flex-col-reverse lg:flex-row lg:items-center gap-6 lg:gap-12">
        <div className="lg:flex-[1.25] min-w-0">
          <h1 className="hs-display text-[60px] sm:text-[88px] lg:text-[clamp(64px,7.6vw,112px)] leading-[0.9]" data-testid="hero-title">
            Dołącz do<br />HoodStories
          </h1>
          <p className="mt-5 sm:mt-8 max-w-[520px] text-[17px] sm:text-[19px] leading-relaxed text-hs-chrome">
            Rekrutacje do frakcji i administracji oraz skargi w jednym miejscu.{" "}
            {user
              ? "Wybierz panel i wyślij zgłoszenie. Status sprawdzisz w zakładce Moje zgłoszenia."
              : "Zaloguj się przez Discord, wybierz panel i wyślij zgłoszenie."}
          </p>
          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <a href="#panele" className="hs-btn hs-btn-primary hs-btn-lg">
                  Zobacz otwarte panele
                  <ArrowDown className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </a>
                <Link to="/my-applications" className="hs-btn hs-btn-ghost hs-btn-lg">Moje zgłoszenia</Link>
              </>
            ) : (
              <>
                <button type="button" onClick={login} className="hs-btn hs-btn-primary hs-btn-lg" data-testid="hero-login-button">
                  <SiDiscord className="w-5 h-5" />
                  Zaloguj przez Discord
                </button>
                <a href="#panele" className="hs-btn hs-btn-ghost hs-btn-lg">
                  Zobacz otwarte panele
                  <ArrowDown className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </a>
              </>
            )}
          </div>
          {!loading && !loadError && (
            <dl className="mt-10 sm:mt-12 hidden sm:flex flex-wrap gap-10">
              <div>
                <dt className="text-sm text-hs-meta">Otwarte rekrutacje</dt>
                <dd className="mt-0.5 hs-display text-[40px] leading-none tabular-nums">{openRecruitments.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-hs-meta">Panele skarg</dt>
                <dd className="mt-0.5 hs-display text-[40px] leading-none tabular-nums">{openComplaints.length}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className="lg:flex-1 min-w-0 w-full max-w-[300px] sm:max-w-[440px] lg:max-w-[540px] mx-auto">
          <Suspense fallback={<div className="hs-hero-logo"><img src="/logo-hero.webp" alt="Logo HoodStories" width="1078" height="827" /></div>}>
            <HeroLogo />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="jak-to-dziala" className="bg-hs-sunken">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col lg:flex-row gap-5 lg:gap-8">
          <h2 id="jak-to-dziala" className="hs-display text-[26px] sm:text-[28px] lg:w-[220px] flex-none">Jak to działa</h2>
          <ol className="flex-1 grid gap-5 sm:gap-8 sm:grid-cols-3">
            {[
              ["Zaloguj się przez Discord", "Twoje konto Discord to Twoja tożsamość na serwerze. Nie zakładasz nowego konta."],
              ["Odpowiedz na pytania", "Pytania są podzielone na sekcje. Odpowiedzi zapisują się na bieżąco w tej przeglądarce."],
              ["Śledź status", "Decyzję zobaczysz w zakładce Moje zgłoszenia: czeka na decyzję, zaakceptowane lub odrzucone."],
            ].map(([title, text], index) => (
              <li key={title}>
                <p className="text-base font-semibold"><span className="text-hs-accent">{index + 1}.</span> {title}</p>
                <p className="mt-1.5 text-[15px] text-hs-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div id="panele" className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-14 sm:pt-[120px] scroll-mt-20">
        {loading ? (
          <Spinner label="Ładowanie paneli" className="py-20" data-testid="loading-recruitments" />
        ) : (
          <>
            <section aria-labelledby="otwarte-rekrutacje" data-testid="active-recruitments-section">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-6 sm:mb-8">
                <div className="max-w-[560px]">
                  <h2 id="otwarte-rekrutacje" className="hs-display text-[42px] sm:text-[56px] leading-[0.95]">Otwarte rekrutacje</h2>
                  <p className="mt-3 sm:mt-3.5 text-base sm:text-[17px] text-hs-chrome">
                    Każdy panel ma własny zestaw pytań. Przeczytaj opis i wymagania, zanim zaczniesz.
                  </p>
                </div>
                {openRecruitments.length > 0 && (
                  <div role="group" aria-label="Kategoria" className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto" data-testid="category-filters">
                    <div className="inline-flex gap-1 p-1 rounded-full bg-hs-surface">
                      {CATEGORY_FILTERS.map((category) => {
                        const isSelected = selectedCategory === category.value;
                        return (
                          <button
                            key={category.value}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedCategory(category.value)}
                            className={`h-9 px-4 rounded-full text-sm whitespace-nowrap transition-colors ${
                              isSelected ? "bg-hs-ink text-hs-ground font-semibold" : "text-hs-muted font-medium hover:text-white"
                            }`}
                            data-testid={`category-filter-${category.value}`}
                          >
                            {category.label} <span className={`tabular-nums ${isSelected ? "text-[#5A6367]" : "text-[#78838A]"}`}>{countFor(category.value)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {filteredRecruitments.length > 0 ? (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  {filteredRecruitments.map((rec) => (
                    <RecruitmentCard key={rec.id} recruitment={rec} />
                  ))}
                </div>
              ) : (
                <div className="hs-card px-6 py-12 text-center text-hs-meta" data-testid={recruitmentList.length === 0 ? "no-recruitments" : "no-recruitments-in-category"}>
                  {openRecruitments.length === 0 ? "Teraz żadna rekrutacja nie przyjmuje zgłoszeń." : "Brak otwartych rekrutacji w tej kategorii."}
                </div>
              )}
            </section>

            {loadError && (
              <p className="py-6 text-center text-sm text-hs-negative" data-testid="recruitments-load-error">{loadError}</p>
            )}
          </>
        )}
      </div>

      {!loading && openComplaints.length > 0 && (
        <section aria-labelledby="skargi" className="mt-14 sm:mt-[120px] bg-hs-petrol">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-10 sm:py-[72px] flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
            <div className="lg:flex-1 min-w-0">
              <h2 id="skargi" className="hs-display text-[42px] sm:text-[56px] leading-[0.95] text-white">Skargi</h2>
              <p className="mt-3 sm:mt-4 max-w-[460px] text-base sm:text-[17px] text-[#D4ECEF]">
                Masz zastrzeżenia do zachowania gracza lub funkcjonariusza? Opisz sytuację w panelu skarg. Status zgłoszenia sprawdzisz w zakładce Moje zgłoszenia.
              </p>
            </div>
            <div className="lg:flex-1 min-w-0 flex flex-col gap-2">
              {openComplaints.map((rec) => (
                <Link
                  key={rec.id}
                  to={`/recruitment/${rec.id}`}
                  className="group flex items-center gap-4 p-4 sm:px-[22px] sm:py-5 rounded-xl bg-hs-petrol-deep text-white transition-colors hover:bg-[#002D35]"
                  data-testid={`recruitment-card-${rec.slug}`}
                >
                  <PanelMark recruitment={rec} size={48} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] sm:text-[19px] font-semibold leading-tight">{rec.name}</span>
                    <span className="block mt-0.5 text-sm text-[#A9CDD2]">{rec.question_count} {pluralQuestions(rec.question_count)}</span>
                  </span>
                  <span className="hidden sm:inline text-[15px] font-semibold whitespace-nowrap">
                    Złóż skargę <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!loading && closedPanels.length > 0 && (
        <section aria-labelledby="zamkniete" className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-14 sm:pt-20" data-testid="closed-recruitments-section">
          <h2 id="zamkniete" className="text-lg font-semibold">Zamknięte panele</h2>
          <p className="mt-1 text-[15px] text-hs-meta">Te panele chwilowo nie przyjmują zgłoszeń.</p>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {closedPanels.map((rec) => (
              <li key={rec.id}>
                <Link to={`/recruitment/${rec.id}`} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-hs-sunken text-hs-muted hover:text-white" data-testid={`recruitment-card-${rec.slug}`}>
                  <span className="opacity-60"><PanelMark recruitment={rec} size={36} /></span>
                  <span className="flex-1 min-w-0 truncate font-medium">{rec.name}</span>
                  <span className="hs-pill hs-pill-neutral">Zamknięty</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="h-6 sm:h-10" />
    </div>
  );
}

function RecruitmentCard({ recruitment }) {
  const r = recruitment;
  const category = getCategory(r);
  const { lead, notes } = splitDescription(r.description);
  return (
    <Link
      to={`/recruitment/${r.id}`}
      className="group flex flex-col gap-4 sm:gap-[18px] p-5 sm:p-7 min-h-0 md:min-h-[248px] rounded-xl bg-hs-surface text-hs-ink transition-colors hover:bg-[#141A1C]"
      data-testid={`recruitment-card-${r.slug}`}
    >
      <div className="flex items-center gap-3.5 sm:gap-4">
        <PanelMark recruitment={r} size={52} />
        <div className="min-w-0">
          <h3 className="text-[19px] sm:text-[22px] font-semibold leading-tight">{r.name}</h3>
          <p className="mt-1 text-sm text-hs-meta">
            {CATEGORY_LABELS[category] || CATEGORY_LABELS.general} · {r.question_count} {pluralQuestions(r.question_count)}
          </p>
        </div>
      </div>
      {lead && <p className="text-[15px] sm:text-base text-hs-chrome line-clamp-3">{lead}</p>}
      {notes.map((note) => (
        <Notice key={note} tone="notice">{note}</Notice>
      ))}
      <div className="mt-auto flex sm:justify-end">
        <span className="text-[15px] font-semibold text-hs-accent">
          Złóż podanie <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}
