import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Rendered instead of the children after an error; `reset` clears the error and re-renders. */
  fallback: (reset: () => void) => ReactNode;
  /** Called on reset, e.g. TanStack Query's QueryErrorResetBoundary reset so the query refetches. */
  onReset?: () => void;
  children: ReactNode;
}

/** Contains a render error to one subtree (React has no hook equivalent). */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.warn('ErrorBoundary caught', error, info.componentStack);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render() {
    return this.state.error ? this.props.fallback(this.reset) : this.props.children;
  }
}
