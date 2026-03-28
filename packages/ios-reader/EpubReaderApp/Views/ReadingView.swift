import SwiftUI

struct ReadingView: View {
  @Environment(AppState.self) private var appState
  let bridge: EPUBBridge
  @State private var isLoading = true
  @State private var errorMessage: String?

  var body: some View {
    Group {
      if let session = appState.sessions.first {
        ChapterWebView(session: session, bridge: bridge)
      } else {
        Color(.systemBackground)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .safeAreaInset(edge: .bottom, spacing: 0) {
      if let session = appState.sessions.first, session.isBottomBarVisible {
          BottomBar(session: session) {
            await navigateChapter(delta: -1)
          } onNext: {
            await navigateChapter(delta: 1)
          } onLibrary: {
            appState.isLibraryVisible = true
          }
          .background(.ultraThinMaterial)
        }
      }
      .onChange(of: bridge.isReady) { _, ready in
        if ready { loadBook() }
      }
      .onAppear {
        if appState.sessions.isEmpty {
          let session = appState.openBook(filename: "Alice's Adventures in Wonderland.epub")
          session.currentChapterIndex = 3
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
      let handle = session.bookHandle
    else { return }
    let newIndex = session.currentChapterIndex + delta
    guard newIndex >= 0, newIndex < session.chapterCount else { return }
    session.currentChapterIndex = newIndex
    try? await bridge.renderChapter(handle: handle, index: newIndex)
  }
}
