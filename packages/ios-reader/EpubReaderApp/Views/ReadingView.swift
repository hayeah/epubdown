import SwiftUI
import UIKit

struct ReadingView: View {
    @Environment(AppState.self) private var appState
    let bridge: EPUBBridge
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var screenSize: CGSize = UIScreen.main.bounds.size

    var body: some View {
        ZStack {
            if let session = appState.sessions.first {
                // WebView with explicit screen-sized frame
                ChapterWebView(session: session, bridge: bridge)
                    .frame(width: screenSize.width, height: screenSize.height)
                    .position(x: screenSize.width / 2, y: screenSize.height / 2)

                // Bottom bar explicitly positioned
                if session.isBottomBarVisible {
                    BottomBar(session: session) {
                        await navigateChapter(delta: -1)
                    } onNext: {
                        await navigateChapter(delta: 1)
                    } onLibrary: {
                        appState.isLibraryVisible = true
                    }
                    .frame(width: screenSize.width)
                    .position(x: screenSize.width / 2, y: screenSize.height - 60)
                }
            }

            if isLoading {
                Color.black.opacity(0.3)
                    .frame(width: screenSize.width, height: screenSize.height)
                    .position(x: screenSize.width / 2, y: screenSize.height / 2)
                    .overlay {
                        ProgressView("Loading...")
                            .tint(.white)
                            .foregroundStyle(.white)
                    }
            }

            if let error = errorMessage {
                VStack(spacing: 12) {
                    Text("Error").font(.headline)
                    Text(error).font(.caption).foregroundStyle(.secondary)
                    Button("Retry") {
                        errorMessage = nil
                        loadBook()
                    }
                }
                .padding()
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .ignoresSafeArea()
        .onChange(of: bridge.isReady) { _, ready in
            if ready { loadBook() }
        }
        .onAppear {
            if appState.sessions.isEmpty {
                let session = appState.openBook(filename: "Alice's Adventures in Wonderland.epub")
                session.currentChapterIndex = 1
            }
        }
    }

    private func loadBook() {
        guard let session = appState.sessions.first else { return }
        isLoading = true
        errorMessage = nil

        Task {
            do {
                let handle = try await bridge.loadBook(from: session.bookURL)
                session.bookHandle = handle

                let meta = try await bridge.getMetadata(handle: handle)
                session.bookTitle = meta["title"] ?? session.bookFilename
                session.bookAuthor = meta["creator"] ?? ""
                session.chapterCount = try await bridge.getChapterCount(handle: handle)

                try await bridge.renderChapter(handle: handle, index: session.currentChapterIndex)
                isLoading = false
            } catch {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }

    private func navigateChapter(delta: Int) async {
        guard let session = appState.sessions.first,
              let handle = session.bookHandle else { return }
        let newIndex = session.currentChapterIndex + delta
        guard newIndex >= 0, newIndex < session.chapterCount else { return }
        session.currentChapterIndex = newIndex
        try? await bridge.renderChapter(handle: handle, index: newIndex)
    }
}
