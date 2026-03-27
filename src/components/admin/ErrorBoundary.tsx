import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Nombre del tab/sección para el mensaje de error */
  section?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Captura errores de render en cualquier hijo y muestra un fallback.
 * Previene que un error en un tab tire abajo todo el panel.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.section ?? "Admin", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-4xl select-none">⚠️</div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-red-400 text-sm">
            {this.props.section
              ? `Error en "${this.props.section}"`
              : "Algo salió mal"}
          </p>
          <p className="text-xs text-gray-500 max-w-xs">{this.state.message}</p>
        </div>
        <button
          onClick={this.handleReset}
          className="mt-2 text-xs px-4 py-2 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] text-gray-400 hover:text-white transition"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
