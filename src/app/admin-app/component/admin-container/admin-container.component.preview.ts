// Visual preview — renders the AdminContainerComponent with all sidebar menu items visible.
// Run: npm run test:vitest:preview -- src/app/admin-app/component/admin-container/admin-container.component.preview.ts

import { describe, it } from 'vitest';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AdminContainerComponent } from './admin-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { hold } from 'src/app/test-utils/preview-helper';
import { SystemPermission } from 'src/app/generated/caster-api';
import { SharedModule } from 'src/app/shared/shared.module';
import { of } from 'rxjs';
import { RouterQuery } from '@datorama/akita-ng-router-store';

const allViewPermissions: SystemPermission[] = [
  SystemPermission.ViewProjects,
  SystemPermission.ViewUsers,
  SystemPermission.ViewModules,
  SystemPermission.ViewWorkspaces,
  SystemPermission.ViewVlans,
  SystemPermission.ViewRoles,
  SystemPermission.ViewGroups,
];

describe('AdminContainer Preview', () => {
  it('renders with all menu items visible', async () => {
    await renderComponent(AdminContainerComponent, {
      declarations: [AdminContainerComponent],
      imports: [
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        SharedModule,
      ],
      providers: [
        {
          provide: RouterQuery,
          useValue: {
            selectQueryParams: () => of(null),
          },
        },
        permissionProvider(allViewPermissions),
      ],
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
