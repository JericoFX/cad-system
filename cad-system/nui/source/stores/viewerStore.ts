import { createStore } from 'solid-js/store';

interface ViewerState {
  isOpen: boolean;
  images: string[];
  currentIndex: number;
  title?: string;
}

const initialState: ViewerState = {
  isOpen: false,
  images: [],
  currentIndex: 0,
  title: undefined,
};

export const [viewerState, setViewerState] = createStore<ViewerState>(initialState);

export const viewerActions = {
  openImages: (images: string[], title?: string) => {
    setViewerState({
      isOpen: true,
      images,
      currentIndex: 0,
      title,
    });
  },
  
  openImage: (url: string, title?: string) => {
    setViewerState({
      isOpen: true,
      images: [url],
      currentIndex: 0,
      title,
    });
  },
  
  nextImage: () => {
    setViewerState('currentIndex', (prev) => {
      const total = viewerState.images.length;
      return total > 0 ? (prev + 1) % total : 0;
    });
  },
  
  prevImage: () => {
    setViewerState('currentIndex', (prev) => {
      const total = viewerState.images.length;
      return total > 0 ? (prev - 1 + total) % total : 0;
    });
  },
  
  goToImage: (index: number) => {
    setViewerState('currentIndex', Math.max(0, Math.min(index, viewerState.images.length - 1)));
  },
  
  close: () => {
    setViewerState({
      isOpen: false,
      images: [],
      currentIndex: 0,
      title: undefined,
    });
  },
};
