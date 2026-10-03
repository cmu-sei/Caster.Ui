# CasterUi Readme

Caster is the primary deployment component of the Crucible framework. Caster is built upon Terraform, an open source "Infrastructure as Code" tool. Caster provides a web interface that gives exercise developers a way to create, share, and manage topology configurations.

For more information on native Terraform constructs used in Caster, please refer to the [Terraform documentation](https://www.terraform.io/docs/index.html).

## Running unit tests

Unit tests run on Angular's `@angular/build:unit-test` builder with Vitest, jsdom
and Angular Testing Library, under zone change detection like the app. The setup
follows the shared Crucible UI test standard.

```bash
npm test                 # run every spec once
npm run test:watch       # re-run on change
npm run test:coverage    # run once with coverage (text, json and html in coverage/); enforces the thresholds in angular.json
```

Run a subset with `npx ng test caster-ui --watch=false --include='src/app/workspace/**/*.spec.ts'`.

Shared helpers (rendering, default providers, typed API stubs, permission
grants, SignalR fakes) live in `src/app/test-utils/`. `vitest.config.ts` applies
the Akita patch in `patches/` with `patch-package` when the tests start.

## Reporting bugs and requesting features

Think you found a bug? Please report all Crucible bugs - including bugs for the individual Crucible apps - in the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include as much detail as possible including steps to reproduce, specific app involved, and any error messages you may have received.

Have a good idea for a new feature? Submit all new feature requests through the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include the reasons why you're requesting the new feature and how it might benefit other Crucible users.

## License

Copyright 2021 Carnegie Mellon University. See the [LICENSE.md](./LICENSE.md) files for details.
