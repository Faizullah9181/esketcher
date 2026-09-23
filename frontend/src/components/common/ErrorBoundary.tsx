import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("eSketcher crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid h-full place-items-center bg-void p-8">
        <div className="max-w-md">
          <div className="es-label !text-err">Instrument fault</div>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">The studio dropped its brush.</h1>
          <p className="mt-3 text-ash">{this.state.error.message}</p>
          <button className="es-btn mt-6" onClick={() => location.reload()}>
            Restart studio
          </button>
        </div>
      </div>
    );
  }
}
