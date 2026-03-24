import { FolderOpen, Plus, Star, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import type { LibraryConfig } from "../lib/LibraryStore";
import { useLibraryRegistry } from "../stores/RootStore";

export const LibrarySidebar = observer(() => {
  const registry = useLibraryRegistry();

  const handleAddLibrary = async () => {
    try {
      const lib = await registry.addFilesystemLibrary();
      registry.switchLibrary(lib.id);
    } catch (e) {
      // User cancelled the directory picker
      console.error("Failed to add library:", e);
    }
  };

  const handleRemove = async (lib: LibraryConfig) => {
    if (
      !confirm(
        `Remove library "${lib.name}"? Books won't be deleted from disk.`,
      )
    )
      return;
    await registry.removeLibrary(lib.id);
  };

  return (
    <aside className="w-56 shrink-0 bg-gray-100 border-r border-gray-200 flex flex-col h-full">
      <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Libraries
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {registry.libraries.map((lib) => (
          <button
            key={lib.id}
            type="button"
            onClick={() => registry.switchLibrary(lib.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors group ${
              registry.activeLibraryId === lib.id
                ? "bg-blue-100 text-blue-800 font-medium"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            {lib.type === "indexeddb" ? (
              <Star className="w-4 h-4 shrink-0 text-amber-500" />
            ) : (
              <FolderOpen className="w-4 h-4 shrink-0 text-gray-400" />
            )}
            <span className="truncate flex-1 text-left">{lib.name}</span>
            {lib.id !== "default" && (
              <span
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(lib);
                }}
                onKeyDown={() => {}}
                role="button"
                tabIndex={-1}
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-2 pb-3 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={handleAddLibrary}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Library</span>
        </button>
      </div>
    </aside>
  );
});
