export type Severity = 'low' | 'medium' | 'high' | 'critical' | 'safe';

export interface SafetyEvent {
  id: string;
  timestamp: Date;
  severity: Severity;
  message: string;
  location: string;
  reasoning: string[];
}

export interface AnalysisResult {
  isSafe: boolean;
  events: SafetyEvent[];
}

export interface ToolCallArgs {
  severity: Severity;
  message: string;
  location: string;
  reasoning_steps: string; // We ask the model to pass a string with steps separated by newlines or similar
}
