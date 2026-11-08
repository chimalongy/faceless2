"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  Globe,
  Loader2,
  Image as ImageIcon,
  Film,
  ExternalLink,
  Check,
  AlertCircle,
  Sparkles,
  Settings,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

export default function StockSearchModal({
  isOpen,
  onClose,
  initialQuery = "",
  sceneNumber = null,
  frameIndex = 1,
  isShort = false,
  channelSlug,
  topicSlug,
  onAssetImported,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [mediaType, setMediaType] = useState("all"); // "all" | "photos" | "videos"
  const [source, setSource] = useState("all");       // "all" | "pexels" | "pixabay"
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const orientation = isShort ? "portrait" : "landscape";
  const orientationLabel = isShort ? "9:16 Portrait" : "16:9 Landscape";

  // Sync initial query when opened
  useEffect(() => {
    if (isOpen) {
      const q = initialQuery || "";
      setQuery(q);
      if (q.trim()) {
        executeSearch(q, mediaType, source);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }
  }, [isOpen, initialQuery]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function executeSearch(searchQuery = query, mType = mediaType, src = source) {
    const cleanQ = (searchQuery || "").trim();
    if (!cleanQ) {
      toast.error("Please enter a search keyword");
      return;
    }

    setLoading(true);
    setWarningMessage("");
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        query: cleanQ,
        mediaType: mType,
        orientation,
        source: src,
        perPage: "30",
      });

      const res = await fetch(`/api/stock/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Stock search failed");
      }

      setResults(Array.isArray(data.results) ? data.results : []);
      if (data.warning) {
        setWarningMessage(data.warning);
      } else if (!data.pexelsAvailable && !data.pixabayAvailable) {
        setWarningMessage("No stock media API keys configured. Please add your free Pexels or Pixabay API key in Settings.");
      }
    } catch (err) {
      console.error("Stock search failed:", err);
      toast.error(err.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e) {
    if (e) e.preventDefault();
    executeSearch();
  }

  async function handleImportItem(item) {
    if (!channelSlug || !topicSlug) {
      toast.error("Missing channel or topic context");
      return;
    }

    setImportingId(item.id);
    const toastId = toast.loading(`Importing ${item.source === "pexels" ? "Pexels" : "Pixabay"} media to Scene ${sceneNumber}...`);

    try {
      const res = await fetch(
        `/api/channels/${channelSlug}/topics/${topicSlug}/import-stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneIndex: sceneNumber,
            imageIndex: frameIndex,
            downloadUrl: item.downloadUrl,
            mediaType: item.mediaType,
            title: item.title,
            author: item.author,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import stock media");
      }

      toast.success(
        `Scene ${sceneNumber}${frameIndex > 1 ? ` (Frame ${frameIndex})` : ""} updated with stock visual!`,
        { id: toastId }
      );

      if (onAssetImported) {
        onAssetImported({
          sceneIndex: sceneNumber,
          frameIndex,
          assignedUrl: data.assignedUrl,
          assignedKey: data.assignedKey,
          fileName: data.fileName,
        });
      }

      onClose();
    } catch (err) {
      console.error("Import error:", err);
      toast.error(err.message || "Failed to import stock visual", { id: toastId });
    } finally {
      setImportingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/75 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-paper border border-line flex flex-col shadow-2xl overflow-hidden rounded-xs">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-paper-dark/70">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xs bg-signal/10 border border-signal/30 flex items-center justify-center text-signal">
              <Globe size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">
                  Stock Media Search (Pexels &amp; Pixabay)
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-signal/15 text-signal border border-signal/25">
                  {orientationLabel}
                </span>
                {sceneNumber !== null && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-paper border border-line text-ink">
                    Scene {sceneNumber} {frameIndex > 1 ? `• Frame ${frameIndex}` : ""}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-muted">
                Free high-resolution royalty-free photos and videos streamed directly into your project.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xs text-ink-muted hover:text-ink hover:bg-paper border border-transparent hover:border-line transition-all cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning Banner (e.g. Missing Keys) */}
        {warningMessage && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>{warningMessage}</span>
            </div>
            <a
              href="/dashboard/settings"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-signal hover:underline text-[11px] shrink-0"
            >
              <Settings size={12} />
              <span>Configure Settings &rarr;</span>
            </a>
          </div>
        )}

        {/* Search Bar & Filters */}
        <div className="p-4 border-b border-line bg-paper flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <form onSubmit={handleFormSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search royalty-free stock photos & videos (e.g. ancient ruins, cyber city, neon sunset)..."
                className="w-full h-9 pl-9 pr-8 border border-line bg-white text-xs font-mono text-ink placeholder:text-ink-muted/70 outline-none focus:border-signal"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 h-9 bg-signal hover:bg-signal-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              <span>Search</span>
            </button>
          </form>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 text-xs shrink-0 overflow-x-auto pb-1 sm:pb-0">
            {/* Media Type */}
            <div className="flex border border-line rounded-xs overflow-hidden bg-paper-dark">
              <button
                type="button"
                onClick={() => {
                  setMediaType("all");
                  executeSearch(query, "all", source);
                }}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  mediaType === "all" ? "bg-signal text-white" : "text-ink hover:bg-paper"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setMediaType("photos");
                  executeSearch(query, "photos", source);
                }}
                className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  mediaType === "photos" ? "bg-signal text-white" : "text-ink hover:bg-paper"
                }`}
              >
                <ImageIcon size={11} />
                <span>Photos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMediaType("videos");
                  executeSearch(query, "videos", source);
                }}
                className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  mediaType === "videos" ? "bg-signal text-white" : "text-ink hover:bg-paper"
                }`}
              >
                <Film size={11} />
                <span>Videos</span>
              </button>
            </div>

            {/* Provider Filter */}
            <div className="flex border border-line rounded-xs overflow-hidden bg-paper-dark">
              <button
                type="button"
                onClick={() => {
                  setSource("all");
                  executeSearch(query, mediaType, "all");
                }}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  source === "all" ? "bg-ink text-white" : "text-ink hover:bg-paper"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource("pexels");
                  executeSearch(query, mediaType, "pexels");
                }}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  source === "pexels" ? "bg-emerald-600 text-white" : "text-ink hover:bg-paper"
                }`}
              >
                Pexels
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource("pixabay");
                  executeSearch(query, mediaType, "pixabay");
                }}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  source === "pixabay" ? "bg-sky-600 text-white" : "text-ink hover:bg-paper"
                }`}
              >
                Pixabay
              </button>
            </div>
          </div>
        </div>

        {/* Results Body / Gallery */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-[350px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2.5 text-ink-muted">
              <Loader2 size={24} className="animate-spin text-signal" />
              <p className="text-xs font-mono">Searching royalty-free media...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {results.map((item) => {
                const isImporting = importingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col border border-line bg-paper-dark overflow-hidden hover:border-signal transition-all shadow-xs"
                  >
                    {/* Media Thumbnail */}
                    <div
                      className={`relative w-full overflow-hidden bg-black/40 ${
                        isShort ? "aspect-[9/16]" : "aspect-[16/9]"
                      }`}
                    >
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.title || "Stock Visual"}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-muted">
                          <ImageIcon size={20} />
                        </div>
                      )}

                      {/* Source & Type Badges */}
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs text-white ${
                            item.source === "pexels" ? "bg-emerald-600/90" : "bg-sky-600/90"
                          }`}
                        >
                          {item.source}
                        </span>
                        {item.mediaType === "video" && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-ink/80 text-white rounded-xs flex items-center gap-0.5">
                            <Film size={9} />
                            {item.duration ? `${item.duration}s` : "Video"}
                          </span>
                        )}
                      </div>

                      {/* External Link */}
                      {item.pageUrl && (
                        <a
                          href={item.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="View on provider site"
                          className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black text-white/80 hover:text-white rounded-xs transition-colors"
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}

                      {/* Hover Overlay with "Use for Scene" */}
                      <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => handleImportItem(item)}
                          className="w-full py-1.5 px-2 bg-signal hover:bg-signal-hover text-white text-[11px] font-semibold rounded-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : (
                            <>
                              <Check size={12} />
                              <span>Use for Scene {sceneNumber}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2 flex flex-col gap-0.5 bg-paper">
                      <p className="text-[11px] font-medium text-ink truncate" title={item.title}>
                        {item.title || "Royalty-free visual"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-ink-muted">
                        <span className="truncate">{item.author ? `By ${item.author}` : item.source}</span>
                        {item.width && item.height && (
                          <span className="font-mono text-[9px]">
                            {item.width}x{item.height}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : hasSearched ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-ink-muted text-center px-4">
              <ImageIcon size={32} className="text-ink-muted/50" />
              <p className="text-xs font-medium text-ink">No royalty-free visuals found for &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] text-ink-muted max-w-sm">
                Try broader keywords like &ldquo;nature&rdquo;, &ldquo;cityscape&rdquo;, &ldquo;space&rdquo;, or switch providers.
              </p>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-ink-muted text-center px-4">
              <Sparkles size={32} className="text-signal/60" />
              <p className="text-xs font-semibold text-ink">Search Royalty-Free Pexels &amp; Pixabay Media</p>
              <p className="text-[11px] text-ink-muted max-w-md">
                Enter any keyword above to search millions of high-definition stock photos and video frames, then click to assign them to your scene.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line bg-paper-dark/70 flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-3">
            <span>Powered by free Pexels &amp; Pixabay APIs</span>
            <span>&bull;</span>
            <span className="font-mono text-[10px]">{results.length} results</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-line bg-white hover:bg-paper text-ink text-xs font-semibold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

