// Visual preview — renders the TopbarComponent with title, user name, and full menu.
// Run: npm run test:vitest:preview -- src/app/shared/components/top-bar/topbar.component.preview.ts

import { describe, it } from 'vitest';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TopbarComponent } from './topbar.component';
import { TopbarView } from './topbar.models';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { hold } from 'src/app/test-utils/preview-helper';
import { SystemPermission } from 'src/app/generated/caster-api';
import { of } from 'rxjs';
import { ComnAuthQuery } from '@cmusei/crucible-common';
import { CurrentUserQuery } from 'src/app/users/state';

const allPermissions: SystemPermission[] = [
  SystemPermission.CreateProjects,
  SystemPermission.ViewProjects,
  SystemPermission.EditProjects,
  SystemPermission.ManageProjects,
  SystemPermission.ViewUsers,
  SystemPermission.ViewModules,
  SystemPermission.ViewWorkspaces,
  SystemPermission.ViewVlans,
  SystemPermission.ViewRoles,
  SystemPermission.ViewGroups,
];

describe('Topbar Preview', () => {
  it('renders with full data and admin menu', async () => {
    await renderComponent(TopbarComponent, {
      declarations: [TopbarComponent],
      imports: [
        MatToolbarModule,
        MatMenuModule,
        MatButtonModule,
        MatSlideToggleModule,
        MatIconModule,
        MatTooltipModule,
      ],
      providers: [
        permissionProvider(allPermissions),
        {
          provide: ComnAuthQuery,
          useValue: {
            userTheme$: of('light-theme'),
          },
        },
        {
          provide: CurrentUserQuery,
          useValue: {
            userTheme$: of('light-theme'),
            select: () =>
              of({
                name: 'Jane Doe',
                id: 'user-001',
                theme: 'light-theme',
                lastRoute: '/',
              }),
            getLastRoute: () => '/',
          },
        },
      ],
      componentProperties: {
        title: 'Caster',
        topbarColor: '#0F1D47',
        topbarTextColor: '#FFFFFF',
        topbarView: TopbarView.CASTER_HOME,
        sidenav: { opened: true },
      },
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
