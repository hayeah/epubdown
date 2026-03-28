import SwiftUI

struct BottomBar: View {
    let session: ReadingSession
    var onPrevious: () async -> Void
    var onNext: () async -> Void
    var onLibrary: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            // Library button
            Button(action: onLibrary) {
                Image(systemName: "books.vertical")
                    .font(.system(size: 18))
            }

            Spacer()

            // Previous chapter
            Button {
                Task { await onPrevious() }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
            }
            .disabled(!session.hasPreviousChapter)

            // Chapter info
            VStack(spacing: 2) {
                Text(session.bookTitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text("Chapter \(session.currentChapterIndex + 1) of \(session.chapterCount)")
                    .font(.caption)
                    .fontWeight(.medium)
            }

            // Next chapter
            Button {
                Task { await onNext() }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
            }
            .disabled(!session.hasNextChapter)

            Spacer()

            // Spacer to balance the library button
            Color.clear.frame(width: 18)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 12)
    }
}
