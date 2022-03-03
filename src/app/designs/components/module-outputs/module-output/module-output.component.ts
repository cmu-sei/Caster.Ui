import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ModuleOutput } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-module-output',
  templateUrl: './module-output.component.html',
  styleUrls: ['./module-output.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleOutputComponent implements OnInit {
  @Input()
  moduleName: string;

  @Input()
  output: ModuleOutput;

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  toTerraform(): string {
    return `$\{module.${this.moduleName}.${this.output.name}}`;
  }

  onClipboardSuccess() {
    this.snackBar.open('Copied to clipboard', 'Dismiss');
  }
}
