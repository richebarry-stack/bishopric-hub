import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { reloadedRecently, reloadForNewBuild } from '../lib/lazyWithReload';

interface Props { children: ReactNode }
interface State { error: Error | null }

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|Unable to preload/i;

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Stale/missing chunk: a fresh load fixes it, so do that automatically.
    if (CHUNK_ERROR.test(error.message) && !reloadedRecently()) reloadForNewBuild();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-gray-700 font-medium mb-1">This page didn't load correctly.</p>
          <p className="text-gray-500 text-sm mb-4">{this.state.error.message}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => this.setState({ error: null })} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100">Try again</button>
            <button onClick={() => window.location.reload()} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Reload page</button>
          </div>
        </div>
      </div>
    );
  }
}

// Keyed by route so navigating to another page clears a previous failure.
export default function ErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <Boundary key={location.pathname}>{children}</Boundary>;
}
