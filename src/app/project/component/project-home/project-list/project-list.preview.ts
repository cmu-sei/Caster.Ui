// Visual preview — renders the ProjectListComponent with realistic data.
// Run: npm run test:vitest:preview -- src/app/project/component/project-home/project-list/project-list.preview.ts

import { describe, it } from 'vitest';
import { MatTableDataSource } from '@angular/material/table';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ProjectListComponent } from './project-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { hold } from 'src/app/test-utils/preview-helper';
import { SystemPermission, Project } from 'src/app/generated/caster-api';
import { SharedModule } from 'src/app/shared/shared.module';

const mockProjects: Project[] = [
  { id: 'p1', name: 'Cyber Range Alpha' },
  { id: 'p2', name: 'Network Defense Exercise' },
  { id: 'p3', name: 'Incident Response Lab' },
  { id: 'p4', name: 'Red Team Simulation' },
  { id: 'p5', name: 'Blue Team Workshop' },
];

describe('ProjectList Preview', () => {
  it('renders with full data and all permissions', async () => {
    await renderComponent(ProjectListComponent, {
      declarations: [ProjectListComponent],
      imports: [
        FormsModule,
        MatTableModule,
        MatSortModule,
        MatToolbarModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatIconModule,
        SharedModule,
      ],
      providers: [
        permissionProvider([
          SystemPermission.CreateProjects,
          SystemPermission.ManageProjects,
        ]),
      ],
      componentProperties: {
        projects: mockProjects,
        isLoading: false,
        dataSource: new MatTableDataSource(mockProjects),
      },
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
