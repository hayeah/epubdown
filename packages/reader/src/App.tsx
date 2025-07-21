import { AppRouter } from "./Router";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const App = () => {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
};
