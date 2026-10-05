import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Algo salió mal</h1>
            <p className="text-slate-600 mb-4">La aplicación se encontró con un error inesperado. Esto puede deberse a datos corruptos en tu sesión.</p>
            <div className="bg-slate-100 p-4 rounded text-xs font-mono text-red-800 overflow-auto mb-6 max-h-40">
              {this.state.error?.toString()}
            </div>
            <div className="flex flex-col gap-3">
              <button 
                className="w-full bg-blue-600 text-white font-medium py-2 rounded shadow hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                Recargar página (F5)
              </button>
              <button 
                className="w-full bg-red-100 text-red-700 font-medium py-2 rounded shadow hover:bg-red-200"
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
