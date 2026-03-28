import SwiftUI

@main
struct EpubReaderApp: App {
    @State private var appState = AppState()
    @State private var bridge = EPUBBridge()
    @State private var agent: AgentConnection?

    var body: some Scene {
        WindowGroup {
            ReadingView(bridge: bridge)
                .environment(appState)
                .onAppear {
                    #if DEBUG
                    let conn = AgentConnection(appState: appState, bridge: bridge)
                    conn.connect(host: appState.agentHost, port: UInt16(appState.agentPort))
                    agent = conn
                    #endif
                }
        }
    }
}
