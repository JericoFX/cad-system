import type { Scenario } from '../types';

export const evidenceCollectionScenario: Scenario = {
  id: 'EVIDENCE_COLLECTION',
  name: 'Evidence Collection',
  description: 'Major case with 50+ evidence items of all types for chain of custody testing',
  icon: '📦',
  data: {
    cases: {
      'CASE_EVIDENCE_001': {
        caseId: 'CASE_EVIDENCE_001',
        caseType: 'THEFT',
        title: 'Bank Heist - Evidence Collection',
        description: 'Major bank robbery with extensive physical and digital evidence',
        status: 'OPEN',
        priority: 1,
        createdBy: 'DETECTIVE_501',
        assignedTo: 'DETECTIVE_501',
        createdAt: new Date(Date.now() - 1209600000).toISOString(),
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
        notes: Array.from({ length: 10 }, (_, i) => ({
          id: `NOTE_EVID_${i + 1}`,
          caseId: 'CASE_EVIDENCE_001',
          author: ['DETECTIVE_501', 'CSI_001', 'ANALYST_001'][i % 3],
          content: `Investigation note ${i + 1}: Detailed observation and findings`,
          timestamp: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
          type: ['general', 'observation', 'interview', 'evidence'][i % 4] as any,
        })),
        evidence: [
          // Photos (10 items)
          ...Array.from({ length: 10 }, (_, i) => ({
            evidenceId: `EVID_PHOTO_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'PHOTO',
            data: { 
              description: `Crime scene photo ${i + 1}`,
              images: Array.from({ length: 5 }, (_, j) => `https://picsum.photos/seed/EVID_PHOTO_${i}_${j}/800/600`),
              count: 5,
            },
            attachedBy: 'CSI_001',
            attachedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
            custodyChain: [
              {
                eventId: `CUST_PHOTO_${i}_1`,
                evidenceId: `EVID_PHOTO_${String(i + 1).padStart(3, '0')}`,
                eventType: 'COLLECTED' as const,
                location: 'Bank of Los Santos',
                timestamp: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
                recordedBy: 'CSI_001',
                notes: 'Collected from crime scene',
              },
              {
                eventId: `CUST_PHOTO_${i}_2`,
                evidenceId: `EVID_PHOTO_${String(i + 1).padStart(3, '0')}`,
                eventType: 'STORED' as const,
                location: 'Evidence Locker 12',
                timestamp: new Date(Date.now() - (i + 1) * 86400000 + 3600000).toISOString(),
                recordedBy: 'OFFICER_101',
                notes: 'Secured in evidence storage',
              },
            ],
          })),
          // Videos (5 items)
          ...Array.from({ length: 5 }, (_, i) => ({
            evidenceId: `EVID_VIDEO_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'VIDEO',
            data: { 
              description: `Surveillance video ${i + 1}`,
              duration: '00:15:30',
              source: 'Security Camera',
              url: i === 0 
                ? 'https://www.w3schools.com/html/mov_bbb.mp4'
                : `https://files.fivemerr.com/videos/sample_video_${i + 1}.mp4`,
            },
            attachedBy: 'ANALYST_001',
            attachedAt: new Date(Date.now() - (i + 11) * 86400000).toISOString(),
            custodyChain: [],
          })),
          // Audio (5 items)
          ...Array.from({ length: 5 }, (_, i) => ({
            evidenceId: `EVID_AUDIO_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'AUDIO',
            data: { 
              description: `Wiretap recording ${i + 1}`,
              duration: '02:30:00',
              source: 'Phone Line 1',
              url: i === 0
                ? 'https://www.w3schools.com/html/horse.mp3'
                : `https://files.fivemerr.com/audio/sample_audio_${i + 1}.mp3`,
            },
            attachedBy: 'ANALYST_001',
            attachedAt: new Date(Date.now() - (i + 16) * 86400000).toISOString(),
            custodyChain: [],
          })),
          // Documents (10 items)
          ...Array.from({ length: 10 }, (_, i) => ({
            evidenceId: `EVID_DOC_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'DOCUMENT',
            data: { 
              description: `Financial record ${i + 1}`,
              filename: `records_${i + 1}.pdf`,
              pages: 15,
            },
            attachedBy: 'DETECTIVE_501',
            attachedAt: new Date(Date.now() - (i + 21) * 86400000).toISOString(),
            custodyChain: [],
          })),
          // Biological evidence (10 items)
          ...Array.from({ length: 10 }, (_, i) => ({
            evidenceId: `EVID_BIO_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'BIOLOGICAL',
            data: { 
              description: `DNA sample ${i + 1}`,
              labStatus: ['PENDING', 'IN_ANALYSIS', 'COMPLETED'][i % 3],
              sampleType: ['Touch DNA', 'Blood', 'Saliva'][i % 3],
              dnaHash: `DNA_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            },
            attachedBy: 'CSI_001',
            attachedAt: new Date(Date.now() - (i + 31) * 86400000).toISOString(),
            custodyChain: [],
          })),
          // Weapons (5 items)
          ...Array.from({ length: 5 }, (_, i) => ({
            evidenceId: `EVID_WEAPON_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'WEAPON',
            data: { 
              description: `Recovered weapon ${i + 1}`,
              type: ['Pistol', 'Rifle', 'Shotgun', 'Knife', 'Explosive'][i],
              serialNumber: i === 3 ? 'FILED_OFF' : `SN${randomInt(100000, 999999)}`,
            },
            attachedBy: 'OFFICER_101',
            attachedAt: new Date(Date.now() - (i + 41) * 86400000).toISOString(),
            custodyChain: [],
          })),
          // Physical evidence (5 items)
          ...Array.from({ length: 5 }, (_, i) => ({
            evidenceId: `EVID_PHYS_${String(i + 1).padStart(3, '0')}`,
            caseId: 'CASE_EVIDENCE_001',
            evidenceType: 'PHYSICAL',
            data: { 
              description: `Physical evidence ${i + 1}`,
              item: ['Clothing', 'Bag', 'Tool', 'Container', 'Debris'][i],
            },
            attachedBy: 'CSI_001',
            attachedAt: new Date(Date.now() - (i + 46) * 86400000).toISOString(),
            custodyChain: [],
          })),
        ],
        tasks: [],
      },
    },
    calls: {},
    units: {
      'DET_01': {
        unitId: 'DET_01',
        badge: 'DET-501',
        name: 'Detective Lead',
        status: 'BUSY',
        type: 'DETECTIVE',
        location: { x: 300.0, y: -200.0, z: 45.0 },
      },
      'CSI_01': {
        unitId: 'CSI_01',
        badge: 'CSI-001',
        name: 'Crime Scene Unit',
        status: 'BUSY',
        type: 'CSI',
        location: { x: 305.0, y: -195.0, z: 45.0 },
      },
    },
    persons: {},
    vehicles: {},
    evidence: [],
    traces: {},
    alerts: [],
    bloodRequests: {},
    fines: {},
    warrants: {},
  },
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
