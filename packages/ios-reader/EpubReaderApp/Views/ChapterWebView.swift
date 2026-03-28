import SwiftUI
import WebKit

struct ChapterWebView: UIViewRepresentable {
    let session: ReadingSession
    let bridge: EPUBBridge

    func makeCoordinator() -> Coordinator {
        Coordinator(session: session, bridge: bridge)
    }

    func makeUIView(context: Context) -> UIView {
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

        // Wrap in a container UIView with Auto Layout constraints
        // so the WKWebView fills the available space
        let container = UIView()
        container.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])

        // Load the bridge HTML from bundle, or fall back to dev server
        if let bridgeURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebContent") {
            webView.loadFileURL(bridgeURL, allowingReadAccessTo: bridgeURL.deletingLastPathComponent())
        } else {
            webView.load(URLRequest(url: URL(string: "http://localhost:5190")!))
        }

        return container
    }

    func updateUIView(_ container: UIView, context: Context) {
        context.coordinator.session = session
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UIView, context: Context) -> CGSize? {
        guard let width = proposal.width, let height = proposal.height else { return nil }
        return CGSize(width: width, height: height)
    }

    class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var session: ReadingSession
        let bridge: EPUBBridge

        init(session: ReadingSession, bridge: EPUBBridge) {
            self.session = session
            self.bridge = bridge
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Page loaded — wait a moment for JS to initialize, then mark ready
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.bridge.isReady = true
            }
        }

        func userContentController(_ controller: WKUserContentController,
                                    didReceive message: WKScriptMessage) {
            switch message.name {
            case "scroll":
                if let body = message.body as? [String: Any],
                   let fraction = body["fraction"] as? Double {
                    session.scrollFraction = fraction
                }
            case "link":
                if let body = message.body as? [String: Any],
                   let href = body["href"] as? String {
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
