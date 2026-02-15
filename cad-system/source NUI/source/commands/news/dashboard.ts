
import { createCommand } from '../commandBuilder';

export function registerNewsDashboardCommand() {
  createCommand({
    name: 'news',
    description: 'Abrir el Centro de Noticias (News Manager)',
    usage: 'news',
    category: 'NEWS',
    permissions: ['news'],
    handler: async ({ terminal }) => {
      terminal.print('📰 Abriendo Centro de Noticias...', 'system');
      terminal.openModal('NEWS_MANAGER');
    }
  });
}
