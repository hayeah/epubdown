import Foundation
import WebKit

/// Wraps JS bridge calls to window.epubBridge via a WKWebView.
/// Uses callAsyncJavaScript which natively handles Promise results.
@Observable
final class EPUBBridge {
    var webView: WKWebView?
    var isReady = false

    /// Run async JS and return the result. Handles Promises automatically.
    private func callAsync(_ js: String) async throws -> Any? {
        guard let webView = webView else { throw BridgeError.noWebView }
        return try await webView.callAsyncJavaScript(
            js, arguments: [:], contentWorld: .page
        )
    }

    func loadBook(from url: URL) async throws -> Int {
        let js = """
        const r = await fetch("\(url.absoluteString)");
        const b = await r.arrayBuffer();
        const h = await window.epubBridge.loadBook(b);
        return h;
        """
        let result = try await callAsync(js)
        // callAsyncJavaScript returns NSNumber for JS numbers
        if let num = result as? NSNumber { return num.intValue }
        if let num = result as? Int { return num }
        throw BridgeError.unexpectedResult
    }

    func getMetadata(handle: Int) async throws -> [String: String] {
        let js = "return JSON.stringify(await window.epubBridge.getMetadata(\(handle)));"
        let result = try await callAsync(js)
        guard let jsonStr = result as? String,
              let data = jsonStr.data(using: .utf8),
              let dict = try JSONSerialization.jsonObject(with: data) as? [String: String] else {
            throw BridgeError.unexpectedResult
        }
        return dict
    }

    func getChapterCount(handle: Int) async throws -> Int {
        let js = "return window.epubBridge.getChapterCount(\(handle));"
        let result = try await callAsync(js)
        if let num = result as? NSNumber { return num.intValue }
        if let num = result as? Int { return num }
        throw BridgeError.unexpectedResult
    }

    func renderChapter(handle: Int, index: Int) async throws {
        let js = "await window.epubBridge.renderChapter(\(handle), \(index));"
        _ = try await callAsync(js)
    }

    func setScrollFraction(_ fraction: Double) async throws {
        guard let webView = webView else { throw BridgeError.noWebView }
        _ = try await webView.evaluateJavaScript("window.setScrollFraction(\(fraction))")
    }

    func takeScreenshot() async throws -> Data {
        guard let webView = webView else { throw BridgeError.noWebView }
        let config = WKSnapshotConfiguration()
        let image = try await webView.takeSnapshot(configuration: config)
        guard let pngData = image.pngData() else { throw BridgeError.screenshotFailed }
        return pngData
    }

    func getTOC(handle: Int) async throws -> [[String: Any]] {
        let js = "return JSON.stringify(await window.epubBridge.getTOC(\(handle)));"
        let result = try await callAsync(js)
        guard let jsonStr = result as? String,
              let data = jsonStr.data(using: .utf8),
              let arr = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            throw BridgeError.unexpectedResult
        }
        return arr
    }
}

enum BridgeError: Error, LocalizedError {
    case noWebView
    case unexpectedResult
    case screenshotFailed

    var errorDescription: String? {
        switch self {
        case .noWebView: return "WebView not available"
        case .unexpectedResult: return "Unexpected result from JS bridge"
        case .screenshotFailed: return "Failed to capture screenshot"
        }
    }
}
