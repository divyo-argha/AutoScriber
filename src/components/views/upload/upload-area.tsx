'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderOpen, Archive, Files, Cloud, Mic } from 'lucide-react';
import { ACCEPTED_AUDIO_EXTENSIONS } from '@/lib/file';
import { AudioRecorder } from './audio-recorder';
import { useUploadArea } from './use-upload-area';
import { UploadDropzone } from './upload-dropzone';
import { ZipCard, FolderCard } from './source-cards';
import { DriveTab } from './drive-tab';
import { SelectedFileCard } from './selected-file-card';
import { PendingFilesCard } from './pending-files-card';
import { UploadStats } from './upload-stats';
import styles from './upload-area.module.css';

export function UploadArea() {
  const {
    uploadedFile,
    setUploadedFile,
    isDragging,
    setIsDragging,
    activeTab,
    setActiveTab,
    preflightChecking,
    pendingFiles,
    driveLoading,
    driveFiles,
    driveSelected,
    setDriveSelected,
    fileInputRef,
    zipInputRef,
    folderInputRef,
    addFiles,
    handleZipUpload,
    handleFolderUpload,
    handleGoogleDriveConnect,
    handleDriveDownload,
    handleDriveCancel,
    startPreflight,
    startBatch,
    removeFile,
    removeUploadedFile,
    clearPending,
    setCurrentView,
  } = useUploadArea();

  if (uploadedFile && pendingFiles.length === 0) {
    return (
      <div className={styles.wrapper}>
        <SelectedFileCard
          fileName={uploadedFile.name}
          fileSize={uploadedFile.size}
          checking={preflightChecking}
          onRemove={removeUploadedFile}
          onStart={() => startPreflight(() => setCurrentView('processing'))}
        />
      </div>
    );
  }

  if (pendingFiles.length > 0) {
    return (
      <div className={styles.wrapper}>
        <PendingFilesCard
          files={pendingFiles}
          checking={preflightChecking}
          onClearAll={clearPending}
          onRemoveFile={removeFile}
          onAddMore={() => fileInputRef.current?.click()}
          onStart={startBatch}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_AUDIO_EXTENSIONS}
          multiple
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          className={styles.hiddenInput}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.tabWrap}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="upload" className={styles.tabTrigger}>
            <FolderOpen className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Upload</span>
          </TabsTrigger>
          <TabsTrigger value="zip" className={styles.tabTrigger}>
            <Archive className={styles.iconXs} /> <span className={styles.hiddenSmInline}>ZIP</span>
          </TabsTrigger>
          <TabsTrigger value="folder" className={styles.tabTrigger}>
            <Files className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Folder</span>
          </TabsTrigger>
          <TabsTrigger value="drive" className={styles.tabTrigger}>
            <Cloud className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Drive</span>
          </TabsTrigger>
          <TabsTrigger value="record" className={styles.tabTrigger}>
            <Mic className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Record</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <UploadDropzone
            isDragging={isDragging}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            onDrop={(files) => { addFiles(files); setActiveTab('upload'); }}
            onBrowse={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_AUDIO_EXTENSIONS}
            multiple
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            className={styles.hiddenInput}
          />
        </TabsContent>

        <TabsContent value="zip">
          <ZipCard onChooseZip={() => zipInputRef.current?.click()} />
          <input ref={zipInputRef} type="file" accept=".zip" onChange={handleZipUpload} className={styles.hiddenInput} />
        </TabsContent>

        <TabsContent value="folder">
          <FolderCard onChooseFolder={() => folderInputRef.current?.click()} />
          {/* @ts-ignore: webkitdirectory is a browser-only folder selection attribute */}
          <input ref={folderInputRef} type="file" webkitdirectory="" onChange={handleFolderUpload} className={styles.hiddenInput} />
        </TabsContent>

        <TabsContent value="drive">
          <DriveTab
            driveLoading={driveLoading}
            driveFiles={driveFiles}
            driveSelected={driveSelected}
            onConnect={handleGoogleDriveConnect}
            onDownload={handleDriveDownload}
            onCancel={handleDriveCancel}
            onToggleFile={(id, checked) => {
              const s = new Set(driveSelected);
              if (checked) s.add(id);
              else s.delete(id);
              setDriveSelected(s);
            }}
          />
        </TabsContent>

        <TabsContent value="record">
          <AudioRecorder
            onRecordingComplete={(file) => { setUploadedFile(file); }}
            onCancel={() => setActiveTab('upload')}
          />
        </TabsContent>
      </Tabs>

      <UploadStats />
    </div>
  );
}
