import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Loader2, ArrowLeft, Check, X, AlertTriangle, Trash2, Copy } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import AnswerList, { buildAnswerRows } from "../components/AnswerList";
import { Notice, Spinner, StatusPill, UserInitial } from "../components/hs";
import { discordAvatarUrl } from "../lib/panels";

const REASON_MAX_LENGTH = 1000;

export default function StaffApplicationDetailPage() {
  const { recId, appId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // "reject" asks for the reason before rejecting, "edit-reason" changes the reason of a rejected one.
  const [mode, setMode] = useState("idle");
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchApp = () => {
    if (!user) { setLoading(false); return; }
    axios.get(`${API}/staff/recruitments/${recId}/applications/${appId}`, { withCredentials: true })
      .then(res => setApp(res.data))
      .catch(err => setError(err.response?.data?.error || err.response?.data?.detail || "Nie udało się załadować"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchApp, [recId, appId, user]);

  const changeStatus = async (newStatus, rejectionReason) => {
    setChanging(true);
    setError(null);
    try {
      const body = rejectionReason === undefined ? { status: newStatus } : { status: newStatus, reason: rejectionReason };
      const res = await axios.patch(`${API}/staff/recruitments/${recId}/applications/${appId}/status`, body, { withCredentials: true });
      const reviewerName = user?.discord_global_name || user?.discord_username || null;
      setApp(prev => ({
        ...prev,
        status: newStatus,
        rejection_reason: res.data.rejection_reason ?? null,
        discord_role_result: res.data.discord_role_result ?? prev.discord_role_result,
        reviewer_name: newStatus !== "nowe" ? (prev.status === newStatus ? prev.reviewer_name : reviewerName) : null,
      }));
      setMode("idle");
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Błąd zmiany statusu");
    } finally {
      setChanging(false);
    }
  };

  const deleteApplication = async () => {
    if (!window.confirm("Na pewno usunąć to zgłoszenie? Tej akcji nie można cofnąć.")) return;
    setDeleting(true);
    setError(null);
    try {
      await axios.delete(`${API}/staff/recruitments/${recId}/applications/${appId}`, { withCredentials: true });
      navigate(`/staff/recruitments/${recId}/applications`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Nie udało się usunąć podania");
      setDeleting(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(app.applicant_discord_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the ID is still selectable.
    }
  };

  if (loading) return <Spinner />;
  if (error && !app) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <AlertTriangle className="w-9 h-9 text-hs-notice mx-auto mb-3" strokeWidth={1.6} />
      <p className="text-hs-chrome mb-3">{error}</p>
      <Link to={`/staff/recruitments/${recId}/applications`} className="hs-link text-[15px]">Wróć do listy zgłoszeń</Link>
    </div>
  );
  if (!app) return null;

  const isComplaint = app.recruitment_category === "complaints";
  const name = app.applicant_global_name || app.applicant_username;
  const sentAt = new Date(app.created_at);
  const canReview = app.can_review_applications;

  const openReasonEditor = (nextMode) => {
    setReason(nextMode === "edit-reason" ? app.rejection_reason || "" : "");
    setMode(nextMode);
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-20" data-testid="staff-app-detail">
      <Link to={`/staff/recruitments/${recId}/applications`} className="hs-back" data-testid="back-to-apps-list">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />{isComplaint ? "Skargi" : "Zgłoszenia"} — {app.recruitment_name}
      </Link>

      <div className="mt-6 flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-start">
        <article className="flex-1 min-w-0" aria-labelledby="osoba" data-testid="applicant-header">
          <div className="flex items-center gap-4 sm:gap-[18px]">
            <Avatar className="w-14 h-14 sm:w-16 sm:h-16 flex-none">
              <AvatarImage src={discordAvatarUrl(app.applicant_discord_id, app.applicant_avatar, 128)} alt="" />
              <AvatarFallback className="bg-transparent p-0"><UserInitial name={name} size={64} /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 id="osoba" className="hs-display text-[40px] sm:text-[48px] leading-[0.95] break-words" data-testid="applicant-name">{name}</h1>
              <p className="mt-1.5 text-[15px] text-hs-meta">
                @{app.applicant_username} · {isComplaint ? "skarga" : "podanie"} · wysłane {sentAt.toLocaleString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <AnswerList
              rows={buildAnswerRows(app.questions_snapshot, app.answers)}
              testId="staff-answers"
              itemTestId="staff-answer"
              downloadTestId="download-code"
              videoTestId="staff-answer-video"
            />
          </div>
        </article>

        <aside aria-label="Decyzja" className="lg:w-[360px] flex-none flex flex-col gap-4 lg:sticky lg:top-24">
          <section className="hs-card p-6" aria-labelledby="decyzja">
            <div className="flex items-center justify-between gap-3">
              <h2 id="decyzja" className="text-base font-semibold">Decyzja</h2>
              <StatusPill status={app.status} data-testid="app-status-badge" />
            </div>

            {app.status !== "nowe" && app.reviewer_name && (
              <p className="mt-3 text-sm text-hs-meta">Sprawdził: <span className="text-hs-ink">{app.reviewer_name}</span></p>
            )}

            {app.status === "odrzucone" && mode !== "edit-reason" && (
              <div className="mt-4 rounded-lg bg-hs-sunken px-4 py-3" data-testid="rejection-reason">
                <p className="text-[13px] text-hs-meta">Powód odrzucenia</p>
                <p className={`mt-1 text-[15px] whitespace-pre-wrap ${app.rejection_reason ? "text-hs-ink" : "text-hs-meta"}`}>
                  {app.rejection_reason || "— nie podano"}
                </p>
                {canReview && (
                  <button type="button" onClick={() => openReasonEditor("edit-reason")} className="mt-2 text-sm hs-link" data-testid="edit-rejection-reason">
                    {app.rejection_reason ? "Zmień powód" : "Dodaj powód"}
                  </button>
                )}
              </div>
            )}

            {canReview && app.status === "nowe" && mode === "idle" && (
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" onClick={() => changeStatus("zaakceptowane")} disabled={changing} className="hs-btn hs-btn-primary h-12 text-[15px]" data-testid="accept-button">
                  {changing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-[18px] h-[18px]" strokeWidth={2} />}
                  Zaakceptuj
                </button>
                <button type="button" onClick={() => openReasonEditor("reject")} disabled={changing} className="hs-btn hs-btn-danger h-12 text-[15px]" data-testid="reject-button">
                  <X className="w-[18px] h-[18px]" strokeWidth={2} />
                  Odrzuć
                </button>
                {!isComplaint && (
                  <p className="mt-2 text-sm text-hs-meta">Jeśli panel ma przypisaną rolę, bot nada ją na Discordzie po akceptacji.</p>
                )}
              </div>
            )}

            {canReview && (mode === "reject" || mode === "edit-reason") && (
              <form
                className="mt-5 flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  changeStatus("odrzucone", reason);
                }}
              >
                <div>
                  <label htmlFor="rejection-reason" className="block text-[15px] font-medium">
                    Powód odrzucenia <span className="font-normal text-hs-meta">(opcjonalnie)</span>
                  </label>
                  <p id="rejection-reason-help" className="mt-1 text-sm text-hs-meta">
                    {isComplaint ? "Zgłaszający zobaczy go przy swojej skardze." : "Gracz zobaczy go przy zgłoszeniu"}
                    {!isComplaint && mode === "reject" ? " i w wiadomości od bota na Discordzie." : !isComplaint ? "." : ""}
                  </p>
                  <textarea
                    id="rejection-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value.slice(0, REASON_MAX_LENGTH))}
                    rows={4}
                    autoFocus
                    placeholder="Np. odpowiedzi są zbyt krótkie, brak klipu z sytuacji"
                    aria-describedby="rejection-reason-help"
                    className="hs-field mt-2.5 py-3 text-[15px] leading-normal resize-y min-h-[110px]"
                    data-testid="rejection-reason-input"
                  />
                  <p className="mt-1 text-right text-[13px] text-hs-faint tabular-nums">{reason.length} / {REASON_MAX_LENGTH}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="submit" disabled={changing} className="hs-btn h-11 bg-[#B23A4C] text-white font-semibold hover:bg-[#C8475A]" data-testid="confirm-reject-button">
                    {changing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {mode === "reject" ? "Odrzuć zgłoszenie" : "Zapisz powód"}
                  </button>
                  <button type="button" onClick={() => setMode("idle")} disabled={changing} className="hs-btn hs-btn-ghost h-11">Anuluj</button>
                </div>
              </form>
            )}

            {error && <p className="mt-4 text-sm text-hs-negative" role="alert">{error}</p>}
            {app.discord_role_result?.attempted && !app.discord_role_result?.success && (
              <Notice tone="notice" icon={AlertTriangle} className="mt-4">
                Zgłoszenie zaakceptowane, ale Discord nie potwierdził nadania roli.
              </Notice>
            )}
          </section>

          <section className="hs-card px-6 py-5" aria-labelledby="konto">
            <h2 id="konto" className="text-base font-semibold">Konto</h2>
            <dl className="mt-3 text-sm">
              <div className="flex justify-between gap-3 py-2 border-b border-hs-raised">
                <dt className="text-hs-meta">Discord</dt>
                <dd className="truncate">@{app.applicant_username}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2 border-b border-hs-raised">
                <dt className="text-hs-meta">Discord ID</dt>
                <dd className="inline-flex items-center gap-2 font-mono text-[13px] min-w-0">
                  <span className="truncate">{app.applicant_discord_id}</span>
                  <button type="button" onClick={copyId} className="text-hs-faint hover:text-hs-ink" aria-label="Kopiuj Discord ID" title={copied ? "Skopiowano" : "Kopiuj"}>
                    {copied ? <Check className="w-3.5 h-3.5 text-hs-positive" /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  </button>
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-hs-meta">Wysłane</dt>
                <dd className="tabular-nums">{sentAt.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</dd>
              </div>
            </dl>
          </section>

          {app.can_delete_application && (
            <button
              type="button"
              onClick={deleteApplication}
              disabled={deleting}
              className="self-start inline-flex items-center gap-2 h-9 px-1 text-sm text-[#C3727C] hover:text-hs-negative disabled:opacity-50"
              data-testid="delete-application-button"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.8} />}
              {deleting ? "Usuwanie…" : "Usuń zgłoszenie"}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
