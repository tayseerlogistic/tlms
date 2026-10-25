import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl max-w-2xl mx-auto text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {this.props.fallbackTitle || 'Something went wrong rendering this view'}
            </h3>
            <p className="text-xs text-rose-300 font-mono mt-1 break-all bg-rose-950/60 p-2 rounded-lg border border-rose-800">
              {this.state.error?.message || 'Unknown runtime error'}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            The screen encountered an error. Reload and check the sync status before retrying your last change.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry View
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
