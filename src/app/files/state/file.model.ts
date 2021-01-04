// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// We use declaration merging in this way to extend the existing api generated code.
// This removes ambiguity between which interface to import. with declaration merging
// we will always import from the generated code and extended properties listed here
// will be added to the type.
// e.g. import {ModelFile} from 'src/app/generated/caster-api/model/file'
declare module 'src/app/generated/caster-api/model/file' {
  interface ModelFile {
    editorContent?: string;
  }
}
/*
export interface ModelFile extends ModelFile {
  editorContent?: string;
}
*/
export interface FileUI {
  id?: string;
  isSaved: boolean;
  selectedVersionId: string;
}
