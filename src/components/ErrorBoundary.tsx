import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl max-w-lg w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-3">Algo salió mal</h1>
            <p className="text-slate-600 mb-3 text-sm">La aplicación se encontró con un error inesperado.</p>
            <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-red-800 overflow-auto mb-4 max-h-48 border border-red-200">
              <div className="font-bold mb-1">{this.state.error?.toString()}</div>
              {this.state.error?.stack && (
                <div className="text-[10px] text-slate-500 whitespace-pre-wrap mt-1">{this.state.error.stack}</div>
              )}
              {this.state.errorInfo?.componentStack && (
                <div className="text-[10px] text-blue-700 whitespace-pre-wrap mt-2">{this.state.errorInfo.componentStack}</div>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <button 
                className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg shadow hover:bg-blue-700 text-sm"
                onClick={() => window.location.reload()}
              >
                Recargar aplicación
              </button>
              <button 
                className="w-full bg-amber-50 text-amber-800 border border-amber-300 font-bold py-2 rounded-lg hover:bg-amber-100 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${this.state.error?.toString()}\n${this.state.error?.stack || ''}\n${this.state.errorInfo?.componentStack || ''}`
                  );
                  alert('Detalles del error copiados al portapapeles');
                }}
              >
                Copiar detalles del error
              </button>
              <button 
                className="w-full bg-red-50 text-red-700 font-medium py-2 rounded-lg hover:bg-red-100 text-xs border border-red-200"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                Borrar datos locales y reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
