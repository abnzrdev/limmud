import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Top-level React error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="workspace-preview">
          Something went wrong. Restart the app or reopen the course folder.
        </div>
      );
    }

    return this.props.children;
  }
}
