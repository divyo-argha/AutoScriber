'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './error-boundary.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('View crashed:', error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <div className={styles.card}>
            <div className={styles.iconWrap}>
              <AlertTriangle className={styles.icon} />
            </div>
            <h2 className={styles.title}>{this.props.fallbackTitle ?? 'This section hit a snag'}</h2>
            <p className={styles.message}>
              {this.state.message || 'An unexpected error occurred. Try reloading this section.'}
            </p>
            <Button onClick={this.handleRetry} className={styles.retryBtn}>
              <RefreshCw className={styles.retryIcon} />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
