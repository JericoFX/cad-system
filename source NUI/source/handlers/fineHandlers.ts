import { onNuiMessage } from '~/utils/nuiRouter';
import type {
  FineCreatedData,
  FinePaidData
} from '~/types/nuiMessages';

export function initFineHandlers(): void {
  onNuiMessage<FineCreatedData>('fine:created', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    cadActions.addFine(data.fine);

    const targetType = data.fine.targetType === 'PERSON' ? 'person' : 'vehicle';
    notificationActions.notifySystem(
      'Fine Issued',
      `${data.fine.fineCode} - $${data.fine.amount} to ${targetType} ${data.fine.targetName}`,
      'info'
    );
  });

  onNuiMessage<FinePaidData>('fine:paid', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    cadActions.updateFine(data.fineId, {
      paid: true,
      paidAt: data.paidAt,
      paidMethod: data.paidMethod,
      status: 'PAID',
    });

    notificationActions.notifySystem(
      'Fine Paid',
      `Fine ${data.fineId} has been paid`,
      'success'
    );
  });
}
