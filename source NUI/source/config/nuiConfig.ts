/**
 * NUI Customization Configuration
 * 
 * Modify this file to customize the NUI interface
 * without changing core system files
 */

export interface NuiCustomization {
  // Theme customization
  theme: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
  };

  // Layout customization
  layout: {
    dockPosition?: 'bottom' | 'left' | 'right';
    dockSize?: 'small' | 'medium' | 'large';
    terminalWidth?: number;
    terminalHeight?: number;
  };

  // Feature toggles
  features: {
    enableDispatch?: boolean;
    enableEvidence?: boolean;
    enableForensics?: boolean;
    enableCases?: boolean;
    enableFines?: boolean;
    enablePhotos?: boolean;
    enableVehicleCad?: boolean;
    enableSecurityCameras?: boolean;
  };

  // Custom CSS classes
  styles: {
    terminalClass?: string;
    dockClass?: string;
    modalClass?: string;
  };

  // Custom components (path to custom component files)
  components: {
    customDock?: string;
    customTerminal?: string;
    customModals?: string[];
  };

  // Phone customization
  phone: {
    enablePhone?: boolean;
    phoneResource?: string;
    phoneCommands?: string[];
  };
}

// Default configuration
export const defaultConfig: NuiCustomization = {
  theme: {
    primaryColor: '#00ff00',
    secondaryColor: '#008800',
    backgroundColor: '#0a0a0a',
    textColor: '#ffffff',
    fontSize: '14px',
  },

  layout: {
    dockPosition: 'bottom',
    dockSize: 'medium',
    terminalWidth: 1200,
    terminalHeight: 800,
  },

  features: {
    enableDispatch: true,
    enableEvidence: true,
    enableForensics: true,
    enableCases: true,
    enableFines: true,
    enablePhotos: true,
    enableVehicleCad: true,
    enableSecurityCameras: true,
  },

  styles: {
    terminalClass: 'cad-terminal',
    dockClass: 'cad-dock',
    modalClass: 'cad-modal',
  },

  components: {
    customDock: undefined,
    customTerminal: undefined,
    customModals: [],
  },

  phone: {
    enablePhone: true,
    phoneResource: 'gcphone',
    phoneCommands: ['/phone', '/call'],
  },
};

// Export merged config helper
export function mergeConfig(base: NuiCustomization, override: Partial<NuiCustomization>): NuiCustomization {
  return {
    ...base,
    ...override,
    theme: { ...base.theme, ...override.theme },
    layout: { ...base.layout, ...override.layout },
    features: { ...base.features, ...override.features },
    styles: { ...base.styles, ...override.styles },
    components: { ...base.components, ...override.components },
    phone: { ...base.phone, ...override.phone },
  };
}