// Visual preview — renders the UserListComponent with realistic mock users.
// Run: npm run test:vitest:preview -- src/app/admin-app/component/admin-users/user-list/user-list.component.preview.ts

import { describe, it } from 'vitest';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { UserListComponent } from './user-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { hold } from 'src/app/test-utils/preview-helper';
import { SystemPermission, User } from 'src/app/generated/caster-api';

const mockUsers: User[] = [
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Alice Johnson', roleId: 'role-admin' },
  { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Bob Williams', roleId: 'role-editor' },
  { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', name: 'Carol Martinez', roleId: null },
  { id: 'd4e5f6a7-b8c9-0123-defa-234567890123', name: 'David Chen', roleId: 'role-admin' },
  { id: 'e5f6a7b8-c9d0-1234-efab-345678901234', name: 'Eva Thompson', roleId: 'role-viewer' },
  { id: 'f6a7b8c9-d0e1-2345-fabc-456789012345', name: 'Frank Garcia', roleId: null },
  { id: 'a7b8c9d0-e1f2-3456-abcd-567890123456', name: 'Grace Lee', roleId: 'role-editor' },
];

describe('UserList Preview', () => {
  it('renders with full user data and edit permissions', async () => {
    await renderComponent(UserListComponent, {
      declarations: [UserListComponent],
      imports: [
        FormsModule,
        ClipboardModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatSelectModule,
        MatDialogModule,
      ],
      providers: [
        permissionProvider([
          SystemPermission.ViewUsers,
          SystemPermission.ManageUsers,
        ]),
      ],
      componentProperties: {
        users: mockUsers,
        isLoading: false,
        canEdit: true,
      },
    });

    // Hold the component visible — close browser or Ctrl+C to stop
    await hold();
  });
});
