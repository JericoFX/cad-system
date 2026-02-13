
import type { Component } from 'solid-js';

export interface FileViewerProps {
  file?: {
    name: string;
    type: string;
    content?: string;
  };
}

export const FileViewer: Component<FileViewerProps> = () => {
  return (
    <div style={{ 
      padding: '20px', 
      color: '#c0c0c0',
      'font-family': 'monospace',
      'text-align': 'center'
    }}>
      [FILE VIEWER NOT IMPLEMENTED]
    </div>
  );
};

export default FileViewer;
