import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FilePlus2,
  FileText,
  ImagePlus,
  Loader2,
  Mail,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Category = "labour" | "materials" | "callout" | "equipment" | "other";
type LineItem = { id: string; category: Category; description: string; unit: string; quantity: number; rate: number; markupPercent: number; sortOrder: number };
type PhotoInput = { fileName: string; dataUrl?: string; storageKey?: string; url?: string; previewUrl: string };
type QuoteForm = {
  id?: number;
  quoteNumber?: string;
  status: "draft" | "ready" | "sent";
  businessName: string;
  businessAbn: string;
  businessLicence: string;
  businessPhone: string;
  businessEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  trade: string;
  jobTitle: string;
  jobAddress: string;
  siteDetails: string;
  scopeOfWork: string;
  assumptions: string;
  exclusions: string;
  terms: string;
  gstRate: number;
  validUntil: string;
  lineItems: LineItem[];
  photos: PhotoInput[];
};

const defaultTerms = "This quote is valid for 14 days from the date of issue. Work is subject to site inspection and any required approvals. Payment terms are as agreed in writing before commencement.";
const blankLine = (sortOrder: number): LineItem => ({ id: crypto.randomUUID(), category: "labour", description: "", unit: "hour", quantity: 1, rate: 0, markupPercent: 0, sortOrder });
const newQuote = (): QuoteForm => ({
  status: "draft", businessName: "", businessAbn: "", businessLicence: "", businessPhone: "", businessEmail: "", customerName: "", customerEmail: "", customerPhone: "", trade: "Plumbing", jobTitle: "", jobAddress: "", siteDetails: "", scopeOfWork: "", assumptions: "", exclusions: "", terms: defaultTerms, gstRate: 10, validUntil: dateInputValue(14), lineItems: [blankLine(0)], photos: [],
});

function dateInputValue(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function formatAud(value: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function lineTotal(line: LineItem) {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const rate = Math.max(0, Number(line.rate) || 0);
  const markup = Math.max(-100, Number(line.markupPercent) || 0);
  return Math.round(quantity * rate * (1 + markup / 100) * 100) / 100;
}

function quoteTotals(form: QuoteForm) {
  const subtotal = form.lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const gst = Math.round(subtotal * (Math.max(0, Number(form.gstRate) || 0) / 100) * 100) / 100;
  return { subtotal, gst, total: subtotal + gst };
}

function normaliseDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toForm(detail: any): QuoteForm {
  const quote = detail.quote;
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    businessName: quote.businessName || "",
    businessAbn: quote.businessAbn || "",
    businessLicence: quote.businessLicence || "",
    businessPhone: quote.businessPhone || "",
    businessEmail: quote.businessEmail || "",
    customerName: quote.customerName,
    customerEmail: quote.customerEmail || "",
    customerPhone: quote.customerPhone || "",
    trade: quote.trade,
    jobTitle: quote.jobTitle,
    jobAddress: quote.jobAddress || "",
    siteDetails: quote.siteDetails || "",
    scopeOfWork: quote.scopeOfWork || "",
    assumptions: quote.assumptions || "",
    exclusions: quote.exclusions || "",
    terms: quote.terms || defaultTerms,
    gstRate: Number(quote.gstRate),
    validUntil: normaliseDate(quote.validUntil),
    lineItems: detail.lineItems.map((item: any) => ({
      id: String(item.id), category: item.category, description: item.description, unit: item.unit, quantity: Number(item.quantity), rate: Number(item.rate), markupPercent: Number(item.markupPercent), sortOrder: item.sortOrder,
    })),
    photos: detail.photos.map((photo: any) => ({ fileName: photo.fileName, storageKey: photo.storageKey, url: photo.url, previewUrl: photo.url })),
  };
}

function statusLabel(status: QuoteForm["status"]) {
  return status === "ready" ? "Ready to send" : status === "sent" ? "Sent" : "Draft";
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [form, setForm] = useState<QuoteForm>(() => newQuote());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const quotesQuery = trpc.quote.list.useQuery(undefined, { enabled: isAuthenticated });
  const quoteQuery = trpc.quote.get.useQuery({ id: selectedId ?? -1 }, { enabled: Boolean(selectedId), staleTime: 0 });
  const draftMutation = trpc.quote.draft.useMutation();
  const createMutation = trpc.quote.create.useMutation();
  const updateMutation = trpc.quote.update.useMutation();
  const duplicateMutation = trpc.quote.duplicate.useMutation();
  const totals = useMemo(() => quoteTotals(form), [form]);

  useEffect(() => {
    if (quoteQuery.data && selectedId === quoteQuery.data.quote.id) setForm(toForm(quoteQuery.data));
  }, [quoteQuery.data, selectedId]);

  const updateForm = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const updateLine = (id: string, patch: Partial<LineItem>) => setForm(current => ({ ...current, lineItems: current.lineItems.map(line => line.id === id ? { ...line, ...patch } : line) }));
  const addLine = () => setForm(current => ({ ...current, lineItems: [...current.lineItems, blankLine(current.lineItems.length)] }));
  const removeLine = (id: string) => setForm(current => ({ ...current, lineItems: current.lineItems.length > 1 ? current.lineItems.filter(line => line.id !== id).map((line, index) => ({ ...line, sortOrder: index })) : [blankLine(0)] }));

  const loadQuote = (id: number) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setForm(newQuote());
  };

  const startNewQuote = () => {
    setSelectedId(null);
    setForm(newQuote());
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Photo could not be read"));
    reader.onerror = () => reject(new Error("Photo could not be read"));
    reader.readAsDataURL(file);
  });

  const handlePhotoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const available = 5 - form.photos.length;
    if (available <= 0) { toast.error("A quote can include up to five job-site photos."); return; }
    const accepted = files.slice(0, available).filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 7 * 1024 * 1024);
    if (accepted.length !== files.slice(0, available).length) toast.message("Only JPEG, PNG, or WebP files below 7 MB were added.");
    try {
      const added = await Promise.all(accepted.map(async file => ({ fileName: file.name, dataUrl: await fileToDataUrl(file), previewUrl: URL.createObjectURL(file) })));
      setForm(current => ({ ...current, photos: [...current.photos, ...added] }));
    } catch { toast.error("One or more photos could not be added."); }
    event.target.value = "";
  };

  const removePhoto = (index: number) => setForm(current => ({ ...current, photos: current.photos.filter((_, photoIndex) => photoIndex !== index) }));

  const generateDraft = () => {
    if (!form.jobTitle.trim() || !form.trade.trim()) { toast.error("Add a trade and job title before generating a draft."); return; }
    draftMutation.mutate({
      trade: form.trade, jobTitle: form.jobTitle, jobAddress: form.jobAddress || undefined, siteDetails: form.siteDetails || undefined, existingScope: form.scopeOfWork || undefined,
      photos: form.photos.filter(photo => photo.dataUrl).map(photo => ({ dataUrl: photo.dataUrl!, fileName: photo.fileName })),
    }, {
      onSuccess: draft => {
        setForm(current => ({
          ...current,
          scopeOfWork: draft.scopeOfWork,
          assumptions: draft.assumptions.map(item => `• ${item}`).join("\n"),
          exclusions: draft.exclusions.map(item => `• ${item}`).join("\n"),
          lineItems: draft.suggestedLineItems.length ? draft.suggestedLineItems.map((item, index) => ({ ...item, id: crypto.randomUUID(), sortOrder: index })) : current.lineItems,
        }));
        toast.success("Draft applied. Review every quantity, rate, and condition before sending.");
      },
      onError: error => toast.error(error.message || "The AI draft could not be generated."),
    });
  };

  const payload = () => ({
    status: form.status, businessName: form.businessName.trim(), businessAbn: form.businessAbn.trim(), businessLicence: form.businessLicence.trim(), businessPhone: form.businessPhone.trim(), businessEmail: form.businessEmail.trim(), customerName: form.customerName.trim(), customerEmail: form.customerEmail.trim(), customerPhone: form.customerPhone.trim(), trade: form.trade.trim(), jobTitle: form.jobTitle.trim(), jobAddress: form.jobAddress.trim(), siteDetails: form.siteDetails.trim(), scopeOfWork: form.scopeOfWork.trim(), assumptions: form.assumptions.trim(), exclusions: form.exclusions.trim(), terms: form.terms.trim(), gstRate: Number(form.gstRate), validUntil: form.validUntil,
    lineItems: form.lineItems.map((line, index) => ({ category: line.category, description: line.description.trim() || "Untitled item", unit: line.unit.trim() || "each", quantity: Number(line.quantity), rate: Number(line.rate), markupPercent: Number(line.markupPercent), sortOrder: index })),
    photos: form.photos.map(photo => ({ dataUrl: photo.dataUrl, storageKey: photo.storageKey, url: photo.url, fileName: photo.fileName })),
  });

  const saveQuote = (status: QuoteForm["status"] = form.status) => {
    if (!form.customerName.trim() || !form.jobTitle.trim() || !form.trade.trim()) { toast.error("Customer, trade, and job title are required to save a quote."); return; }
    const data = { ...payload(), status };
    const options = {
      onSuccess: (detail: any) => {
        setSelectedId(detail.quote.id);
        setForm(toForm(detail));
        utils.quote.list.invalidate();
        toast.success(status === "ready" ? "Quote marked ready to send." : "Quote saved to your workspace.");
      },
      onError: (error: { message: string }) => toast.error(error.message || "The quote could not be saved."),
    };
    if (selectedId) updateMutation.mutate({ id: selectedId, data }, options);
    else createMutation.mutate(data, options);
  };

  const shareByEmail = () => {
    if (!selectedId) { toast.message("Save the quote first, then share it with your customer."); return; }
    const email = form.customerEmail.trim();
    const subject = encodeURIComponent(`Quote ${form.quoteNumber || ""} — ${form.jobTitle}`.trim());
    const body = encodeURIComponent(`Hi ${form.customerName},\n\nPlease find your quote for ${form.jobTitle}.\n\nQuote total (incl. GST): ${formatAud(totals.total)}\n\nKind regards,`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const duplicateQuote = () => {
    if (!selectedId) return;
    duplicateMutation.mutate({ id: selectedId }, {
      onSuccess: (detail: any) => {
        setSelectedId(detail.quote.id);
        setForm(toForm(detail));
        utils.quote.list.invalidate();
        toast.success("Draft copy created. Update it for the next job.");
      },
      onError: error => toast.error(error.message || "The quote could not be copied."),
    });
  };

  if (loading) return <div className="min-h-screen app-grid flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#315d50]" /></div>;
  if (!isAuthenticated) return <MarketingLanding onLogin={() => startLogin()} />;

  return (
    <div className="min-h-screen app-grid text-[#18342c]">
      <div className="print-shell hidden"><CustomerQuote form={form} totals={totals} /></div>
      <div className="flex min-h-screen">
        <aside className={`${sidebarOpen ? "w-[282px]" : "w-[76px]"} hidden shrink-0 bg-[#14372e] text-[#edf4e6] transition-[width] duration-200 lg:flex lg:flex-col`}>
          <div className="flex h-[78px] items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="brand-dot grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#d4ee8c] text-[#17372f]"><BriefcaseBusiness className="h-4 w-4" /></div>
              {sidebarOpen && <div className="min-w-0"><p className="font-display text-lg leading-none tracking-tight text-white">TradieQuote</p><p className="mt-1 font-mono text-[9px] tracking-[.14em] text-[#a9c0ae]">AUSTRALIAN ESTIMATING</p></div>}
            </div>
            <button onClick={() => setSidebarOpen(value => !value)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#b8d0bf] hover:bg-white/10 hover:text-white" aria-label="Toggle quote navigation">{sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}</button>
          </div>
          <div className="px-3 pt-5">
            <button onClick={startNewQuote} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d4ee8c] px-3 text-sm font-bold text-[#17372f] transition hover:bg-[#e1f6a7] active:scale-[.98]"> <Plus className="h-4 w-4" /> {sidebarOpen && "New quote"}</button>
          </div>
          <div className="mt-8 px-4"><p className={`${sidebarOpen ? "" : "sr-only"} font-mono text-[10px] font-medium tracking-[.16em] text-[#91ad98]`}>YOUR QUOTES</p></div>
          <div className="mt-3 flex-1 overflow-y-auto px-3 pb-5">
            {quotesQuery.isLoading && <div className="flex items-center gap-2 px-3 py-5 text-xs text-[#b7cdbb]"><Loader2 className="h-3.5 w-3.5 animate-spin" />{sidebarOpen && "Loading workspace"}</div>}
            {!quotesQuery.isLoading && quotesQuery.data?.length === 0 && sidebarOpen && <p className="px-3 py-4 text-xs leading-relaxed text-[#9bb5a2]">Your saved customer quotes will appear here.</p>}
            {quotesQuery.data?.map(quote => {
              const active = selectedId === quote.id;
              return <button key={quote.id} onClick={() => loadQuote(quote.id)} className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${active ? "bg-white/12 text-white" : "text-[#b8cfbd] hover:bg-white/7 hover:text-white"}`}>
                <div className="flex items-start justify-between gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0" />{sidebarOpen && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] ${quote.status === "ready" ? "bg-[#d4ee8c]/20 text-[#dff69d]" : quote.status === "sent" ? "bg-sky-200/15 text-sky-100" : "bg-white/10 text-[#c4d7c8]"}`}>{quote.status}</span>}</div>
                {sidebarOpen && <><p className="mt-2 truncate text-[13px] font-semibold">{quote.jobTitle}</p><p className="mt-0.5 truncate text-[11px] text-[#9fb9a6]">{quote.customerName}</p></>}
              </button>;
            })}
          </div>
          <div className="border-t border-white/10 p-4">
            <div className={`flex items-center gap-3 ${sidebarOpen ? "" : "justify-center"}`}><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#376b5a] text-xs font-bold">{user?.name?.slice(0, 1).toUpperCase() || "T"}</div>{sidebarOpen && <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{user?.name || "Your trade business"}</p><p className="mt-0.5 text-[10px] text-[#9cb9a4]">Secure workspace</p></div>}</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <header className="flex min-h-[78px] items-center justify-between border-b border-[#dde4d8] bg-[#fbfaf5]/75 px-4 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setSidebarOpen(value => !value)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d8e0d3] bg-white lg:hidden" aria-label="Open quote navigation"><PanelLeftOpen className="h-4 w-4" /></button>
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-display text-[23px] leading-tight tracking-tight">{form.jobTitle || "New customer quote"}</p>{selectedId && <span className="hidden rounded-full bg-[#e9eee2] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#60766b] sm:block">{form.quoteNumber}</span>}</div><p className="mt-1 truncate font-mono text-[10px] font-medium uppercase tracking-[.1em] text-[#668075]">{form.customerName || "Complete the brief to begin"} <span className="px-1 text-[#a3afa4]">/</span> {form.trade}</p></div>
            </div>
            <div className="flex items-center gap-2">{selectedId && <button onClick={duplicateQuote} disabled={duplicateMutation.isPending} className="subtle-button hidden md:inline-flex">{duplicateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />} Copy</button>}<button onClick={() => window.print()} className="subtle-button hidden sm:inline-flex"><Printer className="h-4 w-4" /> Print / PDF</button><button onClick={shareByEmail} className="subtle-button hidden md:inline-flex"><Mail className="h-4 w-4" /> Share</button><button onClick={() => saveQuote("ready")} disabled={createMutation.isPending || updateMutation.isPending} className="primary-button">{(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">Ready to send</span><span className="sm:hidden">Save</span></button></div>
          </header>

          <div className="mx-auto max-w-[1800px] p-4 lg:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:hidden"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${form.status === "ready" ? "bg-[#8eb74a]" : "bg-[#c5a353]"}`} /><span className="text-xs font-semibold text-[#526e63]">{statusLabel(form.status)}</span></div><button onClick={() => setDetailsOpen(value => !value)} className="subtle-button text-xs">{detailsOpen ? "Hide details" : "Show details"}</button></div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_470px]">
              <div className="space-y-5">
                <section className="panel rise-in overflow-hidden rounded-2xl">
                  <div className="flex items-center justify-between border-b border-[#e1e7dd] px-5 py-4"><div><p className="font-mono text-[10px] font-bold tracking-[.14em] text-[#648071]">01 / JOB BRIEF</p><p className="mt-1 text-sm text-[#557067]">Customer and site information</p></div><div className="hidden items-center gap-2 rounded-full bg-[#eef3e9] px-3 py-1.5 text-[10px] font-bold text-[#507361] md:flex"><ShieldCheck className="h-3.5 w-3.5" />PRIVATE TO YOUR WORKSPACE</div></div>
                  {detailsOpen && <div className="p-5"><div className="rounded-xl border border-[#dce6d8] bg-[#f7faf4] p-4"><div className="mb-3 flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-[#5b8064]" /><p className="field-label mb-0">Your business <span className="normal-case tracking-normal font-normal text-[#789184]">(optional)</span></p></div><div className="grid gap-x-4 gap-y-4 md:grid-cols-2"><Field label="Business name" value={form.businessName} onChange={value => updateForm("businessName", value)} placeholder="e.g. Harbour Plumbing Co." /><Field label="ABN" value={form.businessAbn} onChange={value => updateForm("businessAbn", value)} placeholder="XX XXX XXX XXX" /><Field label="Licence no." value={form.businessLicence} onChange={value => updateForm("businessLicence", value)} placeholder="If applicable" /><Field label="Business phone" value={form.businessPhone} onChange={value => updateForm("businessPhone", value)} placeholder="02 XXXX XXXX" /><div className="md:col-span-2"><Field label="Business email" value={form.businessEmail} onChange={value => updateForm("businessEmail", value)} placeholder="hello@yourbusiness.com.au" type="email" /></div></div></div><div className="mt-5 grid gap-x-4 gap-y-4 md:grid-cols-2"><Field label="Customer name" required value={form.customerName} onChange={value => updateForm("customerName", value)} placeholder="e.g. Morgan Lee" /><Field label="Trade" required value={form.trade} onChange={value => updateForm("trade", value)} select options={["Plumbing", "Electrical", "Building", "Carpentry", "HVAC & Refrigeration", "Landscaping", "Painting", "Other"]} /><Field label="Customer email" value={form.customerEmail} onChange={value => updateForm("customerEmail", value)} placeholder="morgan@example.com" type="email" /><Field label="Mobile" value={form.customerPhone} onChange={value => updateForm("customerPhone", value)} placeholder="04XX XXX XXX" /><div className="md:col-span-2"><Field label="Job title" required value={form.jobTitle} onChange={value => updateForm("jobTitle", value)} placeholder="e.g. Replace leaking kitchen mixer" /></div><div className="md:col-span-2"><Field label="Site address" value={form.jobAddress} onChange={value => updateForm("jobAddress", value)} placeholder="Street address, suburb, state, postcode" /></div><div className="md:col-span-2"><Field label="Site details / your notes" value={form.siteDetails} onChange={value => updateForm("siteDetails", value)} textarea placeholder="Access, dimensions, existing conditions, timing, or anything the estimator should consider." /></div></div></div>}
                </section>

                <section className="panel rise-in overflow-hidden rounded-2xl" style={{ animationDelay: "60ms" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e7dd] px-5 py-4"><div><p className="font-mono text-[10px] font-bold tracking-[.14em] text-[#648071]">02 / ESTIMATE BUILDER</p><p className="mt-1 text-sm text-[#557067]">Build it yourself, or begin with an AI-assisted draft.</p></div><button onClick={generateDraft} disabled={draftMutation.isPending} className="secondary-button">{draftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{draftMutation.isPending ? "Reading the brief" : "Generate draft"}</button></div>
                  <div className="p-5">
                    <div className="rounded-xl border border-[#d8e6c8] bg-[#f3f9e8] px-4 py-3 text-xs leading-relaxed text-[#4a6953]"><span className="font-bold">A careful first pass, not an autopilot.</span> Drafts identify possible work from your brief and photos. You remain responsible for confirming site conditions, quantities, pricing, licences, compliance and GST treatment.</div>
                    <div className="mt-5"><label className="field-label">Job-site photos <span className="normal-case tracking-normal text-[#789184]">(optional, up to five)</span></label><input ref={photoInputRef} onChange={handlePhotoSelect} accept="image/jpeg,image/png,image/webp" type="file" multiple className="hidden" /><div className="flex flex-wrap gap-3">{form.photos.map((photo, index) => <div key={`${photo.fileName}-${index}`} className="group relative h-[78px] w-[96px] overflow-hidden rounded-xl border border-[#d7ded2] bg-[#edf0e9]"><img src={photo.previewUrl} alt={photo.fileName} className="h-full w-full object-cover" /><button onClick={() => removePhoto(index)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#183f35]/90 text-white opacity-0 transition group-hover:opacity-100" aria-label={`Remove ${photo.fileName}`}><X className="h-3.5 w-3.5" /></button></div>)}<button onClick={() => photoInputRef.current?.click()} className="flex h-[78px] w-[116px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#bfcdb9] bg-[#fbfcf8] text-[#537565] transition hover:border-[#71965a] hover:bg-[#f4f9ec]"><ImagePlus className="h-4 w-4" /><span className="text-[11px] font-bold">Add photos</span></button></div></div>
                    <div className="mt-5"><Field label="Scope of work" value={form.scopeOfWork} onChange={value => updateForm("scopeOfWork", value)} textarea rows={5} placeholder="Describe what will be supplied and completed. AI-generated wording appears here for your review." /></div>
                    <LineItemEditor items={form.lineItems} onChange={updateLine} onAdd={addLine} onRemove={removeLine} />
                  </div>
                </section>

                <section className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "110ms" }}><p className="font-mono text-[10px] font-bold tracking-[.14em] text-[#648071]">03 / CONDITIONS</p><div className="mt-4 grid gap-4"><Field label="Assumptions" value={form.assumptions} onChange={value => updateForm("assumptions", value)} textarea rows={3} placeholder="What this estimate relies on." /><Field label="Exclusions" value={form.exclusions} onChange={value => updateForm("exclusions", value)} textarea rows={3} placeholder="Work, approvals, repairs or charges not included." /><Field label="Quote terms" value={form.terms} onChange={value => updateForm("terms", value)} textarea rows={4} /></div></section>
              </div>
              <aside className="xl:sticky xl:top-6 xl:self-start"><div className="mb-3 flex items-center justify-between px-1"><p className="font-mono text-[10px] font-bold tracking-[.14em] text-[#668075]">CUSTOMER PREVIEW</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] ${form.status === "ready" ? "bg-[#d9ee9f] text-[#35563a]" : "bg-[#eee7d5] text-[#8a6d31]"}`}>{statusLabel(form.status)}</span></div><CustomerQuote form={form} totals={totals} compact /><div className="panel mt-4 rounded-2xl p-4"><div className="grid grid-cols-2 gap-3"><Field label="GST rate" value={String(form.gstRate)} onChange={value => updateForm("gstRate", Number(value))} type="number" /><Field label="Valid until" value={form.validUntil} onChange={value => updateForm("validUntil", value)} type="date" /></div><div className="mt-4 flex gap-2"><button onClick={() => saveQuote("draft")} className="subtle-button flex-1" disabled={createMutation.isPending || updateMutation.isPending}><FileText className="h-4 w-4" />Save draft</button><button onClick={() => window.print()} className="subtle-button grid w-11 place-items-center px-0" aria-label="Print or save PDF"><Printer className="h-4 w-4" /></button></div></div></aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", textarea, rows, required, select, options }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; textarea?: boolean; rows?: number; required?: boolean; select?: boolean; options?: string[] }) {
  return <label><span className="field-label">{label}{required && <span className="ml-1 text-[#b15846]">*</span>}</span>{select ? <select value={value} onChange={event => onChange(event.target.value)} className="field">{options?.map(option => <option key={option}>{option}</option>)}</select> : textarea ? <textarea className="field resize-y leading-relaxed" rows={rows || 4} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /> : <input className="field" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} type={type} />}</label>;
}

function LineItemEditor({ items, onChange, onAdd, onRemove }: { items: LineItem[]; onChange: (id: string, patch: Partial<LineItem>) => void; onAdd: () => void; onRemove: (id: string) => void }) {
  return <div className="mt-7"><div className="flex items-end justify-between gap-3"><div><p className="field-label mb-0">Cost schedule</p><p className="mt-1 text-xs text-[#759084]">Rates are editable. Mark-up is applied per line.</p></div><button onClick={onAdd} className="subtle-button px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Add item</button></div><div className="mt-3 overflow-x-auto rounded-xl border border-[#dce3d8]"><table className="w-full min-w-[720px] border-collapse text-left"><thead className="bg-[#f0f4ed] text-[10px] font-bold uppercase tracking-[.08em] text-[#6e877c]"><tr><th className="px-3 py-3">Item</th><th className="w-28 px-2 py-3">Type</th><th className="w-16 px-2 py-3">Qty</th><th className="w-20 px-2 py-3">Unit</th><th className="w-28 px-2 py-3">Rate</th><th className="w-20 px-2 py-3">Mark-up</th><th className="w-28 px-3 py-3 text-right">Total</th><th className="w-9" /></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t border-[#e4e9e1] bg-white/50"><td className="px-3 py-2"><input aria-label="Item description" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[#a6b2a8]" placeholder="Describe the work or item" value={item.description} onChange={event => onChange(item.id, { description: event.target.value })} /></td><td className="px-2 py-2"><select aria-label="Item category" className="w-full bg-transparent text-xs outline-none" value={item.category} onChange={event => onChange(item.id, { category: event.target.value as Category })}>{(["labour", "materials", "callout", "equipment", "other"] as Category[]).map(category => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></td><td className="px-2 py-2"><input aria-label="Quantity" className="w-full bg-transparent text-right text-sm outline-none" min="0" step="0.1" type="number" value={item.quantity} onChange={event => onChange(item.id, { quantity: Number(event.target.value) })} /></td><td className="px-2 py-2"><input aria-label="Unit" className="w-full bg-transparent text-center text-xs outline-none" value={item.unit} onChange={event => onChange(item.id, { unit: event.target.value })} /></td><td className="px-2 py-2"><div className="flex items-center"><span className="text-xs text-[#8da095]">$</span><input aria-label="Rate" className="w-full bg-transparent text-right text-sm outline-none" min="0" step="0.01" type="number" value={item.rate} onChange={event => onChange(item.id, { rate: Number(event.target.value) })} /></div></td><td className="px-2 py-2"><div className="flex items-center"><input aria-label="Mark-up percentage" className="w-full bg-transparent text-right text-sm outline-none" min="-100" step="1" type="number" value={item.markupPercent} onChange={event => onChange(item.id, { markupPercent: Number(event.target.value) })} /><span className="text-xs text-[#8da095]">%</span></div></td><td className="px-3 py-2 text-right text-sm font-bold text-[#204438]">{formatAud(lineTotal(item))}</td><td><button onClick={() => onRemove(item.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[#94a198] hover:bg-[#fff0ed] hover:text-[#b24c3a]" aria-label="Remove line item"><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div></div>;
}

function CustomerQuote({ form, totals, compact = false }: { form: QuoteForm; totals: { subtotal: number; gst: number; total: number }; compact?: boolean }) {
  const visibleLines = form.lineItems.filter(line => line.description.trim() || line.rate || line.quantity !== 1);
  return <article className={`quote-paper overflow-hidden ${compact ? "rounded-2xl border border-[#d4ddd0]" : "min-h-[1000px]"}`}><div className="bg-[#14372e] px-6 py-6 text-[#fbf8ef]"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><div className="grid h-6 w-6 place-items-center rounded-md bg-[#d4ee8c] text-[#17372f]"><BriefcaseBusiness className="h-3.5 w-3.5" /></div><span className="font-display text-xl tracking-tight">{form.businessName || "TradieQuote"}</span></div><p className="mt-3 font-mono text-[9px] font-medium tracking-[.15em] text-[#b5cab8]">PROFESSIONAL WORK QUOTE</p></div><div className="text-right"><p className="font-mono text-[10px] tracking-[.1em] text-[#b5cab8]">QUOTE</p><p className="mt-1 text-xs font-bold">{form.quoteNumber || "TO BE ISSUED"}</p></div></div>{(form.businessAbn || form.businessLicence || form.businessPhone || form.businessEmail) && <p className="mt-4 text-[10px] leading-5 text-[#c0d0c2]">{[form.businessAbn && `ABN ${form.businessAbn}`, form.businessLicence && `Licence ${form.businessLicence}`, form.businessPhone, form.businessEmail].filter(Boolean).join(" · ")}</p>}</div><div className="p-6"><div className="grid grid-cols-2 gap-6 border-b border-[#dbe3d7] pb-6 text-xs"><div><p className="font-mono text-[9px] font-bold uppercase tracking-[.12em] text-[#809488]">Prepared for</p><p className="mt-2 text-sm font-bold text-[#1f4137]">{form.customerName || "Customer name"}</p>{form.customerEmail && <p className="mt-1 text-[#688076]">{form.customerEmail}</p>}{form.customerPhone && <p className="mt-0.5 text-[#688076]">{form.customerPhone}</p>}</div><div className="text-right"><p className="font-mono text-[9px] font-bold uppercase tracking-[.12em] text-[#809488]">Job</p><p className="mt-2 text-sm font-bold text-[#1f4137]">{form.jobTitle || "Job title"}</p>{form.jobAddress && <p className="mt-1 whitespace-pre-line text-[#688076]">{form.jobAddress}</p>}{form.validUntil && <p className="mt-2 text-[10px] font-semibold text-[#8a7139]">Valid until {new Date(`${form.validUntil}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>}</div></div><section className="py-6"><p className="font-mono text-[9px] font-bold uppercase tracking-[.12em] text-[#809488]">Scope of work</p><p className="mt-3 whitespace-pre-line text-xs leading-6 text-[#36584d]">{form.scopeOfWork || "The confirmed scope of work will appear here."}</p></section><section className="border-t border-[#dbe3d7] pt-5"><div className="overflow-hidden rounded-lg border border-[#dfe5dc]"><table className="w-full border-collapse text-left text-[11px]"><thead className="bg-[#f0f4ed] font-mono text-[8px] font-bold uppercase tracking-[.1em] text-[#71887d]"><tr><th className="px-3 py-2.5">Description</th><th className="px-2 py-2.5 text-center">Qty</th><th className="px-3 py-2.5 text-right">Amount</th></tr></thead><tbody>{visibleLines.length ? visibleLines.map(line => <tr key={line.id} className="border-t border-[#e4e9e1]"><td className="px-3 py-2.5"><p className="font-semibold text-[#294c41]">{line.description}</p><p className="mt-0.5 capitalize text-[9px] text-[#82948a]">{line.category} · {formatAud(line.rate)} / {line.unit}</p></td><td className="px-2 py-2.5 text-center text-[#668075]">{line.quantity}</td><td className="px-3 py-2.5 text-right font-semibold text-[#294c41]">{formatAud(lineTotal(line))}</td></tr>) : <tr><td colSpan={3} className="px-3 py-5 text-center text-[#84958b]">Quote items will appear here.</td></tr>}</tbody></table></div><div className="ml-auto mt-4 w-full max-w-[220px] space-y-2 text-xs"><div className="flex justify-between text-[#6c8177]"><span>Subtotal</span><span>{formatAud(totals.subtotal)}</span></div><div className="flex justify-between text-[#6c8177]"><span>GST ({form.gstRate || 0}%)</span><span>{formatAud(totals.gst)}</span></div><div className="flex justify-between border-t border-[#dbe3d7] pt-3 text-sm font-bold text-[#1a4035]"><span>Total inc. GST</span><span>{formatAud(totals.total)}</span></div></div></section>{(form.assumptions || form.exclusions || form.terms) && <section className="mt-6 border-t border-[#dbe3d7] pt-5"><div className="grid gap-5 text-[10px] leading-5 text-[#60786d] md:grid-cols-2">{form.assumptions && <div><p className="font-mono text-[8px] font-bold uppercase tracking-[.12em] text-[#466b5c]">Assumptions</p><p className="mt-2 whitespace-pre-line">{form.assumptions}</p></div>}{form.exclusions && <div><p className="font-mono text-[8px] font-bold uppercase tracking-[.12em] text-[#466b5c]">Exclusions</p><p className="mt-2 whitespace-pre-line">{form.exclusions}</p></div>}</div>{form.terms && <div className="mt-5 text-[10px] leading-5 text-[#60786d]"><p className="font-mono text-[8px] font-bold uppercase tracking-[.12em] text-[#466b5c]">Terms</p><p className="mt-2 whitespace-pre-line">{form.terms}</p></div>}</section>}<div className="mt-7 border-t border-[#dbe3d7] pt-4 text-[9px] text-[#84958a]"><p>This is a quotation, not a tax invoice. Please contact {form.businessName || "your tradie"} with any questions about this quote.</p></div></div></article>;
}

function MarketingLanding({ onLogin }: { onLogin: () => void }) {
  return <div className="min-h-screen overflow-hidden bg-[#f8f5ec] text-[#18342c]"><header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><div className="flex items-center gap-3"><div className="brand-dot grid h-9 w-9 place-items-center rounded-xl bg-[#173c32] text-[#d6ef90]"><BriefcaseBusiness className="h-4 w-4" /></div><div><p className="font-display text-xl leading-none tracking-tight">TradieQuote</p><p className="mt-1 font-mono text-[9px] tracking-[.13em] text-[#698076]">BUILT FOR THE TRADE</p></div></div><button onClick={onLogin} className="subtle-button">Sign in <ArrowUpRight className="h-4 w-4" /></button></header><main className="mx-auto max-w-7xl px-6 pb-12 pt-10 lg:px-10 lg:pt-20"><div className="grid items-center gap-14 lg:grid-cols-[1.06fr_.94fr]"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-[#d7e3cc] bg-[#eff5e8] px-3 py-1.5 font-mono text-[10px] font-bold tracking-[.1em] text-[#54745f]"><span className="h-1.5 w-1.5 rounded-full bg-[#8aaa4c]" />AUSTRALIAN QUOTE WORKSPACE</div><h1 className="mt-7 font-display text-5xl leading-[.98] tracking-[-.04em] text-[#183c32] sm:text-6xl lg:text-7xl">Clear quotes.<br /><i className="font-normal">Better jobs.</i></h1><p className="mt-7 max-w-xl text-lg leading-8 text-[#5b7369]">Build, revise and share customer-ready quotes without losing the details that make a job profitable. Turn site notes and photos into a careful first draft—then make it yours.</p><div className="mt-9 flex flex-wrap gap-3"><button onClick={onLogin} className="primary-button px-5 py-3">Open your workspace <ChevronRight className="h-4 w-4" /></button><span className="flex items-center gap-2 px-2 text-sm font-medium text-[#597267]"><ShieldCheck className="h-4 w-4 text-[#6e9a54]" />Private, user-owned quotes</span></div></div><div className="relative"><div className="absolute -inset-6 rounded-[3rem] bg-[#dbeab1] opacity-50 blur-3xl" /><div className="relative overflow-hidden rounded-[1.8rem] border border-[#d3dfc5] bg-[#fffcf5] p-5 shadow-[0_24px_65px_rgba(30,65,53,.16)]"><div className="flex items-center justify-between border-b border-[#e1e7dd] pb-4"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#14372e] text-[#d4ee8c]"><FilePlus2 className="h-4 w-4" /></div><div><p className="text-sm font-bold">Kitchen plumbing repair</p><p className="mt-0.5 font-mono text-[9px] tracking-[.1em] text-[#789085]">CUSTOMER QUOTE</p></div></div><span className="rounded-full bg-[#eaf4db] px-2.5 py-1 text-[9px] font-bold text-[#547641]">DRAFT</span></div><div className="mt-5 grid gap-3"><div className="rounded-xl bg-[#f3f6ee] p-4"><p className="font-mono text-[9px] font-bold tracking-[.1em] text-[#789085]">AI-ASSISTED SCOPE</p><div className="mt-3 h-2 w-full rounded bg-[#cbdac4]" /><div className="mt-2 h-2 w-5/6 rounded bg-[#d8e3d2]" /><div className="mt-2 h-2 w-2/3 rounded bg-[#d8e3d2]" /></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#e1e7dc] p-4"><p className="font-mono text-[9px] tracking-[.1em] text-[#789085]">SITE PHOTOS</p><div className="mt-3 flex gap-2"><span className="h-10 w-10 rounded-md bg-[#b8c9ad]" /><span className="h-10 w-10 rounded-md bg-[#d5dfcc]" /></div></div><div className="rounded-xl bg-[#14372e] p-4 text-white"><p className="font-mono text-[9px] tracking-[.1em] text-[#b6cfbc]">TOTAL INC. GST</p><p className="mt-3 font-display text-2xl">$—</p></div></div></div></div></div></div><div className="mt-20 grid gap-3 border-t border-[#dde5d6] pt-8 sm:grid-cols-3"><Feature icon={<ClipboardList />} title="A job, properly captured" copy="Customer, site and trade details live with the estimate—not in a scattered message thread." /><Feature icon={<PencilLine />} title="Every figure is yours" copy="Edit scope, quantities, rates, mark-up, GST, assumptions and exclusions before finalising." /><Feature icon={<Printer />} title="Ready when the customer is" copy="Present a considered quote in the browser, print it, or save it as a polished PDF." /></div></main></div>;
}

function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="rounded-2xl border border-[#dce4d8] bg-[#fbfaf5] p-5"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e9f2dd] text-[#416655]">{icon}</div><h2 className="mt-4 font-display text-xl tracking-tight text-[#23483c]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667d73]">{copy}</p></div>; }
