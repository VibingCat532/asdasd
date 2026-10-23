import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ArrowLeft, XCircle } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import AnswerList, { buildAnswerRows } from "../components/AnswerList";
import { Notice, PanelMark, Spinner, StatusPill } from "../components/hs";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API}/applications/${id}`, { withCredentials: true })
      .then((res) => setApplication(res.data))
      .catch((err) => setError(err.response?.data?.error || err.response?.data?.detail || "Nie udało się załadować zgłoszenia"))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (authLoading || loading) {
    return <Spinner data-testid="application-detail-loading" />;
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-hs-chrome">Zaloguj się, aby zobaczyć zgłoszenie.</p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-hs-chrome mb-4">{error || "Zgłoszenie nie znalezione"}</p>
        <Link to="/my-applications" className="hs-link text-[15px]">Wróć do moich zgłoszeń</Link>
      </div>
    );
  }

  const snapshot = application.recruitment_snapshot || {};
  const isComplaint = snapshot.category === "complaints";
  const sentAt = new Date(application.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-20" data-testid="application-detail">
      <Link to="/my-applications" className="hs-back" data-testid="back-to-applications">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
        Moje zgłoszenia
      </Link>

      <div className="mt-6 sm:mt-7 max-w-[880px]">
        <div className="flex items-center gap-4 sm:gap-5">
          <PanelMark name={application.recruitment_name} themeColor={snapshot.theme_color} category={snapshot.category} size={64} />
          <div className="min-w-0">
            <h1 className="hs-display text-[36px] sm:text-[48px] leading-[0.95] break-words" data-testid="application-recruitment-name">
              {application.recruitment_name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-hs-meta">
              <StatusPill status={application.status} audience="player" data-testid="application-status-badge" />
              <span>{isComplaint ? "Skarga wysłana" : "Podanie wysłane"} {sentAt}</span>
              {application.reviewer_name && application.status !== "nowe" && <span>· sprawdził {application.reviewer_name}</span>}
            </p>
          </div>
        </div>

        {application.status === "odrzucone" && (
          <Notice tone="bad" icon={XCircle} className="mt-7" data-testid="rejection-reason">
            {application.rejection_reason ? (
              <>
                <p className="font-semibold">Powód odrzucenia</p>
                <p className="mt-1 whitespace-pre-wrap text-hs-ink">{application.rejection_reason}</p>
              </>
            ) : (
              <p>Zgłoszenie zostało odrzucone bez podania powodu.</p>
            )}
          </Notice>
        )}

        <div className="mt-8">
          <AnswerList
            rows={buildAnswerRows(application.questions_snapshot, application.answers)}
            testId="application-answers"
            itemTestId="answer"
            downloadTestId="download-own-code"
            videoTestId="answer-video"
          />
        </div>

        <p className="mt-6 text-sm text-hs-meta">Zgłoszeń nie można edytować po wysłaniu.</p>
      </div>
    </div>
  );
}
