// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'name-dialog',
  templateUrl: './name-dialog.component.html',
  styleUrls: ['./name-dialog.component.css'],
})
export class NameDialogComponent {
  public title: string;
  public message: string;
  public removeArtifacts = true;
  public name: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<NameDialogComponent>
  ) {
    this.dialogRef.disableClose = true;
    this.name = this.data.nameValue;
  }

  onClick(): void {
    this.data.artifacts && this.data.artifacts.length > 0
      ? (this.data.removeArtifacts = this.removeArtifacts)
      : (this.data.removeArtifacts = false);
    this.data.nameValue = this.name;
    this.data.wasCancelled = false;
    this.dialogRef.close(this.data);
  }

  onCancel(): void {
    this.data.artifacts && this.data.artifacts.length > 0
      ? (this.data.removeArtifacts = this.removeArtifacts)
      : (this.data.removeArtifacts = false);
    this.data.wasCancelled = true;
    this.dialogRef.close(this.data);
  }
}
