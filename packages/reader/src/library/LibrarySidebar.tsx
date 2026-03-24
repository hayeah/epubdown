import { FolderOpen, Plus, Star, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import type { LibraryConfig } from "../lib/LibraryStore";
import { useLibraryRegistry } from "../stores/RootStore";

export const LibrarySidebar = observer(() => {
  const registry = useLibraryRegistry();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAddLibrary = async () => {
    if (!newName.trim()) return;
    try {
      const lib = await registry.addFilesystemLibrary(newName.trim());
      registry.switchLibrary(lib.id);
      setNewName("");
      setIsAdding(false);
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
        {isAdding ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddLibrary();
                if (e.key === "Escape") setIsAdding(false);
              }}
              placeholder="Library name..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleAddLibrary}
                disabled={!newName.trim()}
                className="flex-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add Folder
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Library</span>
          </button>
        )}
      </div>
    </aside>
  );
});
