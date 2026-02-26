export interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'drive';
  path?: string;
  size?: number;
  modified?: Date | string;
  icon?: string;
}

export interface FileExplorerProps {
  data?: FileItem[];
  currentPath?: string;
  width?: string;
  height?: string;
  viewMode?: 'icons' | 'details';
  showHidden?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  class?: string;
  classNames?: Partial<Record<string, string>>;
  namespace?: string;
  color?: string;
  iconResolver?: (item: FileItem) => string;
  onNavigate?: (path: string, item: FileItem) => void;
  onFileSelect?: (item: FileItem) => void;
  onFileOpen?: (item: FileItem) => void;
  onSearchChange?: (term: string) => void;
}
