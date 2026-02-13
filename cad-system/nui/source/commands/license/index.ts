
import { createCommand } from '../commandBuilder';
import { licenseActions, LICENSE_TYPES } from '~/stores/licenseStore';

export function registerLicenseCommands() {
  createCommand({
    name: 'license',
    description: 'Abrir gestor de licencias (GUI)',
    usage: 'license',
    category: 'CIVIL',
    handler: async ({ terminal }) => {
      terminal.print('🎫 Abriendo gestor de licencias...', 'system');
      terminal.openModal('LICENSE_MANAGER');
    }
  });
  
  createCommand({
    name: 'license-cli',
    description: 'Gestor de licencias modo CLI interactivo',
    usage: 'license-cli',
    category: 'CIVIL',
    handler: async ({ terminal }) => {
      terminal.print('🎫 GESTOR DE LICENCIAS - MODO CLI', 'system');
      terminal.print('═══════════════════════════════', 'system');
      
      const action = await terminal.select('Selecciona acción:', [
        'check - Verificar licencias',
        'issue - Emitir nueva licencia',
        'revoke - Revocar licencia',
        'verify - Verificar una licencia específica',
        'list - Listar tipos de licencias'
      ]);
      
      const actionType = action.split(' - ')[0];
      
      switch (actionType) {
        case 'check': {
          const citizenId = await terminal.prompt('ID de ciudadano:');
          if (!citizenId) {
            terminal.print('✗ ID requerido', 'error');
            return;
          }
          
          const summary = licenseActions.getHolderSummary(citizenId);
          
          terminal.print(`\n📋 LICENCIAS DE ${citizenId}:`, 'system');
          terminal.print(`Total: ${summary.total} | Activas: ${summary.active} | Revocadas: ${summary.revoked}`, 'info');
          
          if (summary.weapons.length > 0) {
            terminal.print('\n🔫 ARMAS:', 'system');
            summary.weapons.forEach(l => {
              const status = l.status === 'ACTIVE' ? '✓' : '✗';
              terminal.print(`  ${status} ${l.licenseId} - ${LICENSE_TYPES[l.licenseId]?.category}`, 'info');
            });
          }
          
          if (summary.driving.length > 0) {
            terminal.print('\n🚗 VEHÍCULOS:', 'system');
            summary.driving.forEach(l => {
              const status = l.status === 'ACTIVE' ? '✓' : '✗';
              terminal.print(`  ${status} ${l.licenseId} - ${LICENSE_TYPES[l.licenseId]?.category}`, 'info');
            });
          }
          
          if (summary.business.length > 0) {
            terminal.print('\n🏢 NEGOCIOS:', 'system');
            summary.business.forEach(l => {
              const status = l.status === 'ACTIVE' ? '✓' : '✗';
              terminal.print(`  ${status} ${l.licenseId} - ${LICENSE_TYPES[l.licenseId]?.category}`, 'info');
            });
          }
          break;
        }
        
        case 'issue': {
          const citizenId = await terminal.prompt('ID de ciudadano:');
          const holderName = await terminal.prompt('Nombre completo:');
          
          if (!citizenId || !holderName) {
            terminal.print('✗ Información requerida', 'error');
            return;
          }
          
          const licenseType = await terminal.select('Tipo de licencia:', [
            'Armas: W-1 (Armas pequeñas)',
            'Armas: W-2 (Escopetas)',
            'Armas: W-3 (Rifles)',
            'Armas: W-4 (Automáticas - PD/SWAT)',
            'Conducir: D-A (Automóviles)',
            'Conducir: D-B (Vehículos pesados)',
            'Conducir: D-C (Motos)',
            'Conducir: D-D (Transporte público)',
            'Conducir: D-E (Aéreos)',
            'Negocio: B-A (Funcionamiento)',
            'Negocio: B-B (Alcohol)',
            'Negocio: B-C (Armas)',
            'Negocio: B-D (Seguridad privada)'
          ]);
          
          const licenseId = licenseType.match(/[A-Z]-\d/)?.[0];
          if (!licenseId) {
            terminal.print('✗ Tipo de licencia inválido', 'error');
            return;
          }
          
          const license = licenseActions.issue(licenseId, citizenId, holderName, 'OFFICER_001');
          
          if (license) {
            terminal.print(`✓ Licencia emitida: ${licenseId}`, 'success');
            terminal.print(`  Titular: ${holderName}`, 'info');
            terminal.print(`  ID: ${citizenId}`, 'info');
            terminal.print(`  Tipo: ${LICENSE_TYPES[licenseId]?.category}`, 'info');
          } else {
            terminal.print('✗ No se pudo emitir la licencia', 'error');
          }
          break;
        }
        
        case 'revoke': {
          const citizenId = await terminal.prompt('ID de ciudadano:');
          const licenseId = await terminal.prompt('ID de licencia (ej: W-1):');
          const reason = await terminal.prompt('Razón de revocación:');
          
          if (!citizenId || !licenseId) {
            terminal.print('✗ Información requerida', 'error');
            return;
          }
          
          const confirmed = await terminal.confirm(`¿Revocar ${licenseId} a ${citizenId}?`);
          if (confirmed) {
            const success = licenseActions.revoke(licenseId, citizenId, reason || 'Sin especificar', 'OFFICER_001');
            if (success) {
              terminal.print(`✓ Licencia ${licenseId} revocada`, 'success');
            } else {
              terminal.print('✗ No se encontró la licencia', 'error');
            }
          }
          break;
        }
        
        case 'verify': {
          const citizenId = await terminal.prompt('ID de ciudadano:');
          const licenseId = await terminal.prompt('ID de licencia:');
          
          if (!citizenId || !licenseId) {
            terminal.print('✗ Información requerida', 'error');
            return;
          }
          
          const result = licenseActions.verify(licenseId, citizenId);
          
          terminal.print('\n📋 RESULTADO DE VERIFICACIÓN:', 'system');
          terminal.print(`Licencia: ${licenseId}`, 'info');
          terminal.print(`Ciudadano: ${citizenId}`, 'info');
          terminal.print(`Estado: ${result.valid ? '✓ VÁLIDA' : '✗ INVÁLIDA'}`, result.valid ? 'success' : 'error');
          
          if (result.license) {
            terminal.print(`Titular: ${result.license.holderName}`, 'info');
            terminal.print(`Emitida: ${new Date(result.license.issuedAt).toLocaleDateString()}`, 'info');
            if (result.license.status === 'REVOKED') {
              terminal.print(`⚠️ REVOCADA: ${result.license.revokedReason}`, 'warning');
            }
          }
          break;
        }
        
        case 'list': {
          terminal.print('\n📋 TIPOS DE LICENCIAS DISPONIBLES:', 'system');
          terminal.print('═══════════════════════════════', 'system');
          
          terminal.print('\n🔫 ARMAS:', 'system');
          terminal.print('  W-1 - Armas pequeñas', 'info');
          terminal.print('  W-2 - Escopetas', 'info');
          terminal.print('  W-3 - Rifles', 'info');
          terminal.print('  W-4 - Automáticas (PD/SWAT)', 'info');
          
          terminal.print('\n🚗 CONDUCIR:', 'system');
          terminal.print('  D-A - Automóviles livianos', 'info');
          terminal.print('  D-B - Vehículos pesados', 'info');
          terminal.print('  D-C - Motocicletas', 'info');
          terminal.print('  D-D - Transporte público', 'info');
          terminal.print('  D-E - Aéreos/Helicópteros', 'info');
          
          terminal.print('\n🏢 NEGOCIOS:', 'system');
          terminal.print('  B-A - Licencia de funcionamiento', 'info');
          terminal.print('  B-B - Venta de alcohol', 'info');
          terminal.print('  B-C - Venta de armas', 'info');
          terminal.print('  B-D - Seguridad privada', 'info');
          break;
        }
      }
    }
  });
}
