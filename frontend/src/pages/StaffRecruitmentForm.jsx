import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Loader2, ArrowLeft, Plus, Trash2, GripVertical, Save, Lock, AlertTriangle, UserPlus, X, ChevronUp, ChevronDown, Ban, Link as LinkIcon, Video } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { parseVideoFromOptions } from "../lib/videoQuestion";
import VideoPlayer from "../components/VideoPlayer";


const COLORS = [
  { label: "Cyan", value: "#00E5FF" },
  { label: "Fiolet", value: "#8B5CF6" },
  { label: "Zielony", value: "#10B981" },
  { label: "Czerwony", value: "#EF4444" },
  { label: "Pomarańczowy", value: "#F97316" },
  { label: "Różowy", value: "#EC4899" },
  { label: "Niebieski", value: "#3B82F6" },
];

const FIELD_TYPES = [
  { value: "short_text", label: "Krótka odpowiedź" },
  { value: "video", label: "Filmik" },
  { value: "long_text", label: "Długa odpowiedź" },
  { value: "single_choice", label: "Jednokrotny wybór" },
  { value: "multi_choice", label: "Wielokrotny wybór" },
  { value: "code", label: "CODE" },
];


const CATEGORIES = [
  { value: "general", label: "Ogólna" },
  { value: "factions", label: "Frakcje" },
  { value: "complaints", label: "Skargi" },
];

const DEFAULT_ACCESS = { can_edit_questions: false, can_review_applications: true, can_view_statistics: false, can_delete_applications: false, can_all: false };
const ACCESS_OPTIONS = [
  ["can_edit_questions", "Może edytować pytania"],
  ["can_review_applications", "Może sprawdzać zgłoszenia"],
  ["can_view_statistics", "Może przeglądać statystyki"],
  ["can_delete_applications", "Może usuwać podania"],
  ["can_all", "ALL"],
];

function AccessOptions({ access, canGrantAll, onChange }) {
  return ACCESS_OPTIONS.map(([key, label]) => (
    <label key={key} className="flex items-center gap-2 text-xs text-hs-muted">
      <Checkbox
        checked={!!access[key] || (key !== "can_all" && !!access.can_all)}
        disabled={key === "can_all" ? !canGrantAll : !!access.can_all}
        onCheckedChange={value => onChange({ [key]: !!value })}
        className="border-hs-control data-[state=checked]:bg-hs-accent data-[state=checked]:border-hs-accent data-[state=checked]:text-hs-ground"
      />
      {label}
    </label>
  ));
}
const DEFAULT_SECTION_TITLE = "Ogólne";

function normalizeSectionTitle(title) {
  return (title || "").trim() || DEFAULT_SECTION_TITLE;
}

function buildSectionsFromQuestions(questions = []) {
  const sections = [];
  const titleToKey = new Map();

  for (const question of questions) {
    const title = normalizeSectionTitle(question.section_title);
    if (!titleToKey.has(title)) {
      const section = { _key: crypto.randomUUID(), title };
      titleToKey.set(title, section._key);
      sections.push(section);
    }
  }

  return { sections, titleToKey };
}

function attachSectionKeys(questions = [], titleToKey = new Map()) {
  return questions.map((question) => ({
    ...question,
    section_key: titleToKey.get(normalizeSectionTitle(question.section_title)) || null,
  }));
}

export default function StaffRecruitmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, staffInfo, loading: authLoading } = useAuth();
  const isEdit = !!id;
  const initialCategory = new URLSearchParams(window.location.search).get("category") === "complaints" ? "complaints" : "general";

  const [form, setForm] = useState({ name: "", description: "", status: "active", theme_color: "#00E5FF", category: initialCategory, scope: "", accepted_discord_role_id: "" });
  const isComplaint = form.category === "complaints";
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [accessUsers, setAccessUsers] = useState([]);
  const [blacklistUsers, setBlacklistUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [pendingAccess, setPendingAccess] = useState({});
  const [permLevel, setPermLevel] = useState("full");
  const [permissions, setPermissions] = useState({
    canEditRecruitment: !isEdit,
    canEditQuestions: !isEdit,
    canReviewApplications: !isEdit,
    canManageAccess: !isEdit,
    canGrantAll: false,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState("basic");

  const fetchRecruitment = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await axios.get(`${API}/staff/recruitments/${id}`, { withCredentials: true });
      const d = res.data;
      setForm({ name: d.name, description: d.description, status: d.status === "closed" ? "inactive" : d.status, theme_color: d.theme_color, category: d.category || "general", scope: d.scope || "", accepted_discord_role_id: d.accepted_discord_role_id || "" });
      const loadedQuestions = d.questions.map((q) => ({ ...q, _key: q.id || crypto.randomUUID() }));
      const { sections: loadedSections, titleToKey } = buildSectionsFromQuestions(loadedQuestions);
      setSections(loadedSections);
      setQuestions(attachSectionKeys(loadedQuestions, titleToKey));
      setPermLevel(d.permission_level);
      setPermissions({
        canEditRecruitment: !!d.can_edit_recruitment,
        canEditQuestions: !!d.can_edit_questions,
        canReviewApplications: !!d.can_review_applications,
        canManageAccess: !!d.can_manage_access,
        canGrantAll: !!d.can_grant_all,
      });
      if (d.can_edit_recruitment) {
        setActiveTab("basic");
      } else if (d.can_edit_questions) {
        setActiveTab("questions");
      } else if (d.can_manage_access) {
        setActiveTab("access");
      }
    } catch (err) {
      setErrors([err.response?.data?.detail || "Brak dostępu"]);
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  const fetchAccess = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await axios.get(`${API}/staff/recruitments/${id}/access`, { withCredentials: true });
      setAccessUsers(res.data);
    } catch {}
  }, [id, isEdit]);

  const fetchBlacklist = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await axios.get(`${API}/staff/recruitments/${id}/blacklist`, { withCredentials: true });
      setBlacklistUsers(res.data);
    } catch {}
  }, [id, isEdit]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/staff/users`, { params: { recruitment_id: id, q: searchQ }, withCredentials: true });
      setAllUsers(res.data);
    } catch {}
  }, [id, searchQ]);

  useEffect(() => { fetchRecruitment(); }, [fetchRecruitment]);
  useEffect(() => { if (isEdit && permissions.canManageAccess) fetchAccess(); }, [isEdit, permissions.canManageAccess, fetchAccess]);
  useEffect(() => { if (isEdit && permissions.canManageAccess) fetchBlacklist(); }, [isEdit, permissions.canManageAccess, fetchBlacklist]);
  useEffect(() => { if (isEdit && permissions.canManageAccess) fetchUsers(); }, [isEdit, permissions.canManageAccess, fetchUsers]);

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const getApiError = (err, fallback) => err.response?.data?.error || err.response?.data?.detail || fallback;

  const getDefaultSectionKey = () => sections[0]?._key || null;

  const addSection = () => {
    setSections((prev) => {
      const nextIndex = prev.length + 1;
      return [...prev, { _key: crypto.randomUUID(), title: nextIndex === 1 ? "Sekcja OOC" : `Sekcja ${nextIndex}` }];
    });
  };

  const updateSection = (sectionKey, title) => {
    setSections((prev) => prev.map((section) => (
      section._key === sectionKey ? { ...section, title } : section
    )));
  };

  const removeSection = (sectionKey) => {
    const fallbackKey = sections.find((section) => section._key !== sectionKey)?._key;
    if (!fallbackKey) return;

    setSections((prev) => prev.filter((section) => section._key !== sectionKey));
    setQuestions((prev) => prev.map((question) => (
      question.section_key === sectionKey ? { ...question, section_key: fallbackKey } : question
    )));
  };

  const moveSection = (sectionKey, direction) => {
    setSections((prev) => {
      const index = prev.findIndex((section) => section._key === sectionKey);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addQuestion = () => {
    const sectionKey = getDefaultSectionKey();
    if (!sectionKey) {
      setErrors(["Najpierw dodaj sekcję"]);
      return;
    }

    setQuestions((prev) => [
      ...prev,
      {
        _key: crypto.randomUUID(),
        section_key: sectionKey,
        label: "",
        field_type: "short_text",
        required: true,
        options: null,
        sort_order: prev.length,
      },
    ]);
  };
  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };
  const removeQuestion = (idx) => setQuestions(prev => prev.filter((_, i) => i !== idx));
  const moveQuestion = (idx, dir) => {
    setQuestions(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };
  const addOption = (qIdx) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: [...(q.options || []), ""] } : q));
  };
  const updateOption = (qIdx, optIdx, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...(q.options || [])];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  };
  const removeOption = (qIdx, optIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: (q.options || []).filter((_, j) => j !== optIdx) };
    }));
  };

  const updateQuestionOptions = (idx, options) => {
    setQuestions((prev) => prev.map((question, questionIdx) => (
      questionIdx === idx ? { ...question, options } : question
    )));
  };

  const handleVideoUrlChange = (idx, value) => {
    updateQuestionOptions(idx, {
      video: {
        ...(questions[idx]?.options?.video || {}),
        url: value,
        content: undefined,
        filename: undefined,
        size: undefined,
        mime_type: undefined,
      },
    });
  };

  const removeVideo = (idx) => {
    updateQuestionOptions(idx, { video: null });
  };

  const buildQuestionOptions = (question) => {
    if (question.field_type === "single_choice" || question.field_type === "multi_choice") {
      return (question.options || []).filter((option) => option.trim());
    }

    if (question.field_type === "video") {
      const video = question.options?.video;
      if (video?.url?.trim()) {
        return { video: { url: video.url.trim() } };
      }
      return video?.content ? { video } : null;
    }

    return null;
  };

  // Access
  const getPendingAccess = (userId) => pendingAccess[userId] || DEFAULT_ACCESS;

  const updatePendingAccess = (userId, patch) => {
    setPendingAccess(prev => ({
      ...prev,
      [userId]: { ...DEFAULT_ACCESS, ...(prev[userId] || {}), ...patch },
    }));
  };

  const addAccess = async (userId) => {
    const access = getPendingAccess(userId);
    if (!ACCESS_OPTIONS.some(([key]) => access[key])) {
      setErrors(["Wybierz przynajmniej jedna permisje"]);
      return;
    }

    try {
      await axios.post(API + "/staff/recruitments/" + id + "/access", {
        user_id: userId,
        can_edit_questions: !!access.can_edit_questions,
        can_review_applications: !!access.can_review_applications,
        can_view_statistics: !!access.can_view_statistics,
        can_delete_applications: !!access.can_delete_applications,
        can_all: !!access.can_all,
      }, { withCredentials: true });
      setPendingAccess(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      fetchAccess();
    } catch (err) {
      setErrors([getApiError(err, "Nie udalo sie dodac dostepu")]);
    }
  };

  const updateAccess = async (accessUser, patch) => {
    const next = { ...accessUser, ...patch };
    if (!ACCESS_OPTIONS.some(([key]) => next[key])) {
      setErrors(["Uzytkownik musi miec przynajmniej jedna permisje"]);
      return;
    }

    try {
      await axios.patch(API + "/staff/recruitments/" + id + "/access/" + accessUser.id, {
        can_edit_questions: !!next.can_edit_questions,
        can_review_applications: !!next.can_review_applications,
        can_view_statistics: !!next.can_view_statistics,
        can_delete_applications: !!next.can_delete_applications,
        can_all: !!next.can_all,
      }, { withCredentials: true });
      setAccessUsers(prev => prev.map(u => u.id === accessUser.id ? next : u));
    } catch (err) {
      setErrors([getApiError(err, "Nie udalo sie zaktualizowac dostepu")]);
    }
  };

  const removeAccess = async (userId) => {
    try {
      await axios.delete(API + "/staff/recruitments/" + id + "/access/" + userId, { withCredentials: true });
      fetchAccess();
    } catch (err) {
      setErrors([getApiError(err, "Nie udalo sie usunac dostepu")]);
    }
  };

  // Blacklist
  const addBlacklist = async (userId) => {
    try {
      await axios.post(API + "/staff/recruitments/" + id + "/blacklist", {
        user_id: userId,
      }, { withCredentials: true });
      fetchBlacklist();
    } catch (err) {
      setErrors([getApiError(err, "Nie udalo sie dodac uzytkownika do blacklisty")]);
    }
  };

  const removeBlacklist = async (userId) => {
    try {
      await axios.delete(API + "/staff/recruitments/" + id + "/blacklist/" + userId, { withCredentials: true });
      fetchBlacklist();
    } catch (err) {
      setErrors([getApiError(err, "Nie udalo sie usunac uzytkownika z blacklisty")]);
    }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setErrors([]);

    if (questions.length > 0 && sections.length === 0) {
      setErrors(["Dodaj co najmniej jedną sekcję"]);
      setSaving(false);
      return;
    }

    const sectionTitleByKey = Object.fromEntries(
      sections.map((section) => [section._key, normalizeSectionTitle(section.title)])
    );
    const sectionOrder = Object.fromEntries(
      sections.map((section, index) => [section._key, index])
    );
    const orderedQuestions = [...questions].sort((a, b) => {
      const sectionDiff = (sectionOrder[a.section_key] ?? 0) - (sectionOrder[b.section_key] ?? 0);
      if (sectionDiff !== 0) return sectionDiff;
      return questions.indexOf(a) - questions.indexOf(b);
    });

    const missingVideo = orderedQuestions.find(
      (question) => question.field_type === "video" && !question.options?.video?.url?.trim() && !question.options?.video?.content
    );
    if (missingVideo) {
      setErrors([`Pytanie "${missingVideo.label || "bez nazwy"}" wymaga linku do filmiku`]);
      setSaving(false);
      return;
    }

    try {
      const qPayload = orderedQuestions.map((q, i) => ({
        section_title: sectionTitleByKey[q.section_key] || sections[0]?.title || DEFAULT_SECTION_TITLE,
        label: q.label,
        field_type: q.field_type,
        required: q.required,
        options: buildQuestionOptions(q),
        sort_order: i,
      }));

      if (isEdit) {
        if (permissions.canEditRecruitment) {
          await axios.put(`${API}/staff/recruitments/${id}`, form, { withCredentials: true });
        }
        if (permissions.canEditQuestions) {
          await axios.put(`${API}/staff/recruitments/${id}/questions`, { questions: qPayload }, { withCredentials: true });
        }
        navigate("/staff");
      } else {
        const res = await axios.post(`${API}/staff/recruitments`, { ...form, questions: qPayload }, { withCredentials: true });
        navigate("/staff");
      }
    } catch (err) {
      setErrors([getApiError(err, "Wystapil blad")]);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-hs-accent" /></div>;
  if (!user) return <div className="max-w-2xl mx-auto px-4 py-20 text-center"><Lock className="w-12 h-12 text-hs-faint mx-auto mb-4" /><p className="text-hs-muted">Zaloguj się</p></div>;
  if (!staffInfo?.is_staff || (!isEdit && !staffInfo?.can_create_recruitment)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-hs-notice mx-auto mb-4" />
        <p className="text-hs-muted">Brak dostepu do tej czesci panelu.</p>
      </div>
    );
  }
  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-hs-accent" /></div>;

  const showBasicTab = !isEdit || permissions.canEditRecruitment;
  const showQuestionsTab = !isEdit || permissions.canEditQuestions;
  const showAccessTab = isEdit && permissions.canManageAccess;

  const accessUserIds = new Set(accessUsers.map(u => u.id));
  const availableUsers = allUsers.filter(u => !accessUserIds.has(u.id) && u.id !== user?.id);
  const blacklistUserIds = new Set(blacklistUsers.map(u => u.id));
  const availableBlacklistUsers = allUsers.filter(u => !blacklistUserIds.has(u.id) && u.id !== user?.id);

  return (
    <div className="max-w-[880px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-16" data-testid="staff-recruitment-form">
      <Link to="/staff" className="hs-back" data-testid="back-to-staff">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />Panel staff
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="hs-display text-[40px] sm:text-[44px] leading-[0.95] break-words" data-testid="form-title">
          {isEdit ? (form.name || "...") : isComplaint ? "Nowy panel skarg" : "Nowa rekrutacja"}
        </h1>
        <p className="mt-2.5 text-base text-hs-chrome">
          {isEdit ? "Edycja panelu" : isComplaint ? "Utwórz formularz, przez który gracze zgłoszą skargę." : "Utwórz panel rekrutacji z własnym zestawem pytań."}
        </p>
      </div>

      {errors.length > 0 && (
        <div className="hs-note hs-note-bad flex-col mb-6" role="alert" data-testid="form-errors">
          {errors.map((e, i) => <p key={i} className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-none" />{e}</p>)}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-hs-surface h-11 p-1 rounded-full flex-wrap h-auto">
          {showBasicTab && <TabsTrigger value="basic" className="rounded-full px-4 h-9 data-[state=active]:bg-hs-ink data-[state=active]:text-hs-ground" data-testid="tab-basic">Podstawowe</TabsTrigger>}
          {showQuestionsTab && <TabsTrigger value="questions" className="rounded-full px-4 h-9 data-[state=active]:bg-hs-ink data-[state=active]:text-hs-ground" data-testid="tab-questions">Pytania ({questions.length})</TabsTrigger>}
          {showAccessTab && <TabsTrigger value="access" className="rounded-full px-4 h-9 data-[state=active]:bg-hs-ink data-[state=active]:text-hs-ground" data-testid="tab-access">Dostęp ({accessUsers.length})</TabsTrigger>}
          {showAccessTab && <TabsTrigger value="blacklist" className="rounded-full px-4 h-9 data-[state=active]:bg-hs-ink data-[state=active]:text-hs-ground" data-testid="tab-blacklist">Blacklista ({blacklistUsers.length})</TabsTrigger>}
        </TabsList>

        {/* Basic Tab */}
        {showBasicTab && (
          <TabsContent value="basic" className="space-y-5">
            <div>
              <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Nazwa *</Label>
              <Input value={form.name} onChange={e => updateForm("name", e.target.value)} placeholder={isComplaint ? "np. Skargi na policję" : "np. Administracja"}
                className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C]" data-testid="input-name" />
            </div>
            <div>
              <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Opis *</Label>
              <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} rows={3} placeholder="Opis widoczny publicznie..."
                className="hs-field py-3 text-[15px] leading-normal resize-y"
                data-testid="input-description" />
              <p className="mt-1.5 text-[13px] text-hs-meta">Pierwsza linia to opis panelu. Każda kolejna linia pokaże się graczom jako wyróżniona zasada, np. „Minimalny wiek: 17 lat”.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Status</Label>
                <Select value={form.status} onValueChange={v => updateForm("status", v)}>
                  <SelectTrigger className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] focus:ring-0 focus:border-hs-accent" data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktywna</SelectItem>
                    <SelectItem value="inactive">Nieaktywna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Kolor motywu</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => updateForm("theme_color", c.value)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${form.theme_color === c.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                      style={{ background: c.value }} title={c.label} data-testid={`color-${c.label}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Kategoria</Label>
                <Select value={form.category || "general"} onValueChange={v => updateForm("category", v)}>
                  <SelectTrigger className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] focus:ring-0 focus:border-hs-accent" data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isComplaint && <div>
                <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Rola Discord (po akceptacji)</Label>
                <Input value={form.accepted_discord_role_id} onChange={e => updateForm("accepted_discord_role_id", e.target.value)}
                  placeholder="ID roli Discord" className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C] font-mono"
                  data-testid="input-role-id" />
              </div>}
            </div>
            {isComplaint && <p className="hs-note hs-note-notice block">
              Skargi są obsługiwane na stronie. Każdą sprawę można zgłosić osobno, bez nadawania ról, dołączania do serwera ani wysyłania powiadomień na Discordzie.
              W zakładce Pytania przygotuj formularz, np. osoba lub jednostka, opis zdarzenia, data i linki do dowodów.
            </p>}
          </TabsContent>
        )}

        {/* Questions Tab */}
        {showQuestionsTab && <TabsContent value="questions" className="space-y-4">
          <div className="rounded-xl bg-hs-surface p-5 space-y-3" data-testid="sections-editor">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-hs-ink">Sekcje formularza</h3>
                <p className="text-xs text-hs-meta mt-1">Najpierw utwórz sekcje, a potem przypisz do nich pytania.</p>
              </div>
              <button
                type="button"
                onClick={addSection}
                className="hs-btn hs-btn-ghost hs-btn-sm"
                data-testid="add-section-button"
              >
                <Plus className="w-3.5 h-3.5" />Dodaj sekcję
              </button>
            </div>

            {sections.length === 0 ? (
              <p className="text-sm text-hs-meta">Brak sekcji. Dodaj pierwszą sekcję, aby móc tworzyć pytania.</p>
            ) : (
              <div className="space-y-2">
                {sections.map((section, sectionIdx) => (
                  <div
                    key={section._key}
                    className="flex items-center gap-2 rounded-lg bg-hs-sunken px-3 py-2"
                    data-testid={`section-editor-${sectionIdx}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveSection(section._key, -1)}
                        className="text-hs-faint hover:text-white disabled:opacity-30"
                        disabled={sectionIdx === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(section._key, 1)}
                        className="text-hs-faint hover:text-white disabled:opacity-30"
                        disabled={sectionIdx === sections.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <Input
                      value={section.title}
                      onChange={(e) => updateSection(section._key, e.target.value)}
                      placeholder="np. Sekcja OOC"
                      className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C]"
                      data-testid={`section-title-${sectionIdx}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(section._key)}
                      className="p-1.5 text-hs-faint hover:text-hs-negative transition-colors disabled:opacity-30"
                      disabled={sections.length === 1}
                      data-testid={`section-delete-${sectionIdx}`}
                      title={sections.length === 1 ? "Musi pozostać co najmniej jedna sekcja" : "Usuń sekcję"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {questions.map((q, idx) => (
            <div key={q._key || q.id} className="rounded-xl bg-hs-surface p-5 space-y-3" data-testid={`question-editor-${idx}`}>
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button onClick={() => moveQuestion(idx, -1)} className="text-hs-faint hover:text-white disabled:opacity-30" disabled={idx === 0}><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveQuestion(idx, 1)} className="text-hs-faint hover:text-white disabled:opacity-30" disabled={idx === questions.length - 1}><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <div>
                      <Label className="text-[13px] text-hs-meta mb-1.5 block">Sekcja</Label>
                      <Select
                        value={q.section_key || getDefaultSectionKey() || ""}
                        onValueChange={(value) => updateQuestion(idx, "section_key", value)}
                        disabled={sections.length === 0}
                      >
                        <SelectTrigger className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] focus:ring-0 focus:border-hs-accent" data-testid={`q-section-${idx}`}>
                          <SelectValue placeholder="Wybierz sekcję" />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((section) => (
                            <SelectItem key={section._key} value={section._key}>
                              {section.title || "Bez nazwy"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[13px] text-hs-meta mb-1.5 block">Pytanie</Label>
                      <Input value={q.label} onChange={e => updateQuestion(idx, "label", e.target.value)} placeholder="Treść pytania..."
                        className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C]" data-testid={`q-label-${idx}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={q.field_type} onValueChange={v => {
                      setQuestions((prev) => prev.map((question, questionIdx) => {
                        if (questionIdx !== idx) return question;

                        let nextOptions = null;
                        if (v === "single_choice" || v === "multi_choice") {
                          nextOptions = Array.isArray(question.options) && question.options.length > 0
                            ? question.options
                            : [""];
                        } else if (v === "video") {
                          nextOptions = question.options?.video ? question.options : { video: null };
                        }

                        return { ...question, field_type: v, options: nextOptions };
                      }));
                    }}>
                      <SelectTrigger className="w-[200px] h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] focus:ring-0 focus:border-hs-accent" data-testid={`q-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox id={`req-${idx}`} checked={q.required} onCheckedChange={v => updateQuestion(idx, "required", v)}
                        className="border-hs-control data-[state=checked]:bg-hs-accent data-[state=checked]:border-hs-accent data-[state=checked]:text-hs-ground" />
                      <Label htmlFor={`req-${idx}`} className="text-xs text-hs-muted cursor-pointer">Wymagane</Label>
                    </div>
                  </div>
                  {(q.field_type === "single_choice" || q.field_type === "multi_choice") && (
                    <div className="space-y-2 pl-3 border-l-2 border-hs-raised">
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <Input value={opt} onChange={e => updateOption(idx, optIdx, e.target.value)} placeholder={`Opcja ${optIdx + 1}`}
                            className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C] h-9 text-sm" data-testid={`q-opt-${idx}-${optIdx}`} />
                          <button onClick={() => removeOption(idx, optIdx)} className="text-hs-faint hover:text-hs-negative"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      <button onClick={() => addOption(idx)} className="text-sm hs-link flex items-center gap-1">
                        <Plus className="w-3 h-3" />Dodaj opcję
                      </button>
                    </div>
                  )}
                  {q.field_type === "video" && (
                    <div className="space-y-3 pl-3 border-l-2 border-hs-raised">
                      <div className="space-y-2">
                        <Label className="text-[13px] text-hs-meta mb-1.5 block">Link do filmiku</Label>
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-hs-accent shrink-0" />
                          <Input
                            value={q.options?.video?.url || ""}
                            onChange={(event) => handleVideoUrlChange(idx, event.target.value)}
                            placeholder="https://youtu.be/... albo bezposredni link .mp4"
                            className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C]"
                            data-testid={`q-video-url-${idx}`}
                          />
                        </div>
                      </div>
                      {parseVideoFromOptions(q.options)?.src && (
                        <div className="space-y-3 rounded-lg bg-hs-sunken p-3">
                          <div className="flex items-center gap-3">
                            <Video className="w-4 h-4 text-hs-accent shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-hs-ink">{q.options.video.url || q.options.video.filename || "Filmik"}</p>
                              <p className="text-xs text-hs-faint">Podglad filmiku</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVideo(idx)}
                              className="p-1.5 text-hs-meta hover:text-hs-negative"
                              title="Usuń filmik"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <VideoPlayer video={parseVideoFromOptions(q.options)} testId={`q-video-preview-${idx}`} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => removeQuestion(idx)} className="p-1.5 text-hs-faint hover:text-hs-negative transition-colors" data-testid={`q-delete-${idx}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            disabled={sections.length === 0}
            className="w-full h-12 rounded-xl border border-dashed border-hs-control text-[15px] text-hs-muted hover:text-white hover:border-hs-accent transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="add-question-button"
          >
            <Plus className="w-4 h-4" />Dodaj pytanie
          </button>
        </TabsContent>}

        {/* Access Tab */}
        {showAccessTab && (
          <TabsContent value="access" className="space-y-4">
            <p className="text-xs text-hs-muted">
              ALL pozwala zarządzać tą rekrutacją, pytaniami, podaniami, statystykami i dostępem.
              Tylko twórca rekrutacji i management mogą nadawać lub odbierać ALL.
              Usuwanie podań daje też wgląd w ich treść; sprawdzanie zgłoszeń jest osobnym uprawnieniem.
            </p>
            <div>
              <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Dodaj uzytkownika</Label>
              <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Szukaj po nazwie Discord..."
                className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C] mb-3" data-testid="access-search" />
              {availableUsers.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl bg-hs-surface p-2">
                  {availableUsers.map(u => {
                    const selected = getPendingAccess(u.id);
                    return (
                      <div key={u.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-hs-sunken"
                        data-testid={"add-user-" + u.discord_username}>
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={u.discord_avatar ? "https://cdn.discordapp.com/avatars/" + u.discord_id + "/" + u.discord_avatar + ".png?size=64" : undefined} />
                          <AvatarFallback className="bg-hs-raised text-hs-chrome text-xs">{(u.discord_global_name||u.discord_username||"?")[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-hs-ink truncate">{u.discord_global_name || u.discord_username}</p>
                          <p className="text-xs text-hs-meta">@{u.discord_username}</p>
                          <div className="flex flex-wrap gap-4 mt-2">
                            <AccessOptions access={selected} canGrantAll={permissions.canGrantAll} onChange={patch => updatePendingAccess(u.id, patch)} />
                          </div>
                        </div>
                        <button onClick={() => addAccess(u.id)}
                          className="hs-icon-btn w-9 h-9 bg-[#0C2A2E] text-hs-accent-soft hover:bg-[#12383C]"
                          data-testid={"confirm-add-user-" + u.discord_username}
                          title="Dodaj uzytkownika">
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Separator className="bg-hs-raised" />
            <div>
              <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Uzytkownicy z dostepem ({accessUsers.length})</Label>
              {accessUsers.length === 0 ? (
                <p className="text-sm text-hs-meta">Brak dodanych uzytkownikow</p>
              ) : (
                <div className="space-y-2" data-testid="access-users-list">
                  {accessUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-hs-sunken" data-testid={"access-user-" + u.discord_username}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.discord_avatar ? "https://cdn.discordapp.com/avatars/" + u.discord_id + "/" + u.discord_avatar + ".png?size=64" : undefined} />
                        <AvatarFallback className="bg-hs-raised text-hs-chrome text-xs">{(u.discord_global_name||u.discord_username||"?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-hs-ink truncate">{u.discord_global_name || u.discord_username}</p>
                        <p className="text-xs text-hs-meta">@{u.discord_username}</p>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <AccessOptions access={u} canGrantAll={permissions.canGrantAll} onChange={patch => updateAccess(u, patch)} />
                        </div>
                      </div>
                      <button disabled={u.can_all && !permissions.canGrantAll} onClick={() => removeAccess(u.id)} className="p-1.5 text-hs-faint hover:text-hs-negative transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-testid={"remove-user-" + u.discord_username}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Blacklist Tab */}
        {showAccessTab && (
          <TabsContent value="blacklist" className="space-y-4">
            <div className="hs-note hs-note-bad block">
              <div className="flex items-start gap-3">
                <Ban className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Blacklista zgłoszeń</p>
                  <p className="mt-1 opacity-90">
                    Osoby dodane tutaj nie będą mogły wysłać zgłoszenia w tym panelu po zalogowaniu.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Dodaj uzytkownika do blacklisty</Label>
              <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Szukaj po nazwie Discord..."
                className="h-11 rounded-lg border-hs-control bg-hs-surface text-hs-ink text-[15px] placeholder:text-[#7C868B] hover:border-[#3C474C] focus-visible:ring-0 focus:border-hs-accent focus:shadow-[0_0_0_3px_#12383C] mb-3" data-testid="blacklist-search" />
              {availableBlacklistUsers.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl bg-hs-surface p-2">
                  {availableBlacklistUsers.map(u => (
                    <div key={u.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-hs-sunken"
                      data-testid={"blacklist-add-user-" + u.discord_username}>
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={u.discord_avatar ? "https://cdn.discordapp.com/avatars/" + u.discord_id + "/" + u.discord_avatar + ".png?size=64" : undefined} />
                        <AvatarFallback className="bg-hs-raised text-hs-chrome text-xs">{(u.discord_global_name||u.discord_username||"?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-hs-ink truncate">{u.discord_global_name || u.discord_username}</p>
                        <p className="text-xs text-hs-meta">@{u.discord_username}</p>
                      </div>
                      <button onClick={() => addBlacklist(u.id)}
                        className="hs-icon-btn w-9 h-9 bg-[#2A1517] text-hs-negative hover:bg-[#3A1C20]"
                        data-testid={"confirm-blacklist-user-" + u.discord_username}
                        title="Dodaj do blacklisty">
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Separator className="bg-hs-raised" />
            <div>
              <Label className="text-hs-ink mb-2 block text-[15px] font-medium">Zablokowani uzytkownicy ({blacklistUsers.length})</Label>
              {blacklistUsers.length === 0 ? (
                <p className="text-sm text-hs-meta">Brak uzytkownikow na blackliscie</p>
              ) : (
                <div className="space-y-2" data-testid="blacklist-users-list">
                  {blacklistUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-hs-sunken" data-testid={"blacklist-user-" + u.discord_username}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.discord_avatar ? "https://cdn.discordapp.com/avatars/" + u.discord_id + "/" + u.discord_avatar + ".png?size=64" : undefined} />
                        <AvatarFallback className="bg-hs-raised text-hs-chrome text-xs">{(u.discord_global_name||u.discord_username||"?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-hs-ink truncate">{u.discord_global_name || u.discord_username}</p>
                        <p className="text-xs text-hs-meta">@{u.discord_username}</p>
                      </div>
                      <button onClick={() => removeBlacklist(u.id)} className="p-1.5 text-hs-faint hover:text-hs-negative transition-colors" data-testid={"remove-blacklist-user-" + u.discord_username}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Save button */}
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={handleSave} disabled={saving}
          className="hs-btn hs-btn-primary hs-btn-lg"
          data-testid="save-button">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Zapisywanie…" : "Zapisz"}
        </button>
        <Link to="/staff" className="hs-btn hs-btn-ghost hs-btn-lg">
          Anuluj
        </Link>
      </div>
    </div>
  );
}
