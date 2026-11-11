import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, BrainCircuit, CheckCircle2,
  ChevronRight, Database, FileText, LayoutDashboard, Menu,
  ShieldCheck, Sparkles, Target, Upload, X, FileSpreadsheet,
  Download, RefreshCw, Trash2, AlertTriangle, WandSparkles,
  Eye, Columns3, Info, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  CalendarDays, TrendingUp, ShoppingBag, Package, Clock3, LogIn, LogOut, UserPlus, LockKeyhole, MessageCircle, Send, Sun, Moon, GitBranch,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar, Treemap, ScatterChart, Scatter, ZAxis,
} from "recharts";

import {
  uploadDataset,
  getDatasetProfile,
  getCleaningPreview,
  applyCleaning,
  downloadCleanedDataset,
  getAnalyticsOverview,
  getAnalyticsBreakdown,
  getAnalyticsTrend,
  getAnalyticsCorrelations,
  askAnalyst,
  indexDataset,
  getDecisionReport,
  getDatasetRows,
  trainPredictiveModel,
  predictWithSavedModel,
  createForecast, getForecastSegments,
  adminLogin, viewerSignup, viewerLogin, getCurrentUser, getViewerReports, getViewerReport, askViewerReport, publishReport, previewBusinessReport, getViewerPreferences, saveViewerPreferences,
} from "./services/api";
import "./App.css";
import BusinessReport, { BusinessAnalyticsSnapshot } from "./components/BusinessReport";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Data Sources", icon: Database },
  { label: "Data Health", icon: ShieldCheck },
  { label: "Data Cleaning", icon: WandSparkles },
  { label: "Data Modeling", icon: GitBranch },
  { label: "Analytics Studio", icon: BarChart3 },
  { label: "AI Business Analyst", icon: BrainCircuit },
  { label: "Predictions & Forecasts", icon: TrendingUp },
  { label: "Reports", icon: FileText },
];

// Application shell: login state, dataset upload, sidebar, and admin pages.
function App() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [profile, setProfile] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [activePage, setActivePage] = useState("Overview");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("insight-theme") || "light");
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("insight-auth-token");
    if (!token) { setAuthReady(true); return; }
    getCurrentUser().then(setAuthUser).catch(() => localStorage.removeItem("insight-auth-token")).finally(() => setAuthReady(true));
  }, []);

  function finishLogin(result) {
    localStorage.setItem("insight-auth-token", result.access_token);
    setAuthUser(result.user);
  }

  function logout() {
    localStorage.removeItem("insight-auth-token");
    setAuthUser(null);
    resetWorkspace();
  }

  useEffect(() => {
    localStorage.setItem("insight-theme", theme);
  }, [theme]);

  const [cleaningPreview, setCleaningPreview] = useState(null);
  const [cleaningResult, setCleaningResult] = useState(null);
  const [dataRevision, setDataRevision] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applyingCleaning, setApplyingCleaning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cleaningError, setCleaningError] = useState("");
  const [cleaningSuccess, setCleaningSuccess] = useState("");

  function selectFile(selected) {
    if (!selected) return;

    const extension = selected.name.split(".").pop().toLowerCase();

    if (!["csv", "xlsx", "xlsm", "json", "jsonl", "ndjson"].includes(extension)) {
      setError("Unsupported file. Choose CSV, XLSX, XLSM, JSON or JSONL.");
      return;
    }

    if (selected.size > 50 * 1024 * 1024) {
      setError("File exceeds the 50 MB upload limit.");
      return;
    }

    setError("");
    setSuccess("");
    setFile(selected);
  }

  async function handleUpload() {
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const result = await uploadDataset(file);
      const id = result.dataset.dataset_id;
      const datasetProfile = await getDatasetProfile(id);

      setDatasetId(id);
      setProfile(datasetProfile);
      setCleaningPreview(null);
      setCleaningResult(null);
      setActivePage("Overview");
      setSuccess("Dataset uploaded and profiled. Building the searchable knowledge base for dataset questions…");
      indexDataset(id).then(() => { setSuccess("Dataset analysed and AI knowledge base indexed. You can now ask dataset-specific questions."); }).catch((indexError) => { setSuccess(`Dataset analysed. AI knowledge indexing needs attention: ${indexError.message}`); });
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function resetWorkspace() {
    setFile(null);
    setProfile(null);
    setDatasetId(null);
    setCleaningPreview(null);
    setCleaningResult(null);
    setCleaningError("");
    setCleaningSuccess("");
    setError("");
    setSuccess("");
    setActivePage("Overview");
  }

  async function loadCleaningPreview() {
    if (!datasetId || loadingPreview) return;

    setLoadingPreview(true);
    setCleaningError("");
    setCleaningSuccess("");

    try {
      const result = await getCleaningPreview(datasetId);
      setCleaningPreview(result);
      setCleaningSuccess("Dataset analysis completed.");
    } catch (err) {
      setCleaningError(err.message || "Could not analyse the dataset.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleApplyCleaning() {
    if (!datasetId || !cleaningPreview || applyingCleaning) return;

    setApplyingCleaning(true);
    setCleaningError("");
    setCleaningSuccess("");

    try {
      // Use the backend's recommended strategy for each column.
      const columnStrategies = {};

      cleaningPreview.recommendations?.forEach((item) => {
        columnStrategies[item.column] = item.suggested_strategy;
      });

      // Potential outliers are preserved by default.
      const outlierStrategies = {};

      cleaningPreview.outliers?.forEach((item) => {
        outlierStrategies[item.column] = "keep";
      });

      const result = await applyCleaning(datasetId, {
        column_strategies: columnStrategies,
        // Duplicate-looking transactions can be legitimate. Preserve them unless explicitly reviewed.
        remove_duplicates: false,
        outlier_strategies: outlierStrategies,
      });

      setCleaningResult(result);
      // Refresh profile and dependent screens: cleaned.csv is now the active data source.
      const newProfile = await getDatasetProfile(datasetId);
      setProfile(newProfile);
      setDataRevision(previous => previous + 1);
      setCleaningSuccess("Cleaning applied. All analytics, forecasts and new reports now use the cleaned dataset automatically; no re-upload needed.");
      indexDataset(datasetId).catch(() => {
        setCleaningSuccess("Cleaning applied and analytics updated. RAG indexing needs attention; retry knowledge indexing if AI answers appear outdated.");
      });
    } catch (err) {
      setCleaningError(err.message || "Could not apply recommended cleaning.");
    } finally {
      setApplyingCleaning(false);
    }
  }

  async function handleDownload() {
    if (!datasetId || downloading) return;

    setDownloading(true);
    setCleaningError("");

    try {
      await downloadCleanedDataset(datasetId);
      setCleaningSuccess("Your cleaned dataset download has started.");
    } catch (err) {
      setCleaningError(err.message || "Could not download cleaned dataset.");
    } finally {
      setDownloading(false);
    }
  }

  if (!authReady) {
    return <main className="auth-loading"><div className="brand-mark"><Activity size={24} /></div><p>Preparing INSIGHT AI...</p></main>;
  }

  if (!authUser) {
    return <AuthPage onAuthenticated={finishLogin} />;
  }

  if (authUser.role === "viewer") {
    return <ViewerPortal user={authUser} theme={theme} setTheme={setTheme} onLogout={logout} />;
  }

  if (!profile) {
    return (
      <main className="landing">
        <header className="landing-nav">
          <div className="brand">
            <div className="brand-mark"><Activity size={23} /></div>
            <div>
              <h1>INSIGHT<span>AI</span></h1>
              <p>FROM DATA TO DECISIONS</p>
            </div>
          </div>
          <span className="landing-status"><i /> AI DATA INTELLIGENCE PLATFORM</span>
        </header>

        <section className="landing-hero">
          <div className="hero-eyebrow"><Sparkles size={15} /> YOUR DATA. A NEW PERSPECTIVE.</div>
          <h2>From raw data<br />to <span>real decisions.</span></h2>
          <p className="hero-description">
            Upload your dataset. Understand what it contains, improve its quality,
            discover meaningful insights and make data-driven decisions.
          </p>

          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm,.json,.jsonl,.ndjson"
              hidden
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            <div className="drop-icon"><Upload size={27} /></div>
            <h3>{file ? file.name : "Drop your dataset here"}</h3>
            <p>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready to upload`
                : "Drag and drop your file, or browse from your computer"}
            </p>
            <button
              className="browse-button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Browse files <ArrowRight size={16} />
            </button>
            <div className="file-types">
              <span><FileSpreadsheet size={14} /> CSV</span>
              <span><FileSpreadsheet size={14} /> XLSX</span>
              <span><FileSpreadsheet size={14} /> XLSM</span>
              <span>JSON / JSONL</span>
              <span>Maximum 50 MB</span>
            </div>
          </div>

          {file && (
            <div className="selected-file">
              <div><CheckCircle2 size={17} /> <span>{file.name}</span></div>
              <button onClick={() => setFile(null)} aria-label="Remove file"><X size={17} /></button>
            </div>
          )}

          {error && <div className="notice error-notice">{error}</div>}
          {success && <div className="notice success-notice">{success}</div>}

          <button
            className="analyze-button"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? "Analysing your dataset..." : <>Upload and analyse dataset <ArrowRight size={18} /></>}
          </button>

          <div className="trust-line">
            <ShieldCheck size={15} />
            Your original dataset is preserved. Cleaning is a separate step.
          </div>
        </section>

        <section className="landing-capabilities">
          <div><Database /><strong>Understand</strong><span>Discover data structure and quality</span></div>
          <div><Sparkles /><strong>Prepare</strong><span>Clean and prepare your dataset</span></div>
          <div><BarChart3 /><strong>Analyse</strong><span>Explore trends and performance</span></div>
          <div><BrainCircuit /><strong>Decide</strong><span>Generate insights and predictions</span></div>
        </section>

        <footer className="landing-footer">
          <span>INSIGHT AI © 2026</span>
          <span>FROM DATA TO DECISIONS.</span>
        </footer>
      </main>
    );
  }

  return (
    <div className={`app-shell ${theme === "light" ? "theme-light" : "theme-dark"} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} data-theme={theme}>
      {sidebarOpen && (
        <button className="mobile-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={23} /></div>
          <div><h1>INSIGHT<span>AI</span></h1><p>FROM DATA TO DECISIONS</p></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
        </div>

        <div className="workspace-selector">
          <div className="workspace-avatar">S</div>
          <div className="workspace-info"><span>Workspace</span><strong>My Workspace</strong></div>
        </div>

        <div className="nav-section-label">INTELLIGENCE WORKSPACE</div>
        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${activePage === item.label ? "active" : ""}`}
                onClick={() => {
                  setActivePage(item.label);
                  setSidebarOpen(false);

                  if (item.label === "Data Cleaning" && !cleaningPreview && !loadingPreview) {
                    loadCleaningPreview();
                  }
                }}
              >
                <Icon size={18} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <ShieldCheck size={19} />
            <div><strong>Your data, your control</strong><p>Original files are preserved.</p></div>
          </div>
          <button className="nav-item" onClick={resetWorkspace}>
            <Upload size={18} /><span>Upload another dataset</span>
          </button>
          <div className="sidebar-footer"><i className="online-dot" /> System workspace <span className="version">v0.3</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
            <button className="desktop-sidebar-toggle" onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"}><Menu size={18}/></button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")} title="Toggle colour theme">{theme === "light" ? "☾ Dark mode" : "☀ Light mode"}</button>
            <div className="system-status"><i className="online-dot" /> Dataset loaded</div>
            <button className="logout-button" onClick={logout} title="Sign out"><LogOut size={16}/> Sign out</button><div className="user-avatar">{authUser.name?.slice(0,1)?.toUpperCase() || "A"}</div>
          </div>
        </header>

        <div className="page-content">
          {activePage === "Overview" ? (
            <OverviewPage key={`${datasetId}-${dataRevision}`}
              profile={profile}
              datasetId={datasetId}
              resetWorkspace={resetWorkspace}
              openPage={setActivePage}
            />
          ) : activePage === "Data Sources" ? (
            <DataUnderstandingPage key={`${datasetId}-${dataRevision}`} profile={profile} datasetId={datasetId} />
          ) : activePage === "Data Health" ? (
            <DataHealthPage profile={profile} openPage={setActivePage} />
          ) : activePage === "Data Cleaning" ? (
            <CleaningPage
              preview={cleaningPreview}
              result={cleaningResult}
              loading={loadingPreview}
              applying={applyingCleaning}
              downloading={downloading}
              error={cleaningError}
              success={cleaningSuccess}
              loadPreview={loadCleaningPreview}
              applyCleaning={handleApplyCleaning}
              download={handleDownload}
            />
              ) : activePage === "Data Modeling" ? (
                <DataModelingPage />
              ) : activePage === "Analytics Studio" ? (
                <AnalyticsPage key={`${datasetId}-${dataRevision}`} datasetId={datasetId} />
              ) : activePage === "AI Business Analyst" ? (
                <AIAssistantPage key={`${datasetId}-${dataRevision}`} datasetId={datasetId} />
              ) : activePage === "Predictions & Forecasts" ? (
                <PredictionRoadmapPage />
              ) : activePage === "Reports" ? (
                <ReportsPage key={`${datasetId}-${dataRevision}`} datasetId={datasetId} profile={profile} />
              ) : (
                <section className="module-placeholder">
                  <div className="placeholder-icon"><Sparkles size={27} /></div>
                  <span className="eyebrow">INSIGHT AI MODULE</span>
                  <h2>{activePage}</h2>
                  <p>This module is not yet connected.</p>
                  <button className="browse-button" onClick={() => setActivePage("Overview")}>
                    Back to overview <ChevronRight size={16} />
                  </button>
                </section>
              )}

          <footer className="page-footer"><span>INSIGHT AI © 2026</span><span>FROM DATA TO DECISIONS.</span></footer>
        </div>
      </main>
    </div>
  );
}

// Login and viewer signup; tokens are stored and sent by services/api.js.
function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("admin");
  const [viewerAction, setViewerAction] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = mode === "admin"
        ? await adminLogin(email, password)
        : viewerAction === "login" ? await viewerLogin(email, password) : await viewerSignup(name, email, password, accessCode);
      onAuthenticated(result);
    } catch (err) { setError(err.message || "Unable to continue."); }
    finally { setBusy(false); }
  }

  return (
    <main className="auth-page">
      <div className="auth-ambient" />
      <header className="auth-brand"><div className="brand-mark"><Activity size={23}/></div><div><h1>INSIGHT<span>AI</span></h1><p>FROM DATA TO DECISIONS</p></div></header>
      <section className="auth-card">
        <div className="auth-eyebrow"><Sparkles size={14}/> BUSINESS INTELLIGENCE PLATFORM</div>
        <h2>{mode === "admin" ? "Welcome back." : viewerAction === "login" ? "Welcome back." : "Access your business report."}</h2>
        <p className="auth-subtitle">{mode === "admin" ? "Sign in to manage datasets, analysis and published reports." : viewerAction === "login" ? "Sign in to view the business reports assigned to your account." : "Create your viewer account using the report access code shared by your administrator."}</p>
        <div className="auth-tabs"><button className={mode === "admin" ? "selected" : ""} onClick={() => {setMode("admin");setError("")}}><LockKeyhole size={15}/> Admin login</button><button className={mode === "viewer" ? "selected" : ""} onClick={() => {setMode("viewer");setError("")}}><UserPlus size={15}/> Viewer access</button></div>
        {mode === "viewer" && <div className="auth-viewer-toggle"><button type="button" className={viewerAction === "login" ? "selected" : ""} onClick={()=>{setViewerAction("login");setError("")}}>Sign in</button><button type="button" className={viewerAction === "signup" ? "selected" : ""} onClick={()=>{setViewerAction("signup");setError("")}}>Create account</button></div>}
        <form onSubmit={submit} className="auth-form">
          {mode === "viewer" && viewerAction === "signup" && <label>Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" required minLength={2}/></label>}
          <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" required/></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === "viewer" ? "At least 8 characters" : "Your administrator password"} required minLength={mode === "viewer" ? 8 : 1}/></label>
          {mode === "viewer" && viewerAction === "signup" && <label>Report access code<input value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Enter the code shared with you" required/></label>}
          {error && <div className="notice error-notice">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait..." : mode === "admin" ? <>Sign in to Admin Portal <ArrowRight size={17}/></> : viewerAction === "login" ? <>Sign in to Viewer Portal <ArrowRight size={17}/></> : <>Create account & open report <ArrowRight size={17}/></>}</button>
        </form>
        <p className="auth-footnote">{mode === "admin" ? "Administrator access is configured by the platform owner." : viewerAction === "login" ? "Your account only sees reports assigned to it." : "Each access code is linked to one published report and can be redeemed once."}</p>
      </section>
      <footer className="auth-footer">INSIGHT AI © 2026 <span>Understand the past. Monitor the present. Prepare for the future.</span></footer>
    </main>
  );
}

// Viewers can see only published reports assigned to their account.
function ViewerPortal({ user, theme, setTheme, onLogout }) {
  const [reports, setReports] = useState([]);
  const [report, setReport] = useState(null);
  const [reportId, setReportId] = useState("");
  const [page, setPage] = useState("Dashboard");
  const [section, setSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chartTypes, setChartTypes] = useState(() => { try { return JSON.parse(localStorage.getItem("insight-viewer-chart-types") || "{}"); } catch { return {}; } });
  const [visibleCharts, setVisibleCharts] = useState(() => { try { return JSON.parse(localStorage.getItem("insight-viewer-visible-charts") || "{}"); } catch { return {}; } });
  const [customizeDashboard, setCustomizeDashboard] = useState(false);
  const [chartFilters, setChartFilters] = useState({});

  useEffect(() => {
    getViewerPreferences().then(result => {
      if (result.preferences?.chartTypes) setChartTypes(result.preferences.chartTypes);
      if (result.preferences?.visibleCharts) setVisibleCharts(result.preferences.visibleCharts);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    localStorage.setItem("insight-viewer-chart-types", JSON.stringify(chartTypes));
    localStorage.setItem("insight-viewer-visible-charts", JSON.stringify(visibleCharts));
    if (Object.keys(chartTypes).length || Object.keys(visibleCharts).length) saveViewerPreferences({ chartTypes, visibleCharts }).catch(() => {});
  }, [chartTypes, visibleCharts]);
  useEffect(() => {
    getViewerReports().then(result => { setReports(result.reports || []); if (result.reports?.length) setReportId(result.reports[0].id); }).catch(err=>setError(err.message)).finally(()=>setLoading(false));
  }, []);
  useEffect(() => {
    if (!reportId) return;
    setLoading(true); setError("");
    getViewerReport(reportId).then(result=>{setReport(result);setSection(0);}).catch(err=>setError(err.message)).finally(()=>setLoading(false));
  }, [reportId]);

  const payload = report?.payload || {};
  const overview = payload.overview || {};
  const decision = payload.decision || {};
  const forecast = payload.forecast;
  const metricCards = [...(overview.metrics || [])].sort((a,b) => {
    const rank = name => /revenue|total sales/i.test(name) ? 100 : /quantity|units/i.test(name) ? 90 : /average order|average revenue/i.test(name) ? 80 : /total rows/i.test(name) ? 70 : /customer/i.test(name) ? 65 : /total columns/i.test(name) ? 45 : /missing|duplicate/i.test(name) ? 10 : 55;
    return rank(b.name) - rank(a.name);
  }).slice(0, 5);
  const pages = ["Executive overview", "Past & present", "Future outlook", "What should we do?"];
  const activeSection = pages[section];

  async function sendQuestion(event) {
    event.preventDefault(); if (!question.trim() || !reportId || chatBusy) return;
    const prompt = question.trim(); setQuestion(""); setChat(items=>[...items,{role:"user",text:prompt}]); setChatBusy(true);
    try { const result = await askViewerReport(reportId,prompt); setChat(items=>[...items,{role:"assistant",text:result.answer,chart:result.chart || null}]); }
    catch(err){setChat(items=>[...items,{role:"assistant",text:err.message || "Unable to answer right now."}]);}
    finally{setChatBusy(false);}
  }

  function renderChart(name, data, index) {
    if (!data?.length) return null;
    const type = chartTypes[name] || (index === 0 ? "bar" : "pie");
    const update = value => setChartTypes(current=>({...current,[name]:value}));
    const activeFilter = chartFilters[name] || "";
    const shown = activeFilter ? data.filter(item=>String(item.name)===activeFilter) : data;
    const ranked = [...shown].sort((a,b)=>Number(b.value||0)-Number(a.value||0));
    const total = ranked.reduce((sum,item)=>sum+Number(item.value||0),0);
    const leading = ranked[0];
    const explanation = leading ? `${leading.name} is highest in this comparison at ${Number(leading.value||0).toLocaleString(undefined,{maximumFractionDigits:2})}${total ? ` (${(Number(leading.value||0)/total*100).toFixed(1)}% of the displayed total)` : ""}. This is a descriptive comparison, not proof of cause.` : "No comparable values are available.";
    return <article className="viewer-chart-card" key={name}>
      <div className="viewer-chart-heading"><div><span>BUSINESS BREAKDOWN</span><h3>{name.replaceAll("_"," ")}</h3></div><div className="viewer-chart-control"><select aria-label={`Filter ${name}`} value={activeFilter} onChange={e=>setChartFilters(current=>({...current,[name]:e.target.value}))}><option value="">All groups</option>{data.slice(0,50).map(x=><option key={String(x.name)} value={String(x.name)}>{x.name}</option>)}</select><select value={type} onChange={e=>update(e.target.value)} aria-label={`Chart type for ${name}`}><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="pie">Donut</option><option value="radar">Radar</option><option value="radial">Radial</option><option value="treemap">Treemap</option></select></div></div>
      <div className="viewer-chart-canvas"><ResponsiveContainer width="100%" height="100%">{type === "scatter" ? <ScatterChart><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="x" name="X"/><YAxis type="number" dataKey="y" name="Y"/><ZAxis range={[35,90]}/><Tooltip cursor={{strokeDasharray:"3 3"}}/><Scatter data={shown} fill="#3867d6"/></ScatterChart> : type === "radar" ? <RadarChart data={shown}><PolarGrid/><PolarAngleAxis dataKey="name"/><PolarRadiusAxis/><Radar dataKey="value" stroke="#3867d6" fill="#3867d6" fillOpacity={0.25}/><Tooltip/></RadarChart> : type === "radial" ? <RadialBarChart data={shown} innerRadius="20%" outerRadius="90%"><RadialBar dataKey="value" background/><Tooltip/></RadialBarChart> : type === "treemap" ? <Treemap data={shown.map(item=>({...item,size:Math.max(0,Number(item.value)||0)}))} dataKey="size" nameKey="name" stroke="#fff" fill="#3867d6"><Tooltip/></Treemap> : type === "pie" ? <PieChart><Tooltip/><Pie data={shown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>{shown.map((entry,i)=><Cell key={i} fill={["#3867d6","#20a779","#e2a13b","#8266d3","#d36b73","#4b9ca8"][i%6]}/>)}</Pie></PieChart> : type === "line" ? <LineChart data={shown}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Line type="monotone" dataKey="value" stroke="#3867d6" strokeWidth={2.5}/></LineChart> : type === "area" ? <AreaChart data={shown}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Area type="monotone" dataKey="value" stroke="#3867d6" fill="#3867d6" fillOpacity={0.16}/></AreaChart> : <BarChart data={shown}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="value" fill="#3867d6" radius={[5,5,0,0]}/></BarChart>}</ResponsiveContainer></div>
      <details className="viewer-chart-explanation"><summary><Info size={13}/> Explain this chart</summary><p>{explanation} The group filter changes only this chart and does not recalculate other business KPIs.</p></details>
    </article>;
  }

  return <div className={`viewer-shell ${theme === "dark" ? "viewer-dark" : ""}`}>
    <aside className="viewer-sidebar"><div className="brand"><div className="brand-mark"><Activity size={22}/></div><div><h1>INSIGHT<span>AI</span></h1><p>BUSINESS INTELLIGENCE</p></div></div><div className="viewer-welcome"><span>VIEWER PORTAL</span><strong>{user.name}</strong><small>{user.email}</small></div><nav><button className={page === "Dashboard" ? "active" : ""} onClick={()=>setPage("Dashboard")}><LayoutDashboard size={17}/> Analytics</button><button className={page === "Latest Report" ? "active" : ""} onClick={()=>setPage("Latest Report")}><FileText size={17}/> Report</button><button className={page === "AI Assistant" ? "active" : ""} onClick={()=>setPage("AI Assistant")}><MessageCircle size={17}/> AI Chatbot</button></nav><div className="viewer-sidebar-bottom"><button onClick={()=>setTheme(v=>v === "light" ? "dark":"light")}>{theme === "light" ? <Moon size={17}/> : <Sun size={17}/>} {theme === "light" ? "Dark mode":"Light mode"}</button><button onClick={onLogout}><LogOut size={17}/> Sign out</button></div></aside>
    <main className="viewer-main"><header className="viewer-topbar"><div><span>INSIGHT AI / VIEWER</span><strong>{page}</strong></div><div className="viewer-top-actions"><span className="viewer-live-dot">Published report access</span><div className="user-avatar">{user.name?.slice(0,1)?.toUpperCase()}</div></div></header>
      <div className="viewer-content">
        {loading ? <div className="viewer-empty"><RefreshCw className="spin"/><h2>Loading your report</h2><p>Retrieving your published business intelligence.</p></div> : error ? <div className="viewer-empty"><AlertTriangle/><h2>Report unavailable</h2><p>{error}</p></div> : !report ? <div className="viewer-empty"><FileText/><h2>No published report yet</h2><p>Your administrator has not assigned a report to this account.</p></div> : <>
          {page !== "AI Assistant" && <div className="viewer-report-title"><div><span className="eyebrow">LATEST PUBLISHED REPORT</span><h1>{report.title}</h1><p>Generated {new Date(report.created_at * 1000).toLocaleString()} · {overview.rows?.toLocaleString()} records · {overview.columns} columns</p></div><button className="viewer-primary-button" onClick={()=>{setPage("Latest Report");setSection(0)}}><FileText size={16}/> Open full report</button></div>}
          {page === "Dashboard" && <section className="bi-viewer-analytics">
            <div className="viewer-section-intro"><div><h2>Analytics · business at a glance</h2><p>The same analysed business snapshot prepared by the admin when this report was published.</p></div></div>
            <BusinessAnalyticsSnapshot payload={payload}/>
            <div className="viewer-four-questions">
              <div><span>PAST</span><strong>What happened?</strong><p>{decision.business_narrative?.overall_performance || decision.executive_summary || "See the report's recorded results."}</p></div>
              <div><span>INSIGHTS</span><strong>Why did it happen?</strong><p>{decision.business_narrative?.product_performance || "The recorded groups show differences, but causation has not been established."}</p></div>
              <div><span>FUTURE WORKFLOW</span><strong>What will happen?</strong><p>Predictions and forecasting are postponed until validated. Current reports cover observed performance, stock risks and evidence-based actions.</p></div>
              <div><span>ACTIONS</span><strong>What should we do?</strong><p>{payload?.retail?.actions?.[0]?.action || (typeof decision.recommendations?.[0] === "string" ? decision.recommendations[0] : decision.recommendations?.[0]?.description) || "Review findings and constraints before acting."}</p></div>
            </div>
          </section>}
          {page === "Latest Report" && <BusinessReport payload={payload} title={report.title} />}
          {page === "AI Assistant" && <section className="viewer-chat-page"><div className="viewer-section-intro"><div><span className="eyebrow">REPORT-GROUNDED AI</span><h2>AI Research Assistant</h2><p>Ask questions about your assigned published report. Answers are limited to this report's saved evidence.</p></div></div><div className="viewer-chat-history">{chat.length===0 && <div className="viewer-chat-empty"><MessageCircle size={28}/><h3>What would you like to understand?</h3><p>Try asking about performance, findings, forecasts, risks or recommendations.</p><div className="viewer-prompts">{["Summarise the business performance.","What are the main risks?","Which products and locations performed best?"] .map(q=><button key={q} onClick={()=>setQuestion(q)}>{q}</button>)}</div></div>}{chat.map((item,i)=><div className={`viewer-chat-message ${item.role}`} key={i}><strong>{item.role === "user" ? "You":"INSIGHT AI"}</strong><ReactMarkdown remarkPlugins={[remarkGfm]}>{String(item.text||"")}</ReactMarkdown>{item.chart?.data?.length>0 && <div className="viewer-chat-chart"><h4>{item.chart.title}</h4><InsightChart data={item.chart.data} type={item.chart.type || "bar"} xKey={item.chart.xKey || "group"}/><p className="viewer-chart-note">Values from this assigned published report only.</p></div>}</div>)}{chatBusy && <p className="viewer-muted">INSIGHT AI is reviewing the published report…</p>}</div><form className="viewer-chat-form" onSubmit={sendQuestion}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask a question about this report..."/><button disabled={chatBusy || !question.trim()}><Send size={17}/></button></form></section>}
        </>}
      </div>
    </main>
  </div>;
}

function PredictionRoadmapPage() {
  return <section className="module-placeholder"><div className="placeholder-icon"><TrendingUp size={27}/></div><span className="eyebrow">FUTURE WORKFLOW · NOT ACTIVE</span><h2>Predictions & Forecasting</h2><p>INSIGHT AI currently focuses on observed retail and e-commerce performance, inventory checks and evidence-backed recommendations. Forecasting is intentionally disabled until dataset coverage, time-series validation and business reliability are proven.</p><div className="modeling-roadmap"><div><strong>Available now</strong><span>Historical analytics and decisions</span></div><ArrowRight size={18}/><div><strong>Future workflow</strong><span>Validated sales, stock and demand forecasts</span></div></div></section>;
}

function DataModelingPage() {
  return <section className="module-placeholder"><div className="placeholder-icon"><GitBranch size={27}/></div><span className="eyebrow">FUTURE INTEGRATION</span><h2>Data Modeling</h2><p>INSIGHT AI currently focuses on one complete CSV or Excel dataset at a time. Multi-table primary/foreign key detection, relationship diagrams, join recommendations and validated joins are planned for a future release.</p><div className="modeling-roadmap"><div><strong>Current workflow</strong><span>Single dataset ingestion and analysis</span></div><ArrowRight size={18}/><div><strong>Future workflow</strong><span>Multiple tables, relationships and analytical joins</span></div></div></section>;
}

// Business KPIs and chart summaries for the currently selected dataset.
function OverviewPage({ profile, datasetId, resetWorkspace, openPage }) {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [category, setCategory] = useState([]);
  const [productBreakdown, setProductBreakdown] = useState([]);
  const [secondary, setSecondary] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [forecastNote, setForecastNote] = useState("Checking whether this dataset supports a reliable forecast…");
  const [busy, setBusy] = useState(true);
  const [source, setSource] = useState("original");
  const [explanation, setExplanation] = useState(null);

  useEffect(() => {
    let alive = true;
    getAnalyticsOverview(datasetId, "cleaned").then(() => { if (alive) setSource("cleaned"); }).catch(() => {});
    return () => { alive = false; };
  }, [datasetId]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setBusy(true);
      try {
        const data = await getAnalyticsOverview(datasetId, source);
        if (!alive) return;
        setOverview(data);
        const numeric = data.numeric_summary || [];
        const categories = data.categorical_columns || [];
        const dates = data.date_columns || [];
        const semantics = profile.column_profiles || [];
        const semanticField = types => semantics.find(c => types.includes(String(c.semantic_type || "").toLowerCase()) && categories.includes(c.name))?.name;
        const categoryField = semanticField(["category", "channel", "location", "region"]) || categories[0];
        const productField = semanticField(["product"]) || categories.find(c => c !== categoryField);
        const segmentField = semanticField(["customer", "segment", "gender"]) || categories.find(c => c !== categoryField && c !== productField);
        const revenue = numeric.find(x => /revenue|sales|amount|gross/i.test(x.column)) || numeric.find(x => !/id|code|zip|postal/i.test(x.column));
        const quantity = numeric.find(x => /quantity|qty|units|stock/i.test(x.column));
        const date = dates[0];
        const metric = revenue?.column;
        const tasks = [];
        if (date && metric) tasks.push(getAnalyticsTrend(datasetId, date, metric, "month", source).then(r => alive && setTrend(r.results || [])).catch(() => alive && setTrend([])));
        if (categoryField && metric) tasks.push(getAnalyticsBreakdown(datasetId, categoryField, metric, "sum", source).then(r => alive && setCategory(r.results || [])).catch(() => alive && setCategory([])));
        if (productField && metric) tasks.push(getAnalyticsBreakdown(datasetId, productField, metric, "sum", source).then(r => alive && setProductBreakdown(r.results || [])).catch(() => alive && setProductBreakdown([])));
        else setProductBreakdown([]);
        if (segmentField && metric) tasks.push(getAnalyticsBreakdown(datasetId, segmentField, metric, "sum", source).then(r => alive && setSecondary(r.results || [])).catch(() => alive && setSecondary([])));
        else if (categories.length) tasks.push(getAnalyticsBreakdown(datasetId, categories[0], null, "count", source).then(r => alive && setSecondary(r.results || [])).catch(() => alive && setSecondary([])));
        // Forecasting is intentionally deferred; do not calculate during overview.
        setForecast(null);
        setForecastNote("Predictions and forecasting are a planned future workflow. Review the historical business report for evidence-backed decisions.");
        await Promise.allSettled(tasks);
      } catch (err) {
        if (alive) setForecastNote(err.message || "Analytics could not be loaded.");
      } finally { if (alive) setBusy(false); }
    }
    load();
    return () => { alive = false; };
  }, [datasetId, source]);

  const metrics = overview?.metrics || [];
  const findMetric = (...patterns) => metrics.find(m => patterns.some(p => p.test(m.name)) && !/rows|columns|missing|duplicate/i.test(m.name));
  const totalRevenue = findMetric(/revenue|sales/i);
  const orders = findMetric(/orders/i);
  const aov = findMetric(/average order value/i);
  const quantity = findMetric(/quantity|units/i);
  const customers = findMetric(/unique customers|customer count|distinct customers/i);
  const inferredGroups = category.length || secondary.length;
  const averagePerRecord = Number(totalRevenue?.value) / Number(overview?.rows || 0);
  const kpis = [
    {label: totalRevenue?.name || "Recorded revenue", value: totalRevenue?.value, icon: "₹", tone: "blue"},
    {label: orders?.name || "Total records", value: orders?.value ?? overview?.rows, icon: "▤", tone: "violet"},
    {label: aov?.name || "Average revenue / record", value: aov?.value ?? (Number.isFinite(averagePerRecord) ? averagePerRecord : null), icon: "◉", tone: "green"},
    {label: customers?.name || (inferredGroups ? "Groups compared" : "Customers / groups"), value: customers?.value ?? (inferredGroups || null), icon: "♙", tone: "orange"},
    {label: quantity?.name || "Quality score", value: quantity?.value ?? (profile.quality_score != null ? `${profile.quality_score}%` : null), icon: "↗", tone: "cyan"},
  ];
  const money = value => value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString(undefined, {maximumFractionDigits: 0});
  const topCategory = category[0];
  const healthIssues = [
    {label: "Missing cells", value: overview?.missing_cells ?? profile.missing_cells ?? 0},
    {label: "Duplicate rows", value: overview?.duplicate_rows ?? profile.duplicate_rows ?? 0},
    {label: "Rows", value: overview?.rows ?? profile.rows ?? 0},
  ];
  const explain = (title, rows, field) => {
    const sorted = [...(rows || [])].sort((a,b) => Number(b.value || 0) - Number(a.value || 0));
    const total = sorted.reduce((sum, x) => sum + Number(x.value || 0), 0);
    const lines = sorted.slice(0, 5).map((x, i) => `${i+1}. ${x.group}: ${money(x.value)}`).join("\n");
    setExplanation({title, text: sorted.length ? `${title} is calculated from the selected ${source} dataset. ${sorted[0].group} is currently highest at ${money(sorted[0].value)}${total ? ` (${(Number(sorted[0].value)/total*100).toFixed(1)}% of the displayed total)` : ""}.\n\nTop values:\n${lines}\n\nThis is a descriptive comparison. It does not by itself prove why the difference occurred.` : `There is not enough compatible data to explain ${title}.`});
  };

  return <div className="command-dashboard">
    <div className="dashboard-heading">
      <div><div className="eyebrow"><Sparkles size={13}/> AI DATA INTELLIGENCE COMMAND CENTER</div><h2>Business overview</h2><p>{profile.filename} · {profile.detected_domain || "General dataset"} · {Number(overview?.rows ?? profile.rows ?? 0).toLocaleString()} records</p></div>
      <div className="dashboard-controls"><select value={source} onChange={e=>setSource(e.target.value)} aria-label="Dataset version"><option value="original">Active dataset (automatically cleaned)</option><option value="raw">Original upload (audit / compare)</option><option value="cleaned">Approved cleaned dataset</option></select><button className="dashboard-outline" onClick={resetWorkspace}>Change dataset</button></div>
    </div>
    <div className="dashboard-kpis">{kpis.map((k,i)=><article className={`dashboard-kpi ${k.tone}`} key={i}><span className="kpi-icon">{k.icon}</span><span className="kpi-label">{k.label}</span><strong>{typeof k.value === "number" ? money(k.value) : (k.value ?? "N/A")}</strong><small>{i===4 && !quantity ? "Data completeness and consistency" : k.value == null ? "Metric not present in this file" : "Calculated from selected data"}</small></article>)}</div>
    {busy && <div className="dashboard-loading"><span className="loading-spinner"/> Analysing dataset and preparing business intelligence…</div>}
    <div className="dashboard-chart-row">
      <article className="dashboard-card trend-card"><div className="dashboard-card-head"><div><h3>Revenue and order trend</h3><p>Historical performance by month</p></div><button className="chart-info" onClick={()=>explain("Historical trend", trend.map(x=>({group:x.period,value:x.value})))} title="Explain this chart">i</button></div>{trend.length ? <><ResponsiveContainer width="100%" height={205}><AreaChart data={trend}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d83ed" stopOpacity={.24}/><stop offset="100%" stopColor="#4d83ed" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="period" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>money(v)}/><Area type="monotone" dataKey="value" stroke="#477ce7" strokeWidth={2.5} fill="url(#revenueFill)"/></AreaChart></ResponsiveContainer><div className="chart-footnote">{trend.length} historical periods · Values are calculated from source records</div></> : <EmptyChart text="A recognised date and numeric measure are needed for a time trend."/>}</article>
      <article className="dashboard-card"><div className="dashboard-card-head"><div><h3>Revenue by channel / category</h3><p>{profile.column_profiles?.find(c=>["category","channel","location","region"].includes(String(c.semantic_type||"").toLowerCase()) && overview?.categorical_columns?.includes(c.name))?.name || overview?.categorical_columns?.[0] || "Category"} contribution</p></div><button className="chart-info" onClick={()=>explain("Category contribution",category)}>i</button></div>{category.length ? <><ResponsiveContainer width="100%" height={205}><PieChart><Pie data={category.slice(0,6)} dataKey="value" nameKey="group" innerRadius={48} outerRadius={78} paddingAngle={3}>{category.slice(0,6).map((_,i)=><Cell key={i} fill={["#477ce7","#17a98b","#f4a340","#8b70d6","#e16c85","#45a9c7"][i%6]}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer><div className="mini-legend">{category.slice(0,4).map((x,i)=><span key={x.group}><i style={{background:["#477ce7","#17a98b","#f4a340","#8b70d6"][i]}}/>{x.group}</span>)}</div></> : <EmptyChart text="No suitable category field and numeric metric were detected."/>}</article>
      <article className="dashboard-card product-card"><div className="dashboard-card-head"><div><h3>Top products / groups</h3><p>Highest contributing values</p></div><button className="chart-info" onClick={()=>explain("Top products / groups",productBreakdown.length?productBreakdown:category)}>i</button></div>{(productBreakdown.length?productBreakdown:category).length ? <div className="rank-list">{(productBreakdown.length?productBreakdown:category).slice(0,5).map((x,i)=><div className="rank-item" key={x.group}><span className="rank-number">0{i+1}</span><span className="rank-name">{x.group}</span><strong>{money(x.value)}</strong><div className="rank-track"><i style={{width:`${Math.max(2,Number(x.value||0)/Math.max(1,Number((productBreakdown.length?productBreakdown:category)[0]?.value||1))*100)}%`}}/></div></div>)}</div> : <EmptyChart text="No product or category ranking is available."/>}</article>
    </div>
    <div className="dashboard-health-row">
      <article className="dashboard-card health-card"><div className="dashboard-card-head"><div><h3>Data health overview</h3><p>Quality indicators, separate from business KPIs</p></div><span className="health-score">{profile.quality_score ?? "—"}%</span></div><div className="health-progress"><i style={{width:`${Math.min(100,Math.max(0,Number(profile.quality_score)||0))}%`}}/></div><div className="health-metrics">{healthIssues.map(x=><div key={x.label}><span>{x.label}</span><strong>{Number(x.value).toLocaleString()}</strong></div>)}</div></article>
      <article className="dashboard-card alert-card"><div className="dashboard-card-head"><div><h3>Critical issues & anomaly alerts</h3><p>Items that deserve review before decisions</p></div><AlertTriangle size={18}/></div>{(profile.warnings || []).length ? profile.warnings.slice(0,3).map((w,i)=><div className="alert-line" key={i}><i/>{w}</div>) : <div className="alert-line positive"><i/>No profile warnings were returned. This does not guarantee the data is error-free.</div>}{Number(profile.missing_cells||0)>0 && <div className="alert-line"><i/>Missing values detected. Review their pattern before applying imputation.</div>}</article>
      <article className="dashboard-card forecast-card"><div className="dashboard-card-head"><div><h3>Business growth opportunities</h3><p>Historical retail evidence · not forecasts</p></div><Info size={18}/></div><div className="pipeline-steps"><span>✓ Review top-selling items and revenue leaders</span><span>✓ Identify low-margin groups needing investigation</span><span>✓ Check stock against reorder levels when available</span><span>• Predictive forecasting: future workflow</span></div><button className="dashboard-link" onClick={()=>openPage("Reports")}>See business decisions <ArrowRight size={14}/></button></article>
    </div>
    <div className="dashboard-bottom-row">
      <article className="dashboard-card"><div className="dashboard-card-head"><div><h3>Sales by category</h3><p>Compare business contribution</p></div><button className="chart-info" onClick={()=>explain("Sales by category",category)}>i</button></div>{category.length ? <ResponsiveContainer width="100%" height={190}><BarChart data={category.slice(0,8)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="group" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="value" fill="#477ce7" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyChart text="No category breakdown is available."/>}</article>
      <article className="dashboard-card"><div className="dashboard-card-head"><div><h3>Customer / segment distribution</h3><p>{profile.column_profiles?.find(c=>["customer","segment","gender"].includes(String(c.semantic_type||"").toLowerCase()) && overview?.categorical_columns?.includes(c.name))?.name || overview?.categorical_columns?.[1] || overview?.categorical_columns?.[0] || "Detected segment"}</p></div><button className="chart-info" onClick={()=>explain("Segment distribution",secondary)}>i</button></div>{secondary.length ? <ResponsiveContainer width="100%" height={190}><BarChart data={secondary.slice(0,7)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="group" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="value" fill="#18a889" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyChart text="No second category field is available for segmentation."/>}</article>
      <article className="dashboard-card pipeline-card"><div className="dashboard-card-head"><div><h3>Analytics pipeline</h3><p>What INSIGHT AI has processed</p></div><Activity size={18}/></div><div className="pipeline-steps"><span>✓ Dataset uploaded</span><span>✓ Schema and domain inspected</span><span>✓ Data profile calculated</span><span>{category.length || trend.length ? "✓" : "•"} Business analytics prepared</span><span>• Future forecasting workflow deferred</span></div><button className="dashboard-link" onClick={()=>openPage("Analytics Studio")}>Open Analytics Studio <ArrowRight size={14}/></button></article>
    </div>
    {explanation && <div className="insight-modal-backdrop" onClick={()=>setExplanation(null)}><section className="insight-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setExplanation(null)}>×</button><div className="eyebrow"><Sparkles size={13}/> CHART EXPLANATION</div><h3>{explanation.title}</h3><p style={{whiteSpace:"pre-line"}}>{explanation.text}</p><button className="dashboard-outline" onClick={()=>setExplanation(null)}>Close</button></section></div>}
  </div>;
}

function EmptyChart({text}) { return <div className="empty-chart"><BarChart3 size={24}/><span>{text}</span></div>; }

function DataHealthPage({ profile, openPage }) {
  const cols = profile.column_profiles || [];
  const missing = cols.filter(c => Number(c.missing_count || 0) > 0).sort((a,b)=>Number(b.missing_count)-Number(a.missing_count));
  const severe = missing.filter(c => Number(c.missing_percentage || 0) >= 50);
  return <section className="analytics-page data-health-page">
    <div className="welcome-section"><div><div className="eyebrow"><ShieldCheck size={14}/> DATA HEALTH ASSESSMENT</div><h2>Understand the risks before cleaning.</h2><p>Review missingness patterns, duplicates and column-level quality before applying transformations.</p></div><button className="analyze-button" onClick={()=>openPage("Data Cleaning")}>Review cleaning recommendations <ArrowRight size={16}/></button></div>
    <div className="stats-grid"><Stat label="Quality score" value={`${profile.quality_score}%`} icon={ShieldCheck}/><Stat label="Missing cells" value={Number(profile.missing_cells||0).toLocaleString()} icon={AlertTriangle}/><Stat label="Duplicate rows" value={Number(profile.duplicate_rows||0).toLocaleString()} icon={CopyIcon}/><Stat label="Columns with missing data" value={missing.length} icon={Columns3}/></div>
    {severe.length>0 && <div className="notice error-notice"><AlertTriangle size={17}/> {severe.length} column(s) have at least 50% missing values. Do not apply blanket row deletion or imputation. Review the source and business meaning first.</div>}
    <section className="analytics-panel"><div className="analytics-panel-heading"><div><h3>Column-level missingness</h3><p>Sorted by the number of missing values. Values are from the uploaded profile.</p></div></div>
      {missing.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Column</th><th>Data type</th><th>Missing</th><th>Missing %</th><th>Suggested review</th></tr></thead><tbody>{missing.map(c=><tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.data_type}</td><td>{Number(c.missing_count).toLocaleString()}</td><td>{Number(c.missing_percentage).toFixed(1)}%</td><td>{Number(c.missing_percentage)>=50 ? "Investigate source; do not auto-impute" : c.semantic_type==="identifier" ? "Preserve identifier; investigate" : "Preview a suitable column strategy"}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No missing values were reported in the current profile.</p>}
    </section>
    <section className="analytics-panel"><div className="analytics-panel-heading"><div><h3>Cleaning safety rules</h3><p>INSIGHT AI must protect business meaning, not just maximise the quality score.</p></div></div><ul className="health-rule-list"><li>Preserve the original upload and create a separate cleaned version.</li><li>Never delete rows simply because many cells are missing; inspect the missingness pattern and the value of each record.</li><li>Do not invent identifiers or impute target labels without an explicit, defensible policy.</li><li>Show a preview, affected-row count and reason before applying a transformation.</li><li>Keep outliers for review by default unless a verified correction rule exists.</li></ul></section>
  </section>;
}

function BusinessOverviewPanel({ datasetId, profile }) {
  const [overview, setOverview] = useState(null);
  const [decision, setDecision] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const a = await getAnalyticsOverview(datasetId);
        if (!live) return;
        setOverview(a);
        const metric = a.numeric_summary?.find((item) => !/id$/i.test(item.column))?.column;
        const category = a.categorical_columns?.[0];
        const date = a.date_columns?.[0];
        const tasks = [];
        if (category && metric) tasks.push(getAnalyticsBreakdown(datasetId, category, metric, "sum").then((r) => live && setCategoryData(r.results || [])));
        if (date && metric) tasks.push(getAnalyticsTrend(datasetId, date, metric, "month").then((r) => live && setTrendData(r.results || [])));
        await Promise.allSettled(tasks);
        try { const d = await getDecisionReport(datasetId); if (live) setDecision(d); } catch { /* keep deterministic snapshot */ }
      } catch { /* overview cards remain available */ }
    }
    load();
    return () => { live = false; };
  }, [datasetId]);
  const businessMetrics = overview?.metrics?.filter((m) => !["Total Rows", "Total Columns", "Missing Cells", "Duplicate Rows"].includes(m.name)) || [];
  const summary = decision?.executive_summary || `This ${profile.detected_domain || "business"} dataset contains ${Number(profile.rows || 0).toLocaleString()} records across ${profile.columns || profile.column_profiles?.length || 0} columns. The current dataset has ${profile.missing_cells || 0} missing cells and ${profile.duplicate_rows || 0} duplicate records. Historical revenue and sales patterns are being assessed using the available business fields. The business insights shown below depend on the date, price, quantity and category information actually present in the file.`;
  return <section className="business-overview"><div className="business-story-card"><div className="eyebrow"><Sparkles size={14}/> BUSINESS SNAPSHOT</div><h3>What this dataset tells us</h3><p>{summary}</p><div className="business-story-meta"><span>{profile.detected_domain || "General dataset"}</span><span>{Number(profile.rows || 0).toLocaleString()} records analysed</span><span>{profile.domain_confidence || "Unknown"} domain confidence</span></div></div>{businessMetrics.length > 0 && <div className="business-kpi-strip">{businessMetrics.slice(0,4).map((m) => <div className="business-kpi" key={m.name}><span>{m.name}</span><strong>{typeof m.value === "number" ? m.value.toLocaleString(undefined,{maximumFractionDigits:2}) : String(m.value ?? "N/A")}</strong><small>{m.description}</small></div>)}</div>}<div className="overview-mini-charts">{categoryData.length > 0 && <article className="overview-mini-chart"><div><strong>Category performance</strong><span>Historical metric by category</span></div><ResponsiveContainer width="100%" height={155}><BarChart data={categoryData.slice(0,6)}><XAxis dataKey="group" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Bar dataKey="value" fill="#4d91e8" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer><p>{categoryData.length ? `${categoryData[0].group} currently leads this comparison with ${Number(categoryData[0].value).toLocaleString(undefined,{maximumFractionDigits:2})}. This is a historical result, not a forecast.` : "No category comparison is available."}</p></article>}{trendData.length > 0 && <article className="overview-mini-chart"><div><strong>Historical trend</strong><span>Period-by-period movement</span></div><ResponsiveContainer width="100%" height={155}><LineChart data={trendData}><XAxis dataKey="period" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Line type="monotone" dataKey="value" stroke="#19a783" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer><p>{trendData.length > 1 ? `The chart contains ${trendData.length} periods. Review the latest movement before making purchasing or staffing decisions.` : "More historical periods are needed for a trend comparison."}</p></article>}</div></section>;
}

// Dataset columns, types and target suggestions are shown here.
function DataUnderstandingPage({ profile, datasetId }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowError, setRowError] = useState("");
  const [reloadRows, setReloadRows] = useState(0);
  const columns = profile.column_profiles || [];
  const numericTargets = columns.filter((c) => ["numeric", "number"].includes(String(c.data_type || "").toLowerCase()) && !/(^id$|_id$|code|zip|postal|phone)/i.test(c.name));
  const targetPriority = (c) => {
    const name = c.name.toLowerCase();
    if (/revenue|total.?sales|sales.?amount|net.?sales/.test(name)) return 120;
    if (/profit|margin/.test(name)) return 100;
    if (/demand|quantity|units.?sold|qty/.test(name)) return 90;
    if (/amount|outcome|target|label/.test(name)) return 70;
    if (/price|cost/.test(name)) return 45;
    return 10;
  };
  const suggestedTarget = [...numericTargets].sort((a, b) => targetPriority(b) - targetPriority(a))[0];
  const [manualTarget, setManualTarget] = useState(() => localStorage.getItem(`insight-target-${datasetId}`) || "");
  const actualTarget = numericTargets.find(c => c.name === manualTarget) || suggestedTarget;
  const changeTarget = (value) => {
    setManualTarget(value);
    if (value) localStorage.setItem(`insight-target-${datasetId}`, value);
    else localStorage.removeItem(`insight-target-${datasetId}`);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingRows(true);
    setRowError("");
    getDatasetRows(datasetId, page, 20, search)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setRowError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setData(null);
          setRowError(error.message || "The dataset preview could not be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setLoadingRows(false); });
    return () => { cancelled = true; };
  }, [datasetId, page, search, reloadRows]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section className="explorer-page">
      <div className="welcome-section">
        <div><div className="eyebrow"><Database size={14} /> DATA EXPLORER</div><h2>Explore every record.</h2><p>Search, inspect and understand the actual rows in your uploaded dataset.</p></div>
        <span className="supported-label">{profile.filename}</span>
      </div>
      <div className="stats-grid">
        <Stat label="Total records" value={profile.rows?.toLocaleString()} icon={Database} />
        <Stat label="Columns" value={columns.length.toLocaleString()} icon={Columns3} />
        <Stat label="Missing cells" value={profile.missing_cells?.toLocaleString()} icon={AlertTriangle} />
        <Stat label="Duplicate rows" value={profile.duplicate_rows?.toLocaleString()} icon={CopyIcon} />
      </div>
      <section className="explorer-card">
        <div className="section-heading"><div><h3>Dataset preview</h3><p>Inspect actual records. Search across all columns and move through the dataset.</p></div><span className="supported-label">{profile.rows?.toLocaleString()} total rows</span></div>
        <form className="explorer-search" onSubmit={submitSearch}><Search size={17}/><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search any value, product, category, city..."/><button type="submit">Search</button>{search && <button type="button" className="explorer-clear" onClick={() => {setSearchInput("");setSearch("");setPage(1);}}>Clear</button>}</form>
        {rowError && <div className="notice error-notice">{rowError} <button type="button" onClick={() => setReloadRows((value) => value + 1)}>Retry</button></div>}
        <div className="explorer-table-wrap">
          {loadingRows ? <div className="cleaning-empty"><RefreshCw className="spin"/> Loading dataset rows...</div> : data?.rows?.length ? (
            <table className="columns-table explorer-table"><thead><tr><th>#</th>{data.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={`${page}-${index}`}><td>{(page - 1) * 20 + index + 1}</td>{data.columns.map((column) => <td key={column}>{row[column] === null || row[column] === undefined ? <span className="null-cell">NULL</span> : String(row[column])}</td>)}</tr>)}</tbody></table>
          ) : <div className="cleaning-empty"><Search/><h3>No matching records</h3><p>Try a different search value.</p></div>}
        </div>
        <div className="explorer-pagination"><span>{data ? `Showing ${data.total_filtered ? (page - 1) * 20 + 1 : 0}–${Math.min(page * 20, data.total_filtered)} of ${data.total_filtered.toLocaleString()} matching rows` : "Loading rows"}</span><div><button disabled={page <= 1 || loadingRows} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16}/> Previous</button><strong>Page {page} / {data?.total_pages || 1}</strong><button disabled={!data || page >= data.total_pages || loadingRows} onClick={() => setPage((p) => p + 1)}>Next <ChevronRightIcon size={16}/></button></div></div>
      </section>
      <section className="target-suggestion-card target-selector-card"><div><span className="eyebrow">PREDICTION TARGET</span><h3>{actualTarget?.name || "No numeric target available"}</h3><p>We suggest an outcome column using business meaning, prioritising revenue or demand over unit price. You can override it. Forecasting will use your selection where appropriate; a valid date field is still required.</p></div><label className="target-selector-label">Choose target<select value={manualTarget} onChange={e => changeTarget(e.target.value)}><option value="">Automatic: {suggestedTarget?.name || "Not available"}</option>{numericTargets.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label></section>
      <section className="profile-section"><div className="section-heading"><div><h3>Column dictionary</h3><p>Detected data types and business meanings. The suggested target is highlighted.</p></div></div><div className="columns-table-wrapper"><table className="columns-table"><thead><tr><th>Column</th><th>Data type</th><th>Business meaning</th><th>Missing</th><th>Unique</th><th>Prediction role</th></tr></thead><tbody>{columns.map((column) => <tr key={column.name}><td><strong>{column.name}</strong></td><td>{column.data_type}</td><td><span className="semantic-tag">{column.semantic_type}</span></td><td>{column.missing_count?.toLocaleString()}</td><td>{column.unique_count?.toLocaleString()}</td><td>{actualTarget?.name === column.name ? <span className="target-suggestion-badge">{manualTarget ? "Selected target" : "Suggested target"}</span> : <span className="muted-role">Feature / context</span>}</td></tr>)}</tbody></table></div></section>
    </section>
  );
}

// Review the recommended cleaning plan before applying changes.
function CleaningPage({
  preview, result, loading, applying, downloading,
  error, success, loadPreview, applyCleaning, download,
}) {
  const recommendations = preview?.recommendations || [];
  const outliers = preview?.outliers || [];

  function describeStrategy(strategy) {
    const descriptions = {
      median: "Fill missing entries using a typical value from this column.",
      mean: "Fill missing entries using the average of this column.",
      mode: "Fill missing entries using the most frequently occurring value.",
      drop_rows: "Remove records that have missing values in this column.",
      leave: "Keep the missing entries unchanged.",
    };

    return descriptions[strategy] || "Use the recommended approach for this column.";
  }

  function strategyLabel(strategy) {
    const labels = {
      median: "Typical value",
      mean: "Average value",
      mode: "Most common value",
      drop_rows: "Remove incomplete records",
      leave: "Keep unchanged",
    };

    return labels[strategy] || "Recommended action";
  }

  return (
    <section className="cleaning-page">
      <div className="welcome-section">
        <div>
          <div className="eyebrow"><WandSparkles size={14} /> INTELLIGENT DATA PREPARATION</div>
          <h2>Let INSIGHT prepare your data.</h2>
          <p>We analyse your dataset and recommend suitable improvements automatically.</p>
        </div>
        <button className="cleaning-refresh" onClick={loadPreview} disabled={loading || applying}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          Analyse again
        </button>
      </div>

      <div className="pipeline-flow-card">
        <div className="pipeline-stage active"><span>01</span><strong>Profile</strong><small>Inspect structure</small></div><ArrowRight size={17}/>
        <div className="pipeline-stage active"><span>02</span><strong>Diagnose</strong><small>Find quality issues</small></div><ArrowRight size={17}/>
        <div className="pipeline-stage"><span>03</span><strong>Transform</strong><small>Apply selected rules</small></div><ArrowRight size={17}/>
        <div className={`pipeline-stage ${result ? "active" : ""}`}><span>04</span><strong>Validate</strong><small>Compare before/after</small></div>
      </div>
      {error && <div className="notice error-notice">{error}</div>}
      {success && <div className="notice success-notice">{success}</div>}

      {loading && !preview ? (
        <div className="cleaning-empty">
          <RefreshCw className="spin" />
          <h3>Understanding your dataset...</h3>
          <p>Checking data quality and identifying possible improvements.</p>
        </div>
      ) : !preview ? (
        <div className="cleaning-empty">
          <Database size={30} />
          <h3>Dataset analysis is needed</h3>
          <p>Analyse your dataset to discover which improvements are recommended.</p>
          <button className="analyze-button" onClick={loadPreview}>
            Analyse dataset <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="cleaning-stats">
            <CleaningStat label="Total records" value={preview.rows?.toLocaleString()} icon={Database} />
            <CleaningStat label="Columns" value={preview.columns} icon={BarChart3} />
            <CleaningStat label="Missing cells" value={preview.missing_cells?.toLocaleString()} icon={AlertTriangle} />
            <CleaningStat label="Duplicate records" value={preview.duplicate_rows?.toLocaleString()} icon={Trash2} />
          </div>

          <section className="cleaning-intro-card">
            <div className="cleaning-intro-icon"><BrainCircuit size={24} /></div>
            <div>
              <h3>Analysis complete</h3>
              <p>
                INSIGHT has inspected your dataset and prepared a cleaning plan.
                INSIGHT has selected the cleaning actions from detected data issues. Review the execution plan, then run the pipeline.
              </p>
            </div>
            <span className="analysis-status"><CheckCircle2 size={15} /> Ready</span>
          </section>

          <section className="cleaning-section-card">
            <div className="cleaning-card-heading">
              <div>
                <h3>Automated cleaning decisions</h3>
                <p>These actions were selected from the dataset analysis.</p>
              </div>
              <span className="cleaning-count">{recommendations.length} recommendations</span>
            </div>

            {recommendations.length > 0 ? (
              <div className="recommendation-list">
                {recommendations.map((item) => (
                  <div className="recommendation-item" key={item.column}>
                    <div className="recommendation-icon"><CheckCircle2 size={18} /></div>
                    <div className="recommendation-content">
                      <strong>{item.column}</strong>
                      <p>{item.missing_count} missing entries detected.</p>
                      <small>{describeStrategy(item.suggested_strategy)}</small>
                    </div>
                    <span className="recommendation-action">
                      {strategyLabel(item.suggested_strategy)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cleaning-no-issues">
                <CheckCircle2 size={19} />
                No missing-value improvements are currently recommended.
              </div>
            )}
          </section>

          <section className="cleaning-section-card">
            <div className="cleaning-card-heading">
              <div>
                <h3>Duplicate records</h3>
                <p>Repeated records can affect analysis and reporting.</p>
              </div>
              <span className="recommendation-action">Review before removal</span>
            </div>
            <div className="cleaning-inline-info">
              <Trash2 size={18} />
              <span>
                <strong>{preview.duplicate_rows?.toLocaleString() || 0}</strong>
                {" "}duplicate-looking records were detected. They are preserved by default until you confirm they are truly redundant.
              </span>
            </div>
          </section>

          <section className="cleaning-section-card">
            <div className="cleaning-card-heading">
              <div>
                <h3>Unusual values</h3>
                <p>Potentially unusual values detected in numerical columns.</p>
              </div>
              <span className="cleaning-count">{outliers.length} columns checked</span>
            </div>

            {outliers.length > 0 ? (
              <div className="recommendation-list">
                {outliers.map((item) => (
                  <div className="recommendation-item" key={item.column}>
                    <div className="recommendation-icon warning"><AlertTriangle size={18} /></div>
                    <div className="recommendation-content">
                      <strong>{item.column}</strong>
                      <p>{item.outlier_count?.toLocaleString()} potential unusual values detected.</p>
                      <small>These values will be preserved to avoid removing legitimate information.</small>
                    </div>
                    <span className="preserve-tag">Preserve values</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cleaning-no-issues">
                <CheckCircle2 size={19} /> No potential unusual values were detected.
              </div>
            )}

            <p className="cleaning-footnote">
              <Info size={14} />
              Unusual values are not always errors. They are preserved unless further review is needed.
            </p>
          </section>

          {preview.notes?.length > 0 && (
            <div className="cleaning-notes">
              <strong>Additional observations</strong>
              {preview.notes.map((note, index) => <p key={index}>{note}</p>)}
            </div>
          )}

          {!result && (
            <div className="cleaning-actions">
              <div>
                <strong>Your cleaning plan is ready.</strong>
                <p>The original uploaded dataset will remain unchanged.</p>
              </div>
              <button className="analyze-button" onClick={applyCleaning} disabled={applying}>
                {applying
                  ? "Preparing your dataset..."
                  : <>Run Automated Cleaning Pipeline <WandSparkles size={17} /></>}
              </button>
            </div>
          )}

          {result && (
            <div className="cleaning-section-card cleaning-result">
              <div className="cleaning-card-heading">
                <div>
                  <h3><CheckCircle2 size={19} /> Cleaning completed</h3>
                  <p>{result.message}</p>
                </div>
                <button className="download-button" onClick={download} disabled={downloading}>
                  <Download size={17} /> {downloading ? "Preparing..." : "Download CSV"}
                </button>
              </div>

              <div className="comparison-grid">
                <ComparisonStat label="Records before" value={result.original_rows} />
                <ComparisonStat label="Records after" value={result.cleaned_rows} />
                <ComparisonStat label="Duplicates removed" value={result.removed_duplicate_rows} />
                <ComparisonStat label="Missing cells before" value={result.before_missing_cells} />
                <ComparisonStat label="Missing cells after" value={result.after_missing_cells} />
              </div>

              <div className="quality-comparison">
                <div>
                  <span>Quality before</span>
                  <strong>{Number(result.before_quality_score).toFixed(2)}%</strong>
                </div>
                <ArrowRight size={20} />
                <div>
                  <span>Quality after</span>
                  <strong className="quality-improved">{Number(result.after_quality_score).toFixed(2)}%</strong>
                </div>
              </div>

              {result.actions?.length > 0 && (
                <div className="cleaning-action-report">
                  <h4>What INSIGHT changed</h4>
                  {result.actions.map((action, index) => (
                    <p key={index}><CheckCircle2 size={15} /> {action}</p>
                  ))}
                </div>
              )}

              <p className="cleaning-output-name">
                Your original file is preserved. Cleaned output: {result.output_filename}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function InsightChart({ data, type = "bar", xKey = "group", color = "#5987dc" }) {
  const entries = (data || []).slice(0, 15);
  return <ResponsiveContainer width="100%" height={207}>
    {type === "pie" ? <PieChart><Tooltip/><Pie data={entries} dataKey="value" nameKey={xKey} innerRadius={48} outerRadius={81} paddingAngle={2}>{entries.map((item,index)=><Cell key={`${item[xKey]}-${index}`} fill={[color,"#28aa8e","#dca348","#9478d8","#de7186","#5cbbc1"][index%6]}/>)}</Pie></PieChart>
    : type === "line" ? <LineChart data={entries}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey={xKey} tick={{fontSize:9}}/><YAxis tick={{fontSize:9}} width={38}/><Tooltip/><Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false}/></LineChart>
    : type === "area" ? <AreaChart data={entries}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey={xKey} tick={{fontSize:9}}/><YAxis tick={{fontSize:9}} width={38}/><Tooltip/><Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.14} strokeWidth={2.5}/></AreaChart>
    : <BarChart data={entries}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey={xKey} tick={{fontSize:9}}/><YAxis tick={{fontSize:9}} width={38}/><Tooltip/><Bar dataKey="value" fill={color} radius={[4,4,0,0]}/></BarChart>}
  </ResponsiveContainer>;
}

// Historical business findings: charts and verified aggregates.
// The day-to-day Analytics screen is deliberately compact and report-like.
// Power users can expand the existing advanced chart explorer without losing it.
function AnalyticsPage({ datasetId }) {
  const [snapshot,setSnapshot] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [advanced,setAdvanced] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {setSnapshot(await previewBusinessReport(datasetId,"auto"));}
    catch(e){setError(e.message || "Unable to analyse dataset.");}
    finally {setLoading(false);}
  },[datasetId]);
  useEffect(()=>{load();},[load]);
  return <section className="bi-admin-analytics">
    <div className="bi-admin-actions"><div><strong>Analytics Studio · business performance</strong><p>What happened, what the data shows, and why the findings matter.</p></div><div><button onClick={load} disabled={loading}>Refresh analysis</button><button onClick={()=>setAdvanced(v=>!v)}>{advanced ? "Hide advanced charts" : "Advanced chart explorer"}</button></div></div>
    {error && <p className="notice error-notice">{error}</p>}
    {loading ? <div className="bi-admin-loading">Calculating business KPIs and insights…</div> : snapshot && <BusinessAnalyticsSnapshot payload={snapshot}/>}
    {advanced && <div className="bi-advanced"><AdvancedAnalyticsPage datasetId={datasetId}/></div>}
  </section>;
}

function AdvancedAnalyticsPage({ datasetId }) {
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [trend, setTrend] = useState(null);
  const [correlations, setCorrelations] = useState(null);
  const [volumeBreakdown, setVolumeBreakdown] = useState(null);

  const [groupBy, setGroupBy] = useState("");
  const [metric, setMetric] = useState("");
  const [aggregation, setAggregation] = useState("sum");
  const [analysisSource, setAnalysisSource] = useState("original");
  const [breakdownChartType, setBreakdownChartType] = useState(() => localStorage.getItem("insight-breakdown-chart") || "bar");
  const [trendChartType, setTrendChartType] = useState(() => localStorage.getItem("insight-trend-chart") || "line");
  const [volumeChartType, setVolumeChartType] = useState(() => localStorage.getItem("insight-volume-chart") || "bar");

  const [dateColumn, setDateColumn] = useState("");
  const [trendMetric, setTrendMetric] = useState("");
  const [frequency, setFrequency] = useState("month");

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { localStorage.setItem("insight-breakdown-chart", breakdownChartType); }, [breakdownChartType]);
  useEffect(() => { localStorage.setItem("insight-trend-chart", trendChartType); }, [trendChartType]);
  useEffect(() => { localStorage.setItem("insight-volume-chart", volumeChartType); }, [volumeChartType]);

  const numericColumns = useMemo(
    () => overview?.numeric_summary?.map((item) => item.column) || [],
    [overview]
  );

  const categoricalColumns = useMemo(
    () => overview?.categorical_columns || [],
    [overview]
  );

  const dateColumns = useMemo(
    () => overview?.date_columns || [],
    [overview]
  );

  // Load overview manually or when the user refreshes.
  const loadOverview = useCallback(async () => {
    if (!datasetId) return;

    setLoading(true);
    setError("");
    setOverview(null);
    setBreakdown(null);
    setTrend(null);
    setCorrelations(null);
    setVolumeBreakdown(null);

    try {
      let selectedSource = "cleaned";
      let data;
      try { data = await getAnalyticsOverview(datasetId, "cleaned"); }
      catch { selectedSource = "original"; data = await getAnalyticsOverview(datasetId, "original"); }
      setAnalysisSource(selectedSource);
      setOverview(data);

      const firstCategory = data.categorical_columns?.[0] || "";
      const firstMetric = data.numeric_summary?.find((item) => item.column === "__insight_revenue__")?.column || data.numeric_summary?.find((item) => /revenue|sales/i.test(item.column))?.column || data.numeric_summary?.find((item) => !/id$/i.test(item.column))?.column || "";
      const firstDate = data.date_columns?.[0] || "";

      setGroupBy(firstCategory);
      setMetric(firstMetric);
      setDateColumn(firstDate);
      setTrendMetric(firstMetric);
    } catch (err) {
      setError(err.message || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [datasetId, analysisSource]);

  // Load category breakdown based on user selections.
  const loadBreakdown = useCallback(async (
    selectedGroup,
    selectedMetric,
    selectedAggregation
  ) => {
    if (!datasetId || !selectedGroup) return;

    setChartLoading(true);
    setError("");

    try {
      const data = await getAnalyticsBreakdown(
        datasetId,
        selectedGroup,
        selectedMetric || undefined,
        selectedAggregation,
        analysisSource
      );

      setBreakdown(data);
    } catch (err) {
      setError(err.message || "Could not load category breakdown.");
    } finally {
      setChartLoading(false);
    }
  }, [datasetId, analysisSource]);

  // Load time-based trend analysis.
  const loadTrend = useCallback(async (
    selectedDate,
    selectedMetric,
    selectedFrequency
  ) => {
    if (!datasetId || !selectedDate || !selectedMetric) return;

    setChartLoading(true);
    setError("");

    try {
      const data = await getAnalyticsTrend(
        datasetId,
        selectedDate,
        selectedMetric,
        selectedFrequency,
        analysisSource
      );

      setTrend(data);
    } catch (err) {
      setError(err.message || "Could not load trend analysis.");
    } finally {
      setChartLoading(false);
    }
  }, [datasetId, analysisSource]);


  // Initial overview loading.
  useEffect(() => {
    let cancelled = false;

    async function fetchOverview() {
      if (!datasetId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        let selectedSource = "cleaned";
        let data;
        try { data = await getAnalyticsOverview(datasetId, "cleaned"); }
        catch { selectedSource = "original"; data = await getAnalyticsOverview(datasetId, "original"); }
        if (cancelled) return;
        setAnalysisSource(selectedSource);
        setOverview(data);

        const firstCategory = data.categorical_columns?.[0] || "";
        const firstMetric = data.numeric_summary?.find((item) => item.column === "__insight_revenue__")?.column || data.numeric_summary?.find((item) => /revenue|sales/i.test(item.column))?.column || data.numeric_summary?.find((item) => !/id$/i.test(item.column))?.column || "";
        const firstDate = data.date_columns?.[0] || "";

        setGroupBy(firstCategory);
        setMetric(firstMetric);
        setDateColumn(firstDate);
        setTrendMetric(firstMetric);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load analytics.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  // Automatically load the initial charts after overview is available.
  useEffect(() => {
    if (!overview || !datasetId) return;

    let cancelled = false;

    async function fetchInitialCharts() {
      setChartLoading(true);

      const requests = [];

      if (categoricalColumns.length > 0) {
        requests.push(
          getAnalyticsBreakdown(
            datasetId,
            categoricalColumns[0],
            overview.numeric_summary?.find(x=>x.column==="__insight_revenue__")?.column || overview.numeric_summary?.find(x=>/revenue|sales|quantity/i.test(x.column))?.column || numericColumns[0] || undefined,
            "sum",
            analysisSource
          ).then((data) => ({
            type: "breakdown",
            data,
          }))
        );
      }

      if (categoricalColumns.length > 0) {
        requests.push(
          getAnalyticsBreakdown(datasetId, categoricalColumns[0], undefined, "count", analysisSource).then((data) => ({ type: "volume", data }))
        );
      }

      if (dateColumns.length > 0 && numericColumns.length > 0) {
        requests.push(
          getAnalyticsTrend(
            datasetId,
            dateColumns[0],
            overview.numeric_summary?.find(x=>x.column==="__insight_revenue__")?.column || overview.numeric_summary?.find(x=>/revenue|sales|quantity/i.test(x.column))?.column || numericColumns[0],
            "month",
            analysisSource
          ).then((data) => ({
            type: "trend",
            data,
          }))
        );
      }

      requests.push(
        getAnalyticsCorrelations(datasetId, analysisSource).then((data) => ({
          type: "correlations",
          data,
        }))
      );

      const results = await Promise.allSettled(requests);

      if (cancelled) return;

      results.forEach((result) => {
        if (result.status === "rejected") {
          setError(
            result.reason?.message ||
            "Some analytics could not be loaded."
          );
          return;
        }

        const { type, data } = result.value;

        if (type === "breakdown") setBreakdown(data);
        if (type === "trend") setTrend(data);
        if (type === "correlations") setCorrelations(data);
        if (type === "volume") setVolumeBreakdown(data);
      });

      setChartLoading(false);
    }

    fetchInitialCharts().catch((err) => {
      if (!cancelled) {
        setError(err.message || "Could not load analytics charts.");
        setChartLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    overview,
    datasetId,
    categoricalColumns,
    numericColumns,
    dateColumns,
    analysisSource,
  ]);

  const metrics = overview?.metrics || [];
  const numericSummary = overview?.numeric_summary || [];

  if (loading) {
    return (
      <div className="analytics-loading">
        <RefreshCw className="spin" size={25} />
        <h3>Analysing your dataset...</h3>
        <p>Calculating metrics, breakdowns and trends.</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <section className="analytics-page">
        <div className="analytics-error">
          <AlertTriangle size={22} />
          <p>{error || "Analytics could not be loaded."}</p>
          <button onClick={loadOverview}>Try again</button>
        </div>
      </section>
    );
  }

  return (
    <section className="analytics-page">
      <div className="welcome-section">
        <div>
          <div className="eyebrow">
            <BarChart3 size={14} /> DATA ANALYTICS
          </div>
          <h2>Discover what your data reveals.</h2>
          <p>
            Explore key metrics, compare categories, understand trends and
            inspect relationships between numerical variables.
          </p>
        </div>

        <button
          className="cleaning-refresh"
          onClick={loadOverview}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh analytics
        </button>
      </div>

      {error && <div className="notice error-notice">{error}</div>}

      <div className="analytics-source">
        <Database size={16} />
        <span>Analysis source: {analysisSource === "cleaned" ? "Approved cleaned dataset" : "Original uploaded dataset"}</span>
        <span>{overview.rows?.toLocaleString()} records</span>
      </div>

      <div className="analytics-stat-grid">
        <div className="analytics-stat">
          <span>Total records</span>
          <strong>{overview.rows?.toLocaleString() ?? "--"}</strong>
        </div>
        <div className="analytics-stat">
          <span>Total columns</span>
          <strong>{overview.columns ?? "--"}</strong>
        </div>
        <div className="analytics-stat">
          <span>Missing cells</span>
          <strong>{overview.missing_cells?.toLocaleString() ?? "--"}</strong>
        </div>
        <div className="analytics-stat">
          <span>Duplicate rows</span>
          <strong>{overview.duplicate_rows?.toLocaleString() ?? "--"}</strong>
        </div>
      </div>

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Key performance metrics</h3>
            <p>Numerical measurements calculated from your dataset.</p>
          </div>
        </div>

        {metrics.length > 0 ? (
          <div className="analytics-metric-grid">
            {metrics.map((item, index) => (
              <div
                className="analytics-metric-card"
                key={`${item.name}-${index}`}
              >
                <span>{item.name}</span>
                <strong>
                  {typeof item.value === "number"
                    ? item.value.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : item.value ?? "--"}
                </strong>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty">
            No additional metrics are available.
          </p>
        )}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Category breakdown</h3>
            <p>Compare numerical values across different categories.</p>
          </div>
        </div>

        {categoricalColumns.length > 0 ? (
          <>
            <div className="analytics-controls">
              <label>
                Group by
                <select
                  value={groupBy}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGroupBy(value);
                    loadBreakdown(value, metric, aggregation);
                  }}
                >
                  {categoricalColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Numerical metric
                <select
                  value={metric}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMetric(value);
                    loadBreakdown(groupBy, value, aggregation);
                  }}
                >
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Calculation
                <select
                  value={aggregation}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAggregation(value);
                    loadBreakdown(groupBy, metric, value);
                  }}
                >
                  <option value="sum">Total</option>
                  <option value="mean">Average</option>
                  <option value="count">Count</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                </select>
              </label>
            </div>

            <div className="chart-selector"><label>Chart type <select value={breakdownChartType} onChange={e=>setBreakdownChartType(e.target.value)}><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="pie">Donut</option></select></label></div>
            {breakdown?.results?.length > 0 ? (
              <>
              <div className="analytics-chart"><InsightChart data={breakdown.results} type={breakdownChartType}/></div>
              <details className="chart-insight-toggle"><summary><Info size={13}/> Explain this chart</summary><p>This chart compares {metric || "the selected metric"} across {groupBy || "the selected groups"}. {breakdown?.results?.length ? `The leading group is ${breakdown.results[0].group} with ${Number(breakdown.results[0].value).toLocaleString(undefined,{maximumFractionDigits:2})}.` : ""} These are historical totals; the chart cannot prove why a group performed better.</p></details>
              </>
            ) : (
              <p className="analytics-empty">
                {chartLoading
                  ? "Loading chart..."
                  : "No category results are available."}
              </p>
            )}
          </>
        ) : (
          <p className="analytics-empty">
            No categorical columns were detected for a category comparison.
          </p>
        )}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Trend analysis</h3>
            <p>Track a numerical metric over time.</p>
          </div>
        </div>

        {dateColumns.length > 0 && numericColumns.length > 0 ? (
          <>
            <div className="analytics-controls">
              <label>
                Date column
                <select
                  value={dateColumn}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDateColumn(value);
                    loadTrend(value, trendMetric, frequency);
                  }}
                >
                  {dateColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Metric
                <select
                  value={trendMetric}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTrendMetric(value);
                    loadTrend(dateColumn, value, frequency);
                  }}
                >
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Time interval
                <select
                  value={frequency}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFrequency(value);
                    loadTrend(dateColumn, trendMetric, value);
                  }}
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
            </div>

            <div className="chart-selector"><label>Chart type <select value={trendChartType} onChange={e=>setTrendChartType(e.target.value)}><option value="line">Line</option><option value="area">Area</option><option value="bar">Bar</option></select></label></div>
            {trend?.results?.length > 0 ? (
              <>
              <div className="analytics-chart"><InsightChart data={trend.results} type={trendChartType} xKey="period" color="#20a779"/></div>
              <details className="chart-insight-toggle"><summary><Info size={13}/> Explain this chart</summary><p>This chart displays {trendMetric || "the selected metric"} by {frequency}. {trend.results?.length>1 ? `The latest period (${trend.results.at(-1).period}) recorded ${Number(trend.results.at(-1).value).toLocaleString(undefined,{maximumFractionDigits:2})}, compared with ${Number(trend.results.at(-2).value).toLocaleString(undefined,{maximumFractionDigits:2})} in the previous period.` : ""} The cause of movement cannot be inferred from this chart alone.</p></details>
              </>
            ) : (
              <p className="analytics-empty">
                {chartLoading
                  ? "Loading trend..."
                  : "No trend results are available."}
              </p>
            )}
          </>
        ) : (
          <p className="analytics-empty">
            Trend analysis requires at least one date column and one numerical
            column.
          </p>
        )}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading"><div><h3>Record distribution</h3><p>Shows how many records belong to each detected category.</p></div></div>
        {volumeBreakdown?.results?.length ? <><div className="chart-selector"><label>Chart type <select value={volumeChartType} onChange={e=>setVolumeChartType(e.target.value)}><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="pie">Donut</option></select></label></div><div className="analytics-chart"><InsightChart data={volumeBreakdown.results.slice(0,10)} type={volumeChartType} color="#9478d8"/></div><details className="chart-insight-toggle"><summary><Info size={13}/> Explain this chart</summary><p>This chart counts records in each {volumeBreakdown.group_by} group. It shows distribution, not revenue contribution. Compare it with the revenue/category chart to distinguish sales volume from sales value.</p></details></> : <p className="analytics-empty">A categorical field is required for record distribution.</p>}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Correlation analysis</h3>
            <p>
              Explore relationships between numerical columns.
              Correlation does not prove causation.
            </p>
          </div>
        </div>

        {correlations?.strong_relationships?.length > 0 ? (
          <div className="correlation-list">
            {correlations.strong_relationships.map((item, index) => (
              <div
                className="correlation-item"
                key={`${item.column_1}-${item.column_2}-${index}`}
              >
                <div>
                  <strong>{item.column_1}</strong>
                  <span>and</span>
                  <strong>{item.column_2}</strong>
                </div>
                <span className="correlation-value">
                  {Number(item.correlation).toFixed(2)}
                </span>
                <small>{item.strength}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty">
            {correlations
              ? "No strong numerical relationships were detected."
              : "Correlation results are not available for this dataset."}
          </p>
        )}
      </section>

      {numericSummary.length > 0 && <section className="analytics-panel analytics-coverage-panel"><div className="analytics-panel-heading"><div><h3>Numerical field completeness</h3><p>Valid observations, not the measured values themselves.</p></div></div><div className="analytics-chart"><InsightChart data={numericSummary.slice(0,10).map(item=>({group:item.column,value:item.count}))} type="bar" color="#28aa8e"/></div><details className="chart-insight-toggle"><summary><Info size={13}/> Explain this chart</summary><p>Each bar counts non-missing numerical values for the named field. This compares coverage, not monetary values or sales performance; columns can have different units.</p></details></section>}

      {numericSummary.length > 0 && (
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Numerical summary</h3>
              <p>Descriptive statistics for numerical columns.</p>
            </div>
          </div>

          <div className="columns-table-wrapper">
            <table className="columns-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Count</th>
                  <th>Sum</th>
                  <th>Mean</th>
                  <th>Minimum</th>
                  <th>Maximum</th>
                  <th>Median</th>
                </tr>
              </thead>
              <tbody>
                {numericSummary.map((item) => (
                  <tr key={item.column}>
                    <td><strong>{item.column}</strong></td>
                    <td>{item.count?.toLocaleString()}</td>
                    <td>{formatAnalyticsNumber(item.sum)}</td>
                    <td>{formatAnalyticsNumber(item.mean)}</td>
                    <td>{formatAnalyticsNumber(item.minimum)}</td>
                    <td>{formatAnalyticsNumber(item.maximum)}</td>
                    <td>{formatAnalyticsNumber(item.median)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="analytics-panel analytics-story-panel">
        <div className="analytics-panel-heading"><div><span className="eyebrow">WHAT HAPPENED · WHY IT MATTERS</span><h3>Historical and current business findings</h3><p>A readable explanation assembled from verified statistics, not invented causes.</p></div></div>
        <div className="analytics-story-grid">
          <article><h4>What this dataset covers</h4><p>The selected {analysisSource} dataset contains <strong>{Number(overview.rows||0).toLocaleString()} rows</strong> and <strong>{overview.columns} source fields</strong>. It has {overview.missing_cells} missing cells and {overview.duplicate_rows} exact duplicate rows. Business outcomes depend on what the uploaded columns measure.</p></article>
          <article><h4>What happened across groups</h4><p>{breakdown?.results?.length ? `The largest observed ${groupBy} group by ${metric} is ${breakdown.results[0].group}, with ${Number(breakdown.results[0].value).toLocaleString(undefined,{maximumFractionDigits:2})} under the selected ${aggregation} calculation. A higher result does not necessarily mean higher profit or stronger future demand.` : "A supported categorical field and metric are required to establish a reliable group ranking."}</p></article>
          <article><h4>How performance changed</h4><p>{trend?.results?.length>1 ? `The last two available ${frequency} periods, ${trend.results.at(-2).period} and ${trend.results.at(-1).period}, recorded ${Number(trend.results.at(-2).value).toLocaleString(undefined,{maximumFractionDigits:2})} and ${Number(trend.results.at(-1).value).toLocaleString(undefined,{maximumFractionDigits:2})} in ${trendMetric}. This describes movement within the recorded history, not a forward prediction.` : "Without enough dated numerical observations, the system cannot calculate a recent historical change."}</p></article>
          <article><h4>Why did it happen?</h4><p>{correlations?.strong_relationships?.length ? `${correlations.strong_relationships.length} stronger numerical associations were detected, but associations alone cannot explain the underlying causes.` : "No strong verified numerical association was established."} Possible drivers such as pricing, promotions, store openings and stockouts need additional evidence. Compare groups and periods before making causal claims.</p></article>
        </div>
      </section>

      {overview.insights?.length > 0 && (
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Automated observations</h3>
              <p>Observations calculated from the dataset.</p>
            </div>
          </div>

          <div className="analytics-insights">
            {overview.insights.map((insight, index) => (
              <p key={index}>
                <CheckCircle2 size={16} /> {insight}
              </p>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

// Reusable display for real backend responses.
function ComingSoonPage() {
  const roadmap = [
    ["Seasonal and external-driver forecasting", "Add seasonal baselines, holidays, promotions, prices and other explanatory variables."],
    ["Advanced inventory optimisation", "Model supplier variability, service levels, MOQ, holding cost and stockout risk."],
    ["Product opportunity scoring", "Identify products to expand using revenue, margin, repeat purchases and market context."],
    ["Live business integrations", "Connect databases, POS platforms and spreadsheets for recurring analysis."],
    ["Scheduled intelligence reports", "Deliver automated weekly and monthly business summaries."],
  ];
  return <section className="coming-soon-page"><div className="welcome-section"><div><div className="eyebrow"><Clock3 size={14}/> PRODUCT ROADMAP</div><h2>What comes next.</h2><p>These are planned capabilities, not features currently available in this release.</p></div><span className="supported-label">FUTURE ROADMAP</span></div><div className="roadmap-grid">{roadmap.map(([title, description], i) => <article className="roadmap-card" key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{description}</p><small>Planned enhancement</small></article>)}</div></section>;
}

function ResultViewer({ title, data }) {
  if (data === null || data === undefined) return null;

  return (
    <section className="analytics-panel">
      <div className="analytics-panel-heading">
        <div>
          <h3>{title}</h3>
          <p>Results returned by the INSIGHT AI backend.</p>
        </div>
      </div>
      <pre className="result-json">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

// AI ASSISTANT



// Natural-language questions go to the four-agent FastAPI endpoint.
function AIAssistantPage({ datasetId }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const suggestions = [
    "What were the total sales and revenue in the latest month?",
    "Which products sold the most and the least?",
    "Which categories generated the highest revenue?",
    "Compare this month’s sales with the previous month.",
    "Which products or categories show declining sales?",
    "Based on past sales, what should the business focus on next month?",
    "What business opportunities and risks can you identify from this data?",
  ];

  async function sendQuestion(event) {
    event?.preventDefault();

    const text = question.trim();
    if (!text || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
    ]);
    setQuestion("");
    setError("");
    setLoading(true);

    try {
      const result = await askAnalyst(datasetId, text);

      const answer =
        result.answer ||
        result.response ||
        result.message ||
        result.result ||
        "The analyst returned no answer.";

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: String(answer).replace(/\r\n/g, "\n").trim(),
          raw: result,
        },
      ]);
    } catch (err) {
      setError(err.message || "The AI Analyst could not answer.");
    } finally {
      setLoading(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    setError("");
  }

  return (
    <section className="ai-workspace">
      <div className="ai-page-heading">
        <div>
          <div className="eyebrow">
            <BrainCircuit size={14} /> INTELLIGENT DATA ANALYSIS
          </div>
          <h2>Talk to your business data analyst.</h2>
          <p>
            Ask about sales, revenue, products, categories and historical performance. Get evidence-based explanations in plain language.
          </p>
        </div>
        <span className="ai-status">
          <i /> ANALYST READY
        </span>
      </div>

      <div className="ai-layout">
        <aside className="ai-context-panel">
          <div className="ai-context-header">
            <div className="ai-icon-box">
              <BrainCircuit size={22} />
            </div>
            <div>
              <strong>INSIGHT Analyst</strong>
              <span>Dataset intelligence</span>
            </div>
          </div>

          <div className="ai-context-block">
            <span className="ai-section-label">YOUR WORKSPACE</span>
            <div className="ai-context-item">
              <Database size={17} />
              <div>
                <strong>Active dataset</strong>
                <small>{datasetId}</small>
              </div>
            </div>
            <div className="ai-context-item">
              <ShieldCheck size={17} />
              <div>
                <strong>Evidence-based analysis</strong>
                <small>Uses available dataset results</small>
              </div>
            </div>
          </div>

          <div className="ai-context-block">
            <span className="ai-section-label">EXPLORE YOUR DATA</span>
            <div className="ai-suggestion-list">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuestion(item)}
                  disabled={loading}
                >
                  <span>{item}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </div>

          <div className="ai-context-note">
            <Sparkles size={17} />
            <div>
              <strong>Ask meaningful questions</strong>
              <p>
                Numerical results should come from the analytics engine.
                AI explains the findings in understandable language.
              </p>
            </div>
          </div>
        </aside>

        <section className="ai-chat-panel">
          <header className="ai-chat-header">
            <div>
              <strong>Data conversation</strong>
              <span>Ask questions about your uploaded dataset</span>
            </div>
            <button
              type="button"
              className="ai-clear-button"
              onClick={clearConversation}
              disabled={messages.length === 0 || loading}
            >
              <RefreshCw size={14} /> New conversation
            </button>
          </header>

          <div className="ai-chat-body">
            {messages.length === 0 ? (
              <div className="ai-empty-state">
                <div className="ai-empty-icon">
                  <Sparkles size={27} />
                </div>
                <h3>Let's discover what your data is telling us.</h3>
                <p>
                  Ask a question or select one of the suggested prompts
                  from the left panel.
                </p>
              </div>
            ) : (
              <div className="assistant-messages">
                {messages.map((message, index) => (
                  <article
                    key={index}
                    className={`assistant-message ${message.role}`}
                  >
                    <div className="ai-message-author">
                      <span className="ai-message-avatar">
                        {message.role === "user" ? "Y" : <Sparkles size={15} />}
                      </span>
                      <strong>
                        {message.role === "user" ? "You" : "INSIGHT AI"}
                      </strong>
                    </div>

                    {message.role === "assistant" ? (
                      <div className="analyst-answer">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                        {message.raw?.visualization?.data?.length > 0 && <div className="analyst-inline-chart"><div className="analytics-panel-heading"><div><h3>{message.raw.visualization.title}</h3><p>Chart calculated from your uploaded dataset</p></div></div><InsightChart data={message.raw.visualization.data} type={message.raw.visualization.type} xKey={message.raw.visualization.xKey}/><details className="chart-insight-toggle"><summary><Info size={13}/> Explain chart</summary><p>These values are computed from the uploaded dataset. Comparisons do not prove the causes of performance differences.</p></details></div>}
                        {message.raw?.execution_trace?.length > 0 && (
                          <details className="analyst-trace">
                            <summary>Execution trace · {message.raw.execution_trace.length} steps · {message.raw.total_elapsed_seconds}s</summary>
                            <ol>
                              {message.raw.execution_trace.map((step) => (
                                <li key={`${step.step}-${step.node}`}>
                                  <strong>{step.agent || `Step ${step.step}`} · {step.agent_name || String(step.node).replaceAll("_", " ")}</strong>
                                  <span>{step.status} · {step.elapsed_seconds}s</span>
                                  <small>{step.purpose || "Workflow execution"}</small>
                                  <small>{step.detail?.analytics_executed ? "Analytics result available" : "No analytics result"} · {step.detail?.rag_sources || 0} RAG sources · {step.detail?.error_count || 0} errors</small>
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </div>
                    ) : (
                      <p className="ai-user-text">{message.content}</p>
                    )}
                  </article>
                ))}
              </div>
            )}

            {loading && (
              <div className="ai-thinking">
                <span className="ai-thinking-dots">
                  <i /><i /><i />
                </span>
                INSIGHT is analysing your question...
              </div>
            )}

            {error && (
              <div className="notice error-notice">{error}</div>
            )}
          </div>

          <form className="ai-composer" onSubmit={sendQuestion}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendQuestion(event);
                }
              }}
              placeholder="Ask anything about your dataset..."
              rows={3}
              disabled={loading}
            />
            <div className="ai-composer-footer">
              <span>Enter to send · Shift + Enter for a new line</span>
              <button
                type="submit"
                className="analyze-button"
                disabled={!question.trim() || loading}
              >
                Send question <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}



function LightbulbIcon() {
  return <Sparkles size={17} />;
}


function AnalystAnswer({ content }) {
  const lines = String(content).split("\n");

  const tableRows = [];
  const otherLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        tableRows.push(cells);
      }
    } else {
      otherLines.push(line);
    }
  }

  const headers = tableRows[0] || [];
  const rows = tableRows.slice(1);

  const numericColumn = headers.findIndex((header) =>
    /quantity|total|value|revenue|count|amount|sum|average/i.test(header)
  );

  const chartData = rows
    .map((row) => ({
      name: row[0],
      value: Number(
        String(row[numericColumn] ?? "")
          .replace(/,/g, "")
          .replace(/\*\*/g, "")
          .replace(/₹|\$/g, "")
          .trim()
      ),
    }))
    .filter(
      (item) =>
        item.name &&
        numericColumn >= 0 &&
        Number.isFinite(item.value)
    );

  const answerText = otherLines.join("\n").trim()
    .split(/\n{2,}/)
    .map(block => block.split("\n").reduce((acc, line) => {
      const item = line.trim();
      if (!item) return acc;
      if (/^(#{1,4}\s|[-*]\s|\d+\.\s)/.test(item)) return `${acc}\n${item}`;
      return acc && !acc.endsWith("\n") ? `${acc} ${item}` : `${acc}${item}`;
    }, "").trim())
    .join("\n\n");

  const sections = answerText.split(/\n(?=#{1,4}\s)/);

  function renderInline(text) {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }

      return part;
    });
  }

  return (
    <div className="ai-answer-content">

      {sections.map((section, index) => {
        const sectionLines = section
          .split("\n")
          .filter((line) => line.trim());

        if (!sectionLines.length) return null;

        const firstLine = sectionLines[0].trim();
        const hasHeading = /^#{1,4}\s/.test(firstLine);

        const heading = hasHeading
          ? firstLine.replace(/^#{1,4}\s*/, "")
          : "";

        const body = hasHeading
          ? sectionLines.slice(1)
          : sectionLines;

        return (
          <section
            className="ai-answer-section"
            key={index}
          >
            {hasHeading && <h4>{renderInline(heading)}</h4>}

            {body.map((line, lineIndex) => {
              const trimmed = line.trim();

              if (!trimmed) return null;

              if (/^[-*]\s+/.test(trimmed)) {
                return (
                  <p className="ai-answer-list-item" key={lineIndex}>
                    <span>•</span>
                    {renderInline(trimmed.replace(/^[-*]\s+/, ""))}
                  </p>
                );
              }

              if (/^\d+\.\s+/.test(trimmed)) {
                return (
                  <p className="ai-answer-list-item" key={lineIndex}>
                    {renderInline(trimmed)}
                  </p>
                );
              }

              return (
                <p key={lineIndex}>
                  {renderInline(trimmed)}
                </p>
              );
            })}
          </section>
        );
      })}

      {headers.length > 0 && rows.length > 0 && (
        <section className="ai-result-card">

          <div className="ai-result-card-heading">
            <div>
              <span>DATA BREAKDOWN</span>
              <h4>{headers[0]} comparison</h4>
            </div>

            <BarChart3 size={19} />
          </div>

          {chartData.length > 0 && (
            <div className="ai-result-chart">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 12, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#263449"
                  />

                  <XAxis
                    type="number"
                    stroke="#8491a7"
                    tick={{ fontSize: 10 }}
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={125}
                    stroke="#8491a7"
                    tick={{ fontSize: 10 }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="value"
                    fill="#5795f5"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="ai-result-table-wrap">
            <table className="ai-result-table">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th key={index}>
                      {header.replace(/\*\*/g, "")}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {headers.map((_, cellIndex) => (
                      <td key={cellIndex}>
                        {(row[cellIndex] || "").replace(/\*\*/g, "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>
      )}
    </div>
  );
}


// DECISION ENGINE
function DecisionPage({ datasetId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getDecisionReport(datasetId, "original");
      setReport(result);
    } catch (err) {
      setError(err.message || "Could not generate the decision report.");
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <section className="analytics-page">
      <div className="welcome-section">
        <div>
          <div className="eyebrow"><Activity size={14} /> DECISION INTELLIGENCE</div>
          <h2>Turn findings into decisions.</h2>
          <p>
            Generate a report containing data-driven findings,
            recommendations and potential risks.
          </p>
        </div>
        <button className="cleaning-refresh" onClick={loadReport} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          Regenerate
        </button>
      </div>

      {error && <div className="notice error-notice">{error}</div>}

      {loading && !report && (
        <div className="analytics-loading">
          <RefreshCw className="spin" size={25} />
          <h3>Preparing decision report...</h3>
          <p>Analysing findings and generating recommendations.</p>
        </div>
      )}

      {report && (
        <ResultViewer title="Decision intelligence report" data={report} />
      )}
    </section>
  );
}

// PREDICTIVE INTELLIGENCE
// Train and inspect evaluated supervised models.
function PredictivePage({ datasetId, profile }) {
  const columns = profile.column_profiles || [];
  const [target, setTarget] = useState("");
  const [task, setTask] = useState("regression");
  const [training, setTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState(null);
  const [recordsText, setRecordsText] = useState('[\n  {}\n]');
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");

  async function handleTrain(event) {
    event.preventDefault();

    if (!target) {
      setError("Select a target column before training.");
      return;
    }

    setTraining(true);
    setError("");
    setTrainingResult(null);
    setPrediction(null);

    try {
      const result = await trainPredictiveModel(
        datasetId,
        target,
        task,
        "original"
      );
      setTrainingResult(result);
    } catch (err) {
      setError(err.message || "Model training failed.");
    } finally {
      setTraining(false);
    }
  }

  async function handlePredict(event) {
    event.preventDefault();

    let records;

    try {
      records = JSON.parse(recordsText);
    } catch {
      setError("Prediction input must be valid JSON.");
      return;
    }

    if (!Array.isArray(records) || records.length === 0) {
      setError("Enter a non-empty JSON array of records.");
      return;
    }

    setPredicting(true);
    setError("");
    setPrediction(null);

    try {
      const result = await predictWithSavedModel(datasetId, records);
      setPrediction(result);
    } catch (err) {
      setError(err.message || "Prediction failed.");
    } finally {
      setPredicting(false);
    }
  }

  return (
    <section className="analytics-page">
      <div className="welcome-section">
        <div>
          <div className="eyebrow"><Target size={14} /> PREDICTIVE INTELLIGENCE</div>
          <h2>Explore what could happen next.</h2>
          <p>
            Train a machine learning pipeline on your dataset, evaluate it,
            and use the saved model to make predictions.
          </p>
        </div>
      </div>

      {error && <div className="notice error-notice">{error}</div>}

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Train a machine learning model</h3>
            <p>Choose a target column and prediction task.</p>
          </div>
        </div>

        <form className="analytics-controls predictive-form" onSubmit={handleTrain}>
          <label>
            Target column
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              required
            >
              <option value="">Select target</option>
              {columns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Prediction task
            <select
              value={task}
              onChange={(event) => setTask(event.target.value)}
            >
              <option value="regression">Regression</option>
              <option value="classification">Classification</option>
            </select>
          </label>

          <button className="analyze-button" type="submit" disabled={training || !target}>
            {training ? "Training model..." : <>Train model <ArrowRight size={17} /></>}
          </button>
        </form>

        {columns.length === 0 && (
          <p className="analytics-empty">
            No column profile is available. Check that your dataset profile contains column data types.
          </p>
        )}
      </section>

      {trainingResult && (
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><h3>Model evaluation</h3><p>{trainingResult.model_name} · {trainingResult.task} · {trainingResult.training_rows} training rows / {trainingResult.testing_rows} holdout rows</p></div></div>
          <div className="analytics-metric-grid">
            {Object.entries(trainingResult.metrics || {}).map(([name, value]) => <div className="analytics-metric-card" key={name}><span>{name.replaceAll("_", " ")}</span><strong>{value ?? "N/A"}</strong></div>)}
          </div>
          <div className="comparison-grid">
            <div className="comparison-stat"><span>Selected model</span><strong>{trainingResult.model_name}</strong></div>
            <div className="comparison-stat"><span>Cross-validation</span><strong>{trainingResult.cv_folds} folds</strong></div>
            <div className="comparison-stat"><span>Beats simple baseline?</span><strong>{trainingResult.beats_baseline ? "Yes" : "No"}</strong></div>
          </div>
          <h4>Holdout baseline comparison</h4>
          <div className="result-json">{JSON.stringify({ model: trainingResult.metrics, baseline: trainingResult.baseline_metrics }, null, 2)}</div>
          <h4>Candidate model comparison (cross-validation)</h4>
          <div className="result-json">{JSON.stringify(trainingResult.model_comparison, null, 2)}</div>
          <p className="chart-interpretation">The holdout metrics are measured on records not used for fitting. Compare against the baseline before trusting a model. Performance on this uploaded dataset does not guarantee future performance.</p>
        </section>
      )}

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Make predictions</h3>
            <p>
              This uses the saved model from the most recent successful training.
              Enter an array of feature records as JSON.
            </p>
          </div>
        </div>

        <form onSubmit={handlePredict}>
          <label className="predictive-json-label">
            Prediction records
            <textarea
              className="predictive-json-input"
              rows={8}
              value={recordsText}
              onChange={(event) => setRecordsText(event.target.value)}
              spellCheck={false}
            />
          </label>

          <button className="analyze-button" type="submit" disabled={predicting}>
            {predicting ? "Generating predictions..." : <>Predict <Target size={17} /></>}
          </button>
        </form>

        {prediction && (
          <ResultViewer title="Prediction results" data={prediction} />
        )}
      </section>
    </section>
  );
}

// FORECASTING & INVENTORY INTELLIGENCE
function SegmentForecastGallery({ results = {} }) {
  const available = Object.entries(results).filter(([, item]) => item?.segments?.length);
  if (!available.length) return null;
  const format = value => Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
  return <section className="analytics-panel segment-forecast-section">
    <div className="analytics-panel-heading"><div><h3>Business measure by product, category and region</h3><p>Each chart estimates the displayed measurement (for example, units sold or revenue) per month. It is not stock on hand. Groups are forecast independently when they have enough history; identical values may indicate a flat-baseline model.</p></div></div>
    {available.map(([role, response]) => <div className="segment-role" key={role}>
      <h4>{role[0].toUpperCase()+role.slice(1)} outlook <small>· {response.value_column} · by {response.group_column}</small></h4>
      <div className="segment-forecast-grid">{response.segments.slice(0,5).map(item => {
        const values = item.forecast.forecasts || [];
        const first = values[0]?.forecast;
        const last = values.at(-1)?.forecast;
        const change = Number(first) > 0 ? ((Number(last)-Number(first))/Number(first))*100 : null;
        const error = item.forecast.backtest_metrics?.[item.forecast.selected_method]?.wape_percent;
        return <article className="segment-forecast-card" key={item.group}>
          <div className="segment-card-head"><strong title={item.group}>{item.group}</strong><span>{role}</span></div>
          <div className="segment-forecast-bars"><ResponsiveContainer width="100%" height={112}><BarChart data={values} margin={{top:4,right:4,left:0,bottom:0}}><XAxis dataKey="period" hide/><YAxis hide/><Tooltip formatter={format} labelFormatter={label=>String(label).slice(0,7)}/><Bar dataKey="forecast" fill="#5987dc" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          <div className="segment-values">{values.map(row=><div key={row.period}><span>{String(row.period).slice(0,7)}</span><b>{format(row.forecast)}</b></div>)}</div>
          <p>{change == null ? "Trend comparison unavailable" : `Across the forecast horizon: ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}. Backtest WAPE: {error ?? "N/A"}%.</p>
          <details className="chart-insight-toggle"><summary><Info size={13}/> Explain prediction</summary><p>Monthly estimated totals of {response.value_column} for {item.group}, using {item.forecast.selected_method?.replaceAll("_"," ")}. The model uses this group's own historical records; it cannot establish why a change will occur, and sales volume is not the same as physical inventory.</p></details>
        </article>;
      })}</div>
      {response.unavailable?.length>0 && <p className="segment-unavailable">{response.unavailable.length} segment(s) could not be forecast from the available history; no values were invented.</p>}
    </div>)}
  </section>;
}

// Show future monthly estimates and segment forecasts when enough history exists.
function ForecastPage({ datasetId, profile }) {
  const [overview,setOverview] = useState(null);
  const [forecastResults,setForecastResults] = useState([]);
  const [segmentForecasts,setSegmentForecasts] = useState({});
  const [model,setModel] = useState(null);
  const [modelLoading,setModelLoading] = useState(false);
  const [decisionReport,setDecisionReport] = useState(null);
  const [loading,setLoading] = useState(true);
  const [messages,setMessages] = useState([]);
  const [manualTarget,setManualTarget] = useState(() => localStorage.getItem(`insight-target-${datasetId}`) || "");
  const fmt = v => Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true); setModelLoading(false); setMessages([]); setModel(null);
      setForecastResults([]); setSegmentForecasts({}); setDecisionReport(null);
      try {
        let source = "cleaned"; let data;
        try { data = await getAnalyticsOverview(datasetId,"cleaned"); }
        catch { source = "original"; data = await getAnalyticsOverview(datasetId,"original"); }
        if (!alive) return;
        setOverview(data);
        getDecisionReport(datasetId,source).then(d=>{if(alive)setDecisionReport(d);}).catch(()=>{});
        const cols = data.numeric_summary || [];
        const dates = data.date_columns || [];
        const date = dates[0];
        const candidates = cols.filter(x=>/revenue|sales_amount|total_sales|quantity|qty|units_sold|profit|demand/i.test(x.column) && !/id$|inventory|stock_level|unit_price|price_per/i.test(x.column))
          .sort((a,b) => {
            const rank = x => /quantity|qty|units_sold|demand/i.test(x) ? 0 : /revenue|sales_amount|total_sales/i.test(x) ? 1 : /profit/i.test(x) ? 2 : 3;
            return rank(a.column)-rank(b.column);
          });
        const requested = cols.find(x=>x.column === manualTarget);
        const selected = [...new Map([...(requested ? [requested] : []), ...candidates].map(x=>[x.column,x])).values()].slice(0,3);
        if (!date) setMessages(["No supported date field was found. Monthly future forecasting is unavailable for this file."]);
        else if (!selected.length) setMessages(["No suitable numeric business outcome is available. Select a numerical target in Data Sources."]);
        else {
          const results = await Promise.all(selected.map(async col => {
            try { return {column:col.column,result:await createForecast(datasetId,{source,date_column:date,value_column:col.column,horizon:3,frequency:"MS"}),error:null}; }
            catch(e) { return {column:col.column,result:null,error:e.message}; }
          }));
          if (!alive) return;
          setForecastResults(results);
          setMessages(results.filter(item=>item.error).map(item=>`${item.column}: ${item.error}`));
        }
        // First paint can happen now; heavier segment/model analysis remains asynchronous.
        if (alive) setLoading(false);
        const target = selected.find(x=>/quantity|qty|units_sold|demand/i.test(x.column)) || requested || selected[0];
        if (date && target) {
          const segmentRoles = ["product","location","category"];
          const semantics = profile.column_profiles || [];
          const requests = segmentRoles.map(async role => {
            const group = semantics.find(col => String(col.semantic_type||"").toLowerCase() === role && col.name !== target.column);
            if (!group) return null;
            const result = await getForecastSegments(datasetId, {source,date_column:date,value_column:target.column,group_column:group.name,horizon:3,limit:5});
            return [role,result];
          });
          Promise.allSettled(requests).then(outcomes => {
            if (!alive) return;
            setSegmentForecasts(Object.fromEntries(outcomes.filter(x=>x.status==="fulfilled" && x.value).map(x=>x.value)));
          });
          setModelLoading(true);
          trainPredictiveModel(datasetId,target.column,"auto",source)
            .then(trained=>{if(alive)setModel({target:target.column,result:trained});})
            .catch(e=>{if(alive)setMessages(prev=>[...prev,`Automatic ML evaluation for ${target.column}: ${e.message}`]);})
            .finally(()=>{if(alive)setModelLoading(false);});
        }
      } catch(e) { if (alive) setMessages([e.message||"Automatic analysis could not be completed."]); }
      finally { if(alive) setLoading(false); }
    }
    run();
    return () => {alive=false;};
  }, [datasetId, manualTarget]);
  return <section className="analytics-page auto-forecast-page">
    <div className="welcome-section"><div><div className="eyebrow"><TrendingUp size={14}/> PREDICTIVE & FORECAST INTELLIGENCE</div><h2>What is likely to happen next?</h2><p>Automatic monthly outlook, evaluated models and evidence-based planning. Forecasts need at least 10 historical periods. Each amount is a calendar-month total, not a stock count; estimates are not guaranteed.</p></div><label className="forecast-target-select">Prediction target<select value={manualTarget} onChange={e=>{setManualTarget(e.target.value);if(e.target.value)localStorage.setItem(`insight-target-${datasetId}`,e.target.value);else localStorage.removeItem(`insight-target-${datasetId}`);}}><option value="">Automatic</option>{profile.column_profiles?.filter(x=>String(x.data_type||"").toLowerCase()==="numeric" && !/id$|code/i.test(x.name)).map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label></div>
    {loading && <div className="analytics-loading"><RefreshCw className="spin" size={22}/><h3>Analysing forecast opportunities</h3><p>Validating dates, measures and historical periods.</p></div>}
    {!loading && <>
      <section className="analytics-panel forecast-main-panel"><div className="analytics-panel-heading"><div><h3>Future outlook · next three months</h3><p>Estimated monthly values from a chronological backtest. Empty forecasts mean insufficient or unsuitable observations.</p></div></div>
        {forecastResults.length ? <div className="auto-forecast-grid">{forecastResults.map(item=><article className="auto-forecast-card" key={item.column}><div className="eyebrow">FORECAST MEASURE</div><h4>{item.column === "__insight_revenue__" ? "Estimated monthly revenue (price × quantity)" : /quantity|qty|units_sold|demand/i.test(item.column) ? `Total monthly units sold · ${item.column}` : /profit/i.test(item.column) ? `Monthly profit · ${item.column}` : /revenue|sales_amount/i.test(item.column) ? `Monthly revenue · ${item.column}` : `Monthly total · ${item.column}`}</h4>{item.result ? <><div className="auto-forecast-values">{item.result.forecasts.map(f=><div key={f.period}><span>{new Date(f.period).toLocaleDateString(undefined,{month:"short",year:"numeric"})}</span><strong>{fmt(f.forecast)}</strong></div>)}</div><div className="forecast-mini-chart"><ResponsiveContainer width="100%" height={125}><AreaChart data={item.result.forecasts}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="period" tickFormatter={x=>String(x).slice(0,7)} tick={{fontSize:9}}/><YAxis hide/><Tooltip formatter={fmt}/><Area type="monotone" dataKey="forecast" stroke="#20a779" fill="#20a779" fillOpacity={0.13} strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div><p>Monthly total of <strong>{item.column}</strong> across all records. Method: {item.result.selected_method.replaceAll("_"," ")} · {item.result.observed_periods} observed periods · Backtest WAPE: {item.result.backtest_metrics?.[item.result.selected_method]?.wape_percent ?? "N/A"}%</p><details className="chart-insight-toggle"><summary><Info size={13}/> Business interpretation</summary><p>Forecast values are monthly totals for the measured column, not item counts unless the selected column is actual sold quantity. A flat forecast means the chosen baseline predicts a similar level, not guaranteed constant sales. Expected {item.column} moves from {fmt(item.result.forecasts[0]?.forecast)} to {fmt(item.result.forecasts.at(-1)?.forecast)} over the projected periods. Treat this as a planning range, not a guaranteed outcome. {item.result.limitations?.join(" ")}</p></details></> : <div className="notice error-notice">{item.error}</div>}</article>)}</div> : <p className="analytics-empty">No forecast could be generated from the available fields.</p>}
      </section>
      <SegmentForecastGallery results={segmentForecasts}/>
      <section className="analytics-panel forecast-model-panel"><div className="analytics-panel-heading"><div><h3>Automatic predictive model evaluation</h3><p>Regression/classification evaluation on historical records. This is distinct from the chronological monthly forecast.</p></div></div>
        {model ? <><div className="auto-model-summary"><div><span>Selected target</span><strong>{model.target}</strong></div><div><span>Task</span><strong>{model.result.task}</strong></div><div><span>Selected model</span><strong>{model.result.model_name}</strong></div><div><span>Baseline comparison</span><strong>{model.result.beats_baseline?"Beats baseline":"Does not beat baseline"}</strong></div></div><div className="analytics-metric-grid">{Object.entries(model.result.metrics||{}).map(([k,v])=><div className="analytics-metric-card" key={k}><span>{k.replaceAll("_"," ")}</span><strong>{v??"N/A"}</strong></div>)}</div><p className="chart-interpretation">Target selection is a business heuristic, not proof that this outcome can be predicted accurately. Inspect validation metrics and baseline performance.</p></> : modelLoading ? <p className="analytics-empty"><RefreshCw size={14} className="spin"/> Optional predictive model evaluation is still running. Forecasts above are already available; you can continue using the report while training completes.</p> : <p className="analytics-empty">No predictive model was evaluated for these fields, or a limitation is recorded below.</p>}
      </section>
      {decisionReport && <section className="analytics-panel forecast-decision-panel"><div className="analytics-panel-heading"><div><h3>Decision support · what should we do?</h3><p>Actions are drawn from observed data. Validate costs, inventory and supplier constraints before implementation.</p></div></div>{decisionReport.executive_summary && <div className="forecast-executive-summary"><span>EXECUTIVE SUMMARY</span><p>{decisionReport.executive_summary}</p></div>}<div className="forecast-guidance-grid"><article><h4>Recommended actions</h4>{decisionReport.recommendations?.length ? <ol>{decisionReport.recommendations.map((item,index)=><li key={index}>{typeof item==="string" ? item : item.description || JSON.stringify(item)}</li>)}</ol> : <p>Specific action is not supported by the current data.</p>}</article><article><h4>Risks and cautions</h4>{decisionReport.risks?.length ? <ul>{decisionReport.risks.map((item,index)=><li key={index}>{typeof item==="string" ? item : item.description || JSON.stringify(item)}</li>)}</ul> : <p>Review stock, margin, seasonal promotions, uncertainty and supplier constraints before taking action.</p>}</article></div></section>}
      {messages.length>0 && <section className="analytics-panel forecast-limits-panel"><h3>Forecast availability and limitations</h3>{messages.map((m,i)=><p className="notice" key={i}>{m}</p>)}</section>}
      <section className="analytics-panel forecast-limits-panel"><h3>Forecast safeguards</h3><p className="chart-interpretation">Do not automatically order the forecast demand as stock. First subtract verified on-hand inventory and incoming orders, check lead times and service levels, then account for forecast error. The system has not measured external market conditions or proven any root cause.</p></section>
    </>}
  </section>;
}

// REPORTS

// Four business report pages and admin-only publication.
// Admin preview and viewer report use the SAME component and backend snapshot format.
// Publishing saves a frozen copy; viewers never read the admin's live dataset.
function ReportsPage({ datasetId, profile }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(null);
  const load = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true); setError("");
    try { setSnapshot(await previewBusinessReport(datasetId, "auto")); }
    catch (err) { setError(err.message || "Unable to prepare business report."); }
    finally { setLoading(false); }
  }, [datasetId]);
  useEffect(() => { load(); }, [load]);
  const title = `${profile?.filename || "Business"} · Intelligence Report`;
  async function publish() {
    setPublishing(true); setError("");
    try {
      // Publish from precisely the same approved source used for the admin preview.
      const result = await publishReport(datasetId, title, snapshot?.source || "original");
      setPublished(result);
    } catch(err) {setError(err.message || "Unable to publish report.");}
    finally {setPublishing(false);}
  }
  return <section className="bi-admin-wrap">
    <div className="bi-admin-actions"><div><strong>Business intelligence report</strong><p>The admin preview and the viewer's published report share the same four-page layout. Refresh after cleaning or changes.</p></div><div><button onClick={load} disabled={loading}>Refresh preview</button><button className="bi-publish" onClick={publish} disabled={!snapshot || loading || publishing}>{publishing ? "Publishing…" : "Publish report"}</button></div></div>
    {error && <p role="alert" className="notice error-notice">{error}</p>}
    {published && <div className="bi-published"><strong>Published report access code: {published.access_code}</strong><p>Share this one-time code privately with your viewer. A viewer must also create an account to redeem it.</p><button onClick={()=>navigator.clipboard?.writeText(published.access_code)}>Copy code</button></div>}
    {loading ? <div className="bi-admin-loading">Preparing report from the active dataset…</div> : snapshot ? <BusinessReport payload={snapshot} title={title}/> : <p>Report unavailable. Try Refresh preview.</p>}
  </section>;
}

function formatAnalyticsNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "--";
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
function Stat({ label, value, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><Icon size={19} /></div>
      <strong>{value ?? "--"}</strong>
      <p>From your uploaded dataset</p>
    </div>
  );
}

function CleaningStat({ label, value, icon: Icon }) {
  return (
    <div className="stat-card cleaning-stat-card">
      <div className="stat-top"><span>{label}</span><Icon size={19} /></div>
      <strong>{value ?? "--"}</strong>
      <p>Detected in original dataset</p>
    </div>
  );
}

function ComparisonStat({ label, value }) {
  return (
    <div className="comparison-stat">
      <span>{label}</span>
      <strong>{Number(value ?? 0).toLocaleString()}</strong>
    </div>
  );
}

function CopyIcon(props) {
  return <FileSpreadsheet {...props} />;
}

export default App;