import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PortalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("[PortalErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    const message = this.state.error?.message?.toLowerCase() ?? "";
    if (
      message.includes("failed to fetch") ||
      message.includes("dynamically imported module") ||
      message.includes("importing")
    ) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.assign("/portal");
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Esta sección no se pudo cargar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hubo un error inesperado. Podés reintentar o volver al inicio del portal.
          </p>
          {this.state.error?.message ? (
            <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <RotateCcw size={14} /> Reintentar
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Home size={14} /> Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
