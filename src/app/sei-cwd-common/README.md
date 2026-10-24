## SEI CWD Common

#### Description

SEI CWD Common is a set of standalone Angular components, directives and services that are shared across the
Caster UI. Settings and authentication are not part of this folder; they come from `@cmusei/crucible-common`
(`ComnSettingsModule`, `ComnAuthModule`).

#### Components

- [Toolbar](cwd-toolbar/README.md)
- [Table](cwd-table/README.md)
- `NameDialogComponent` (`name-dialog/`)

#### Services

- `ErrorService` (`cwd-error/`): an `ErrorHandler` that shows API and client errors through the `SystemMessageService`
- `SystemMessageService` and `SystemMessageComponent` (`cwd-system-message/`): display a message in a bottom sheet
- `CanDeactivateGuard` (`cwd-route-guards/`): asks for confirmation before leaving a component that reports unsaved changes

#### Replacing Services

If you would like to replace or extend any of these services. Angular makes this process very simple.

```typescript
// Example of replacing the global error handler, which app.config.ts sets to ErrorService.
bootstrapApplication(AppComponent, {
  providers: [
    // Replace ErrorService in the providers array
    { provide: ErrorHandler, useClass: <YOUR_CUSTOM_CLASS> },
  ],
});
```

These components and services expect a certain format for dependent modules, services and components. As such you
should extend existing classes when possible.
