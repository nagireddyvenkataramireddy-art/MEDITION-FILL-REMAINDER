
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Standard React ErrorBoundary implementation.
 * Using Component from 'react' explicitly to ensure that 'setState' and 'props' are recognized by the TypeScript compiler.
 */
// Fix: Extending Component directly to ensure that 'setState' and 'props' are correctly inherited from the base class.
export class ErrorBoundary extends Component<Props, State> {
  // Initialize state directly as a property for cleaner implementation
  public state: State = {
    hasError: false,
    error: null,
  };

  // Captures errors from the descendant component tree and updates the state.
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Logs error details for debugging purposes.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  public render(): ReactNode {
    // Correctly access the state property inherited from the Component base class
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white rounded-2xl border border-red-100 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-slate-500 mb-6 max-w-sm text-sm">
            We encountered an unexpected error in this view. Please try refreshing or switching tabs.
          </p>
          <div className="p-4 bg-slate-50 rounded-lg text-left w-full max-w-sm mb-6 overflow-auto max-h-32 text-xs font-mono text-slate-600 border border-slate-200 shadow-inner">
             {this.state.error?.message}
          </div>
          <button
            // Fix: Accessing setState from the base Component class to clear the error state and trigger re-render.
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200"
          >
            <RefreshCw size={18} /> Try Again
          </button>
        </div>
      );
    }

    // Fix: Accessing children from this.props which is correctly inherited from the Component base class.
    return this.props.children;
  }
}
