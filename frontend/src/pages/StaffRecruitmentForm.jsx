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
import { Loader2, ArrowLeft, Plus, Trash2, GripVertical, Save, Lock, AlertTriangle, UserPlus, X, ChevronUp, ChevronDown } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";


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
  { value: "long_text", label: "Długa odpowiedź" },
  { value: "single_choice", label: "Jednokrotny wybór" },
  { value: "multi_choice", label: "Wielokrotny wybór" },
];

export default function StaffRecruitmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, staffInfo, loading: authLoading } = useAuth();
  const isEdit = !!id;

  const [form, setForm] = useState({ name: "", description: "", status: "active", theme_color: "#00E5FF", scope: "", accepted_discord_role_id: "" });
  const [questions, setQuestions] = useState([]);
  const [accessUsers, setAccessUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [permLevel, setPermLevel] = useState("full");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState("basic");

  const fetchRecruitment = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await axios.get(`${API}/staff/recruitments/${id}`, { withCredentials: true });
      const d = res.data;
      setForm({ name: d.name, description: d.description, status: d.status, theme_color: d.theme_color, scope: d.scope || "", accepted_discord_role_id: d.accepted_discord_role_id || "" });
      setQuestions(d.questions.map(q => ({ ...q, _key: q.id || crypto.randomUUID() })));
      setPermLevel(d.permission_level);
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

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/staff/users${searchQ ? `?q=${encodeURIComponent(searchQ)}` : ""}`, { withCredentials: true });
      setAllUsers(res.data);
    } catch {}
  }, [searchQ]);

  useEffect(() => { fetchRecruitment(); }, [fetchRecruitment]);
  useEffect(() => { if (isEdit && permLevel === "full") fetchAccess(); }, [isEdit, permLevel, fetchAccess]);
  useEffect(() => { if (isEdit && permLevel === "full") fetchUsers(); }, [isEdit, permLevel, fetchUsers]);

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Questions
  const addQuestion = () => {
    setQuestions(prev => [...prev, { _key: crypto.randomUUID(), label: "", field_type: "short_text", required: true, options: null, sort_order: prev.length }]);
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

  // Access
  const addAccess = async (userId) => {
    try {
      await axios.post(`${API}/staff/recruitments/${id}/access`, { user_id: userId }, { withCredentials: true });
      fetchAccess();
    } catch {}
  };
  const removeAccess = async (userId) => {
    try {
      await axios.delete(`${API}/staff/recruitments/${id}/access/${userId}`, { withCredentials: true });
      fetchAccess();
    } catch {}
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const qPayload = questions.map((q, i) => ({
        label: q.label, field_type: q.field_type, required: q.required,
        options: (q.field_type === "single_choice" || q.field_type === "multi_choice") ? (q.options || []).filter(o => o.trim()) : null,
        sort_order: i,
      }));

      if (isEdit) {
        if (permLevel === "full") {
          await axios.put(`${API}/staff/recruitments/${id}`, form, { withCredentials: true });
        }
        await axios.put(`${API}/staff/recruitments/${id}/questions`, { questions: qPayload }, { withCredentials: true });
        navigate("/staff");
      } else {
        const res = await axios.post(`${API}/staff/recruitments`, { ...form, questions: qPayload }, { withCredentials: true });
        navigate("/staff");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrors([typeof detail === "string" ? detail : "Wystąpił błąd"]);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" /></div>;
  if (!user) return <div className="max-w-2xl mx-auto px-4 py-20 text-center"><Lock className="w-12 h-12 text-zinc-600 mx-auto mb-4" /><p className="text-zinc-400">Zaloguj się</p></div>;
  if (!staffInfo?.is_staff || (!isEdit && !staffInfo?.can_create_recruitment)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-zinc-400">Brak dostepu do tej czesci panelu.</p>
      </div>
    );
  }
  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" /></div>;

  const showBasicTab = !isEdit || permLevel === "full";
  const showAccessTab = isEdit && permLevel === "full";

  const accessUserIds = new Set(accessUsers.map(u => u.id));
  const availableUsers = allUsers.filter(u => !accessUserIds.has(u.id) && u.id !== user?.id);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-testid="staff-recruitment-form">
      <Link to="/staff" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6" data-testid="back-to-staff">
        <ArrowLeft className="w-3.5 h-3.5" />Panel Staff
      </Link>

      <div className="hs-animate-fade-up mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00E5FF] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {isEdit ? "Edycja rekrutacji" : "Nowa rekrutacja"}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }} data-testid="form-title">
          {isEdit ? (form.name || "...") : "Utwórz rekrutację"}
        </h1>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-4 mb-6" data-testid="form-errors">
          {errors.map((e, i) => <p key={i} className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />{e}</p>)}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#0F0F13] border border-white/5">
          {showBasicTab && <TabsTrigger value="basic" className="data-[state=active]:bg-[#00E5FF]/15 data-[state=active]:text-[#00E5FF]" data-testid="tab-basic">Podstawowe</TabsTrigger>}
          <TabsTrigger value="questions" className="data-[state=active]:bg-[#00E5FF]/15 data-[state=active]:text-[#00E5FF]" data-testid="tab-questions">Pytania ({questions.length})</TabsTrigger>
          {showAccessTab && <TabsTrigger value="access" className="data-[state=active]:bg-[#00E5FF]/15 data-[state=active]:text-[#00E5FF]" data-testid="tab-access">Dostęp ({accessUsers.length})</TabsTrigger>}
        </TabsList>

        {/* Basic Tab */}
        {showBasicTab && (
          <TabsContent value="basic" className="space-y-5">
            <div>
              <Label className="text-zinc-300 mb-1.5 block text-sm">Nazwa *</Label>
              <Input value={form.name} onChange={e => updateForm("name", e.target.value)} placeholder="np. Administracja"
                className="bg-black/40 border-white/10 focus:border-[#00E5FF] text-zinc-100" data-testid="input-name" />
            </div>
            <div>
              <Label className="text-zinc-300 mb-1.5 block text-sm">Opis *</Label>
              <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} rows={3} placeholder="Opis widoczny publicznie..."
                className="flex w-full rounded-md border bg-black/40 border-white/10 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] focus:outline-none resize-y"
                data-testid="input-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300 mb-1.5 block text-sm">Status</Label>
                <Select value={form.status} onValueChange={v => updateForm("status", v)}>
                  <SelectTrigger className="bg-black/40 border-white/10 text-zinc-100" data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktywna</SelectItem>
                    <SelectItem value="closed">Zamknięta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300 mb-1.5 block text-sm">Kolor motywu</Label>
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
                <Label className="text-zinc-300 mb-1.5 block text-sm">Zakres (scope)</Label>
                <Select value={form.scope || "general"} onValueChange={v => updateForm("scope", v === "general" ? "" : v)}>
                  <SelectTrigger className="bg-black/40 border-white/10 text-zinc-100" data-testid="select-scope"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Ogólny</SelectItem>
                    <SelectItem value="administracja">Administracja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300 mb-1.5 block text-sm">Rola Discord (po akceptacji)</Label>
                <Input value={form.accepted_discord_role_id} onChange={e => updateForm("accepted_discord_role_id", e.target.value)}
                  placeholder="ID roli Discord" className="bg-black/40 border-white/10 focus:border-[#00E5FF] text-zinc-100 font-mono text-xs"
                  data-testid="input-role-id" />
              </div>
            </div>
          </TabsContent>
        )}

        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q._key || q.id} className="rounded-xl bg-[#0F0F13] border border-white/5 p-4 space-y-3" data-testid={`question-editor-${idx}`}>
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button onClick={() => moveQuestion(idx, -1)} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30" disabled={idx === 0}><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveQuestion(idx, 1)} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30" disabled={idx === questions.length - 1}><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex-1 space-y-3">
                  <Input value={q.label} onChange={e => updateQuestion(idx, "label", e.target.value)} placeholder="Treść pytania..."
                    className="bg-black/40 border-white/10 text-zinc-100 text-sm" data-testid={`q-label-${idx}`} />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={q.field_type} onValueChange={v => {
                      updateQuestion(idx, "field_type", v);
                      if (v === "single_choice" || v === "multi_choice") {
                        if (!q.options || q.options.length === 0) updateQuestion(idx, "options", [""]);
                      }
                    }}>
                      <SelectTrigger className="w-[180px] bg-black/40 border-white/10 text-zinc-300 text-xs" data-testid={`q-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox id={`req-${idx}`} checked={q.required} onCheckedChange={v => updateQuestion(idx, "required", v)}
                        className="border-white/20 data-[state=checked]:bg-[#00E5FF] data-[state=checked]:border-[#00E5FF]" />
                      <Label htmlFor={`req-${idx}`} className="text-xs text-zinc-400 cursor-pointer">Wymagane</Label>
                    </div>
                  </div>
                  {(q.field_type === "single_choice" || q.field_type === "multi_choice") && (
                    <div className="space-y-2 pl-2 border-l-2 border-white/5">
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <Input value={opt} onChange={e => updateOption(idx, optIdx, e.target.value)} placeholder={`Opcja ${optIdx + 1}`}
                            className="bg-black/40 border-white/10 text-zinc-100 text-xs h-8" data-testid={`q-opt-${idx}-${optIdx}`} />
                          <button onClick={() => removeOption(idx, optIdx)} className="text-zinc-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      <button onClick={() => addOption(idx)} className="text-xs text-[#00E5FF] hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" />Dodaj opcję
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => removeQuestion(idx)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors" data-testid={`q-delete-${idx}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button onClick={addQuestion}
            className="w-full py-3 rounded-xl border border-dashed border-white/10 text-sm text-zinc-500 hover:text-[#00E5FF] hover:border-[#00E5FF]/30 transition-colors flex items-center justify-center gap-2"
            data-testid="add-question-button">
            <Plus className="w-4 h-4" />Dodaj pytanie
          </button>
        </TabsContent>

        {/* Access Tab */}
        {showAccessTab && (
          <TabsContent value="access" className="space-y-4">
            <div>
              <Label className="text-zinc-300 mb-1.5 block text-sm">Dodaj użytkownika</Label>
              <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Szukaj po nazwie Discord..."
                className="bg-black/40 border-white/10 text-zinc-100 mb-3" data-testid="access-search" />
              {availableUsers.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-white/5 p-2">
                  {availableUsers.map(u => (
                    <button key={u.id} onClick={() => addAccess(u.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                      data-testid={`add-user-${u.discord_username}`}>
                      <Avatar className="w-7 h-7 border border-white/10">
                        <AvatarImage src={u.discord_avatar ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=64` : undefined} />
                        <AvatarFallback className="bg-zinc-900 text-zinc-400 text-xs">{(u.discord_global_name||u.discord_username||"?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{u.discord_global_name || u.discord_username}</p>
                        <p className="text-xs text-zinc-500">@{u.discord_username}</p>
                      </div>
                      <UserPlus className="w-4 h-4 text-zinc-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Separator className="border-white/5" />
            <div>
              <Label className="text-zinc-300 mb-2 block text-sm">Użytkownicy z dostępem ({accessUsers.length})</Label>
              {accessUsers.length === 0 ? (
                <p className="text-sm text-zinc-500">Brak dodanych użytkowników</p>
              ) : (
                <div className="space-y-2" data-testid="access-users-list">
                  {accessUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5" data-testid={`access-user-${u.discord_username}`}>
                      <Avatar className="w-8 h-8 border border-white/10">
                        <AvatarImage src={u.discord_avatar ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=64` : undefined} />
                        <AvatarFallback className="bg-zinc-900 text-zinc-400 text-xs">{(u.discord_global_name||u.discord_username||"?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{u.discord_global_name || u.discord_username}</p>
                        <p className="text-xs text-zinc-500">@{u.discord_username}</p>
                      </div>
                      <button onClick={() => removeAccess(u.id)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors" data-testid={`remove-user-${u.discord_username}`}>
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
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          data-testid="save-button">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Zapisywanie..." : "Zapisz"}
        </button>
        <Link to="/staff" className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-400 border border-white/10 hover:border-white/20 hover:text-zinc-200 transition-colors">
          Anuluj
        </Link>
      </div>
    </div>
  );
}
