'use client';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            autoScriber — Bangla Audio Transcription for Researchers
          </p>
          <p className="text-xs text-muted-foreground">
            Cloud: Gemini Flash API · Local: Gemma via Ollama
          </p>
        </div>
      </div>
    </footer>
  );
}
