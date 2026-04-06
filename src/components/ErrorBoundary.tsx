import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    const errorMsg = this.state.error?.message?.toLowerCase() ?? "";
    const isFetchError =
      errorMsg.includes("failed to fetch") ||
      errorMsg.includes("dynamically imported module") ||
      errorMsg.includes("importing");

    if (isFetchError) {
      // Si falló la descarga de un módulo, la única forma de arreglarlo
      // es pedirle al navegador que recupere el index.html nuevo (F5).
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-white">
            Algo salió mal
          </h2>
          <p className="text-sm text-gray-400">
            {this.state.error?.message ?? "Error inesperado en la aplicación."}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}
