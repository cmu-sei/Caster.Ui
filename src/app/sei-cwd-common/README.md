## SEI CWD Common Modules

#### Description

SEI CWD Common modules are a set of angular modules, components and services that are shared across the
Caster UI. Settings and authentication are not part of this folder; they come from `@cmusei/crucible-common`
(`ComnSettingsModule`, `ComnAuthModule`).

#### Modules

- [Toolbar Module](cwd-toolbar/README.md) (`CwdToolbarModule`)
- [Table Module](cwd-table/README.md) (`CwdTableModule`)
- `SeiCwdCommonModule`: declares and exports the `name-dialog` component (`NameDialogComponent`)

#### Services

- `ErrorService` (`cwd-error/`): an `ErrorHandler` that shows API and client errors through the `SystemMessageService`
- `SystemMessageService` and `SystemMessageComponent` (`cwd-system-message/`): display a message in a bottom sheet
- `CanDeactivateGuard` (`cwd-route-guards/`): asks for confirmation before leaving a component that reports unsaved changes

#### Replacing Services

If you would like to replace or extend any of these services. Angular makes this process very simple.

```typescript
// Example of replacing the global error handler, which app.module.ts sets to ErrorService.
import { ErrorHandler, NgModule } from '@angular/core';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, CwdToolbarModule],
  // Replace ErrorService in the providers array
  providers: [{ provide: ErrorHandler, useClass: <YOUR_CUSTOM_CLASS> }],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Cwd Modules will expect a certain format for dependent modules, services and components. As such you
should extend existing classes when possible.
