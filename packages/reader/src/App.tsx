import { AppRouter } from "./Router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Keymap } from "./components/Keymap";

export const App = () => {
  return (
    <ErrorBoundary>
      <Keymap>
        <AppRouter />
      </Keymap>
    </ErrorBoundary>
  );
};
