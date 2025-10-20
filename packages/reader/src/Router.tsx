import { Route, Router, Switch } from "wouter";
import CommandPalettePage from "../pages/CommandPalettePage";
import { UploadErrorsPrototype } from "../prototype/UploadErrors";
import { Library } from "./Library";
import { ReaderPage } from "./ReaderPage";
import { NotFound } from "./components/NotFound";
import { PdfPage } from "./pdf/PdfPage";
import { PdfViewerHPPage } from "./pdf-viewer/PdfViewerHPPage";

export function AppRouter() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={Library} />
        <Route path="/book/:bookId/:chapterIndex?" component={ReaderPage} />
        <Route path="/pdf/:bookId" component={PdfPage} />
        <Route path="/pdf-hp/:bookId" component={PdfViewerHPPage} />
        <Route
          path="/prototype/upload-errors"
          component={UploadErrorsPrototype}
        />
        <Route
          path="/prototype/command-palette"
          component={CommandPalettePage}
        />
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </Router>
  );
}
