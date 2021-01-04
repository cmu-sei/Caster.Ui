// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

export interface DirectoryUI {
  id?: string;
  isExpanded: boolean;
  isFilesExpanded: boolean;
  isWorkspacesExpanded: boolean;
  isDirectoriesExpanded: boolean;
}
