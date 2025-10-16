import { Loader } from "lucide-react";
import { makeAutoObservable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { downloadWithProgress, type DownloadProgress } from "../lib/download";
import type { BookLibraryStore } from "../stores/BookLibraryStore";
import { useBookLibraryStore } from "../stores/RootStore";
import { formatBytes, formatPercent, formatSpeed } from "../utils/formatBytes";

type Phase = "confirm" | "downloading" | "adding" | "done" | "error";

export class AddBookPageStore {
  phase: Phase = "confirm";
  received = 0;
  total: number | undefined = undefined;
  speedBps = 0;
  errorMsg: string | null = null;
  filename = "";
  downloadUrl = "";

  constructor() {
    makeAutoObservable(this);
  }

  setDownloadUrl(url: string) {
    this.downloadUrl = url.trim();
  }

  async startDownload(
    bookLibraryStore: BookLibraryStore,
    navigate: (path: string, options?: { replace?: boolean }) => void,
  ) {
    if (!this.hasValidUrl) {
      this.errorMsg = this.urlValidationError ?? "Invalid download URL";
      this.phase = "error";
      return;
    }

    this.phase = "downloading";
    this.errorMsg = null;
    this.received = 0;
    this.total = undefined;
    this.speedBps = 0;

    try {
      const { blob, filename } = await downloadWithProgress(
        this.downloadUrl,
        (progress) => this.handleProgress(progress),
      );

      runInAction(() => {
        this.filename = filename ?? "download.epub";
        this.phase = "adding";
      });

      const file = new File([blob], filename ?? "download.epub", {
        type: blob.type || "application/epub+zip",
      });

      const bookId = await bookLibraryStore.ensureBook(file);

      runInAction(() => {
        this.phase = "done";
      });

      navigate(`/book/${bookId}`);
    } catch (error) {
      console.error("Failed to download and add book", error);
      runInAction(() => {
        this.errorMsg =
          error instanceof Error ? error.message : "Unknown download error";
        this.phase = "error";
      });
    }
  }

  reset() {
    this.phase = "confirm";
    this.received = 0;
    this.total = undefined;
    this.speedBps = 0;
    this.errorMsg = null;
    this.filename = "";
  }

  private handleProgress(progress: DownloadProgress) {
    runInAction(() => {
      this.received = progress.received;
      this.total = progress.total;
      this.speedBps = progress.speedBps;
    });
  }

  get hasValidUrl(): boolean {
    return this.urlValidationError === null;
  }

  get urlValidationError(): string | null {
    const value = this.downloadUrl;
    if (!value) {
      return "Missing url parameter.";
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "Only http/https URLs are supported.";
      }
    } catch {
      return "Invalid url parameter.";
    }
    return null;
  }

  get progressPercent(): string | null {
    return formatPercent(this.received, this.total);
  }

  get isWaitingForFileInfo(): boolean {
    return (
      this.phase === "downloading" &&
      this.received === 0 &&
      this.total === undefined
    );
  }
}

export const AddBookPage = observer(() => {
  const [location, navigate] = useLocation();
  const [store] = useState(() => new AddBookPageStore());
  const bookLibraryStore = useBookLibraryStore();

  // Parse URL and auto-start download
  useEffect(() => {
    const searchIndex = location.indexOf("?");
    const search =
      searchIndex >= 0 ? location.slice(searchIndex) : window.location.search;
    const params = new URLSearchParams(search);
    const url = params.get("url") ?? "";
    store.setDownloadUrl(url);

    // Auto-start download if URL is valid
    if (url && store.hasValidUrl) {
      void store.startDownload(bookLibraryStore, navigate);
    }
  }, [location, store, bookLibraryStore, navigate]);

  const handleTryAgain = () => {
    store.reset();
    void store.startDownload(bookLibraryStore, navigate);
  };

  if (store.urlValidationError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto p-8">
          <h1 className="text-xl font-semibold mb-4">Add book from URL</h1>
          <p className="text-sm text-red-600">{store.urlValidationError}</p>
          <button
            className="mt-6 px-4 py-2 bg-gray-200 rounded"
            onClick={() => navigate("/")}
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto p-8 space-y-6">
        {store.phase === "downloading" && (
          <>
            <h2 className="text-lg font-medium">Downloading…</h2>
            <div className="bg-blue-50/80 rounded p-3 space-y-2">
              {store.isWaitingForFileInfo ? (
                <div className="flex items-center gap-3 text-blue-800 text-sm">
                  <Loader className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Requesting file information…</span>
                </div>
              ) : (
                <>
                  <div className="h-2 bg-blue-200 rounded overflow-hidden">
                    {store.progressPercent ? (
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: store.progressPercent }}
                      />
                    ) : (
                      <div
                        className="h-full bg-blue-600 animate-pulse"
                        style={{ width: "40%" }}
                      />
                    )}
                  </div>
                  <ul className="text-sm text-blue-800 flex flex-wrap gap-4">
                    <li>
                      bytes: {formatBytes(store.received)}
                      {store.total ? ` / ${formatBytes(store.total)}` : ""}
                    </li>
                    <li>speed: {formatSpeed(store.speedBps)}</li>
                    <li>progress: {store.progressPercent ?? "—"}</li>
                  </ul>
                </>
              )}
            </div>
          </>
        )}

        {store.phase === "adding" && (
          <>
            <h2 className="text-lg font-medium">Adding to library…</h2>
            <p className="text-sm text-gray-600">{store.filename}</p>
          </>
        )}

        {store.phase === "error" && (
          <>
            <h2 className="text-lg font-semibold text-red-600">
              Download failed
            </h2>
            <p className="text-sm text-gray-600">{store.errorMsg}</p>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleTryAgain}
              >
                Try again
              </button>
              <button
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={() => navigate("/")}
              >
                Back to library
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
