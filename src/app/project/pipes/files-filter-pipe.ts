// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Pipe, PipeTransform } from '@angular/core';
import { ModelFile } from 'src/app/generated/caster-api';

@Pipe({ name: 'filesFilter' })
export class FilesFilterPipe implements PipeTransform {
  transform(value, args: string): ModelFile[] {
    let files = value as ModelFile[];
    // First arg is the workspaceId.  If no args, return all with workspaceId null
    if (args) {
      files = files.filter((f) => f.workspaceId === args);
    } else {
      files = files.filter((f) => f.workspaceId === null);
    }
    return files;
  }
}
