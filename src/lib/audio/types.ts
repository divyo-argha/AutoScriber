export interface ChunkInfo {
  index: number;
  filePath: string;
  startTime: number;
  duration: number;
  coreStartTime: number;
  coreEndTime: number;
  hasStartOverlap: boolean;
  hasEndOverlap: boolean;
}

export interface SlicerOptions {
  chunkDuration?: number;   // Base core duration in seconds (default: 600 = 10 mins)
  overlapDuration?: number; // Overlap duration in seconds at start and end (default: 30 = 30s)
  outputDir?: string;
}
