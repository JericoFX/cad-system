import { onNuiMessage } from '~/utils/nuiRouter';
import type {
  PoliceJailTransferLoggedData
} from '~/types/nuiMessages';

export function initPoliceHandlers(): void {
  onNuiMessage<PoliceJailTransferLoggedData>('police:jailTransferLogged', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'Jail Transfer',
      `${data.transfer.personName} transferred to ${data.transfer.facility}`,
      'info'
    );

    const { auditActions } = await import('~/stores/auditStore');
    auditActions.logCommand(
      'jail-transfer',
      [data.transfer.citizenId, data.transfer.facility],
      'success',
      `Transfer logged: ${data.transfer.transferId}`
    );
  });
}
