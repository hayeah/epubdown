export function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">404 - Page Not Found</h1>
        <a href="/" className="text-blue-500 hover:underline">
          Back to Library
        </a>
      </div>
    </div>
  );
}
