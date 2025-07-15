import { Route, Router, Switch } from "wouter";
import { BookLibraryPage } from "./BookLibraryPage";
import { ReaderPage } from "./ReaderPage";
import { NotFound } from "./components/NotFound";

export function AppRouter() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={BookLibraryPage} />
        <Route path="/book/:bookId/:chapterIndex?" component={ReaderPage} />
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </Router>
  );
}
