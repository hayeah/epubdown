import { Route, Router, Switch } from "wouter";
import { Library } from "./Library";
import { ReaderPage } from "./ReaderPage";
import { NotFound } from "./components/NotFound";

export function AppRouter() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={Library} />
        <Route path="/book/:bookId/:chapterIndex?" component={ReaderPage} />
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </Router>
  );
}
