import { useEffect, useMemo, useState } from "react";

const mediaOptions = [
  {
    id: "image",
    title: "Image",
    accept: "image/*",
    endpoint: "/api/analyze/image",
    helper: "Upload a portrait, profile photo, or any JPEG, PNG, or WEBP image.",
  },
  {
    id: "video",
    title: "Video",
    accept: "video/*",
    endpoint: "/api/analyze/video",
    helper: "Check a clip for face swaps, motion anomalies, and visual artifacts.",
  },
  {
    id: "audio",
    title: "Voice",
    accept: "audio/*",
    endpoint: "/api/analyze/audio",
    helper: "Inspect a voice note or recording for synthetic speech signals.",
  },
];

const heroGallery = [
  {
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
    label: "Fake",
    title: "Face swap detection",
  },
  {
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
    label: "True",
    title: "Reference comparison",
  },
];

const showcaseCards = [
  {
    src: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=80",
    label: "Fake",
    title: "Profile image",
  },
  {
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    label: "True",
    title: "Trusted photo",
  },
  {
    src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    label: "Fake",
    title: "Suspicious source",
  },
];

const steps = [
  {
    title: "Upload Your File",
    copy:
      "Click upload, pick an image, video, or audio clip, and let the browser send it to the backend for analysis.",
  },
  {
    title: "Let AI Do the Work",
    copy:
      "The backend compares the file against the local reference data and calculates the verdict and confidence.",
  },
  {
    title: "View the Results",
    copy:
      "See the verdict, confidence, findings, and any video frame or audio feature breakdown directly in the result panel.",
  },
  {
    title: "Download or Share",
    copy:
      "Use the scan history and report-style result card to revisit what the model found and share it with others.",
  },
];

const stepVisuals = [
  {
    number: "1",
    title: "Upload Image",
    subtitle: "Choose the file you want to inspect.",
    src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  },
  {
    number: "2",
    title: "Submit Image",
    subtitle: "The scan starts as soon as the file is sent.",
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80",
  },
  {
    number: "3",
    title: "Get result",
    subtitle: "Review a clean report with verdict and analysis.",
    src: "https://images.unsplash.com/photo-1494891848038-7bd202a2afeb?auto=format&fit=crop&w=900&q=80",
  },
];

const audioFeatureCards = [
  { key: "sample_rate", label: "sample rate", scale: 48000 },
  { key: "duration", label: "duration", scale: 30 },
  { key: "rms_energy", label: "rms energy", scale: 0.2 },
  { key: "zero_crossing_rate", label: "zero crossing rate", scale: 0.25 },
  { key: "mfcc_mean", label: "mfcc mean", scale: 40, useAbsolute: true },
  { key: "mfcc_std", label: "mfcc std", scale: 150 },
  { key: "spectral_centroid", label: "spectral centroid", scale: 5000 },
  { key: "spectral_rolloff", label: "spectral rolloff", scale: 8000 },
  { key: "spectral_bandwidth", label: "spectral bandwidth", scale: 5000 },
  { key: "pitch_std", label: "pitch std", scale: 1000 },
];

function getScanLabel(scan) {
  const verdict = String(scan?.verdict || "").toUpperCase();
  if (verdict === "FAKE" || verdict === "REAL") return verdict;
  return "INCONCLUSIVE";
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatFileSize(bytes) {
  if (typeof bytes !== "number") return "--";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getVerdictTone(verdict) {
  const normalized = String(verdict || "").toUpperCase();
  if (normalized === "FAKE") return "fake";
  if (normalized === "REAL") return "real";
  return "neutral";
}

function normalizeProbability(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
}

function getConfidenceBreakdown(analysis) {
  const verdict = String(analysis?.verdict || "").toUpperCase();
  const confidence = normalizeProbability(analysis?.confidence) ?? 0;
  const directFake = normalizeProbability(analysis?.fake_probability);

  if (directFake !== null) {
    const fake = Math.max(0, Math.min(1, directFake));
    return { fake, real: Math.max(0, Math.min(1, 1 - fake)) };
  }

  if (verdict === "FAKE") {
    const fake = confidence || 0.5;
    return { fake, real: Math.max(0, Math.min(1, 1 - fake)) };
  }

  if (verdict === "REAL") {
    const real = confidence || 0.5;
    return { fake: Math.max(0, Math.min(1, 1 - real)), real };
  }

  return { fake: 0.5, real: 0.5 };
}

function getFeatureMeter(value, scale, useAbsolute = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const normalized = useAbsolute ? Math.abs(value) : value;
  return Math.max(0, Math.min(1, normalized / scale));
}

function formatFeatureValue(value) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "--";
    if (Number.isInteger(value)) return String(value);
    if (Math.abs(value) >= 100) return value.toFixed(2);
    if (Math.abs(value) >= 10) return value.toFixed(2);
    return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  return String(value);
}

function VerdictPieChart({ verdict, fake, real }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fakeDash = circumference * fake;
  const realDash = circumference * real;
  const label = String(verdict || "INCONCLUSIVE").toUpperCase();
  const fakePercent = Math.round(fake * 100);
  const realPercent = Math.round(real * 100);

  return (
    <section className="verdict-chart" aria-label="Verdict pie chart">
      <div className="verdict-chart-head">
        <span className="eyebrow">Result Chart</span>
        <h4>Prediction split</h4>
      </div>

      <div className="pie-wrap">
        <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
          <circle className="pie-track" cx="60" cy="60" r={radius} />
          <circle
            className="pie-segment real"
            cx="60"
            cy="60"
            r={radius}
            style={{
              strokeDasharray: `${realDash} ${circumference - realDash}`,
              strokeDashoffset: "0",
            }}
          />
          <circle
            className="pie-segment fake"
            cx="60"
            cy="60"
            r={radius}
            style={{
              strokeDasharray: `${fakeDash} ${circumference - fakeDash}`,
              strokeDashoffset: `${-realDash}`,
            }}
          />
        </svg>

        <div className="pie-center">
          <strong>{label}</strong>
          <span>{Math.max(fakePercent, realPercent)}% confidence</span>
        </div>
      </div>

      <div className="pie-legend">
        <div>
          <span className="legend-dot real" />
          <strong>Real</strong>
          <span>{realPercent}%</span>
        </div>
        <div>
          <span className="legend-dot fake" />
          <strong>Fake</strong>
          <span>{fakePercent}%</span>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [activeMedia, setActiveMedia] = useState("image");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [error, setError] = useState("");
  const [health, setHealth] = useState({ status: "checking", service: "Deepfake Detection" });
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [showcaseIndex, setShowcaseIndex] = useState(0);

  const currentMedia = useMemo(
    () => mediaOptions.find((option) => option.id === activeMedia) ?? mediaOptions[0],
    [activeMedia]
  );

  const confidenceBreakdown = useMemo(() => getConfidenceBreakdown(analysis), [analysis]);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function startAnalysisProgress() {
    setAnalysisProgress(12);
    const timer = window.setInterval(() => {
      setAnalysisProgress((current) => {
        if (current >= 92) {
          window.clearInterval(timer);
          return current;
        }
        return current + 8;
      });
    }, 180);
    return timer;
  }

  async function loadDashboard() {
    try {
      const healthResponse = await fetch("/api/health");
      const healthData = healthResponse.ok ? await healthResponse.json() : null;
      const normalizedStatus = String(healthData?.status || "").toLowerCase();

      setHealth({
        status: normalizedStatus === "ok" ? "online" : normalizedStatus || "online",
        service: healthData?.service || "Deepfake Detection",
      });

      const analyticsResult = await fetch("/api/analytics")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      const scansResult = await fetch("/api/scans?limit=8")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      setAnalytics(analyticsResult);
      setScanHistory(Array.isArray(scansResult?.scans) ? scansResult.scans : []);
      setError("");
    } catch (loadError) {
      setHealth({ status: "offline", service: "Backend unavailable" });
      setError(loadError.message || "Could not load dashboard data.");
    }
  }

  async function analyzePreparedFile(preparedFile, mediaId = activeMedia) {
    if (!preparedFile) {
      setError(`Choose a ${mediaId} file before starting a scan.`);
      return;
    }

    const targetMedia = mediaOptions.find((option) => option.id === mediaId) ?? currentMedia;
    setActiveMedia(targetMedia.id);
    setFile(preparedFile);
    setIsAnalyzing(true);
    setError("");
    const progressTimer = startAnalysisProgress();

    try {
      const formData = new FormData();
      formData.append("file", preparedFile);

      const response = await fetch(targetMedia.endpoint, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      let payload = {};
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = { detail: responseText };
        }
      }

      if (!response.ok) {
        throw new Error(payload.detail || "Analysis failed.");
      }

      setAnalysis(payload);
      setToolOpen(true);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message || "Analysis request failed.");
    } finally {
      window.clearInterval(progressTimer);
      setAnalysisProgress(100);
      window.setTimeout(() => setAnalysisProgress(0), 500);
      setIsAnalyzing(false);
    }
  }

  const totalScans = analytics?.total_scans ?? 0;
  const imageScans = analytics?.by_type?.image?.total ?? 0;
  const audioScans = analytics?.by_type?.audio?.total ?? 0;
  const videoScans = analytics?.by_type?.video?.total ?? 0;
  const verdictLabel = analysis?.verdict ? String(analysis.verdict).toUpperCase() : "WAITING";
  const confidence = formatPercent(analysis?.confidence);
  const selectedShowcase = [
    showcaseCards[showcaseIndex % showcaseCards.length],
    showcaseCards[(showcaseIndex + 1) % showcaseCards.length],
    showcaseCards[(showcaseIndex + 2) % showcaseCards.length],
  ];

  const featureTiles = analysis?.audio_features
    ? audioFeatureCards
        .filter((item) => Object.prototype.hasOwnProperty.call(analysis.audio_features, item.key))
        .map((item, index) => ({
          ...item,
          value: formatFeatureValue(analysis.audio_features[item.key]),
          meter: getFeatureMeter(analysis.audio_features[item.key], item.scale, item.useAbsolute),
          accent: index % 3 === 0 ? "blue" : index % 3 === 1 ? "cyan" : "sky",
        }))
    : [];

  const videoFrameAnalysis =
    analysis?.frame_analysis ?? analysis?.frameAnalysis ?? analysis?.frames ?? [];

  return (
    <div className="app-shell">
      <header className="topbar shell">
        <a className="brand" href="#home" aria-label="Deepfake Detection">
          <span className="brand-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10" cy="10" r="6.25" />
              <path d="M15 15l5 5" />
            </svg>
          </span>
          <span>
            <strong>Deepfake Detection</strong>
          </span>
        </a>

        <nav className="nav-links" aria-label="Primary">
          <a className="active" href="#home">
            Home
          </a>
          <a href="#tools">
            Deepfake Detection Tools <span className="chev">⌄</span>
          </a>
          <a href="#about">About</a>
          <a href="#credits">Credits</a>
        </nav>

        <a className="nav-cta" href="#tools">
          <span className="user-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c1.5-4 4.25-6 7.5-6s6 2 7.5 6" />
            </svg>
          </span>
          Sign in
        </a>
      </header>

      <main className="shell page">
        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="eyebrow">Deepfake Detection Tools</span>
            <h1>AI Deepfake Detection Online Free</h1>
            <p className="hero-lead">
              Use our AI deepfake detection tool to quickly check if an image, video, or voice is
              real or fake. You&apos;ll get fast results, clear reports, and a polished workflow
              that still talks to your backend.
            </p>

            <div className="social-proof">
              <div className="avatar-row" aria-label="User reviews">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="stars">★★★★★</div>
              <p>50,000+ deepfakes detected successfully</p>
            </div>

            <div className="hero-actions">
              <a className="primary-button" href="#tools">
                Try Deepfake Detection
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div className="hero-gallery">
            <button className="gallery-arrow left" type="button" onClick={() => setShowcaseIndex((index) => (index + showcaseCards.length - 1) % showcaseCards.length)}>
              ‹
            </button>
            <div className="gallery-grid">
              {heroGallery.map((item) => (
                <article key={item.title} className="gallery-card hero-card">
                  <img src={item.src} alt={item.title} />
                  <span className={`result-badge ${item.label.toLowerCase()}`}>{item.label}</span>
                </article>
              ))}
            </div>
            <button className="gallery-arrow right" type="button" onClick={() => setShowcaseIndex((index) => (index + 1) % showcaseCards.length)}>
              ›
            </button>
          </div>
        </section>

        <section className="section centered">
          <span className="eyebrow">Different Deepfake Detection Online</span>
          <h2>Different Deepfake Detection Online</h2>
          <p className="section-lead">
            Whether it&apos;s for education, research, or just peace of mind, people love using
            deepfake detection to stay safe and informed.
          </p>

          <div className="showcase-wrap">
            <button
              className="gallery-arrow floating left"
              type="button"
              onClick={() => setShowcaseIndex((index) => (index + showcaseCards.length - 1) % showcaseCards.length)}
            >
              ‹
            </button>

            <div className="showcase-grid">
              {selectedShowcase.map((item) => (
                <article key={`${item.title}-${item.label}`} className="showcase-card">
                  <img src={item.src} alt={item.title} />
                  <span className={`result-badge ${item.label.toLowerCase()}`}>{item.label}</span>
                </article>
              ))}
            </div>

            <button
              className="gallery-arrow floating right"
              type="button"
              onClick={() => setShowcaseIndex((index) => (index + 1) % showcaseCards.length)}
            >
              ›
            </button>
          </div>
        </section>

        <section className="section how-grid" id="about">
          <div className="how-copy">
            <span className="eyebrow">How to Use Deepfake Detection</span>
            <h2>How to Use Deepfake Detection</h2>
            <p className="section-lead">
              It&apos;s super easy. Just follow these steps to check if an image, video, or voice
              is real or totally fake.
            </p>

            <div className="step-list">
              {steps.map((step, index) => (
                <article key={step.title} className="step-copy">
                  <div className="step-icon">
                    <span>{index + 1}</span>
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="how-preview">
            {stepVisuals.map((step) => (
              <article key={step.number} className="preview-card">
                <div className="preview-header">
                  <div className="preview-number">{step.number}</div>
                  <strong>{step.title}</strong>
                </div>
                <img src={step.src} alt={step.title} />
                <p>{step.subtitle}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section cta-strip">
          <a className="primary-button large" href="#tools">
            Try Deepfake Detection Now <span aria-hidden="true">→</span>
          </a>
        </section>

        <section className="section" id="tools">
          <div className="tool-shell">
            <div className="tool-head">
              <div>
                <span className="eyebrow">Free Online Detection</span>
                <h2>Upload and review the verdict</h2>
              </div>
              <span className={`status-pill ${health.status === "online" ? "online" : "offline"}`}>
                <span className="status-dot" />
                {health.status === "online" ? "Live" : "Offline"}
              </span>
            </div>

            <div className="tool-tabs">
              {mediaOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === activeMedia ? "tool-tab active" : "tool-tab"}
                  onClick={() => {
                    setActiveMedia(option.id);
                    setFile(null);
                    setAnalysis(null);
                    setToolOpen(false);
                    setError("");
                  }}
                >
                  {option.title}
                </button>
              ))}
            </div>

            <form
              className="tool-form"
              onSubmit={async (event) => {
                event.preventDefault();
                await analyzePreparedFile(file, activeMedia);
              }}
            >
              <label className="dropzone">
                <input
                  key={activeMedia}
                  type="file"
                  accept={currentMedia.accept}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <span className="dropzone-title">
                  {file ? file.name : `Choose a ${currentMedia.title.toLowerCase()} file`}
                </span>
                <span className="dropzone-copy">{currentMedia.helper}</span>
                <span className="dropzone-meta">
                  {file
                    ? `${formatFileSize(file.size)} | ${file.type || "unknown type"}`
                    : "Drag and drop is supported in the browser"}
                </span>
              </label>

              {previewUrl ? (
                <div className="preview-frame">
                  {file?.type?.startsWith("video/") ? (
                    <video src={previewUrl} controls className="media-preview" />
                  ) : file?.type?.startsWith("audio/") ? (
                    <audio src={previewUrl} controls className="media-preview audio-player" />
                  ) : (
                    <img src={previewUrl} alt="Selected preview" className="media-preview" />
                  )}
                </div>
              ) : null}

              <button className="primary-button full" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : `Analyze ${currentMedia.title}`}
              </button>
            </form>

            {analysisProgress > 0 ? (
              <div className="analysis-progress">
                <div className="analysis-progress-head">
                  <span>Analyzing media</span>
                  <strong>{analysisProgress}%</strong>
                </div>
                <div className="analysis-progress-track">
                  <div className="analysis-progress-fill" style={{ width: `${analysisProgress}%` }} />
                </div>
              </div>
            ) : null}

            {analysis ? (
              <div className="result-panel">
                <div className="result-panel-head">
                  <span className="result-label">Latest result</span>
                  <span className={`result-pill ${getVerdictTone(analysis.verdict)}`}>
                    {verdictLabel}
                  </span>
                </div>
                <h3>{analysis.summary || "Run a scan to see the model verdict"}</h3>
                <div className="result-meta">
                  <div>
                    <span>Confidence</span>
                    <strong>{confidence}</strong>
                  </div>
                  <div>
                    <span>Risk</span>
                    <strong>{analysis.risk_level || "--"}</strong>
                  </div>
                  <div>
                    <span>File</span>
                    <strong>{analysis.filename || "No file analyzed yet"}</strong>
                  </div>
                </div>

                <VerdictPieChart verdict={analysis.verdict} fake={confidenceBreakdown.fake} real={confidenceBreakdown.real} />

                <div className="result-text">
                  <span>{formatDate(analysis.created_at)}</span>
                  <span>{analysis.media_type || currentMedia.title}</span>
                </div>

                {String(analysis.media_type || "").toLowerCase() === "video" && videoFrameAnalysis.length ? (
                  <section className="frame-analysis">
                    <h4>Video Frame Analysis</h4>
                    <div className="frame-list">
                      {videoFrameAnalysis.map((frame) => (
                        <article key={`${frame.frame}-${frame.source_frame}`} className="frame-item">
                          <div className="frame-thumb">
                            {frame.thumbnail ? (
                              <img src={`data:image/jpeg;base64,${frame.thumbnail}`} alt={`Frame ${frame.frame}`} />
                            ) : (
                              <span>No preview</span>
                            )}
                          </div>
                          <div className="frame-copy">
                            <div className="frame-copy-head">
                              <strong>Frame {frame.frame}</strong>
                              <span className={`frame-chip ${getVerdictTone(frame.label)}`}>{frame.label}</span>
                            </div>
                            <p>{frame.reason}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {featureTiles.length ? (
                  <section className="feature-snapshot">
                    <h4>Audio Feature Snapshot</h4>
                    <div className="feature-grid">
                      {featureTiles.map((tile) => (
                        <article key={tile.key} className="feature-card mini">
                          <span>{tile.label}</span>
                          <strong>{tile.value}</strong>
                          <div className="meter">
                            <div className={`meter-fill ${tile.accent}`} style={{ width: `${tile.meter * 100}%` }} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            <div className="recent-scans">
              <div className="recent-head">
                <span className="eyebrow">Recent scans</span>
                <h3>What the system processed recently</h3>
                <p>The latest stored scans are pulled from the backend history feed.</p>
              </div>

              {scanHistory.length ? (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Type</th>
                        <th>Verdict</th>
                        <th>Risk</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanHistory.map((scan) => (
                        <tr key={scan.scan_id}>
                          <td className="history-file">{scan.filename || "Unnamed file"}</td>
                          <td>{scan.media_type || "Unknown"}</td>
                          <td>
                            <span className={`history-pill ${getVerdictTone(scan.verdict)}`}>
                              {getScanLabel(scan)}
                            </span>
                          </td>
                          <td>
                            <span className={`history-pill ${getVerdictTone(scan.verdict)}`}>
                              {scan.risk_level || "--"}
                            </span>
                          </td>
                          <td>{formatDate(scan.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">
                  {health.status === "checking"
                    ? "Loading recent scans..."
                    : "No scan history is available yet."}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="section footer-links">
          <div id="credits">
            <span className="eyebrow">Credits</span>
            <h2>Built to help people check media quickly and clearly.</h2>
            <p className="section-lead">
              This landing page keeps the reference style while staying connected to your backend
              analysis flow.
            </p>
          </div>
        </section>
      </main>

      {error ? <div className="banner error">{error}</div> : null}
    </div>
  );
}

export default App;
