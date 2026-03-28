import Foundation

@Observable
final class AppState: NSObject {
    @objc dynamic var sessions: [ReadingSession] = []
    @objc dynamic var isLibraryVisible = false

    // Library
    @objc dynamic var librarySearchQuery = ""
    @objc dynamic var bookServerURL = "http://localhost:8765"

    // Agent
    @objc dynamic var agentHost = "localhost"
    @objc dynamic var agentPort: Int = 9876

    // ── Actions ──

    func openBook(filename: String, serverURL: String? = nil) -> ReadingSession {
        let session = ReadingSession(
            bookFilename: filename,
            bookServerURL: serverURL ?? bookServerURL
        )
        sessions.append(session)
        return session
    }

    func closeSession(_ id: UUID) {
        sessions.removeAll { $0.id == id }
    }

    /// KVC path walker for agent API
    func setValueAtPath(_ path: String, value: Any) {
        // For simple top-level properties, KVC works directly
        // For nested paths like "sessions.0.currentChapterIndex",
        // we need to walk manually since NSArray KVC differs from Swift arrays
        let parts = path.split(separator: ".").map(String.init)
        guard let first = parts.first else { return }

        if first == "sessions", parts.count >= 3, let idx = Int(parts[1]) {
            guard idx < sessions.count else { return }
            let subPath = parts.dropFirst(2).joined(separator: ".")
            sessions[idx].setValueAtPath(subPath, value: value)
            return
        }

        // Direct KVC for top-level properties
        setValue(value, forKey: first)
    }

    /// Encode full state as JSON for agent get_state
    func toJSON() -> [String: Any] {
        return [
            "sessions": sessions.map { $0.toJSON() },
            "isLibraryVisible": isLibraryVisible,
            "librarySearchQuery": librarySearchQuery,
            "bookServerURL": bookServerURL,
        ]
    }
}
