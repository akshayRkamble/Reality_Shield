import { useEffect, useMemo, useState } from "react";

const mediaOptions = [
  { id: "image", label: "Image", accept: "image/*", endpoint: "/api/analyze/image", helper: "Upload JPG, PNG, or WEBP files for image forensics." },
  { id: "audio", label: "Audio", accept: "audio/*", endpoint: "/api/analyze/audio", helper: "Upload WAV or other voice clips for audio pattern comparison." },
  { id: "video", label: "Video", accept: "video/*", endpoint: "/api/analyze/video", helper: "Upload MP4 or video clips for frame and temporal analysis." },
];

const riskClassMap = { LOW: "risk-low", MEDIUM: "risk-medium", HIGH: "risk-high", CRITICAL: "risk-critical" };
const themeStorageKey = "deepfake-detector-theme";

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function formatMetric(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function parseStoredTheme() {
  const stored = window.localStorage.getItem(themeStorageKey);
  return stored === "light" ? "light" : "dark";
}

function SectionHeader({ eyebrow, title, copy, action }) {
  return (
    <div className="section-header-row">
      <div className="section-header">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <article className={`stat-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle}>
      <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span>
      <strong>{theme === "dark" ? "Switch to light" : "Switch to dark"}</strong>
    </button>
  );
}

function HorizontalBarChart({ title, items, metricKey, accentClass = "chart-accent" }) {
  return (
    <section className="viz-card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {items.map((item) => (
          <div className="bar-row" key={`${title}-${item.model}`}>
            <div className="bar-labels">
              <strong>{item.model}</strong>
              <span>{formatMetric(item[metricKey])}</span>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${accentClass}`} style={{ width: `${Math.max(4, item[metricKey] * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DistributionChart({ distribution }) {
  const entries = Object.entries(distribution || {});
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return (
    <section className="viz-card">
      <h3>Prediction Distribution</h3>
      <div className="distribution-chart">
        {entries.map(([label, value]) => (
          <div className="distribution-column" key={label}>
            <div className="distribution-track">
              <div className={`distribution-fill distribution-${label.toLowerCase()}`} style={{ height: `${(value / total) * 100}%` }} />
            </div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerformanceMatrix({ rows }) {
  const metrics = ["accuracy", "precision", "recall", "f1_score"];
  return (
    <section className="viz-card">
      <h3>Performance Matrix</h3>
      <div className="matrix-grid performance-grid">
        <div className="matrix-cell header">Model / Modality</div>
        {metrics.map((metric) => (
          <div className="matrix-cell header" key={metric}>{metric.replace("_", " ")}</div>
        ))}
        {rows.map((row) => (
          <div className="matrix-row-fragment" key={`${row.modality}-${row.model}`}>
            <div className="matrix-cell row-label">
              <strong>{row.model}</strong>
              <span>{row.modality}</span>
            </div>
            {metrics.map((metric) => (
              <div
                className="matrix-cell score"
                key={`${row.modality}-${row.model}-${metric}`}
                style={{ background: `linear-gradient(135deg, rgba(245,158,11,${0.1 + row[metric] * 0.55}), rgba(59,130,246,${0.08 + row[metric] * 0.4}))` }}
              >
                {formatMetric(row[metric])}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfusionMatrixPanel({ matrices, activeModel, onSelect }) {
  const current = matrices.find((item) => item.model === activeModel) ?? matrices[0];
  const values = current?.matrix?.values ?? [[0, 0], [0, 0]];
  return (
    <section className="viz-card">
      <div className="confusion-header">
        <h3>Confusion Matrix</h3>
        <select value={current?.model || ""} onChange={(event) => onSelect(event.target.value)}>
          {matrices.map((item) => (
            <option key={item.model} value={item.model}>{item.model}</option>
          ))}
        </select>
      </div>
      <div className="matrix-grid confusion-grid">
        <div className="matrix-cell header blank" />
        {current?.matrix?.predicted?.map((label) => (
          <div className="matrix-cell header" key={label}>{label}</div>
        ))}
        {values.map((row, rowIndex) => (
          <div className="matrix-row-fragment" key={`${current?.model}-${rowIndex}`}>
            <div className="matrix-cell header side">{current?.matrix?.labels?.[rowIndex]}</div>
            {row.map((value, cellIndex) => (
              <div
                key={`${current?.model}-${rowIndex}-${cellIndex}`}
                className="matrix-cell heat"
                style={{ background: `linear-gradient(135deg, rgba(16,185,129,${0.15 + value * 0.7}), rgba(59,130,246,${0.1 + value * 0.45}))` }}
              >
                {formatMetric(value)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [theme, setTheme] = useState("dark");
  const [activeMedia, setActiveMedia] = useState("image");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [health, setHealth] = useState({ status: "checking", service: "" });
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [activeConfusionModel, setActiveConfusionModel] = useState("");

  const currentMedia = useMemo(() => mediaOptions.find((item) => item.id === activeMedia) ?? mediaOptions[0], [activeMedia]);

  useEffect(() => {
    const resolvedTheme = parseStoredTheme();
    setTheme(resolvedTheme);
    document.documentElement.dataset.theme = resolvedTheme;
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!file || activeMedia !== "image") {
      setPreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, activeMedia]);

  useEffect(() => {
    if (performance?.confusion_matrices?.length && !activeConfusionModel) {
      setActiveConfusionModel(performance.confusion_matrices[0].model);
    }
  }, [performance, activeConfusionModel]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(themeStorageKey, nextTheme);
  }

  async function loadDashboard() {
    setIsBootstrapping(true);
    try {
      const healthResponse = await fetch("/api/health");
      if (!healthResponse.ok) throw new Error("Backend health check failed.");

      const [analyticsResult, scansResult, performanceResult, healthData] = await Promise.all([
        fetch("/api/analytics").then((response) => (response.ok ? response.json() : null)).catch(() => null),
        fetch("/api/scans?limit=8").then((response) => (response.ok ? response.json() : null)).catch(() => null),
        fetch("/api/performance").then((response) => (response.ok ? response.json() : null)).catch(() => null),
        healthResponse.json(),
      ]);

      setHealth({ status: healthData.status, service: healthData.service });
      setAnalytics(
        analyticsResult ?? {
          total_scans: 0,
          real_count: 0,
          fake_count: 0,
          inconclusive_count: 0,
          by_type: { image: { total: 0, real: 0, fake: 0 }, audio: { total: 0, real: 0, fake: 0 }, video: { total: 0, real: 0, fake: 0 } },
          recent_scans: [],
        }
      );
      setPerformance(performanceResult);
      setScanHistory(Array.isArray(scansResult?.scans) ? scansResult.scans : []);
      setError(analyticsResult && scansResult && performanceResult ? "" : "Backend is online, but some analytics sections are currently unavailable.");
    } catch (loadError) {
      setHealth({ status: "offline", service: "Backend unavailable" });
      setError(loadError.message || "Could not load dashboard data.");
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function handleAnalyze(event) {
    event.preventDefault();
    if (!file) {
      setError(`Choose a ${activeMedia} file before starting a scan.`);
      return;
    }

    setIsAnalyzing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(currentMedia.endpoint, { method: "POST", body: formData });
      const responseText = await response.text();
      let payload = {};
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = { detail: responseText };
        }
      }
      if (!response.ok) throw new Error(payload.detail || "Analysis failed.");
      setAnalysis(payload);
      setFile(null);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message || "Analysis request failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const dashboardStats = analytics
    ? [
        { label: "Total scans", value: analytics.total_scans, accent: "blue" },
        { label: "Flagged fake", value: analytics.fake_count, accent: "danger" },
        { label: "Marked real", value: analytics.real_count, accent: "success" },
        { label: "Inconclusive", value: analytics.inconclusive_count, accent: "warning" },
      ]
    : [];

  const bestModel = performance?.best_model;

  return (
    <div className="app-shell analytics-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="hero">
        <nav className="topbar">
          <div>
            <span className="brand-kicker">React frontend</span>
            <h1>Deepfake Detector Control Room</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className={`status-pill ${health.status === "ok" ? "online" : "offline"}`}>
              <span className="status-dot" />
              {health.status === "ok" ? health.service || "API online" : "Backend offline"}
            </div>
          </div>
        </nav>

        <div className="hero-grid">
          <section className="hero-copy card">
            <span className="eyebrow">Multimodal analysis</span>
            <h2>Scan media, compare model quality, and inspect performance from one dashboard.</h2>
            <p>The frontend now includes theme switching plus graph-based analytics built from the training evaluation reports in the repository.</p>
            <div className="quick-metrics">
              <div><strong>{analytics?.by_type?.image?.total ?? 0}</strong><span>Image scans</span></div>
              <div><strong>{analytics?.by_type?.audio?.total ?? 0}</strong><span>Audio scans</span></div>
              <div><strong>{analytics?.by_type?.video?.total ?? 0}</strong><span>Video scans</span></div>
            </div>
            {bestModel ? (
              <div className="highlight-band">
                <span>Best reported model</span>
                <strong>{bestModel.model}</strong>
                <p>F1 score {formatMetric(bestModel.f1_score)} with accuracy {formatMetric(bestModel.accuracy)}</p>
              </div>
            ) : null}
          </section>

          <section className="upload-panel card">
            <SectionHeader eyebrow="Start a scan" title="Upload media" copy="Choose a modality, attach a file, and send it to the corresponding backend endpoint." />
            <div className="tab-row" role="tablist" aria-label="Media type">
              {mediaOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === activeMedia ? "tab active" : "tab"}
                  onClick={() => {
                    setActiveMedia(option.id);
                    setFile(null);
                    setAnalysis(null);
                    setError("");
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <form className="upload-form" onSubmit={handleAnalyze}>
              <label className="dropzone">
                <input key={activeMedia} type="file" accept={currentMedia.accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <span className="dropzone-title">{file ? file.name : `Choose a ${currentMedia.label.toLowerCase()} file`}</span>
                <span className="dropzone-copy">{currentMedia.helper}</span>
                {file ? <span className="file-meta">{formatFileSize(file.size)} · {file.type || "unknown type"}</span> : null}
              </label>
              {previewUrl ? <div className="image-preview"><img src={previewUrl} alt="Selected preview" /></div> : null}
              <button className="primary-button" type="submit" disabled={isAnalyzing}>{isAnalyzing ? "Analyzing..." : `Analyze ${currentMedia.label}`}</button>
            </form>
          </section>
        </div>
      </header>

      <main className="content">
        {error ? <div className="banner error">{error}</div> : null}

        <section className="stats-grid">
          {dashboardStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={isBootstrapping ? "..." : stat.value} accent={stat.accent} />)}
        </section>

        <section className="content-grid">
          <article className="card result-card">
            <SectionHeader
              eyebrow="Latest result"
              title={analysis ? analysis.summary : "Run a scan to see the model verdict"}
              copy={analysis ? "The backend response is rendered directly below with verdict metadata and detailed findings." : "Once a file is analyzed, verdict, confidence, findings, and recommendations will appear here."}
            />
            {analysis ? (
              <div className="result-body">
                <div className="result-topline">
                  <div><span className="label">Verdict</span><strong>{analysis.verdict}</strong></div>
                  <div><span className="label">Confidence</span><strong>{formatPercent(analysis.confidence)}</strong></div>
                  <div><span className="label">Risk</span><strong className={riskClassMap[analysis.risk_level] || ""}>{analysis.risk_level}</strong></div>
                </div>
                <div className="result-meta">
                  <span>{analysis.filename}</span>
                  <span>{formatFileSize(analysis.file_size)}</span>
                  <span>{formatDate(analysis.created_at)}</span>
                </div>
                <div className="result-columns">
                  <section>
                    <h3>Findings</h3>
                    {analysis.details?.length ? (
                      <ul className="clean-list">
                        {analysis.details.map((detail, index) => (
                          <li key={`${detail.category}-${index}`}><strong>{detail.category}:</strong> {detail.finding}</li>
                        ))}
                      </ul>
                    ) : <p className="muted">No detailed findings were returned for this scan.</p>}
                  </section>
                  <section>
                    <h3>Artifacts</h3>
                    {analysis.artifacts_detected?.length ? (
                      <div className="chip-row">
                        {analysis.artifacts_detected.map((artifact) => <span key={artifact} className="chip">{artifact}</span>)}
                      </div>
                    ) : <p className="muted">No artifacts were explicitly detected.</p>}
                    <h3>Recommendation</h3>
                    <p>{analysis.recommendation || "No recommendation was provided."}</p>
                  </section>
                </div>
                {analysis.audio_features ? (
                  <section className="feature-panel">
                    <h3>Audio feature snapshot</h3>
                    <div className="feature-grid">
                      {Object.entries(analysis.audio_features).map(([key, value]) => (
                        <div key={key}><span>{key.replaceAll("_", " ")}</span><strong>{String(value)}</strong></div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : <div className="empty-state"><p>No scan has been run in this session yet.</p></div>}
          </article>

          <article className="card history-card">
            <SectionHeader eyebrow="Activity" title="Recent scans" copy="The latest stored scans fetched from `/api/scans` help you review what the system processed." />
            <div className="history-list">
              {scanHistory.length ? scanHistory.map((scan) => (
                <div key={scan.scan_id} className="history-item">
                  <div>
                    <strong>{scan.filename || "Unnamed file"}</strong>
                    <p>{scan.media_type} · {formatDate(scan.created_at)}</p>
                  </div>
                  <div className="history-tags">
                    <span className="history-tag">{scan.verdict}</span>
                    <span className={`history-tag ${riskClassMap[scan.risk_level] || ""}`}>{scan.risk_level}</span>
                  </div>
                </div>
              )) : <p className="muted">{isBootstrapping ? "Loading recent scans..." : "No scan history is available yet."}</p>}
            </div>
          </article>
        </section>

        <section className="card analytics-panel">
          <SectionHeader eyebrow="Model analytics" title="Training and evaluation performance" copy="These charts are built from the repository evaluation reports and the current prediction distribution from the backend." />
          {performance ? (
            <>
              <div className="viz-grid viz-grid-two">
                <HorizontalBarChart title="Overall Model Accuracy" items={performance.overall_models} metricKey="accuracy" />
                <HorizontalBarChart title="Overall F1 Score" items={performance.overall_models} metricKey="f1_score" accentClass="chart-accent-secondary" />
              </div>
              <div className="viz-grid viz-grid-two">
                <DistributionChart distribution={performance.prediction_distribution} />
                <ConfusionMatrixPanel matrices={performance.confusion_matrices} activeModel={activeConfusionModel} onSelect={setActiveConfusionModel} />
              </div>
              <PerformanceMatrix rows={performance.multimodal_models} />
              <p className="chart-note">{performance.notes?.confusion_matrix}</p>
            </>
          ) : <p className="muted">Performance graphs are unavailable right now.</p>}
        </section>
      </main>
    </div>
  );
}

export default App;
