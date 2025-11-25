import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { CommandPalette } from "../../command/CommandPalette";
import { ReaderHeader } from "../components/ReaderHeader";
import { markdownToReact } from "../markdownToReact";
import { CollectionReaderStore } from "../stores/CollectionReaderStore";
import {
  useCollectionStore,
  useCommandPaletteStore,
  useEventSystem,
  useTemplates,
} from "../stores/RootStore";
import { CollectionSidebar } from "./CollectionSidebar";
import { CollectionTableOfContents } from "./CollectionTableOfContents";

export const CollectionPage = observer(() => {
  const collectionStore = useCollectionStore();
  const [match, params] = useRoute("/collection/:collectionId/:filePath*");
  const [, navigate] = useLocation();
  const [renderedContent, setRenderedContent] = useState<React.ReactNode>(null);
  const readerContainerRef = useRef<HTMLDivElement>(null);
  const events = useEventSystem();
  const palette = useCommandPaletteStore();
  const templates = useTemplates();

  // Create a reader store instance for this collection
  const readerStore = useMemo(() => {
    if (!collectionStore) return null;
    return new CollectionReaderStore(
      collectionStore.getManager(),
      events,
      palette,
      templates,
    );
  }, [collectionStore, events, palette, templates]);

  // Navigate to a file and update URL
  const navigateToFile = async (filePath: string, headingId?: string) => {
    if (!readerStore || !params?.collectionId) return;
    await readerStore.loadFile(filePath);
    const url = `/collection/${params.collectionId}/${encodeURIComponent(filePath)}${headingId ? `#${headingId}` : ""}`;
    navigate(url, { replace: true });

    // Update current heading ID
    readerStore.setCurrentHeadingId(headingId || null);

    // Close sidebar when navigating to a heading
    if (headingId) {
      readerStore.setSidebarOpen(false);
    }

    // Scroll to heading if specified
    if (headingId) {
      setTimeout(() => {
        const element = document.getElementById(headingId);
        element?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  };

  // Setup event bindings for collection view
  useEffect(() => {
    if (!readerContainerRef.current || !readerStore || !readerStore.currentFile)
      return;

    const dispose = readerStore.setupBindings(
      "view",
      readerContainerRef.current,
    );
    return dispose;
  }, [readerStore, readerStore?.currentFile]);

  // Load collection when route matches
  useEffect(() => {
    const load = async () => {
      if (!match || !params?.collectionId || !collectionStore || !readerStore)
        return;

      const collectionId = Number(params.collectionId);
      const collection = await collectionStore.getCollection(collectionId);
      if (!collection) {
        console.error("Collection not found:", collectionId);
        return;
      }

      await collectionStore.updateLastOpened(collectionId);
      await readerStore.load(collectionId, collection);

      // Load specific file if provided in URL
      if (params.filePath) {
        await readerStore.loadFile(params.filePath);
      }
    };
    load();

    // Cleanup on unmount
    return () => {
      readerStore?.reset();
    };
  }, [
    match,
    params?.collectionId,
    params?.filePath,
    collectionStore,
    readerStore,
  ]);

  // Render markdown content when it changes
  useEffect(() => {
    const render = async () => {
      if (!readerStore?.currentFile?.content) {
        setRenderedContent(null);
        return;
      }
      const content = await markdownToReact(readerStore.currentFile.content, {
        type: "collection",
        readerStore,
      });
      setRenderedContent(content);

      // Scroll to hash fragment after content renders and update heading ID
      const hash = window.location.hash.slice(1);
      if (hash) {
        readerStore.setCurrentHeadingId(hash);
        setTimeout(() => {
          const element = document.getElementById(hash);
          element?.scrollIntoView({ behavior: "auto" });
        }, 100);
      } else {
        readerStore.setCurrentHeadingId(null);
      }
    };
    render();
  }, [readerStore?.currentFile?.content, readerStore]);

  // Check if current file is a media file
  const currentFileIsMedia = useMemo(() => {
    if (!readerStore?.currentFilePath) return false;
    return readerStore.mediaFiles.some(
      (f) => f.filePath === readerStore.currentFilePath,
    );
  }, [readerStore?.currentFilePath, readerStore?.mediaFiles]);

  // Load media file URL
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  useEffect(() => {
    const loadMediaUrl = async () => {
      if (!currentFileIsMedia || !readerStore?.currentFilePath) {
        setMediaUrl(null);
        return;
      }
      const url = await readerStore.getImageUrl(readerStore.currentFilePath);
      setMediaUrl(url);
    };
    loadMediaUrl();
  }, [currentFileIsMedia, readerStore?.currentFilePath, readerStore]);

  if (!match || !readerStore) {
    return null;
  }

  const { collection, currentFile, isLoading, hasNextFile, hasPreviousFile } =
    readerStore;

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">
          {isLoading ? "Loading..." : "Collection not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="min-h-screen">
        <div className="min-h-full flex justify-center relative">
          <div className="max-w-4xl w-full relative">
            {/* Sticky anchor for sidebar positioning */}
            <div className="sticky top-0 h-0 relative z-50">
              <CollectionSidebar
                store={readerStore}
                collectionStore={collectionStore}
              >
                <CollectionTableOfContents
                  store={readerStore}
                  onNavigate={navigateToFile}
                />
              </CollectionSidebar>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              <div className="collection-reader" ref={readerContainerRef}>
                {/* File Navigation */}
                <ReaderHeader
                  title={
                    currentFileIsMedia
                      ? readerStore.currentFilePath || "Loading..."
                      : currentFile?.title || "Loading..."
                  }
                  subtitle={collection.name}
                  hasPrevious={hasPreviousFile}
                  hasNext={hasNextFile}
                  onPrevious={async () => {
                    const prevFile =
                      readerStore.files[readerStore.currentFileIndex - 1];
                    if (prevFile) await navigateToFile(prevFile.filePath);
                  }}
                  onNext={async () => {
                    const nextFile =
                      readerStore.files[readerStore.currentFileIndex + 1];
                    if (nextFile) await navigateToFile(nextFile.filePath);
                  }}
                  progress={{
                    current: readerStore.currentFileIndex + 1,
                    total: readerStore.files.length,
                    label: "File",
                  }}
                  onToggleSidebar={() => readerStore.setSidebarOpen(true)}
                />

                {/* Content */}
                {currentFileIsMedia && mediaUrl ? (
                  <div className="flex justify-center items-center py-8">
                    <img
                      src={mediaUrl}
                      alt={readerStore.currentFilePath || "Media file"}
                      className="max-w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                ) : (
                  currentFile && (
                    <article className="prose prose-gray max-w-none break-words [&_pre]:overflow-x-auto">
                      {renderedContent}
                    </article>
                  )
                )}

                {isLoading && (
                  <div className="text-center py-8 text-gray-500">
                    Loading...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette />
    </div>
  );
});
