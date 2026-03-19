# CasterUi Readme

Caster is the primary deployment component of the Crucible framework. Caster is built upon Terraform, an open source "Infrastructure as Code" tool. Caster provides a web interface that gives exercise developers a way to create, share, and manage topology configurations.

For more information on native Terraform constructs used in Caster, please refer to the [Terraform documentation](https://www.terraform.io/docs/index.html).

## Running unit tests

Caster UI uses **Vitest** with `@testing-library/angular`. Test files use the `.vitest.ts` extension.

```bash
npm test                    # Run all tests (jsdom, fast)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm run test:browser        # Run in headless Chromium via Playwright
```

### Permission Tests

Caster has the most comprehensive permission test suite covering 21 system permissions and 5 project permissions:

| File | Coverage |
|------|----------|
| `src/app/test-utils/mock-permission.service.ts` | `permissionProvider(systemPerms, projectPerms)` factory |
| `src/app/permissions/permission.service.vitest.ts` | All `SystemPermission` and `ProjectPermission` values, hierarchy, `canEditProject/canManageProject/canAdminLockProject()` |
| `src/app/project/component/project-details/project-navigation-container/project-navigation-container.component.vitest.ts` | `EditProject` permission gates "Add Directory"; project-level perm only grants for matching project ID |
| `src/app/project/component/project-memberships/project-memberships-page/project-memberships-page.component.vitest.ts` | `ManageProject` permission, `loadProjectPermissions()` called with correct project ID |

Key patterns tested:
- `SystemPermission.EditProjects` grants edit access to all projects
- `ProjectPermission.EditProject` only grants edit access to the specific project
- Export/Import Project are not permission-gated (always visible)

## Reporting bugs and requesting features

Think you found a bug? Please report all Crucible bugs - including bugs for the individual Crucible apps - in the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include as much detail as possible including steps to reproduce, specific app involved, and any error messages you may have received.

Have a good idea for a new feature? Submit all new feature requests through the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include the reasons why you're requesting the new feature and how it might benefit other Crucible users.

## License

Copyright 2021 Carnegie Mellon University. See the [LICENSE.md](./LICENSE.md) files for details.
