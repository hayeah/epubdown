import Foundation

@Observable
final class ReadingSession: NSObject, Identifiable {
    let id = UUID()
    let bookFilename: String
    let bookServerURL: String

    @objc dynamic var currentChapterIndex: Int = 0
    @objc dynamic var scrollFraction: Double = 0.0
    @objc dynamic var chapterCount: Int = 0
    @objc dynamic var bookTitle: String = ""
    @objc dynamic var bookAuthor: String = ""
    @objc dynamic var currentChapterTitle: String = ""
    @objc dynamic var isBottomBarVisible: Bool = true
    @objc dynamic var isChapterSwitcherVisible: Bool = false

    /// JS bridge book handle (set after loading)
    var bookHandle: Int?

    init(bookFilename: String, bookServerURL: String) {
        self.bookFilename = bookFilename
        self.bookServerURL = bookServerURL
    }

    var bookURL: URL {
        let encoded = bookFilename.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? bookFilename
        return URL(string: "\(bookServerURL)/books/\(encoded)")!
    }

    var hasNextChapter: Bool { currentChapterIndex < chapterCount - 1 }
    var hasPreviousChapter: Bool { currentChapterIndex > 0 }

    func setValueAtPath(_ path: String, value: Any) {
        switch path {
        case "currentChapterIndex":
            if let v = value as? Int { currentChapterIndex = v }
        case "scrollFraction":
            if let v = value as? Double { scrollFraction = v }
        case "isBottomBarVisible":
            if let v = value as? Bool { isBottomBarVisible = v }
        case "isChapterSwitcherVisible":
            if let v = value as? Bool { isChapterSwitcherVisible = v }
        default:
            break
        }
    }

    func toJSON() -> [String: Any] {
        return [
            "id": id.uuidString,
            "bookFilename": bookFilename,
            "bookTitle": bookTitle,
            "bookAuthor": bookAuthor,
            "currentChapterIndex": currentChapterIndex,
            "scrollFraction": scrollFraction,
            "chapterCount": chapterCount,
            "currentChapterTitle": currentChapterTitle,
            "isBottomBarVisible": isBottomBarVisible,
            "isChapterSwitcherVisible": isChapterSwitcherVisible,
        ]
    }
}
