import { ProjectPermission } from 'src/app/generated/caster-api';

export class ProjectRolesModel {
  public static ProjectPermissions = new Map<string, string>([
    ['All', 'Gives permission to perform any action within the Project'],
    [
      ProjectPermission.EditProject,
      'Allows performing most actions in the Project. Can make changes to the contents of the Project, including creating and editing Files, Directories, and Workspaces. Can Plan and Apply Workspace Runs.',
    ],
    [
      ProjectPermission.ImportProject,
      'Allows importing Files, Directories, and Workspaces into the Project.',
    ],
    [
      ProjectPermission.LockFiles,
      'Allows for administratively locking files in the Project so that only other users with this Permission can unlock them.',
    ],
    [
      ProjectPermission.ManageProject,
      'Allows for making changes to Project Memberships in the Project.',
    ],
    [
      ProjectPermission.ViewProject,
      'Allows viewing all contents of the Project.',
    ],
  ]);
}
