import type { StateCreator } from 'zustand';
import type { AppState } from '../types';

export interface FileSlice {
  uploadedFile: File | null;
  uploadedFileName: string;
  uploadedFileSize: number;
  uploadedFileDuration: number;
  setUploadedFile: (file: File | null) => void;
  setUploadedFileDuration: (duration: number) => void;
}

export const createFileSlice: StateCreator<AppState, [], [], FileSlice> = set => ({
  uploadedFile: null,
  uploadedFileName: '',
  uploadedFileSize: 0,
  uploadedFileDuration: 0,

  setUploadedFile: file => set({
    uploadedFile: file,
    uploadedFileName: file?.name || '',
    uploadedFileSize: file?.size || 0,
  }),

  setUploadedFileDuration: duration => set({ uploadedFileDuration: duration }),
});
