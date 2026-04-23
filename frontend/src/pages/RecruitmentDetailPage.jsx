import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { ArrowLeft, Loader2, Send, AlertTriangle, CheckCircle, Lock, LogIn } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import axios from "axios";
import { API } from "../lib/api";


export default function RecruitmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [recruitment, setRecruitment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors([]);
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
  };

  const validateClient = () => {
    if (!recruitment) return false;
    const errs = [];
    for (const q of recruitment.questions) {
      if (q.required) {
        const val = answers[q.id];
        if (q.field_type === "multi_choice") {
          if (!val || val.length === 0) errs.push(`Pole "${q.label}" jest wymagane`);
        } else {
          if (!val || !String(val).trim()) errs.push(`Pole "${q.label}" jest wymagane`);
        }
      }
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateClient()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/recruitments/${id}/apply`, { answers }, { withCredentials: true });
      setSubmitted(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
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

  if (loading) {
    return (
      <div className="flex justify-center py-32" data-testid="recruitment-loading">
        <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
      </div>
    );
  }

  if (!recruitment) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400 text-lg">Rekrutacja nie znaleziona</p>
        <Link to="/" className="text-[#00E5FF] text-sm mt-4 inline-block hover:underline">Powrót</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center hs-animate-fade-up" data-testid="application-submitted">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}
        >
          Aplikacja złożona
        </h2>
        <p className="text-zinc-400 mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Twoja aplikacja do rekrutacji <strong className="text-zinc-200">{recruitment.name}</strong> została
          pomyślnie złożona. Możesz śledzić jej status w zakładce "Moje Aplikacje".
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            to="/my-applications"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 transition-colors"
            data-testid="go-to-my-applications"
          >
            Moje Aplikacje
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-400 border border-white/10 hover:border-white/20 hover:text-zinc-200 transition-colors"
            data-testid="go-to-home"
          >
            Powrót
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = recruitment.status !== "active";
  const canApply = recruitment.user_can_apply === true;
  const existingStatus = recruitment.user_application_status;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
        data-testid="back-to-list"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Wszystkie rekrutacje
      </Link>

      {/* Header */}
      <div className="hs-animate-fade-up mb-8">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-1 w-10 rounded-full mt-3" style={{ background: recruitment.theme_color }} />
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}
              data-testid="recruitment-title"
            >
              {recruitment.name}
            </h1>
          </div>
          <Badge
            className={
              isClosed
                ? "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 text-xs font-mono uppercase ml-auto shrink-0"
                : "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono uppercase ml-auto shrink-0"
            }
            data-testid="recruitment-status-badge"
          >
            {isClosed ? "zamknięta" : "otwarta"}
          </Badge>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed ml-[52px]" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="recruitment-description">
          {recruitment.description}
        </p>
      </div>

      <Separator className="mb-8 border-white/5" />

      {/* Blocked states */}
      {isClosed && (
        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-6 text-center" data-testid="recruitment-closed-notice">
          <Lock className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>Ta rekrutacja jest zamknięta</p>
          <p className="text-zinc-600 text-sm mt-1">Nowe aplikacje nie są przyjmowane.</p>
        </div>
      )}

      {!isClosed && !user && (
        <div className="rounded-xl bg-[#5865F2]/5 border border-[#5865F2]/15 p-6 text-center" data-testid="login-prompt">
          <LogIn className="w-8 h-8 text-[#5865F2] mx-auto mb-3" />
          <p className="text-zinc-300 font-medium mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Zaloguj się kontem Discord, aby złożyć aplikację
          </p>
          <button
            onClick={login}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_16px_rgba(88,101,242,0.3)]"
            style={{ background: "#5865F2" }}
            data-testid="login-to-apply-button"
          >
            <SiDiscord className="w-4 h-4" />
            Zaloguj przez Discord
          </button>
        </div>
      )}

      {!isClosed && user && !canApply && existingStatus === "nowe" && (
        <div className="rounded-xl bg-[#00E5FF]/5 border border-[#00E5FF]/15 p-6 text-center" data-testid="already-applied-notice">
          <CheckCircle className="w-8 h-8 text-[#00E5FF] mx-auto mb-3" />
          <p className="text-zinc-300 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Masz już aktywną aplikację w tej rekrutacji
          </p>
          <Link
            to="/my-applications"
            className="text-[#00E5FF] text-sm mt-2 inline-block hover:underline"
          >
            Zobacz swoje aplikacje
          </Link>
        </div>
      )}

      {!isClosed && user && !canApply && existingStatus === "zaakceptowane" && (
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-6 text-center" data-testid="accepted-notice">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-zinc-300 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Twoja aplikacja w tej rekrutacji została zaakceptowana
          </p>
        </div>
      )}

      {/* Application Form */}
      {!isClosed && user && canApply && (
        <form onSubmit={handleSubmit} className="space-y-6 hs-animate-fade-up" data-testid="application-form">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-[#00E5FF]" />
            <h2 className="text-lg font-semibold" style={{ fontFamily: "'Outfit', sans-serif", color: "#FAFAFA" }}>
              Formularz aplikacyjny
            </h2>
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-4" data-testid="form-errors">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  {errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-400">{err}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {recruitment.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(val) => updateAnswer(q.id, val)}
              onToggle={(opt) => toggleMultiChoice(q.id, opt)}
            />
          ))}

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold tracking-wide bg-[#00E5FF] text-black transition-all duration-200 hover:bg-[#00E5FF]/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="submit-application-button"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? "Wysyłanie..." : "Złóż aplikację"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function QuestionField({ question, value, onChange, onToggle }) {
  const q = question;
  const id = `q-${q.id}`;

  return (
    <div className="rounded-xl bg-[#0F0F13] border border-white/5 p-5" data-testid={`question-field-${q.id}`}>
      <Label
        htmlFor={id}
        className="text-sm font-medium text-zinc-200 mb-3 block"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {q.label}
        {q.required && <span className="text-red-400 ml-1">*</span>}
      </Label>

      {q.field_type === "short_text" && (
        <Input
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Twoja odpowiedź..."
          className="bg-black/40 border-white/10 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] text-zinc-100 placeholder:text-zinc-600"
          data-testid={`input-${q.id}`}
        />
      )}

      {q.field_type === "long_text" && (
        <textarea
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Twoja odpowiedź..."
          rows={4}
          className="flex w-full rounded-md border bg-black/40 border-white/10 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] focus:outline-none transition-colors resize-y min-h-[100px]"
          data-testid={`textarea-${q.id}`}
        />
      )}

      {q.field_type === "single_choice" && q.options && (
        <RadioGroup value={value || ""} onValueChange={onChange} className="mt-1">
          {q.options.map((opt) => (
            <div key={opt} className="flex items-center gap-3 py-1.5">
              <RadioGroupItem
                value={opt}
                id={`${id}-${opt}`}
                className="border-white/20 text-[#00E5FF] data-[state=checked]:border-[#00E5FF] data-[state=checked]:bg-[#00E5FF]"
                data-testid={`radio-${q.id}-${opt}`}
              />
              <Label
                htmlFor={`${id}-${opt}`}
                className="text-sm text-zinc-300 cursor-pointer font-normal"
              >
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {q.field_type === "multi_choice" && q.options && (
        <div className="space-y-2 mt-1">
          {q.options.map((opt) => (
            <div key={opt} className="flex items-center gap-3 py-1">
              <Checkbox
                id={`${id}-${opt}`}
                checked={(value || []).includes(opt)}
                onCheckedChange={() => onToggle(opt)}
                className="border-white/20 data-[state=checked]:bg-[#00E5FF] data-[state=checked]:border-[#00E5FF]"
                data-testid={`checkbox-${q.id}-${opt}`}
              />
              <Label
                htmlFor={`${id}-${opt}`}
                className="text-sm text-zinc-300 cursor-pointer font-normal"
              >
                {opt}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
