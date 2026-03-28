import SwiftUI
import WebKit

struct ChapterWebView: UIViewRepresentable {
  let session: ReadingSession
  let bridge: EPUBBridge

  func makeCoordinator() -> Coordinator {
    Coordinator(session: session, bridge: bridge)
  }

  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    let userContent = config.userContentController

    userContent.add(context.coordinator, name: "scroll")
    userContent.add(context.coordinator, name: "link")
    userContent.add(context.coordinator, name: "ready")

    let webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = context.coordinator
    webView.scrollView.contentInsetAdjustmentBehavior = .never

    // Store reference on the shared bridge
    bridge.webView = webView

    // Load the bridge HTML from bundle, or fall back to dev server
    if let bridgeURL = Bundle.main.url(
      forResource: "index", withExtension: "html", subdirectory: "WebContent")
    {
      webView.loadFileURL(bridgeURL, allowingReadAccessTo: bridgeURL.deletingLastPathComponent())
    } else {
      webView.load(URLRequest(url: URL(string: "http://localhost:5190")!))
    }

    return webView
  }

  func updateUIView(_ webView: WKWebView, context: Context) {
    context.coordinator.session = session
  }

  class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var session: ReadingSession
    let bridge: EPUBBridge

    init(session: ReadingSession, bridge: EPUBBridge) {
      self.session = session
      self.bridge = bridge
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
        self?.bridge.isReady = true
      }
    }

    func userContentController(
      _ controller: WKUserContentController,
      didReceive message: WKScriptMessage
    ) {
      switch message.name {
      case "scroll":
        if let body = message.body as? [String: Any],
          let fraction = body["fraction"] as? Double
        {
          session.scrollFraction = fraction
        }
      case "link":
        if let body = message.body as? [String: Any],
          let href = body["href"] as? String
        {
          print("[link] \(href)")
        }
      case "ready":
        bridge.isReady = true
      default:
        break
      }
    }
  }
}
