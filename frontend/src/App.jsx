import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, BrainCircuit, CheckCircle2,
  ChevronRight, Database, FileText, LayoutDashboard, Menu,
  ShieldCheck, Sparkles, Target, Upload, X, FileSpreadsheet,
  Download, RefreshCw, Trash2, AlertTriangle, WandSparkles,
  Eye, Columns3, Info, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  CalendarDays, TrendingUp, ShoppingBag, Package, Clock3,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
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
  getDecisionReport,
  getDatasetRows,
} from "./services/api";
import "./App.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Data Explorer", icon: Database },
  { label: "Data Pipeline", icon: Sparkles },
  { label: "Analytics Studio", icon: BarChart3 },
  { label: "AI Business Analyst", icon: BrainCircuit },
  { label: "Reports", icon: FileText },
  { label: "Coming Soon", icon: Clock3 },
];

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

  const [cleaningPreview, setCleaningPreview] = useState(null);
  const [cleaningResult, setCleaningResult] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applyingCleaning, setApplyingCleaning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cleaningError, setCleaningError] = useState("");
  const [cleaningSuccess, setCleaningSuccess] = useState("");

  function selectFile(selected) {
    if (!selected) return;

    const extension = selected.name.split(".").pop().toLowerCase();

    if (!["csv", "xlsx", "xlsm"].includes(extension)) {
      setError("Unsupported file. Please choose CSV, XLSX or XLSM.");
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
      setSuccess("Your dataset has been uploaded and analysed.");
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
        remove_duplicates: true,
        outlier_strategies: outlierStrategies,
      });

      setCleaningResult(result);
      setCleaningSuccess("Recommended cleaning has been applied successfully.");
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
              accept=".csv,.xlsx,.xlsm"
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
    <div className="app-shell">
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

                  if (item.label === "Data Pipeline" && !cleaningPreview && !loadingPreview) {
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
            <div className="breadcrumb">Workspace <span>/</span> <strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="system-status"><i className="online-dot" /> Dataset loaded</div>
            <div className="user-avatar">S</div>
          </div>
        </header>

        <div className="page-content">
          {activePage === "Overview" ? (
            <OverviewPage
              profile={profile}
              datasetId={datasetId}
              resetWorkspace={resetWorkspace}
              openPage={setActivePage}
            />
          ) : activePage === "Data Explorer" ? (
            <DataUnderstandingPage profile={profile} datasetId={datasetId} />
          ) : activePage === "Data Pipeline" ? (
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
              ) : activePage === "Analytics Studio" ? (
                <AnalyticsPage datasetId={datasetId} />
              ) : activePage === "AI Business Analyst" ? (
                <AIAssistantPage datasetId={datasetId} />
              ) : activePage === "Coming Soon" ? (
                <ComingSoonPage />
              ) : activePage === "Reports" ? (
                <ReportsPage datasetId={datasetId} profile={profile} />
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

function OverviewPage({ profile, datasetId, resetWorkspace, openPage }) {
  const columnCount = profile.columns ?? profile.column_profiles?.length ?? 0;

  return (
    <>
      <section className="welcome-section">
        <div>
          <div className="eyebrow"><Sparkles size={14} /> DATA INTELLIGENCE WORKSPACE</div>
          <h2>Your data, understood.</h2>
          <p>Here is a quick overview of your uploaded dataset and its current condition.</p>
        </div>
        <span className="supported-label">{profile.file_type?.toUpperCase()} DATASET</span>
      </section>

      <div className="dataset-banner">
        <div className="dataset-banner-icon"><FileSpreadsheet size={22} /></div>
        <div>
          <span>ACTIVE DATASET</span>
          <strong>{profile.filename}</strong>
          <small>{profile.detected_domain} · {datasetId}</small>
        </div>
        <button onClick={resetWorkspace}>Change dataset</button>
      </div>

      <section className="stats-grid">
        <Stat label="Total records" value={profile.rows?.toLocaleString()} icon={Database} />
        <Stat label="Columns" value={columnCount.toLocaleString()} icon={BarChart3} />
        <Stat label="Data quality" value={`${profile.quality_score}%`} icon={ShieldCheck} />
        <Stat label="Missing cells" value={profile.missing_cells?.toLocaleString()} icon={AlertTriangle} />
      </section>

      <BusinessOverviewPanel datasetId={datasetId} profile={profile} />

      <section className="overview-panel">
        <div className="section-heading">
          <div>
            <h3>Dataset health</h3>
            <p>A quick view of the quality of your uploaded data.</p>
          </div>
          <span className="supported-label">{profile.domain_confidence} confidence</span>
        </div>

        <div className="quality-panel">
          <div className="quality-heading">
            <strong>Overall data quality</strong>
            <strong>{profile.quality_score}%</strong>
          </div>
          <div className="quality-track">
            <div
              className="quality-fill"
              style={{ width: `${Math.min(100, Math.max(0, profile.quality_score || 0))}%` }}
            />
          </div>
          <p>
            {profile.missing_cells} missing cells across {profile.rows} records.
            {" "}{profile.duplicate_rows} duplicate records detected.
          </p>
        </div>

        <div className="overview-summary-grid">
          <div>
            <Database size={21} />
            <span>Detected data domain</span>
            <strong>{profile.detected_domain || "Not identified"}</strong>
          </div>
          <div>
            <FileSpreadsheet size={21} />
            <span>File format</span>
            <strong>{profile.file_type || "Unknown"}</strong>
          </div>
          <div>
            <Columns3 size={21} />
            <span>Dataset size</span>
            <strong>{columnCount} columns</strong>
          </div>
        </div>
      </section>

      <section className="overview-next-steps">
        <div>
          <div className="eyebrow"><Sparkles size={14} /> YOUR NEXT STEPS</div>
          <h3>Explore your dataset</h3>
          <p>Start by understanding the data, then improve its quality before analysis.</p>
        </div>
        <div className="overview-actions">
          <button onClick={() => openPage("Data Explorer")}>
            <Eye size={17} /> Explore data <ArrowRight size={16} />
          </button>
          <button onClick={() => openPage("Data Pipeline")}>
            <WandSparkles size={17} /> Prepare data <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {profile.warnings?.length > 0 && (
        <section className="profile-warnings">
          <strong><Info size={16} /> Important observations</strong>
          {profile.warnings.slice(0, 4).map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </section>
      )}
    </>
  );
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

function DataUnderstandingPage({ profile, datasetId }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowError, setRowError] = useState("");
  const [reloadRows, setReloadRows] = useState(0);
  const columns = profile.column_profiles || [];

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
      <section className="profile-section"><div className="section-heading"><div><h3>Column dictionary</h3><p>Detected data types and business meanings.</p></div></div><div className="columns-table-wrapper"><table className="columns-table"><thead><tr><th>Column</th><th>Data type</th><th>Business meaning</th><th>Missing</th><th>Unique</th></tr></thead><tbody>{columns.map((column) => <tr key={column.name}><td><strong>{column.name}</strong></td><td>{column.data_type}</td><td><span className="semantic-tag">{column.semantic_type}</span></td><td>{column.missing_count?.toLocaleString()}</td><td>{column.unique_count?.toLocaleString()}</td></tr>)}</tbody></table></div></section>
    </section>
  );
}

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
              <span className="recommendation-action">Remove detected duplicates</span>
            </div>
            <div className="cleaning-inline-info">
              <Trash2 size={18} />
              <span>
                <strong>{preview.duplicate_rows?.toLocaleString() || 0}</strong>
                {" "}duplicate records will be removed from the cleaned output.
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

function AnalyticsPage({ datasetId }) {
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [trend, setTrend] = useState(null);
  const [correlations, setCorrelations] = useState(null);
  const [volumeBreakdown, setVolumeBreakdown] = useState(null);

  const [groupBy, setGroupBy] = useState("");
  const [metric, setMetric] = useState("");
  const [aggregation, setAggregation] = useState("sum");

  const [dateColumn, setDateColumn] = useState("");
  const [trendMetric, setTrendMetric] = useState("");
  const [frequency, setFrequency] = useState("month");

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");

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
      const data = await getAnalyticsOverview(datasetId, "original");

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
  }, [datasetId]);

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
        "original"
      );

      setBreakdown(data);
    } catch (err) {
      setError(err.message || "Could not load category breakdown.");
    } finally {
      setChartLoading(false);
    }
  }, [datasetId]);

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
        "original"
      );

      setTrend(data);
    } catch (err) {
      setError(err.message || "Could not load trend analysis.");
    } finally {
      setChartLoading(false);
    }
  }, [datasetId]);


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
        const data = await getAnalyticsOverview(datasetId, "original");

        if (cancelled) return;

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
            numericColumns[0] || undefined,
            "sum",
            "original"
          ).then((data) => ({
            type: "breakdown",
            data,
          }))
        );
      }

      if (categoricalColumns.length > 0) {
        requests.push(
          getAnalyticsBreakdown(datasetId, categoricalColumns[0], undefined, "count", "original").then((data) => ({ type: "volume", data }))
        );
      }

      if (dateColumns.length > 0 && numericColumns.length > 0) {
        requests.push(
          getAnalyticsTrend(
            datasetId,
            dateColumns[0],
            numericColumns[0],
            "month",
            "original"
          ).then((data) => ({
            type: "trend",
            data,
          }))
        );
      }

      requests.push(
        getAnalyticsCorrelations(datasetId, "original").then((data) => ({
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
        <span>Analysis source: Original uploaded dataset</span>
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

            {breakdown?.results?.length > 0 ? (
              <>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={breakdown.results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#263449" />
                    <XAxis
                      dataKey="group"
                      stroke="#8491a7"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="#8491a7" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#101827",
                        border: "1px solid #34445d",
                        borderRadius: 8,
                        color: "#e8edf7",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#5795f5"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-interpretation">This chart compares {metric || "the selected metric"} across {groupBy || "the selected groups"}. The tallest bar represents the highest recorded value in this dataset. Use this comparison to investigate where business performance is concentrated; it does not explain the cause by itself.</p>
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

            {trend?.results?.length > 0 ? (
              <>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trend.results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#263449" />
                    <XAxis
                      dataKey="period"
                      stroke="#8491a7"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="#8491a7" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#101827",
                        border: "1px solid #34445d",
                        borderRadius: 8,
                        color: "#e8edf7",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#55c7a0"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-interpretation">This time-series chart shows {trendMetric || "the selected metric"} grouped by {frequency}. Peaks indicate periods with higher recorded values, while dips indicate lower recorded values. Compare consecutive periods before making operational decisions.</p>
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
        {volumeBreakdown?.results?.length ? <><div className="analytics-chart"><ResponsiveContainer width="100%" height={205}><BarChart data={volumeBreakdown.results.slice(0,10)}><CartesianGrid strokeDasharray="3 3" stroke="#263449"/><XAxis dataKey="group" stroke="#8491a7" tick={{fontSize:10}}/><YAxis stroke="#8491a7" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="value" fill="#9a83df" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><p className="chart-interpretation">This chart counts records in each {volumeBreakdown.group_by} group. It shows how the dataset is distributed, not which group generated the most revenue. Compare it with the revenue/category chart to distinguish sales volume from sales value.</p></> : <p className="analytics-empty">A categorical field is required for record distribution.</p>}
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
    ["Demand forecasting", "Estimate future sales from sufficiently long historical time series."],
    ["Inventory optimisation", "Translate demand patterns into stock planning with lead-time and safety-stock inputs."],
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
          content: String(answer),
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

  const answerText = otherLines.join("\n").trim();

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
        <ResultViewer title="Model training and evaluation results" data={trainingResult} />
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

// REPORTS

function ReportsPage({ datasetId, profile }) {
  const [source, setSource] = useState("original");
  const [report, setReport] = useState(null);
  const [decision, setDecision] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [trend, setTrend] = useState(null);
  const [correlations, setCorrelations] = useState(null);

  const [groupBy, setGroupBy] = useState("");
  const [metric, setMetric] = useState("");
  const [aggregation, setAggregation] = useState("sum");
  const [dateColumn, setDateColumn] = useState("");
  const [trendMetric, setTrendMetric] = useState("");
  const [frequency, setFrequency] = useState("month");

  const [cleanedAvailable, setCleanedAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

const numericColumns = report?.numeric_summary
  ?.map((item) => item.column)
  .filter((column) => !/id$/i.test(column)) || [];
  const categoricalColumns = report?.categorical_columns || [];
  const dateColumns = report?.date_columns || [];

  const loadReport = useCallback(async (selectedSource = source) => {
    setLoading(true);
    setError("");

    try {
      const [analytics, decisionResult] = await Promise.all([
        getAnalyticsOverview(datasetId, selectedSource),
        getDecisionReport(datasetId, selectedSource),
      ]);

      setReport(analytics);
      setDecision(decisionResult);

      const firstCategory = analytics.categorical_columns?.[0] || "";
      const firstMetric = analytics.numeric_summary?.find((item) => item.column === "__insight_revenue__")?.column || analytics.numeric_summary?.find((item) => /revenue|sales/i.test(item.column))?.column || analytics.numeric_summary?.find((item) => !/id$/i.test(item.column))?.column || "";
      const firstDate = analytics.date_columns?.[0] || "";

      setGroupBy(firstCategory);
      setMetric(firstMetric);
      setDateColumn(firstDate);
      setTrendMetric(firstMetric);

      const requests = [];

      if (firstCategory) {
        requests.push(
          getAnalyticsBreakdown(
            datasetId,
            firstCategory,
            firstMetric || undefined,
            "sum",
            selectedSource
          ).then((data) => ({ type: "breakdown", data }))
        );
      }

      if (firstDate && firstMetric) {
        requests.push(
          getAnalyticsTrend(
            datasetId,
            firstDate,
            firstMetric,
            "month",
            selectedSource
          ).then((data) => ({ type: "trend", data }))
        );
      }

      requests.push(
        getAnalyticsCorrelations(datasetId, selectedSource)
          .then((data) => ({ type: "correlations", data }))
      );

      const results = await Promise.allSettled(requests);

      setBreakdown(null);
      setTrend(null);
      setCorrelations(null);

      results.forEach((result) => {
        if (result.status !== "fulfilled") return;

        const { type, data } = result.value;

        if (type === "breakdown") setBreakdown(data);
        if (type === "trend") setTrend(data);
        if (type === "correlations") setCorrelations(data);
      });
    } catch (err) {
      setError(err.message || "Could not generate the report.");
      setReport(null);
      setDecision(null);
    } finally {
      setLoading(false);
    }
  }, [datasetId, source]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);

      try {
        const original = await getAnalyticsOverview(datasetId, "original");

        if (cancelled) return;

        setCleanedAvailable(false);

        try {
          await getAnalyticsOverview(datasetId, "cleaned");
          if (!cancelled) setCleanedAvailable(true);
        } catch {
          if (!cancelled) setCleanedAvailable(false);
        }

        if (cancelled) return;

        await loadReport("original");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load report data.");
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  async function changeSource(value) {
    setSource(value);
    await loadReport(value);
  }

  async function updateBreakdown(
    selectedGroup,
    selectedMetric,
    selectedAggregation
  ) {
    if (!selectedGroup) return;

    setChartLoading(true);

    try {
      const data = await getAnalyticsBreakdown(
        datasetId,
        selectedGroup,
        selectedMetric || undefined,
        selectedAggregation,
        source
      );
      setBreakdown(data);
    } catch (err) {
      setError(err.message || "Could not update category analysis.");
    } finally {
      setChartLoading(false);
    }
  }

  async function updateTrend(
    selectedDate,
    selectedMetric,
    selectedFrequency
  ) {
    if (!selectedDate || !selectedMetric) return;

    setChartLoading(true);

    try {
      const data = await getAnalyticsTrend(
        datasetId,
        selectedDate,
        selectedMetric,
        selectedFrequency,
        source
      );
      setTrend(data);
    } catch (err) {
      setError(err.message || "Could not update trend analysis.");
    } finally {
      setChartLoading(false);
    }
  }

  const sections = [
    ["overview", "Overview"],
    ["quality", "Data Quality"],
    ["analytics", "Analytics Studio"],
    ["insights", "AI Insights"],
    ["recommendations", "Recommendations"],
  ];

  function scrollToSection(id) {
    setActiveSection(id);
    document.getElementById(`report-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (loading && !report) {
    return (
      <section className="full-report-loading">
        <RefreshCw className="spin" size={30} />
        <h2>Preparing your intelligence report</h2>
        <p>INSIGHT is collecting analytics and generating findings.</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="full-report-loading">
        <AlertTriangle size={28} />
        <h2>Report unavailable</h2>
        <p>{error || "Could not generate the report."}</p>
        <button
          className="analyze-button"
          onClick={() => loadReport(source)}
        >
          Try again <RefreshCw size={16} />
        </button>
      </section>
    );
  }

  const qualityScore = Number(profile?.quality_score ?? 0);
  const missingPercentage = Number(profile?.missing_percentage ?? 0);

  const formatValue = (value) => {
    if (value === null || value === undefined) return "--";
    return typeof value === "number"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : value;
  };

  return (
    <section className="full-report">
      <header className="full-report-header">
        <div className="full-report-brand">
          <div className="full-report-brand-icon">
            <BrainCircuit size={22} />
          </div>
          <div>
            <strong>INSIGHT AI</strong>
            <span>DATA INTELLIGENCE REPORT</span>
          </div>
        </div>

        <div className="full-report-header-actions">
          <label className="report-source-select">
            <Database size={16} />
            <select
              value={source}
              onChange={(event) => changeSource(event.target.value)}
            >
              <option value="original">Original dataset</option>
              <option value="cleaned" disabled={!cleanedAvailable}>
                Cleaned dataset
              </option>
            </select>
          </label>

          <button
            className="cleaning-refresh"
            onClick={() => loadReport(source)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="full-report-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} /> DATASET INTELLIGENCE
          </div>
          <h2>Dataset Intelligence Report</h2>
          <p>
            A comprehensive analysis of your data, its quality,
            patterns and actionable findings.
          </p>
        </div>

        <div className="report-dataset-info">
          <span>DATASET</span>
          <strong>{profile?.filename || datasetId}</strong>
          <small>
            {report.rows?.toLocaleString()} records · {report.columns} columns
          </small>
        </div>
      </div>

      <nav className="full-report-nav">
        {sections.map(([id, label]) => (
          <button
            key={id}
            className={activeSection === id ? "active" : ""}
            onClick={() => scrollToSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="notice error-notice">{error}</div>
      )}

      <div className="full-report-content">
        <section id="report-overview" className="report-section">
          <div className="report-section-heading">
            <div>
              <span>01 / OVERVIEW</span>
              <h3>Dataset at a glance</h3>
              <p>Key measurements from your selected dataset.</p>
            </div>
          </div>

          <div className="report-kpi-grid">
            <div className="report-kpi-card">
              <span>Total records</span>
              <strong>{formatValue(report.rows)}</strong>
              <Database size={19} />
            </div>
            <div className="report-kpi-card">
              <span>Total columns</span>
              <strong>{formatValue(report.columns)}</strong>
              <Columns3 size={19} />
            </div>
            <div className="report-kpi-card">
              <span>Missing cells</span>
              <strong>{formatValue(report.missing_cells)}</strong>
              <AlertTriangle size={19} />
            </div>
            <div className="report-kpi-card">
              <span>Duplicate rows</span>
              <strong>{formatValue(report.duplicate_rows)}</strong>
              <CopyIcon size={19} />
            </div>
          </div>

          <div className="report-domain-card">
            <div>
              <span>DETECTED DATA DOMAIN</span>
              <h3>{profile?.detected_domain || "General dataset"}</h3>
              <p>
                Domain confidence: {profile?.domain_confidence || "Not available"}
              </p>
            </div>
            <div className="report-domain-icon">
              <BrainCircuit size={28} />
            </div>
          </div>

          {report.metrics?.length > 0 && (
            <div className="report-subsection">
              <h4>Key performance indicators</h4>
              <div className="report-metric-grid">
                {report.metrics.map((item, index) => (
                  <div className="report-metric-card" key={index}>
                    <span>{item.name}</span>
                    <strong>{formatValue(item.value)}</strong>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section id="report-quality" className="report-section">
          <div className="report-section-heading">
            <div>
              <span>02 / DATA QUALITY</span>
              <h3>Understand your data quality</h3>
              <p>Review completeness and structural issues.</p>
            </div>
          </div>

          <div className="report-quality-grid">
            <div className="report-quality-score">
              <span>PROFILE QUALITY SCORE</span>
              <strong>{qualityScore.toFixed(2)}%</strong>
              <div className="report-quality-track">
                <div style={{ width: `${Math.min(100, Math.max(0, qualityScore))}%` }} />
              </div>
            </div>

            <div className="report-quality-stat">
              <span>Missing data percentage</span>
              <strong>{missingPercentage.toFixed(2)}%</strong>
            </div>

            <div className="report-quality-stat">
              <span>Duplicate records</span>
              <strong>{formatValue(report.duplicate_rows)}</strong>
            </div>
          </div>

          <div className="report-subsection">
            <h4>Column-level profile</h4>
            {profile?.column_profiles?.length > 0 ? (
              <div className="columns-table-wrapper">
                <table className="columns-table report-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Data type</th>
                      <th>Missing</th>
                      <th>Unique values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.column_profiles.map((column) => (
                      <tr key={column.name}>
                        <td><strong>{column.name}</strong></td>
                        <td>{column.data_type}</td>
                        <td>{column.missing_count} ({Number(column.missing_percentage || 0).toFixed(1)}%)</td>
                        <td>{formatValue(column.unique_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="analytics-empty">
                Column profile information is unavailable.
              </p>
            )}
          </div>

          {profile?.warnings?.length > 0 && (
            <div className="report-observations">
              <h4><AlertTriangle size={17} /> Data quality observations</h4>
              {profile.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </div>
          )}
        </section>

        <section id="report-analytics" className="report-section">
          <div className="report-section-heading">
            <div>
              <span>03 / ANALYTICS</span>
              <h3>Explore patterns and relationships</h3>
              <p>Interactive charts generated by the analytics engine.</p>
            </div>
          </div>

          <div className="report-chart-card">
            <div className="report-chart-heading">
              <div>
                <h4>Category breakdown</h4>
                <p>Compare values across categories.</p>
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
                        updateBreakdown(value, metric, aggregation);
                      }}
                    >
                      {categoricalColumns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Metric
                    <select
                      value={metric}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMetric(value);
                        updateBreakdown(groupBy, value, aggregation);
                      }}
                    >
                      {numericColumns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Aggregation
                    <select
                      value={aggregation}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAggregation(value);
                        updateBreakdown(groupBy, metric, value);
                      }}
                    >
                      <option value="sum">Sum</option>
                      <option value="mean">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Minimum</option>
                      <option value="max">Maximum</option>
                    </select>
                  </label>
                </div>

                {breakdown?.results?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={330}>
                    <BarChart data={breakdown.results}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#263449" />
                      <XAxis dataKey="group" stroke="#8491a7" />
                      <YAxis stroke="#8491a7" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#5795f5" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="analytics-empty">
                    {chartLoading ? "Updating chart..." : "No category results available."}
                  </p>
                )}
                {breakdown?.results?.length > 0 && <details className="chart-insight-toggle"><summary>Understand this chart</summary><p>This chart ranks {groupBy || "the selected categories"} by {metric === "__insight_revenue__" ? "estimated revenue derived from price multiplied by quantity" : metric || "the selected metric"}. The first bar is the largest recorded group in the selected dataset. This ranking describes historical performance and does not by itself prove why a group performed better.</p></details>}
              </>
            ) : (
              <p className="analytics-empty">No categorical columns were detected.</p>
            )}
          </div>

          <div className="report-chart-card">
            <div className="report-chart-heading">
              <div>
                <h4>Time-based trend</h4>
                <p>Track numerical measurements over time.</p>
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
                        updateTrend(value, trendMetric, frequency);
                      }}
                    >
                      {dateColumns.map((column) => (
                        <option key={column} value={column}>{column}</option>
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
                        updateTrend(dateColumn, value, frequency);
                      }}
                    >
                      {numericColumns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Frequency
                    <select
                      value={frequency}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFrequency(value);
                        updateTrend(dateColumn, trendMetric, value);
                      }}
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </label>
                </div>

                {trend?.results?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={330}>
                    <LineChart data={trend.results}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#263449" />
                      <XAxis dataKey="period" stroke="#8491a7" />
                      <YAxis stroke="#8491a7" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#55c7a0"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="analytics-empty">
                    {chartLoading ? "Updating trend..." : "No trend results available."}
                  </p>
                )}
                {trend?.results?.length > 0 && <details className="chart-insight-toggle"><summary>Understand this chart</summary><p>This chart shows how {trendMetric === "__insight_revenue__" ? "estimated revenue" : trendMetric} changes across the selected {frequency} periods. Peaks and declines help identify periods that deserve further investigation. Use multiple periods before changing stock or budgets.</p></details>}
              </>
            ) : (
              <p className="analytics-empty">
                Trend analysis requires a date column and a numerical column.
              </p>
            )}
          </div>

          <div className="report-chart-card">
            <h4>Correlation analysis</h4>
            <p>Relationships between numerical variables. Correlation does not prove causation.</p>

            {correlations?.strong_relationships?.length > 0 ? (
              <div className="correlation-list">
                {correlations.strong_relationships.map((item, index) => (
                  <div className="correlation-item" key={index}>
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
                No strong numerical relationships were detected.
              </p>
            )}
          </div>

          {report.numeric_summary?.length > 0 && (
            <div className="report-chart-card">
              <h4>Numerical summary</h4>
              <div className="columns-table-wrapper">
                <table className="columns-table report-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Mean</th>
                      <th>Median</th>
                      <th>Minimum</th>
                      <th>Maximum</th>
                      <th>Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.numeric_summary.map((item) => (
                      <tr key={item.column}>
                        <td><strong>{item.column}</strong></td>
                        <td>{formatValue(item.mean)}</td>
                        <td>{formatValue(item.median)}</td>
                        <td>{formatValue(item.minimum)}</td>
                        <td>{formatValue(item.maximum)}</td>
                        <td>{formatValue(item.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section id="report-insights" className="report-section">
          <div className="report-section-heading">
            <div>
              <span>04 / AI INSIGHTS</span>
              <h3>What the AI analyst discovered</h3>
              <p>Findings generated from the selected dataset.</p>
            </div>
          </div>

          {decision?.executive_summary && (
            <div className="report-executive-summary">
              <div className="report-ai-label">
                <Sparkles size={16} /> EXECUTIVE SUMMARY
              </div>
              <p>{decision.executive_summary}</p>
            </div>
          )}

          {decision?.business_narrative && (
            <div className="business-narrative-grid">
              {[
                ["overall_performance", "Overall business performance"],
                ["sales_volume", "Sales volume and trend"],
                ["product_performance", "Product performance"],
                ["category_performance", "Category performance"],
                ["regional_performance", "Regional performance"],
                ["data_reliability", "Data reliability and scope"],
              ].filter(([key]) => decision.business_narrative[key]).map(([key, title]) => (
                <article className="business-narrative-card" key={key}>
                  <h4>{title}</h4>
                  <p>{decision.business_narrative[key]}</p>
                </article>
              ))}
            </div>
          )}

          {decision?.findings?.length > 0 ? (
            <div className="report-finding-list">
              {decision.findings.map((item, index) => (
                <div className="report-finding-card" key={index}>
                  <span>FINDING {String(index + 1).padStart(2, "0")}</span>
                  <p>{typeof item === "string" ? item : item.description || JSON.stringify(item)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">No additional findings were returned.</p>
          )}

          {report.insights?.length > 0 && (
            <div className="report-observations">
              <h4>Automated analytical observations</h4>
              {report.insights.map((item, index) => (
                <p key={index}><CheckCircle2 size={16} /> {item}</p>
              ))}
            </div>
          )}
        </section>

        <section id="report-recommendations" className="report-section">
          <div className="report-section-heading">
            <div>
              <span>05 / RECOMMENDATIONS</span>
              <h3>Turn findings into action</h3>
              <p>Suggested next steps and potential risks.</p>
            </div>
          </div>

          {decision?.recommendations?.length > 0 ? (
            <div className="report-recommendation-list">
              {decision.recommendations.map((item, index) => (
                <div className="report-recommendation-card" key={index}>
                  <div className="report-recommendation-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p>{typeof item === "string" ? item : item.description || JSON.stringify(item)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">No recommendations were returned.</p>
          )}

          {decision?.risks?.length > 0 && (
            <div className="report-risk-card">
              <h4><AlertTriangle size={17} /> Potential risks and limitations</h4>
              {decision.risks.map((item, index) => (
                <p key={index}>
                  {typeof item === "string" ? item : item.description || JSON.stringify(item)}
                </p>
              ))}
            </div>
          )}

          {decision?.limitations?.length > 0 && (
            <div className="report-observations">
              <h4>Analysis limitations</h4>
              {decision.limitations.map((item, index) => (
                <p key={index}>
                  {typeof item === "string" ? item : JSON.stringify(item)}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="full-report-footer">
        <div>
          <strong>INSIGHT AI</strong>
          <span>Automated dataset intelligence</span>
        </div>
        <span>
          Source: {source === "original" ? "Original dataset" : "Cleaned dataset"}
        </span>
      </footer>
    </section>
  );
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