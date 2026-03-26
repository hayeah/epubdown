import Foundation
import Capacitor

/// Capacitor plugin that handles iOS security-scoped directory access.
/// Picks directories, persists access via bookmarks, and reads files
/// within the security scope.
@objc(SecureDirectoryPlugin)
public class SecureDirectoryPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "SecureDirectoryPlugin"
    public let jsName = "SecureDirectory"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickDirectory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listBookmarks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBookmark", returnType: CAPPluginReturnPromise),
    ]

    private var pickCall: CAPPluginCall?

    // MARK: - Pick Directory

    @objc func pickDirectory(_ call: CAPPluginCall) {
        self.pickCall = call
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickCall, let url = urls.first else { return }
        pickCall = nil

        guard url.startAccessingSecurityScopedResource() else {
            call.reject("Failed to access security-scoped resource")
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        // Create a bookmark for persistent access
        do {
            let bookmarkData = try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            let bookmarkId = UUID().uuidString
            let key = "bookmark_\(bookmarkId)"
            UserDefaults.standard.set(bookmarkData, forKey: key)

            let name = url.lastPathComponent
            call.resolve([
                "bookmarkId": bookmarkId,
                "name": name,
                "path": url.path,
            ])
        } catch {
            call.reject("Failed to create bookmark: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickCall?.reject("User cancelled", "CANCELLED")
        pickCall = nil
    }

    // MARK: - List Files

    @objc func listFiles(_ call: CAPPluginCall) {
        guard let bookmarkId = call.getString("bookmarkId") else {
            call.reject("Missing bookmarkId")
            return
        }
        let subpath = call.getString("path") ?? ""

        guard let url = resolveBookmark(bookmarkId) else {
            call.reject("Bookmark not found or stale")
            return
        }

        guard url.startAccessingSecurityScopedResource() else {
            call.reject("Failed to access security-scoped resource")
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        let targetURL = subpath.isEmpty ? url : url.appendingPathComponent(subpath)

        do {
            let contents = try FileManager.default.contentsOfDirectory(
                at: targetURL,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey, .nameKey],
                options: [.skipsHiddenFiles]
            )

            var files: [[String: Any]] = []
            for item in contents {
                let resourceValues = try item.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey])
                let isDir = resourceValues.isDirectory ?? false
                let size = resourceValues.fileSize ?? 0
                let mtime = resourceValues.contentModificationDate?.timeIntervalSince1970 ?? 0

                files.append([
                    "name": item.lastPathComponent,
                    "type": isDir ? "directory" : "file",
                    "size": size,
                    "mtime": Int(mtime * 1000), // ms to match JS Date.now()
                ])
            }

            call.resolve(["files": files])
        } catch {
            call.reject("Failed to list directory: \(error.localizedDescription)")
        }
    }

    // MARK: - Read File

    @objc func readFile(_ call: CAPPluginCall) {
        guard let bookmarkId = call.getString("bookmarkId") else {
            call.reject("Missing bookmarkId")
            return
        }
        guard let path = call.getString("path") else {
            call.reject("Missing path")
            return
        }

        guard let url = resolveBookmark(bookmarkId) else {
            call.reject("Bookmark not found or stale")
            return
        }

        guard url.startAccessingSecurityScopedResource() else {
            call.reject("Failed to access security-scoped resource")
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        let fileURL = url.appendingPathComponent(path)

        do {
            let data = try Data(contentsOf: fileURL)
            let base64 = data.base64EncodedString()
            call.resolve(["data": base64])
        } catch {
            call.reject("Failed to read file: \(error.localizedDescription)")
        }
    }

    // MARK: - List Bookmarks

    @objc func listBookmarks(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        let allKeys = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix("bookmark_") }
        var bookmarks: [[String: Any]] = []

        for key in allKeys {
            let bookmarkId = String(key.dropFirst("bookmark_".count))
            if let url = resolveBookmark(bookmarkId) {
                bookmarks.append([
                    "bookmarkId": bookmarkId,
                    "name": url.lastPathComponent,
                    "path": url.path,
                ])
            }
        }

        call.resolve(["bookmarks": bookmarks])
    }

    // MARK: - Remove Bookmark

    @objc func removeBookmark(_ call: CAPPluginCall) {
        guard let bookmarkId = call.getString("bookmarkId") else {
            call.reject("Missing bookmarkId")
            return
        }
        UserDefaults.standard.removeObject(forKey: "bookmark_\(bookmarkId)")
        call.resolve()
    }

    // MARK: - Helpers

    private func resolveBookmark(_ bookmarkId: String) -> URL? {
        let key = "bookmark_\(bookmarkId)"
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }

        var isStale = false
        guard let url = try? URL(
            resolvingBookmarkData: data,
            options: [],
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        ) else { return nil }

        // Refresh bookmark if stale
        if isStale {
            if let newData = try? url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            ) {
                UserDefaults.standard.set(newData, forKey: key)
            }
        }

        return url
    }
}
