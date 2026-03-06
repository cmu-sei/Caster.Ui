// Visual preview — renders the ModuleListComponent with realistic Terraform modules.
// Run: npm run test:vitest:preview -- src/app/editor/component/module-list/module-list.component.preview.ts

import { describe, it } from 'vitest';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { ModuleListComponent } from './module-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { hold } from 'src/app/test-utils/preview-helper';
import { Module } from 'src/app/generated/caster-api';

const mockModules: Module[] = [
  {
    id: 'mod-001',
    name: 'vsphere-virtual-machine',
    path: 'sei/vsphere-virtual-machine/vsphere',
    description: 'Creates a vSphere virtual machine with configurable CPU, memory, network, and storage settings.',
    versionsCount: 3,
    dateModified: '2026-02-15T08:00:00Z',
  },
  {
    id: 'mod-002',
    name: 'vsphere-network',
    path: 'sei/vsphere-network/vsphere',
    description: 'Provisions vSphere distributed port groups and network configurations for lab environments.',
    versionsCount: 2,
    dateModified: '2026-01-20T14:30:00Z',
  },
  {
    id: 'mod-003',
    name: 'windows-server',
    path: 'sei/windows-server/vsphere',
    description: 'Deploys a Windows Server VM with Active Directory, DNS, and DHCP role options.',
    versionsCount: 5,
    dateModified: '2026-03-01T11:45:00Z',
  },
  {
    id: 'mod-004',
    name: 'linux-workstation',
    path: 'sei/linux-workstation/vsphere',
    description: 'Provisions a Linux workstation with pre-configured security tools for cyber exercises.',
    versionsCount: 4,
    dateModified: '2026-02-28T09:15:00Z',
  },
  {
    id: 'mod-005',
    name: 'firewall-pfsense',
    path: 'sei/firewall-pfsense/vsphere',
    description: 'Deploys a pfSense firewall appliance with configurable interfaces and rules.',
    versionsCount: 1,
    dateModified: '2026-01-10T16:00:00Z',
  },
];

describe('ModuleList Preview', () => {
  it('renders with full module data', async () => {
    await renderComponent(ModuleListComponent, {
      declarations: [ModuleListComponent],
      imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
      ],
      componentProperties: {
        modules: mockModules,
        isEditing: true,
      },
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
