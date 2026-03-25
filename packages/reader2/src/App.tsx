import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { BookLibrary } from "./pages/BookLibrary";
import { BookReader } from "./pages/BookReader";
import { type RootStore, RootStoreContext, initRootStore } from "./stores/RootStore";

const AppRouter: React.FC = observer(() => {
  return (
    <Switch>
      <Route path="/book/:bookId/:chapterIndex?" component={BookReader} />
      <Route path="/" component={BookLibrary} />
    </Switch>
  );
});

export function App() {
  const [store, setStore] = useState<RootStore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initRootStore()
      .then(setStore)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center text-red-600">
          <p className="font-semibold">Failed to initialize</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Initializing...</p>
      </div>
    );
  }

  return (
    <RootStoreContext value={store}>
      <AppRouter />
    </RootStoreContext>
  );
}
