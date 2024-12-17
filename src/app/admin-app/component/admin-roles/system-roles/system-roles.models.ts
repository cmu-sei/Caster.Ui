import { SystemPermission } from 'src/app/generated/caster-api';

export class SystemRolesModel {
  public static SystemPermissions = new Map<string, string>([
    ['All', 'Gives permission to perform any action'],
    [
      SystemPermission.CreateProjects,
      'Allows creation of new Projects. The creating User will be added as a Manager to the new Project.',
    ],
    [
      SystemPermission.EditProjects,
      'Allows performing most actions in a Project. Can make changes to the contents of a Project, including creating and editing Files, Directories, and Workspaces. Can Plan and Apply Workspace Runs.',
    ],
    [
      SystemPermission.ViewProjects,
      'Allows viewing all Projects and their Users and Groups. Implictly allows listing all Users and Groups. Enables the Projects Administration panel',
    ],
    [
      SystemPermission.ImportProjects,
      'Allows importing Projects into the system',
    ],
    [
      SystemPermission.LockFiles,
      'Allows for administratively locking files in a Project so that only other users with this Permission can unlock them.',
    ],
    [
      SystemPermission.ManageProjects,
      'Allows for making changes to Project Memberships.',
    ],
    [
      SystemPermission.ViewGroups,
      'Allows viewing all Groups and Group Memberships. Implicitly allows listing of Users. Enables the Groups Administration panel. ',
    ],
    [
      SystemPermission.ManageGroups,
      'Allows for creating and making changes to all Groups and Group Memberships.',
    ],
    [SystemPermission.ViewHosts, 'Allows viewing of Hosts'],
    [
      SystemPermission.ManageHosts,
      'Allows for creating and making changes to Hosts. This is only available through the API.',
    ],
    [
      SystemPermission.ViewModules,
      'Allows for viewing all Modules. Enables the Modules Administration panel',
    ],
    [SystemPermission.ManageModules, 'Allows for making changes to Modules.'],
    [
      SystemPermission.ViewRoles,
      'Allows viewing all Roles and their Permissions. Enables the Roles Administration panel',
    ],
    [
      SystemPermission.ManageRoles,
      'Allows for making changes to Roles. Can create new Roles, rename existing Roles, and assign and remove Permissions to Roles.',
    ],
    [
      SystemPermission.ViewUsers,
      'Allows viewing all Users. Enables the Users Administration panel',
    ],
    [
      SystemPermission.ManageUsers,
      'Allows for making changes to Users. Can add or remove Users and change their assigned Roles.',
    ],
    [
      SystemPermission.ViewVlans,
      'Allows viewing all VLAN pools. Enables the VLANs Administration panel.',
    ],
    [
      SystemPermission.ManageVlans,
      'Allows for making changes to VLANs. Can assign VLAN Pools to Projects if the User also has the ViewProjects Permission.',
    ],
    [
      SystemPermission.ViewWorkspaces,
      'Allows for viewing all Workspaces and their Runs. Enables the Workspaces Administration panel',
    ],
    [
      SystemPermission.ManageWorkspaces,
      'Allows for making changes in the Workspaces Administrative panel.',
    ],
  ]);
}
