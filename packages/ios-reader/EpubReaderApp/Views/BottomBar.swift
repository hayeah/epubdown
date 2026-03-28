import SwiftUI

struct BottomBar: View {
    let session: ReadingSession
    var onPrevious: () async -> Void
    var onNext: () async -> Void
    var onLibrary: () -> Void

    var body: some View {
        HStack {
            Button(action: onLibrary) {
                Image(systemName: "book")
            }

            Spacer()

            Button {
                Task { await onPrevious() }
            } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(!session.hasPreviousChapter)

            Spacer()

            Text("Chapter \(session.currentChapterIndex + 1) of \(session.chapterCount)")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Spacer()

            Button {
                Task { await onNext() }
            } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(!session.hasNextChapter)

            Spacer()

            Button {} label: {
                Image(systemName: "textformat.size")
            }
        }
        .buttonStyle(.plain)
        .font(.system(size: 20))
        .foregroundStyle(.primary)
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
    }
}
