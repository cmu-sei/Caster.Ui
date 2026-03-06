// Visual preview — renders the DesignModulesComponent with mock design modules.
// Run: npm run test:vitest:preview -- src/app/designs/components/design-modules/design-modules.component.preview.ts

import { describe, it } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { DesignModulesComponent } from './design-modules.component';
import { DesignModuleComponent } from './design-module/design-module.component';
import { ModuleListComponent } from 'src/app/editor/component/module-list/module-list.component';
import { ModuleVariablesComponent } from 'src/app/editor/component/module-variables/module-variables.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { hold } from 'src/app/test-utils/preview-helper';
import { of } from 'rxjs';
import { Module, DesignModule } from 'src/app/generated/caster-api';
import { ModuleQuery } from 'src/app/modules/state/module.query';
import { DesignModuleQuery } from '../../state/design-modules/design-module.query';

const mockModules: Module[] = [
  {
    id: 'mod-001',
    name: 'vsphere-virtual-machine',
    path: 'sei/vsphere-virtual-machine/vsphere',
    description: 'Creates a vSphere virtual machine.',
    versionsCount: 3,
  },
  {
    id: 'mod-002',
    name: 'vsphere-network',
    path: 'sei/vsphere-network/vsphere',
    description: 'Provisions vSphere network configurations.',
    versionsCount: 2,
  },
];

const mockDesignModules: DesignModule[] = [
  {
    id: 'dm-001',
    designId: 'design-001',
    moduleId: 'mod-001',
    name: 'web_server',
    moduleVersion: '1.2.0',
    enabled: true,
    values: [
      { name: 'vm_name', value: 'web-01', type: 'string' },
      { name: 'num_cpus', value: '4', type: 'number' },
    ],
  },
  {
    id: 'dm-002',
    designId: 'design-001',
    moduleId: 'mod-002',
    name: 'lab_network',
    moduleVersion: '1.0.0',
    enabled: true,
    values: [
      { name: 'network_name', value: 'exercise-net', type: 'string' },
    ],
  },
];

describe('DesignModules Preview', () => {
  it('renders with design modules and edit capability', async () => {
    await renderComponent(DesignModulesComponent, {
      declarations: [
        DesignModulesComponent,
        DesignModuleComponent,
        ModuleListComponent,
        ModuleVariablesComponent,
      ],
      imports: [
        FormsModule,
        ReactiveFormsModule,
        ClipboardModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatTooltipModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        MatDialogModule,
      ],
      providers: [
        {
          provide: ModuleQuery,
          useValue: {
            selectAll: () => of(mockModules),
            selectByModuleId: (id: string) =>
              of(mockModules.find((m) => m.id === id) || null),
            getAll: () => mockModules,
            getEntity: (id: string) =>
              mockModules.find((m) => m.id === id) || null,
          },
        },
        {
          provide: DesignModuleQuery,
          useValue: {
            selectAll: () => of(mockDesignModules),
            getByDesignId: () => of(mockDesignModules),
            getOutputsByDesignId: () => of([]),
            getAll: () => mockDesignModules,
            getEntity: (id: string) =>
              mockDesignModules.find((dm) => dm.id === id) || null,
          },
        },
      ],
      componentProperties: {
        designId: 'design-001',
        canEdit: true,
      },
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
