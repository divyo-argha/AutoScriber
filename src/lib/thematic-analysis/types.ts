export interface Quote {
  text: string;
  source: string;
  speaker?: string;
  timestamp?: number;
}

export interface Code {
  id: string;
  label: string;
  description: string;
  quotes: Quote[];
  frequency: number;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  codes: string[];
  prevalence: number;
}

export interface ThematicAnalysisResult {
  codes: Code[];
  themes: Theme[];
  summary: string;
}
