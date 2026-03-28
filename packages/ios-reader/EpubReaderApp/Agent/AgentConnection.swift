import Foundation
import Network

/// TCP client that connects to the agent relay server.
/// Handles JSONL protocol for remote state inspection and manipulation.
final class AgentConnection {
    let appState: AppState
    let bridge: EPUBBridge
    private var connection: NWConnection?
    private var buffer = ""

    init(appState: AppState, bridge: EPUBBridge) {
        self.appState = appState
        self.bridge = bridge
    }

    func connect(host: String, port: UInt16) {
        let endpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host(host),
            port: NWEndpoint.Port(rawValue: port)!
        )
        let conn = NWConnection(to: endpoint, using: .tcp)

        conn.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                print("[agent] Connected to \(host):\(port)")
                let msg = #"{"type":"register","role":"app"}"# + "\n"
                conn.send(content: msg.data(using: .utf8), completion: .idempotent)
                self?.receiveLoop(conn)
            case .failed(let error):
                print("[agent] Connection failed: \(error)")
            case .waiting(let error):
                print("[agent] Waiting: \(error)")
            default:
                break
            }
        }

        conn.start(queue: .main)
        self.connection = conn
    }

    func disconnect() {
        connection?.cancel()
        connection = nil
    }

    // MARK: - Receive

    private func receiveLoop(_ conn: NWConnection) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            if let data = data, let str = String(data: data, encoding: .utf8) {
                self?.buffer.append(str)
                self?.processBuffer()
            }
            if isComplete {
                print("[agent] Connection closed by server")
            } else if error == nil {
                self?.receiveLoop(conn)
            }
        }
    }

    private func processBuffer() {
        let lines = buffer.split(separator: "\n", omittingEmptySubsequences: false)
        buffer = String(lines.last ?? "")

        for line in lines.dropLast() {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { continue }
            handleMessage(trimmed)
        }
    }

    // MARK: - Message Handling

    private func handleMessage(_ json: String) {
        guard let data = json.data(using: .utf8),
              let msg = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = msg["type"] as? String,
              let id = msg["id"] as? String else {
            return
        }

        Task { @MainActor in
            switch type {
            case "get_state":
                let state = appState.toJSON()
                sendResponse(id: id, type: "state", data: state)

            case "set":
                if let path = msg["path"] as? String {
                    let value = msg["value"] as Any
                    appState.setValueAtPath(path, value: value)

                    if path.hasSuffix("currentChapterIndex"),
                       let session = appState.sessions.first,
                       let handle = session.bookHandle {
                        try? await bridge.renderChapter(handle: handle, index: session.currentChapterIndex)
                    }

                    sendResponse(id: id, type: "ok")
                }

            case "screenshot":
                do {
                    let pngData = try await bridge.takeScreenshot()
                    let base64 = pngData.base64EncodedString()
                    let size = bridge.webView?.bounds.size ?? .zero
                    sendResponse(id: id, type: "screenshot", extra: [
                        "data": base64,
                        "format": "png",
                        "width": Int(size.width),
                        "height": Int(size.height),
                    ])
                } catch {
                    sendError(id: id, message: error.localizedDescription)
                }

            case "action":
                if let name = msg["name"] as? String {
                    await handleAction(id: id, name: name, params: msg["params"] as? [String: Any])
                }

            case "preset":
                if let name = msg["name"] as? String {
                    loadPreset(name)
                    sendResponse(id: id, type: "ok")
                }

            default:
                sendError(id: id, message: "Unknown message type: \(type)")
            }
        }
    }

    // MARK: - Actions

    private func handleAction(id: String, name: String, params: [String: Any]?) async {
        switch name {
        case "openBook":
            if let filename = params?["filename"] as? String {
                let session = appState.openBook(filename: filename)
                if bridge.isReady {
                    do {
                        let handle = try await bridge.loadBook(from: session.bookURL)
                        session.bookHandle = handle
                        let meta = try await bridge.getMetadata(handle: handle)
                        session.bookTitle = meta["title"] ?? filename
                        session.bookAuthor = meta["creator"] ?? ""
                        session.chapterCount = try await bridge.getChapterCount(handle: handle)
                        let chapter = (params?["chapter"] as? Int) ?? 0
                        session.currentChapterIndex = chapter
                        try await bridge.renderChapter(handle: handle, index: chapter)
                        sendResponse(id: id, type: "ok", extra: ["sessionIndex": 0])
                    } catch {
                        sendError(id: id, message: error.localizedDescription)
                    }
                } else {
                    sendError(id: id, message: "Bridge not ready")
                }
            }

        case "nextChapter":
            if let session = appState.sessions.first,
               let handle = session.bookHandle,
               session.hasNextChapter {
                session.currentChapterIndex += 1
                try? await bridge.renderChapter(handle: handle, index: session.currentChapterIndex)
                sendResponse(id: id, type: "ok")
            } else {
                sendError(id: id, message: "Cannot navigate")
            }

        case "previousChapter":
            if let session = appState.sessions.first,
               let handle = session.bookHandle,
               session.hasPreviousChapter {
                session.currentChapterIndex -= 1
                try? await bridge.renderChapter(handle: handle, index: session.currentChapterIndex)
                sendResponse(id: id, type: "ok")
            } else {
                sendError(id: id, message: "Cannot navigate")
            }

        case "goToChapter":
            if let session = appState.sessions.first,
               let handle = session.bookHandle,
               let index = params?["chapterIndex"] as? Int,
               index >= 0, index < session.chapterCount {
                session.currentChapterIndex = index
                try? await bridge.renderChapter(handle: handle, index: index)
                sendResponse(id: id, type: "ok")
            } else {
                sendError(id: id, message: "Invalid chapter index")
            }

        default:
            sendError(id: id, message: "Unknown action: \(name)")
        }
    }

    // MARK: - Presets

    private func loadPreset(_ name: String) {
        switch name {
        case "emptyLibrary":
            appState.sessions.removeAll()
            appState.isLibraryVisible = true

        case "readingAlice":
            appState.sessions.removeAll()
            let _ = appState.openBook(filename: "Alice's Adventures in Wonderland.epub")

        default:
            print("[agent] Unknown preset: \(name)")
        }
    }

    // MARK: - Send

    private func sendResponse(id: String, type: String, data: Any? = nil, extra: [String: Any]? = nil) {
        var msg: [String: Any] = ["id": id, "type": type]
        if let data = data { msg["data"] = data }
        if let extra = extra { msg.merge(extra) { _, new in new } }
        sendJSON(msg)
    }

    private func sendError(id: String, message: String) {
        sendJSON(["id": id, "type": "error", "message": message])
    }

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str = String(data: data, encoding: .utf8) else { return }
        let line = str + "\n"
        connection?.send(content: line.data(using: .utf8), completion: .idempotent)
    }
}
