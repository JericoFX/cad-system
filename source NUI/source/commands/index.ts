
import { registerCaseCommands } from './case';
import { registerCaseTaskCommands } from './case/tasks';
import { registerNoteCommands } from './notes';
import { registerEvidenceCommands } from './evidence';
import { registerPoliceCommands } from './police';
import { registerEMSCommands } from './ems';
import { registerSearchCommands } from './search';
import { registerDispatchCommands } from './dispatch';
import { registerNewsCommands } from './news';
import { registerRadioCommands } from './radio';
import { registerLicenseCommands } from './license';
import { registerPropertyCommands } from './property';
import { registerFleetCommands } from './fleet';
import { registerFineCommands } from './fineCommands';
import { registerStatusCommands } from './statusCommands';
import './flowCommands';
import { featureState } from '~/stores/featureStore';

export type {
  CommandConfig,
  CommandHandlerContext,
  TerminalAPI,
  UserContext,
  ArgConfig,
  FlagConfig
} from './types';

export {
  createCommand,
  createCommandWithSubcommands,
  requireCaseLoaded,
  requirePermission,
  getCaseId
} from './commandBuilder';

export { terminalAPI } from './terminalApi';

export function registerAllCommands() {
  registerCaseCommands();
  registerCaseTaskCommands();
  registerNoteCommands();
  registerEvidenceCommands();
  registerPoliceCommands();
  registerEMSCommands();
  registerSearchCommands();
  if (featureState.dispatch.enabled && featureState.dispatch.visible) {
    registerDispatchCommands();
  }
  if (featureState.news.enabled && featureState.news.visible) {
    registerNewsCommands();
  }
  registerRadioCommands();
  registerLicenseCommands();
  registerPropertyCommands();
  registerFleetCommands();
  registerFineCommands();
  registerStatusCommands();
  
  console.log('[Commands] All commands registered successfully');
}
