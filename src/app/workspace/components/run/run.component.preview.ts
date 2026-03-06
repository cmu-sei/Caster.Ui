// Visual preview — renders the RunComponent with mock run data showing a completed plan.
// Run: npm run test:vitest:preview -- src/app/workspace/components/run/run.component.preview.ts

import { describe, it } from 'vitest';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RunComponent } from './run.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { hold } from 'src/app/test-utils/preview-helper';
import { Run, RunStatus } from 'src/app/generated/caster-api';

const mockRun: Run = {
  id: 'run-001',
  workspaceId: 'ws-001',
  isDestroy: false,
  status: RunStatus.Planned,
  planId: 'plan-001',
  applyId: null,
  plan: {
    id: 'plan-001',
    runId: 'run-001',
    status: RunStatus.Planned,
    output:
      'Terraform will perform the following actions:\r\n\r\n' +
      '  # vsphere_virtual_machine.vm-web-01 will be created\r\n' +
      '  + resource "vsphere_virtual_machine" "vm-web-01" {\r\n' +
      '      + name             = "web-server-01"\r\n' +
      '      + num_cpus         = 4\r\n' +
      '      + memory           = 8192\r\n' +
      '      + guest_id         = "ubuntu64Guest"\r\n' +
      '    }\r\n\r\n' +
      '  # vsphere_virtual_machine.vm-db-01 will be created\r\n' +
      '  + resource "vsphere_virtual_machine" "vm-db-01" {\r\n' +
      '      + name             = "db-server-01"\r\n' +
      '      + num_cpus         = 8\r\n' +
      '      + memory           = 16384\r\n' +
      '      + guest_id         = "ubuntu64Guest"\r\n' +
      '    }\r\n\r\n' +
      'Plan: 2 to add, 0 to change, 0 to destroy.\r\n',
  },
  createdAt: '2026-03-06T10:30:00Z',
  createdBy: 'Jane Doe',
  modifiedAt: '2026-03-06T10:31:15Z',
  modifiedBy: 'Jane Doe',
};

describe('Run Preview', () => {
  it('renders with planned run data', async () => {
    await renderComponent(RunComponent, {
      declarations: [RunComponent],
      imports: [
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        DragDropModule,
      ],
      componentProperties: {
        run: mockRun,
        loading: false,
      },
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
