## CWD Toolbar

#### Description

The CWD toolbar creates a common CWD toolbar using angular Cdk portals and content projection.
The goal is to let components provide buttons, menus and actions on the toolbar in a dynamic
way.

This allows you to build the toolbar navigation and the actions needed for your application based on the components
that are displayed.

#### Dependencies

- `@angular/material` - npm
- `@angular/cdk` - npm
- `bootstrap` - npm (layout utility classes in the toolbar template)

#### Components

- `CwdToolbarComponent` (`cas-cwd-toolbar`)
- `CwdToolbarNavigationItemComponent` (`cas-cwd-toolbar-navigation-item`)
- `CwdToolbarActionItemComponent` (`cas-cwd-toolbar-action-item`)

#### Implementation

The components are standalone. Import the ones your component uses.

```typescript
import {
  CwdToolbarComponent,
  CwdToolbarActionItemComponent,
  CwdToolbarNavigationItemComponent,
} from './sei-cwd-common/cwd-toolbar';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [CwdToolbarComponent, CwdToolbarActionItemComponent, CwdToolbarNavigationItemComponent, RouterOutlet],
})
export class AppComponent {}
```

#### Example

You can then use the components to provide navigation and actions to the toolbar from within your components. typically this code
will be put in a smart component.

```html
<cas-cwd-toolbar></cas-cwd-toolbar>
<router-outlet></router-outlet>

<cas-cwd-toolbar-navigation-item>
  <!-- This block will show up in your navigation row -->
  <button mat-button [matMenuTriggerFor]="menu">Administrator@this.ws</button>
  <mat-menu #menu="matMenu">
    <button mat-menu-item>Settings</button>
    <button (click)="logout()" mat-menu-item>Logout</button>
  </mat-menu>
</cas-cwd-toolbar-navigation-item>

<cas-cwd-toolbar-action-item selector="#toolbar-action">
  <!-- This block will show up in your action row -->
  <button mat-button>New</button>
</cas-cwd-toolbar-action-item>
```

_app.component.html_

`cas-cwd-toolbar-navigation-item` moves its content into the toolbar's `#toolbar-navigation` element.
`cas-cwd-toolbar-action-item` moves its content into the element its `selector` input matches; the toolbar
provides `#toolbar-action` in its action row.

Additionally you will handle any events within your component.
`<button (click)="logout()" mat-menu-item>Logout</button>`

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppComponent {
  title = 'Caster';

  constructor(private authService: AuthService) {}

  logout() {
    this.authService.logout();
  }
}
```

_app.component.ts_

#### Theme

The toolbar's styles are in the `cwd-toolbar-theme` mixin in `theme/theme.scss`. Import it into your global
stylesheet next to your material theme (this app's is `src/styles/styles.scss`) and include it. The mixin
takes a theme argument but does not use its colors.

```scss
@use '@angular/material' as mat;
@import '../app/sei-cwd-common/cwd-toolbar/theme/theme';

html {
  @include mat.theme((color: mat.$azure-palette));
}

@include cwd-toolbar-theme(());
```
