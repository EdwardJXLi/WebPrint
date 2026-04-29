import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
          <div className="panel max-w-lg p-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-950">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-500">
              Refresh the page to try again. If the issue persists, check the server logs.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
