import { useEffect, useMemo, useState } from "react";

const mediaOptions = [
  {
    id: "image",
    title: "Image",
    label: "Deepfake Image Detection",
    accept: "image/*",
    endpoint: "/api/analyze/image",
    helper: "Upload a portrait, profile photo, or any JPEG, PNG, or WEBP image.",
  },
  {
    id: "video",
    title: "Video",
    label: "Deepfake Video Detection",
    accept: "video/*",
    endpoint: "/api/analyze/video",
    helper: "Check a video clip for face swaps, temporal artifacts, and manipulation.",
  },
  {
    id: "audio",
    title: "Voice",
    label: "Deepfake Voice Detection",
    accept: "audio/*",
    endpoint: "/api/analyze/audio",
    helper: "Inspect a voice note or recording for synthetic speech signals.",
  },
];

const useCases = [
  {
    title: "Social Media Profile",
    score: "89%",
    copy: "Catch suspicious profile images before they spread across feeds.",
  },
  {
    title: "Parade Images",
    score: "45%",
    copy: "Review event photos and spot edits that do not feel authentic.",
  },
  {
    title: "Financial Document",
    score: "31%",
    copy: "Validate identity photos and supporting documents for fraud checks.",
  },
  {
    title: "Video Calls",
    score: "67%",
    copy: "Scan recorded calls for face-swap artifacts and timing mismatches.",
  },
  {
    title: "News Media",
    score: "15%",
    copy: "Verify viral clips before publishing or sharing them.",
  },
  {
    title: "Scam Calls",
    score: "22%",
    copy: "Inspect suspicious voice notes and phone recordings quickly.",
  },
];

const steps = [
  {
    title: "Upload Your File",
    copy: "Choose an image, video, or audio file from your device. No sign-up required.",
  },
  {
    title: "Let AI Do the Work",
    copy: "The backend analyzes the file and generates a clear verdict with confidence details.",
  },
  {
    title: "View the Results",
    copy: "Review the summary, confidence, artifacts, and supporting metadata in one place.",
  },
  {
    title: "Download or Share",
    copy: "Use the recent scan history to revisit results and share them with your team.",
  },
];

const trustCards = [
  {
    title: "Simple & Free to Use",
    copy: "Upload and go. The interface is intentionally clean, fast, and easy to learn.",
  },
  {
    title: "Natural, Accurate Results",
    copy: "Readable verdicts, confidence values, and media context keep the output approachable.",
  },
  {
    title: "See Real-World Use",
    copy: "The layout works for classrooms, newsrooms, creators, and families alike.",
  },
  {
    title: "Privacy First",
    copy: "Files are sent to your backend for analysis and surfaced back in the browser.",
  },
];

const testimonials = [
  {
    quote:
      "I used Deepfake Detection during a lesson on historical photos. The scan results came fast and were easy for students to understand.",
    name: "Emily Harper",
    role: "High School History Teacher",
  },
  {
    quote:
      "The upload flow is clean, and the result card makes it simple to explain what the model is seeing to non-technical teammates.",
    name: "Marcus Lee",
    role: "Digital Investigations Analyst",
  },
];

const faqs = [
  {
    question: "What is deepfake detection?",
    answer:
      "It is the process of identifying AI-generated or digitally manipulated images, videos, and voices by analyzing visual and audio cues, metadata, and model patterns.",
  },
  {
    question: "How does deepfake detection work?",
    answer:
      "You upload a file, the backend analyzes it with the appropriate model, and the app presents a verdict, confidence, scan summary, and supporting details.",
  },
  {
    question: "Which file types are supported?",
    answer:
      "The frontend supports image, video, and audio uploads and routes each file type to its matching analysis endpoint.",
  },
  {
    question: "How fast is the analysis?",
    answer:
      "That depends on the file size and backend workload, but the interface is designed to feel immediate and easy to track while the scan is running.",
  },
  {
    question: "Can I review previous scans?",
    answer:
      "Yes. The recent scans panel reads from the backend history feed so you can review prior uploads and verdicts.",
  },
  {
    question: "Is the tool free?",
    answer:
      "The reference design emphasizes a free online workflow, and this frontend keeps that same no-friction presentation.",
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

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function formatCompactNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  if (value < 1000) return `${Math.round(value)}`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
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

function getRiskTone(risk) {
  const normalized = String(risk || "").toUpperCase();
  if (normalized === "LOW") return "real";
  if (normalized === "MEDIUM") return "neutral";
  if (normalized === "HIGH" || normalized === "CRITICAL") return "fake";
  return "neutral";
}

function normalizeProbability(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
}

function clampProbability(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getConfidenceBreakdown(analysis) {
  const verdict = String(analysis?.verdict || "").toUpperCase();
  const confidence = clampProbability(normalizeProbability(analysis?.confidence) ?? 0);
  const directFake = normalizeProbability(analysis?.fake_probability);

  if (directFake !== null) {
    const fake = clampProbability(directFake);
    return { fake, real: clampProbability(1 - fake) };
  }

  if (verdict === "FAKE") {
    const fake = confidence || 0.5;
    return { fake, real: clampProbability(1 - fake) };
  }

  if (verdict === "REAL") {
    const real = confidence || 0.5;
    return { fake: clampProbability(1 - real), real };
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

function SectionHeader({ eyebrow, title, copy, action }) {
  return (
    <div className="section-header-row">
      <div className="section-header">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}

function FeatureCard({ title, copy }) {
  return (
    <article className="feature-card">
      <strong>{title}</strong>
      <p>{copy}</p>
    </article>
  );
}

function AudioFeatureTile({ title, value, meter, accent }) {
  return (
    <article className="audio-tile">
      <span>{title}</span>
      <strong>{value}</strong>
      <div className="audio-meter" aria-hidden="true">
        <div className={`audio-meter-fill ${accent}`} style={{ width: `${meter * 100}%` }} />
      </div>
    </article>
  );
}

function AudioFeatureSnapshot({ audioFeatures }) {
  const tiles = audioFeatureCards
    .filter((item) => Object.prototype.hasOwnProperty.call(audioFeatures, item.key))
    .map((item, index) => ({
      ...item,
      value: formatFeatureValue(audioFeatures[item.key]),
      meter: getFeatureMeter(audioFeatures[item.key], item.scale, item.useAbsolute),
      accent: index % 3 === 0 ? "amber" : index % 3 === 1 ? "sky" : "rose",
    }));

  if (!tiles.length) return null;

  return (
    <section className="feature-snapshot audio-snapshot">
      <h4>Audio Feature Snapshot</h4>
      <div className="feature-grid audio-grid">
        {tiles.map((tile) => (
          <AudioFeatureTile
            key={tile.key}
            title={tile.label}
            value={tile.value}
            meter={tile.meter}
            accent={tile.accent}
          />
        ))}
      </div>
    </section>
  );
}

function VideoFrameAnalysis({ frames }) {
  if (!Array.isArray(frames) || !frames.length) return null;

  return (
    <section className="frame-analysis">
      <h4>Video Frame Analysis</h4>
      <div className="frame-grid">
        {frames.map((frame) => (
          <article key={`${frame.frame}-${frame.source_frame}`} className="frame-card">
            <div className="frame-thumb">
              {frame.thumbnail ? (
                <img
                  src={`data:image/jpeg;base64,${frame.thumbnail}`}
                  alt={`Frame ${frame.frame}`}
                />
              ) : (
                <div className="frame-thumb-fallback">No preview</div>
              )}
            </div>
            <div className="frame-meta">
              <div className="frame-meta-head">
                <strong>Frame {frame.frame}</strong>
                <span className={`frame-label ${getVerdictTone(frame.label)}`}>{frame.label}</span>
              </div>
              <p>Source frame {frame.source_frame}</p>
              <p>{frame.reason}</p>
              <div className="frame-stats">
                <span>Fake {formatPercent(normalizeProbability(frame.fake_prob) ?? 0)}</span>
                <span>Confidence {formatPercent(normalizeProbability(frame.confidence) ?? 0)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfidencePieChart({ fake, real, verdict }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fakeDash = circumference * fake;
  const realDash = circumference * real;
  const label = verdict ? String(verdict).toUpperCase() : "INCONCLUSIVE";
  const fakePercent = Math.round(fake * 100);
  const realPercent = Math.round(real * 100);

  return (
    <section className="confidence-panel">
      <div className="confidence-panel-head">
        <div>
          <span className="eyebrow">Confidence Breakdown</span>
          <h4>Prediction split</h4>
        </div>
        <span className={`confidence-label ${getVerdictTone(verdict)}`}>{label}</span>
      </div>

      <div className="pie-wrap" aria-label="Confidence pie chart">
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
          <strong>{Math.max(fakePercent, realPercent)}%</strong>
          <span>highest</span>
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
  const [health, setHealth] = useState({ status: "checking", service: "Deepfake Detection" });
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

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
    setAnalysisProgress(15);
    const timer = window.setInterval(() => {
      setAnalysisProgress((current) => {
        if (current >= 92) {
          window.clearInterval(timer);
          return current;
        }
        return current + 9;
      });
    }, 180);
    return timer;
  }

  async function loadDashboard() {
    setIsBootstrapping(true);
    try {
      const healthResponse = await fetch("/api/health");
      if (!healthResponse.ok) {
        throw new Error("Backend health check failed.");
      }

      const [analyticsResult, scansResult, healthData] = await Promise.all([
        fetch("/api/analytics")
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
        fetch("/api/scans?limit=8")
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
        healthResponse.json(),
      ]);

      const normalizedStatus = String(healthData.status || "").toLowerCase();
      setHealth({
        status: normalizedStatus === "ok" ? "online" : normalizedStatus || "online",
        service: healthData.service || "Deepfake Detection",
      });
      setAnalytics(
        analyticsResult ?? {
          total_scans: 0,
          real_count: 0,
          fake_count: 0,
          inconclusive_count: 0,
          by_type: {
            image: { total: 0, real: 0, fake: 0 },
            audio: { total: 0, real: 0, fake: 0 },
            video: { total: 0, real: 0, fake: 0 },
          },
        }
      );
      setScanHistory(Array.isArray(scansResult?.scans) ? scansResult.scans : []);
      setError("");
    } catch (loadError) {
      setHealth({ status: "offline", service: "Backend unavailable" });
      setError(loadError.message || "Could not load dashboard data.");
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function handleAnalyze(event) {
    event.preventDefault();
    await analyzePreparedFile(file, activeMedia);
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
      setFile(null);
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
  const videoFrameAnalysis =
    analysis?.frame_analysis ?? analysis?.frameAnalysis ?? analysis?.frames ?? [];
  const verdictLabel = analysis?.verdict ? String(analysis.verdict).toUpperCase() : "WAITING";
  const confidence = formatPercent(analysis?.confidence);
  const heroCount = totalScans > 0 ? formatCompactNumber(totalScans) : "50,000+";

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="site-shell site-nav">
        <a className="brand" href="#home">
          <span className="brand-mark">D</span>
          <span>
            <strong>Deepfake Detection</strong>
            <small>AI deepfake detection online free</small>
          </span>
        </a>

        <nav className="nav-links" aria-label="Primary">
          <a href="#home">Home</a>
          <a href="#tools">Tools</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main className="site-shell">
        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="eyebrow">Deepfake Detection Tools</span>
            <h1>AI Deepfake Detection Online Free</h1>
            <p className="hero-lead">
              Use our AI deepfake detection tool to quickly check if an image, video, or voice is
              real or fake. You&apos;ll get fast results, clear reports, and a polished workflow
              that still talks to your backend.
            </p>

            <div className="avatar-row" aria-label="User reviews">
              <div className="avatar-stack">
                <span>EH</span>
                <span>ML</span>
                <span>SK</span>
                <span>TR</span>
              </div>
              <div>
                <strong>50,000+ deepfakes detected successfully</strong>
                <p>Used by teachers, journalists, creators, and families.</p>
              </div>
            </div>

            <div className="hero-actions">
              <a className="primary-button" href="#tools">
                Try Deepfake Detection
              </a>
              <span className="hero-chip">{heroCount}+ scans processed</span>
            </div>

            <div className="hero-stats">
              <StatCard label="Total scans" value={formatCompactNumber(totalScans)} hint="All uploads processed by the backend." />
              <StatCard label="Image scans" value={formatCompactNumber(imageScans)} hint="Image analysis requests." />
              <StatCard label="Video scans" value={formatCompactNumber(videoScans)} hint="Video analysis requests." />
            </div>
          </div>

          <aside className="hero-panel" id="tools">
            <div className="panel-topline">
              <div>
                <span className="eyebrow">Tool interface</span>
                <h2>Upload a file and review the verdict</h2>
              </div>
              <span className={`status-pill ${health.status === "online" ? "online" : "offline"}`}>
                <span className="status-dot" />
                {health.status === "online" ? "Live" : "Offline"}
              </span>
            </div>

            <div className="media-tabs" role="tablist" aria-label="Media type">
              {mediaOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === activeMedia ? "media-tab active" : "media-tab"}
                  onClick={() => {
                    setActiveMedia(option.id);
                    setFile(null);
                    setAnalysis(null);
                    setError("");
                  }}
                >
                  {option.title}
                </button>
              ))}
            </div>

            <form className="upload-form" onSubmit={handleAnalyze}>
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
              <div className="analysis-progress" aria-live="polite" aria-label="Analysis progress">
                <div className="analysis-progress-head">
                  <span>Analyzing media</span>
                  <strong>{analysisProgress}%</strong>
                </div>
                <div className="analysis-progress-track">
                  <div className="analysis-progress-fill" style={{ width: `${analysisProgress}%` }} />
                </div>
              </div>
            ) : null}

            <div className="panel-stats">
              <div>
                <strong>{imageScans}</strong>
                <span>Image scans</span>
              </div>
              <div>
                <strong>{audioScans}</strong>
                <span>Voice scans</span>
              </div>
              <div>
                <strong>{videoScans}</strong>
                <span>Video scans</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="section">
          <SectionHeader
            eyebrow="Different Deepfake Detection Online"
            title="Whether it's for education, research, or peace of mind, the workflow stays simple."
            copy="This layout keeps the reference site&apos;s rhythm while showing the actual upload and result experience from your backend."
          />

          <div className="use-case-grid">
            {useCases.map((item) => (
              <article key={item.title} className="use-case-card">
                <span className="case-score">{item.score} Deepfake</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-split" id="about">
          <SectionHeader
            eyebrow="How to Use Deepfake Detection"
            title="Just follow these steps to check if a file is real or fake."
            copy="The flow is designed to feel obvious on desktop and mobile."
          />

          <div className="step-grid">
            {steps.map((step, index) => (
              <article key={step.title} className="step-card">
                <span className="step-index">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <SectionHeader
            eyebrow="Why Thousands Trust Our Tool"
            title="Readable results, polished visuals, and a private-feeling experience."
            copy="The goal is not only to match the tone of the reference, but to keep your existing analysis output easy to understand."
          />

          <div className="trust-grid">
            {trustCards.map((card) => (
              <FeatureCard key={card.title} title={card.title} copy={card.copy} />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="quote-grid">
            {testimonials.map((item) => (
              <article key={item.name} className="quote-card">
                <p className="quote-mark">&ldquo;</p>
                <p>{item.quote}</p>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section result-section">
          <SectionHeader
            eyebrow="Free Online Deepfake Detection at Your Fingertips"
            title="Start using the detector now, then review the backend result below."
            copy="This is where your real scan output appears after each upload, keeping the main experience aligned with the reference site but connected to your API."
          />

          <div className="result-grid">
            <article className="result-card">
              <div className="result-head">
                <div>
                  <span className="result-label">Latest Result</span>
                  <h3>{analysis?.summary || "Run a scan to see the model verdict"}</h3>
                </div>
                <div className={`verdict-pill ${analysis ? getVerdictTone(analysis.verdict) : "neutral"}`}>
                  {verdictLabel}
                </div>
              </div>

              <div className="result-metrics">
                <div>
                  <span>Confidence</span>
                  <strong>{confidence}</strong>
                </div>
                <div>
                  <span>Risk level</span>
                  <strong className={analysis?.risk_level ? getRiskTone(analysis.risk_level) : ""}>
                    {analysis?.risk_level || "--"}
                  </strong>
                </div>
                <div>
                  <span>File</span>
                  <strong>{analysis?.filename || "No file analyzed yet"}</strong>
                </div>
              </div>

              {analysis ? (
                <ConfidencePieChart
                  fake={confidenceBreakdown.fake}
                  real={confidenceBreakdown.real}
                  verdict={analysis.verdict}
                />
              ) : null}

              {analysis ? (
                <div className="result-body">
                  <div className="result-meta">
                    <span>{formatFileSize(analysis.file_size)}</span>
                    <span>{formatDate(analysis.created_at)}</span>
                    <span>{analysis.media_type || currentMedia.title}</span>
                  </div>

                  <div className="result-columns">
                    <section>
                      <h4>Findings</h4>
                      {analysis.details?.length ? (
                        <ul className="detail-list">
                          {analysis.details.map((detail, index) => (
                            <li key={`${detail.category || "detail"}-${index}`}>
                              <strong>{detail.category || "Note"}:</strong> {detail.finding}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">No detailed findings were returned for this scan.</p>
                      )}
                    </section>

                    <section>
                      <h4>Artifacts</h4>
                      {analysis.artifacts_detected?.length ? (
                        <div className="chip-row">
                          {analysis.artifacts_detected.map((artifact) => (
                            <span key={artifact} className="chip">
                              {artifact}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No explicit artifacts were detected.</p>
                      )}

                      <h4>Recommendation</h4>
                      <p>{analysis.recommendation || "No recommendation was provided."}</p>
                    </section>
                  </div>

                  {String(analysis.media_type || "").toLowerCase() === "video" && videoFrameAnalysis.length ? (
                    <VideoFrameAnalysis frames={videoFrameAnalysis} />
                  ) : null}

                  {analysis.audio_features ? <AudioFeatureSnapshot audioFeatures={analysis.audio_features} /> : null}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No scan has been run in this session yet.</p>
                </div>
              )}
            </article>

            <aside className="history-card">
              <SectionHeader
                eyebrow="Recent scans"
                title="What the system processed recently"
                copy="The latest stored scans are pulled from the backend history feed."
              />

              <div className="history-list">
                {scanHistory.length ? (
                  scanHistory.map((scan) => (
                    <article key={scan.scan_id} className="history-item">
                      <div className="history-copy">
                        <strong>{scan.filename || "Unnamed file"}</strong>
                        <p>
                          {scan.media_type || "Unknown"} | {formatDate(scan.created_at)}
                        </p>
                      </div>
                      <span className={`history-tag ${getVerdictTone(scan.verdict)}`}>
                        {scan.verdict || "INCONCLUSIVE"}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="muted">{isBootstrapping ? "Loading recent scans..." : "No scan history is available yet."}</p>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="section" id="faq">
          <SectionHeader eyebrow="Frequently Asked Questions" title="Common questions, answered clearly." />
          <FaqAccordion items={faqs} />
        </section>
      </main>

      {error ? <div className="banner error">{error}</div> : null}

      <footer className="site-footer">
        <div>
          <strong>Deepfake Detection</strong>
          <p>Free AI-powered detection for images, videos, and audio files.</p>
        </div>
        <div className="footer-links">
          <a href="#tools">Tools</a>
          <a href="#about">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="footer-meta">Copyright 2026 Deepfake Detection. All rights reserved.</div>
      </footer>
    </div>
  );
}

function FaqItem({ item, open, onToggle }) {
  return (
    <article className={`faq-item ${open ? "open" : ""}`}>
      <button type="button" className="faq-question" onClick={onToggle} aria-expanded={open}>
        <span>{item.question}</span>
        <span className="faq-icon">{open ? "-" : "+"}</span>
      </button>
      {open ? <p className="faq-answer">{item.answer}</p> : null}
    </article>
  );
}

function FaqAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="faq-list">
      {items.map((item, index) => (
        <FaqItem
          key={item.question}
          item={item}
          open={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
        />
      ))}
    </div>
  );
}

export default App;
