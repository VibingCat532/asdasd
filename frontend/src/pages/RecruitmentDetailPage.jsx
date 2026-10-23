import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useApplicationDraft } from "../hooks/useApplicationDraft";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { ArrowLeft, ArrowRight, Loader2, Send, AlertTriangle, CheckCircle, Lock, FileCode, Upload, X, Ban, CloudOff, History, Clock } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import axios from "axios";
import { API } from "../lib/api";
import { parseVideoFromOptions } from "../lib/videoQuestion";
import VideoPlayer from "../components/VideoPlayer";
import { Notice, PanelMark, Spinner } from "../components/hs";
import { CATEGORY_LABELS, getCategory, pluralQuestions, splitDescription } from "../lib/panels";

const CODE_FILE_MAX_BYTES = 512 * 1024;
const CODE_FILE_MAX_FILES = 10;
const CODE_FILE_MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const CODE_FILE_ACCEPT = ".lua,.js,.jsx,.ts,.tsx,.py,.java,.cs,.cpp,.c,.h,.hpp,.php,.rb,.go,.rs,.json,.html,.css,.scss,.sql,.txt";
const DEFAULT_SECTION_TITLE = "Ogólne";

function getSectionTitle(question) {
  return (question?.section_title || "").trim() || DEFAULT_SECTION_TITLE;
}

function buildQuestionSections(questions = []) {
  const orderedTitles = [];
  const sectionMap = new Map();

  for (const question of questions) {
    const title = getSectionTitle(question);
    if (!sectionMap.has(title)) {
      sectionMap.set(title, { title, questions: [] });
      orderedTitles.push(title);
    }
    sectionMap.get(title).questions.push(question);
  }

  return orderedTitles.map((title) => sectionMap.get(title));
}

function inferCodeLanguage(filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    lua: "Lua",
    js: "JavaScript",
    jsx: "React JSX",
    ts: "TypeScript",
    tsx: "React TSX",
    py: "Python",
    java: "Java",
    cs: "C#",
    cpp: "C++",
    c: "C",
    h: "C/C++ Header",
    hpp: "C++ Header",
    php: "PHP",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    json: "JSON",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    sql: "SQL",
    txt: "Text",
  };
  return map[ext] || (ext ? ext.toUpperCase() : "Code");
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 102.4) / 10} KB`;
}

function isAnswered(question, value) {
  if (question.field_type === "multi_choice") {
    return Array.isArray(value) && value.length > 0;
  }
  if (question.field_type === "code") {
    const files = Array.isArray(value) ? value : value?.content ? [value] : [];
    return files.length > 0 && files.some(file => file.content?.trim());
  }
  return !!value && !!String(value).trim();
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
const formatDateTime = (iso) => new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

const DRAFT_STATUS_TEXT = {
  saving: () => "Zapisywanie…",
  saved: (savedAt) => (savedAt ? `Zapisano automatycznie o ${formatTime(savedAt)}` : "Zapisano automatycznie"),
  partial: (savedAt) => `Odpowiedzi zapisane${savedAt ? ` o ${formatTime(savedAt)}` : ""}, ale pliki z kodem są za duże na zapis w przeglądarce.`,
  error: () => "Nie udało się zapisać wersji roboczej w tej przeglądarce.",
};

export default function RecruitmentDetailPage() {
  const { id } = useParams();
  const { user, login } = useAuth();
  const [recruitment, setRecruitment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);
  const [missingIds, setMissingIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const fetchRecruitment = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/recruitments/${id}`, { withCredentials: true });
      setRecruitment(res.data);
    } catch {
      setRecruitment(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecruitment();
  }, [fetchRecruitment]);

  useEffect(() => {
    setCurrentSectionIndex(0);
  }, [recruitment?.id]);

  const questions = useMemo(() => recruitment?.questions || [], [recruitment]);
  const questionSections = useMemo(() => buildQuestionSections(questions), [questions]);
  const questionIds = useMemo(() => questions.map((q) => String(q.id)), [questions]);
  const isClosed = recruitment ? recruitment.status !== "active" : false;
  const canApply = recruitment?.user_can_apply === true;
  const formVisible = !!recruitment && !isClosed && !!user && canApply && !submitted;

  const draft = useApplicationDraft({
    userId: user?.id,
    recruitmentId: recruitment?.id,
    questionIds,
    enabled: formVisible,
    answers,
    sectionIndex: currentSectionIndex,
    onRestore: ({ answers: restored, sectionIndex }) => {
      setAnswers(restored);
      setCurrentSectionIndex(Math.min(Math.max(sectionIndex, 0), Math.max(questionSections.length - 1, 0)));
    },
  });

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors([]);
    setMissingIds((prev) => prev.filter((missingId) => missingId !== questionId));
  };

  const toggleMultiChoice = (questionId, option) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
    setErrors([]);
    setMissingIds((prev) => prev.filter((missingId) => missingId !== questionId));
  };

  const validateQuestions = (list) => {
    const missing = list.filter((q) => q.required && !isAnswered(q, answers[q.id]));
    setMissingIds(missing.map((q) => q.id));
    setErrors(missing.map((q) => `Pole "${q.label}" jest wymagane`));
    return missing.length === 0;
  };

  const goToSection = (index) => {
    setCurrentSectionIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitApplication = async () => {
    if (!validateQuestions(questions)) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/applications/${id}`, { answers }, { withCredentials: true });
      draft.clear();
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const data = err.response?.data;
      const detail = data?.detail;
      if (!err.response) {
        setErrors(["Brak połączenia z serwerem. Twoje odpowiedzi są zapisane w tej przeglądarce — spróbuj wysłać ponownie, gdy wróci internet."]);
      } else if (Array.isArray(data?.errors)) {
        setErrors(data.errors);
      } else if (typeof data?.error === "string") {
        setErrors([data.error]);
      } else if (typeof detail === "string") {
        setErrors([detail]);
      } else if (detail?.errors) {
        setErrors(detail.errors);
      } else {
        setErrors(["Wystąpił nieoczekiwany błąd"]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    const activeSection = questionSections[currentSectionIndex] || questionSections[0];
    const onLastSection = currentSectionIndex >= questionSections.length - 1;

    if (onLastSection) {
      submitApplication();
      return;
    }
    if (!validateQuestions(activeSection?.questions || [])) return;
    goToSection(Math.min(currentSectionIndex + 1, questionSections.length - 1));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handlePrimaryAction();
  };

  const startOver = () => {
    if (!window.confirm("Usunąć zapisane odpowiedzi i zacząć od nowa?")) return;
    draft.clear();
    setAnswers({});
    setErrors([]);
    setMissingIds([]);
    goToSection(0);
  };

  if (loading) {
    return <Spinner label="Ładowanie panelu" data-testid="recruitment-loading" />;
  }

  if (!recruitment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-lg text-hs-chrome">Panel nie znaleziony</p>
        <Link to="/" className="hs-link text-[15px] mt-4 inline-block">Wróć do paneli</Link>
      </div>
    );
  }

  const category = getCategory(recruitment);
  const isComplaint = category === "complaints";

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center" data-testid="application-submitted">
        <div className="w-16 h-16 rounded-full bg-[#13261B] text-hs-positive flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8" strokeWidth={1.8} />
        </div>
        <h1 className="hs-display text-[44px] sm:text-[56px]">{isComplaint ? "Skarga wysłana" : "Podanie wysłane"}</h1>
        <p className="mt-4 text-[17px] text-hs-chrome">
          {isComplaint ? "Twoja skarga w panelu" : "Twoje podanie do"} <strong className="text-hs-ink font-semibold">{recruitment.name}</strong> trafiło do staffu.
          Status sprawdzisz w zakładce Moje zgłoszenia.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/my-applications" className="hs-btn hs-btn-primary hs-btn-lg" data-testid="go-to-my-applications">Moje zgłoszenia</Link>
          <Link to="/" className="hs-btn hs-btn-ghost hs-btn-lg" data-testid="go-to-home">Wróć do paneli</Link>
        </div>
      </div>
    );
  }

  const existingStatus = recruitment.user_application_status;
  const isBlacklisted = recruitment.user_is_blacklisted === true || recruitment.user_apply_block_reason === "blacklisted";
  const currentSection = questionSections[currentSectionIndex] || questionSections[0];
  const isLastSection = currentSectionIndex >= questionSections.length - 1;
  const nextSection = questionSections[currentSectionIndex + 1];
  const { lead, notes } = splitDescription(recruitment.description);
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const sectionAnswered = (currentSection?.questions || []).filter((q) => isAnswered(q, answers[q.id])).length;
  const sectionTotal = currentSection?.questions.length || 0;
  const draftText = DRAFT_STATUS_TEXT[draft.status]?.(draft.savedAt);
  const categoryLine = isComplaint ? "Panel skarg" : category === "factions" ? "Rekrutacja do frakcji" : "Rekrutacja ogólna";

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-20 sm:pb-24">
      <Link to="/" className="hs-back" data-testid="back-to-list">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
        Wszystkie panele
      </Link>

      <div className="mt-6 sm:mt-7 flex flex-col lg:flex-row gap-8 lg:gap-12 lg:items-start">
        <div className="flex-1 min-w-0 lg:max-w-[760px]">
          <div className="flex items-center gap-4 sm:gap-5">
            <PanelMark recruitment={recruitment} size={64} />
            <div className="min-w-0">
              <h1 className="hs-display text-[40px] sm:text-[56px] leading-[0.95] break-words" data-testid="recruitment-title">
                {recruitment.name}
              </h1>
              <p className="mt-1.5 text-[15px] text-hs-meta">
                {categoryLine} · {questions.length} {pluralQuestions(questions.length)}
                {questionSections.length > 1 ? ` w ${questionSections.length} sekcjach` : ""}
                {isClosed && <span className="hs-pill hs-pill-neutral ml-2 align-middle" data-testid="recruitment-status-badge">Zamknięty</span>}
              </p>
            </div>
          </div>
          {lead && (
            <p className="mt-6 text-[17px] sm:text-lg text-hs-chrome max-w-[640px] whitespace-pre-line" data-testid="recruitment-description">{lead}</p>
          )}
          {notes.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 max-w-[640px]">
              {notes.map((note) => <Notice key={note} tone="notice">{note}</Notice>)}
            </div>
          )}

          <div className="mt-10">
            {isClosed && (
              <div className="hs-card p-6 sm:p-8 text-center" data-testid="recruitment-closed-notice">
                <Lock className="w-7 h-7 text-hs-faint mx-auto mb-3" strokeWidth={1.6} />
                <p className="text-base font-medium">Ten panel jest teraz zamknięty</p>
                <p className="mt-1 text-[15px] text-hs-meta">Nowe zgłoszenia nie są przyjmowane.</p>
              </div>
            )}

            {!isClosed && !user && (
              <div className="hs-card p-6 sm:p-8" data-testid="login-prompt">
                <p className="text-lg font-semibold">Zaloguj się, żeby wysłać zgłoszenie</p>
                <p className="mt-1.5 text-[15px] text-hs-meta">Twoje konto Discord to Twoja tożsamość na serwerze. Nie zakładasz nowego konta.</p>
                <button type="button" onClick={login} className="mt-5 hs-btn hs-btn-primary hs-btn-lg" data-testid="login-to-apply-button">
                  <SiDiscord className="w-5 h-5" />
                  Zaloguj przez Discord
                </button>
              </div>
            )}

            {!isClosed && user && isBlacklisted && (
              <Notice tone="bad" icon={Ban} data-testid="blacklisted-notice">
                <p className="font-semibold">Nie możesz wysłać zgłoszenia w tym panelu</p>
                <p className="mt-0.5 opacity-90">Twoje konto jest na blackliście tego panelu.</p>
              </Notice>
            )}

            {!isClosed && user && !isBlacklisted && !canApply && existingStatus === "nowe" && (
              <div className="hs-card p-6 sm:p-8" data-testid="already-applied-notice">
                <p className="text-lg font-semibold">Twoje podanie czeka na decyzję</p>
                <p className="mt-1.5 text-[15px] text-hs-meta">Kolejne możesz złożyć, gdy staff rozpatrzy obecne.</p>
                <Link to="/my-applications" className="mt-5 hs-btn hs-btn-ghost">Zobacz moje zgłoszenia</Link>
              </div>
            )}

            {formVisible && (
              <form onSubmit={handleFormSubmit} noValidate data-testid="application-form" aria-labelledby="section-title">
                {!isComplaint && existingStatus === "zaakceptowane" && (
                  <Notice tone="ok" icon={CheckCircle} className="mb-6" data-testid="accepted-notice">
                    Twoje poprzednie podanie w tym panelu zostało zaakceptowane. Możesz złożyć kolejne.
                  </Notice>
                )}
                {!isComplaint && existingStatus === "odrzucone" && (
                  <Notice tone="info" className="mb-6" data-testid="rejected-before-notice">
                    Poprzednie podanie zostało odrzucone. Możesz złożyć nowe — powód odrzucenia znajdziesz w zakładce Moje zgłoszenia.
                  </Notice>
                )}
                {draft.restoredAt && (
                  <Notice tone="info" icon={History} className="mb-6" data-testid="draft-restored-notice">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Przywróciliśmy odpowiedzi zapisane {formatDateTime(draft.restoredAt)}.</span>
                      <button type="button" onClick={startOver} className="underline underline-offset-2 hover:text-white">Zacznij od nowa</button>
                    </div>
                  </Notice>
                )}

                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <h2 id="section-title" className="text-[24px] sm:text-[26px] font-semibold leading-tight">
                    {questionSections.length > 1 ? currentSection?.title : isComplaint ? "Formularz skargi" : "Podanie"}
                  </h2>
                  {questionSections.length > 1 && (
                    <p className="text-[15px] text-hs-meta">Sekcja {currentSectionIndex + 1} z {questionSections.length}</p>
                  )}
                </div>
                <div className="mt-3.5 h-1 rounded-full bg-hs-raised" aria-hidden="true">
                  <div className="h-1 rounded-full bg-hs-accent transition-[width] duration-300" style={{ width: `${sectionTotal ? (sectionAnswered / sectionTotal) * 100 : 0}%` }} />
                </div>

                {errors.length > 0 && (
                  <Notice tone="bad" icon={errors.length === 1 && errors[0].startsWith("Brak połączenia") ? CloudOff : AlertTriangle} className="mt-6" role="alert" data-testid="form-errors">
                    <ul className="space-y-1">
                      {errors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                  </Notice>
                )}

                {currentSection && (
                  <div className="mt-8 flex flex-col gap-7" data-testid={`application-section-${currentSectionIndex}`}>
                    {currentSection.questions.map((q) => (
                      <QuestionField
                        key={q.id}
                        question={q}
                        value={answers[q.id]}
                        invalid={missingIds.includes(q.id)}
                        onChange={(val) => updateAnswer(q.id, val)}
                        onToggle={(opt) => toggleMultiChoice(q.id, opt)}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-10 pt-6 border-t border-hs-raised flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => goToSection(Math.max(currentSectionIndex - 1, 0))}
                    disabled={currentSectionIndex === 0 || submitting}
                    className="hs-btn hs-btn-ghost h-12 px-5"
                    data-testid="prev-section-button"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />Wstecz
                  </button>
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    disabled={submitting}
                    className="hs-btn hs-btn-primary hs-btn-lg"
                    data-testid={isLastSection ? "submit-application-button" : "next-section-button"}
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Wysyłanie…</>
                    ) : isLastSection ? (
                      <><Send className="w-4 h-4" strokeWidth={1.8} />{isComplaint ? "Wyślij skargę" : "Złóż podanie"}</>
                    ) : (
                      <>Dalej{nextSection ? `: ${nextSection.title}` : ""}<ArrowRight className="w-4 h-4" strokeWidth={1.8} /></>
                    )}
                  </button>
                </div>
                {draftText && (
                  <p className="lg:hidden mt-4 text-sm text-hs-meta" aria-live="polite">{draftText}</p>
                )}
              </form>
            )}
          </div>
        </div>

        {formVisible && (
          <aside aria-label="Postęp zgłoszenia" className="hidden lg:flex w-[360px] flex-none flex-col gap-4 sticky top-24">
            <div className="hs-card p-6">
              <h2 className="text-base font-semibold">{isComplaint ? "Twoja skarga" : "Twoje podanie"}</h2>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="hs-display text-[40px] leading-none tabular-nums">{answeredCount}</span>
                <span className="text-[15px] text-hs-meta">z {questions.length} odpowiedzi</span>
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-hs-line" aria-hidden="true">
                <div className="h-1.5 rounded-full bg-hs-accent transition-[width] duration-300" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
              </div>
              {questionSections.length > 1 && (
                <ol className="mt-5">
                  {questionSections.map((section, index) => {
                    const done = section.questions.filter((q) => isAnswered(q, answers[q.id])).length;
                    const current = index === currentSectionIndex;
                    return (
                      <li key={section.title} className={`flex items-center gap-3 py-3 ${index < questionSections.length - 1 ? "border-b border-hs-raised" : ""}`}>
                        <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-none ${current ? "bg-hs-accent" : "bg-[#3A4448]"}`} />
                        <span className={`flex-1 text-[15px] ${current ? "font-semibold" : "text-hs-muted"}`}>{section.title}</span>
                        <span className={`text-sm tabular-nums ${current ? "text-hs-muted" : "text-hs-meta"}`}>{done} / {section.questions.length}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div className="rounded-xl bg-hs-sunken px-6 py-5 text-[15px] text-hs-muted">
              <p className="flex items-start gap-2.5" aria-live="polite">
                <Clock className="w-4 h-4 mt-0.5 flex-none text-hs-meta" strokeWidth={1.8} aria-hidden="true" />
                <span>{draftText || "Odpowiedzi zapisują się automatycznie w tej przeglądarce."}</span>
              </p>
              <p className="mt-3">
                Jeśli zamkniesz stronę albo stracisz internet, po powrocie odpowiedzi będą na miejscu. Wysyłasz jako{" "}
                <span className="text-hs-ink font-medium">{user.discord_global_name || user.discord_username}</span>.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function QuestionField({ question, value, invalid, onChange, onToggle }) {
  const q = question;
  const id = `q-${q.id}`;
  const errorId = `${id}-error`;
  const [fileError, setFileError] = useState(null);
  const codeFiles = Array.isArray(value) ? value : value?.content ? [value] : [];
  const questionVideo = q.field_type === "video" ? parseVideoFromOptions(q.options) : null;
  const fieldClass = `hs-field ${invalid ? "hs-field-invalid" : ""}`;
  const describedBy = invalid ? errorId : undefined;

  const handleCodeFile = async (event) => {
    const files = Array.from(event.target.files || []);
    setFileError(null);

    if (files.length === 0) {
      return;
    }

    if (codeFiles.length + files.length > CODE_FILE_MAX_FILES) {
      setFileError(`Możesz załączyć maksymalnie ${CODE_FILE_MAX_FILES} plików.`);
      event.target.value = "";
      return;
    }

    const oversized = files.find(file => file.size > CODE_FILE_MAX_BYTES);
    if (oversized) {
      setFileError(`Plik "${oversized.name}" jest za duży. Maksymalny rozmiar to 512 KB.`);
      event.target.value = "";
      return;
    }

    const totalSize = codeFiles.reduce((sum, file) => sum + (file.size || 0), 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > CODE_FILE_MAX_TOTAL_BYTES) {
      setFileError("Łączny rozmiar plików nie może przekroczyć 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      const nextFiles = await Promise.all(files.map(async (file) => ({
        filename: file.name,
        language: inferCodeLanguage(file.name),
        size: file.size,
        content: await file.text(),
      })));
      onChange([...codeFiles, ...nextFiles]);
    } catch {
      setFileError("Nie udało się odczytać pliku.");
    } finally {
      event.target.value = "";
    }
  };

  const removeCodeFile = (index) => {
    const nextFiles = codeFiles.filter((_, fileIndex) => fileIndex !== index);
    onChange(nextFiles.length > 0 ? nextFiles : "");
  };

  const labelFor = ["short_text", "long_text", "code"].includes(q.field_type) ? id : q.field_type === "video" ? `${id}-answer` : undefined;
  const LabelTag = labelFor ? "label" : "p";

  return (
    <div data-testid={`question-field-${q.id}`} role={labelFor ? undefined : "group"} aria-labelledby={labelFor ? undefined : `${id}-label`}>
      <LabelTag id={`${id}-label`} htmlFor={labelFor} className="hs-label">
        {q.label}
        {q.required && <span className="text-[#E5566F] ml-1" aria-hidden="true">*</span>}
        {q.required && <span className="sr-only"> (wymagane)</span>}
      </LabelTag>

      <div className="mt-2.5">
        {q.field_type === "short_text" && (
          <input
            id={id}
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Twoja odpowiedź"
            className={`${fieldClass} h-12`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            data-testid={`input-${q.id}`}
          />
        )}

        {q.field_type === "long_text" && (
          <textarea
            id={id}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Twoja odpowiedź"
            rows={5}
            className={`${fieldClass} py-3 leading-normal resize-y min-h-[120px]`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            data-testid={`textarea-${q.id}`}
          />
        )}

        {q.field_type === "single_choice" && q.options && (
          <RadioGroup value={value || ""} onValueChange={onChange} className="gap-1" aria-labelledby={`${id}-label`}>
            {q.options.map((opt) => (
              <label key={opt} htmlFor={`${id}-${opt}`} className="flex items-center gap-3 min-h-[44px] px-3.5 rounded-lg bg-hs-surface cursor-pointer hover:bg-[#12171A]">
                <RadioGroupItem
                  value={opt}
                  id={`${id}-${opt}`}
                  className="border-hs-control text-hs-accent data-[state=checked]:border-hs-accent"
                  data-testid={`radio-${q.id}-${opt}`}
                />
                <span className="text-[15px] text-hs-ink">{opt}</span>
              </label>
            ))}
          </RadioGroup>
        )}

        {q.field_type === "multi_choice" && q.options && (
          <div className="flex flex-col gap-1">
            {q.options.map((opt) => (
              <label key={opt} htmlFor={`${id}-${opt}`} className="flex items-center gap-3 min-h-[44px] px-3.5 rounded-lg bg-hs-surface cursor-pointer hover:bg-[#12171A]">
                <Checkbox
                  id={`${id}-${opt}`}
                  checked={(value || []).includes(opt)}
                  onCheckedChange={() => onToggle(opt)}
                  className="border-hs-control data-[state=checked]:bg-hs-accent data-[state=checked]:border-hs-accent data-[state=checked]:text-hs-ground"
                  data-testid={`checkbox-${q.id}-${opt}`}
                />
                <span className="text-[15px] text-hs-ink">{opt}</span>
              </label>
            ))}
          </div>
        )}

        {q.field_type === "video" && (
          <div className="flex flex-col gap-4">
            {questionVideo?.src ? (
              <VideoPlayer video={questionVideo} testId={`video-player-${q.id}`} />
            ) : (
              <p className="text-[15px] text-hs-meta">Nagranie nie jest dostępne.</p>
            )}
            <textarea
              id={`${id}-answer`}
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Twoja odpowiedź po obejrzeniu nagrania"
              rows={6}
              className={`${fieldClass} py-3 leading-normal resize-y min-h-[140px]`}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              data-testid={`video-answer-${q.id}`}
            />
          </div>
        )}

        {q.field_type === "code" && (
          <div className="flex flex-col gap-3">
            <label
              htmlFor={id}
              className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors hover:border-hs-accent ${invalid ? "border-[#E5566F]" : "border-hs-control"} bg-hs-sunken`}
            >
              <Upload className="w-5 h-5 text-hs-accent" strokeWidth={1.8} />
              <span className="text-[15px] font-medium">
                {codeFiles.length > 0 ? "Dodaj kolejne pliki z kodem" : "Wybierz pliki z kodem"}
              </span>
              <span className="text-sm text-hs-meta">Lua, JS, TS, Python, C++, HTML, CSS, JSON i inne, do 512 KB na plik</span>
            </label>
            <input
              id={id}
              type="file"
              multiple
              accept={CODE_FILE_ACCEPT}
              onChange={handleCodeFile}
              className="sr-only"
              data-testid={`code-file-${q.id}`}
            />
            {fileError && <p className="text-sm text-hs-negative" role="alert">{fileError}</p>}
            {codeFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                {codeFiles.map((file, index) => (
                  <div key={`${file.filename}-${index}`} className="flex items-center gap-3 rounded-lg bg-hs-surface px-3.5 py-2.5">
                    <FileCode className="w-4 h-4 text-hs-accent flex-none" strokeWidth={1.8} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">{file.filename}</p>
                      <p className="text-[13px] text-hs-meta">{file.language || inferCodeLanguage(file.filename)} · {formatBytes(file.size || file.content?.length || 0)}</p>
                    </div>
                    <button type="button" onClick={() => removeCodeFile(index)} className="hs-icon-btn hover:text-hs-negative" aria-label={`Usuń plik ${file.filename}`} title="Usuń plik">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <p className="text-[13px] text-hs-meta tabular-nums">
                  {codeFiles.length}/{CODE_FILE_MAX_FILES} plików · {formatBytes(codeFiles.reduce((sum, file) => sum + (file.size || 0), 0))} z 5 MB
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {invalid && (
        <p id={errorId} className="mt-2 flex items-center gap-2 text-sm text-[#F08A9B]">
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
          To pole jest wymagane
        </p>
      )}
    </div>
  );
}
