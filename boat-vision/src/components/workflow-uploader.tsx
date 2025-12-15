'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ProcessingStatus =
  | 'idle'
  | 'ready'
  | 'analyzing'
  | 'generating'
  | 'verifying'
  | 'complete'
  | 'error';

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: ProcessingStatus;
  logs: string[];
  result?: ProcessedResult;
  error?: string;
};

type ProcessedResult = {
  finalImage: string;
  prompt: string;
  summary: string;
  qualityReport: string;
  insights: {
    boatOverview?: string;
    visualFocalPoints?: string;
    locationAdaptation?: string;
  };
};

const lensStyles = [
  {
    id: 'wide-immersive',
    label: 'Wide Immersive',
    description: 'Dramatic sweep with immersive horizon lines and cinematic depth.',
  },
  {
    id: 'action-zoom',
    label: 'Action Zoom',
    description: 'Telephoto burst capturing speed, rooster tails, and tight detail.',
  },
  {
    id: 'luxury-showcase',
    label: 'Luxury Showcase',
    description: 'Focused on premium finishes, lifestyle staging, and deck layouts.',
  },
];

const shotDynamics = [
  {
    id: 'running',
    label: 'Running Shot',
    description: 'Full-throttle carving with crisp wake detail and dynamic spray.',
  },
  {
    id: 'anchored',
    label: 'Anchored Lifestyle',
    description: 'Calm water, scenic anchorage, elegant composition for brochures.',
  },
  {
    id: 'harbor',
    label: 'Harbor Arrival',
    description: 'Iconic local landmarks, marina energy, and on-brand mood.',
  },
];

const defaultLocationExamples = [
  'Fort Lauderdale, FL (Intracoastal Waterway)',
  'San Diego, CA (Mission Bay)',
  'Seattle, WA (Lake Union)',
  'Lake of the Ozarks, MO',
];

export function WorkflowUploader() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [location, setLocation] = useState('');
  const [lens, setLens] = useState('wide-immersive');
  const [dynamic, setDynamic] = useState('running');
  const [includeInteriors, setIncludeInteriors] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const readyForProcessing = useMemo(
    () => queue.length > 0 && queue.some((item) => item.status === 'idle' || item.status === 'ready'),
    [queue],
  );

  useEffect(() => {
    return () => {
      queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [queue]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const supported = Array.from(files).filter((file) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type),
    );

    const mapped: QueueItem[] = supported.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'ready',
      logs: ['Queued for processing'],
    }));

    setQueue((prev) => [...prev, ...mapped]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQueueItem = useCallback((id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const merged: QueueItem = { ...item, ...updates };
        if (updates.logs) {
          merged.logs = [...item.logs, ...updates.logs];
        }
        return merged;
      }),
    );
  }, []);

  const appendLog = useCallback((id: string, entry: string) => {
    updateQueueItem(id, { logs: [entry] });
  }, [updateQueueItem]);

  const processQueue = useCallback(async () => {
    if (!readyForProcessing || isProcessing) return;
    setIsProcessing(true);

    for (const item of queue) {
      if (item.status === 'complete') continue;
      appendLog(item.id, '🚀 Starting processing pipeline');
      updateQueueItem(item.id, { status: 'analyzing' });

      const formData = new FormData();
      formData.append('image', item.file);
      formData.append('location', location);
      formData.append('lens', lens);
      formData.append('dynamic', dynamic);
      formData.append('includeInteriors', String(includeInteriors));

      try {
        appendLog(item.id, '🔍 Extracting vessel details and trailer remnants');
        const response = await fetch('/api/process', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          appendLog(item.id, `❌ Failed: ${text}`);
          updateQueueItem(item.id, { status: 'error', error: text });
          continue;
        }

        const payload = (await response.json()) as {
          summary: string;
          prompt: string;
          generatedImage: string;
          qualityReport: string;
          insights: ProcessedResult['insights'];
        };

        updateQueueItem(item.id, { status: 'generating' });
        appendLog(item.id, '🎨 Rendering cinematic water shot');
        updateQueueItem(item.id, { status: 'verifying' });
        appendLog(item.id, '🔁 Double-checking trailer removal and composition');

        updateQueueItem(item.id, {
          status: 'complete',
          result: {
            finalImage: payload.generatedImage,
            prompt: payload.prompt,
            summary: payload.summary,
            qualityReport: payload.qualityReport,
            insights: payload.insights ?? {},
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        appendLog(item.id, `❌ ${message}`);
        updateQueueItem(item.id, { status: 'error', error: message });
      }
    }

    setIsProcessing(false);
  }, [
    appendLog,
    dynamic,
    includeInteriors,
    isProcessing,
    lens,
    location,
    queue,
    readyForProcessing,
    updateQueueItem,
  ]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer?.files;
      handleFiles(files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24">
      <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <header className="flex flex-col gap-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
            Marina-Ready Makeover
          </span>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            Transform trailer lot photos into on-water hero imagery.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-teal-100/80 md:text-lg">
            Upload dealership shots, and the agent reimagines them on your flagship waterways—
            complete with cinematic lenses, clean compositions, and verified trailer removal.
          </p>
        </header>

        <label
          htmlFor="boat-upload"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-10 text-center transition hover:border-teal-300/80 hover:bg-slate-900/70"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-400/10 text-teal-200">
            📸
          </div>
          <div>
            <p className="text-xl font-medium text-white">Drop your trailer-lot photos</p>
            <p className="text-sm text-teal-100/70">
              Supports JPG, PNG, WEBP, HEIC. Add multiple files for bulk enhancement.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-teal-100/60">
            <span className="h-px w-8 bg-white/20" />
            Drag & Drop or Browse
            <span className="h-px w-8 bg-white/20" />
          </div>
          <input
            ref={fileInputRef}
            id="boat-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
            className="sr-only"
          />
        </label>

        {queue.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
              >
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/5 bg-black/50">
                  <img
                    src={item.result?.finalImage ?? item.previewUrl}
                    alt={item.file.name}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
                    {item.status === 'complete' ? 'Final' : 'Source'}
                  </span>
                </div>

                <div className="flex flex-col gap-3 text-sm text-teal-50/80">
                  <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-teal-200">
                    <span>{item.file.name}</span>
                    <span>
                      {item.status === 'complete'
                        ? 'Ready for download'
                        : item.status === 'error'
                          ? 'Action required'
                          : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>
                  <ul className="grid gap-1 text-xs text-teal-100/70">
                    {item.logs.map((log, index) => (
                      <li key={`${item.id}-log-${index}`} className="leading-relaxed">
                        {log}
                      </li>
                    ))}
                  </ul>

                  {item.status === 'complete' && item.result && (
                    <div className="grid gap-2 rounded-xl border border-teal-300/20 bg-teal-300/10 p-3 text-xs text-teal-100">
                      <p className="font-semibold text-white">Quality Report</p>
                      <p className="leading-relaxed">{item.result.summary}</p>
                      <p className="text-teal-100/70">{item.result.qualityReport}</p>
                      <details className="rounded-lg bg-black/30 p-2">
                        <summary className="cursor-pointer text-teal-100">View shot prompt</summary>
                        <p className="mt-2 whitespace-pre-wrap text-teal-100/70">{item.result.prompt}</p>
                      </details>
                      <div className="flex flex-col gap-1 text-teal-100/70">
                        {item.result.insights.boatOverview && (
                          <p>
                            <span className="text-teal-100">Boat:</span> {item.result.insights.boatOverview}
                          </p>
                        )}
                        {item.result.insights.locationAdaptation && (
                          <p>
                            <span className="text-teal-100">Locale:</span> {item.result.insights.locationAdaptation}
                          </p>
                        )}
                        {item.result.insights.visualFocalPoints && (
                          <p>
                            <span className="text-teal-100">Focal Points:</span>{' '}
                            {item.result.insights.visualFocalPoints}
                          </p>
                        )}
                      </div>
                      <a
                        href={item.result.finalImage}
                        download={`${item.file.name.replace(/\.[^/.]+$/, '')}-on-water.png`}
                        className="inline-flex items-center justify-center rounded-lg bg-teal-400 px-3 py-2 font-semibold text-slate-950 transition hover:bg-teal-300"
                      >
                        Download 4K Render
                      </a>
                    </div>
                  )}
                </div>

                {item.status !== 'complete' && item.status !== 'error' && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full w-full origin-left scale-x-0 animate-[progress_2.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-200"
                    />
                  </div>
                )}

                {item.status === 'error' && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/20"
                  >
                    Remove Item
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 md:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-6">
            <div className="grid gap-3">
              <label className="text-sm font-semibold uppercase tracking-wide text-teal-100/80">
                Home Waterway / Dealership Locale
              </label>
              <input
                type="text"
                value={location}
                placeholder="e.g. Charleston Harbor, SC"
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition focus:border-teal-400 focus:bg-black/60"
              />
              <div className="flex flex-wrap gap-2 text-xs text-teal-100/70">
                {defaultLocationExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setLocation(example)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-teal-400 hover:bg-teal-400/20 hover:text-teal-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <fieldset className="grid gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
                <legend className="text-sm font-semibold uppercase tracking-wide text-teal-100/80">
                  Lens Profile
                </legend>
                {lensStyles.map((option) => (
                  <label
                    key={option.id}
                    className={`grid gap-1 rounded-lg border px-4 py-3 transition ${
                      lens === option.id
                        ? 'border-teal-400 bg-teal-400/10 text-teal-50'
                        : 'border-white/5 bg-white/0 text-teal-100/80 hover:border-teal-300/50 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="lens"
                      value={option.id}
                      checked={lens === option.id}
                      onChange={() => setLens(option.id)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-white">{option.label}</span>
                    <span className="text-xs leading-relaxed text-inherit">{option.description}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="grid gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
                <legend className="text-sm font-semibold uppercase tracking-wide text-teal-100/80">
                  Shot Dynamic
                </legend>
                {shotDynamics.map((option) => (
                  <label
                    key={option.id}
                    className={`grid gap-1 rounded-lg border px-4 py-3 transition ${
                      dynamic === option.id
                        ? 'border-teal-400 bg-teal-400/10 text-teal-50'
                        : 'border-white/5 bg-white/0 text-teal-100/80 hover:border-teal-300/50 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dynamic"
                      value={option.id}
                      checked={dynamic === option.id}
                      onChange={() => setDynamic(option.id)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-white">{option.label}</span>
                    <span className="text-xs leading-relaxed text-inherit">{option.description}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/40 p-6 text-sm text-teal-100/90">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-white">Interior Showcase</p>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={includeInteriors}
                  onChange={(event) => setIncludeInteriors(event.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-white/20 after:absolute after:left-[4px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-teal-400 peer-checked:after:translate-x-full peer-checked:after:bg-slate-900" />
              </label>
            </div>
            <p className="text-xs leading-relaxed text-teal-100/70">
              Generates wide-angle salon, helm, and cabin shots with architectural lighting. Automatically matches
              upholstery, trim, and material palette from the original photo set.
            </p>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-teal-100/70">
              • Identifies trailer remnants, parking lot patterns, and dealership signage for removal.
              <br />
              • Re-builds reflections, wake trails, and local water coloration for authenticity.
              <br />• Validates finished renders for stray artifacts prior to handoff.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-300/30 bg-teal-300/10 p-5">
          <div className="text-sm text-teal-50/80">
            {isProcessing
              ? 'Processing batch… Rendering premium marina assets.'
              : readyForProcessing
                ? 'Ready when you are. Queue up more shots or launch the transformation.'
                : 'Load files to kick off the marina-grade enhancement pipeline.'}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                setQueue([]);
                setIsProcessing(false);
              }}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-teal-100 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear Queue
            </button>
            <button
              type="button"
              onClick={processQueue}
              disabled={!readyForProcessing || isProcessing}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessing ? 'Transforming…' : 'Launch Transformation'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
