// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, HostBinding, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { ComnSettingsService, Theme } from '@cmusei/crucible-common';
import { HotkeysHelpComponent, HotkeysService } from '@ngneat/hotkeys';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CurrentUserQuery } from './users/state';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
  @HostBinding('class') componentCssClass: string;
  title = 'Caster';
  unsubscribe$: Subject<null> = new Subject<null>();
  constructor(
    public matIconRegistry: MatIconRegistry,
    public overlayContainer: OverlayContainer,
    private currentUserQuery: CurrentUserQuery,
    public sanitizer: DomSanitizer,
    public titleService: Title,
    public settingsService: ComnSettingsService,
    private HotkeysService: HotkeysService,
    private hotkeysDialog: MatDialog
  ) {
    this.currentUserQuery.userTheme$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((theme) => {
        this.setTheme(theme);
      });

    titleService.setTitle(settingsService.settings.AppTopBarText);

    matIconRegistry.setDefaultFontSetClass('mdi');

    matIconRegistry.addSvgIcon(
      'ic_apps_white_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_apps_white_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_chevron_left_white_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_chevron_left_white_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_chevron_right_black_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_chevron_right_black_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_chevron_right_white_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_chevron_right_white_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_expand_more_white_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_expand_more_white_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_clear_black_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_clear_black_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_expand_more_black_24px',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_expand_more_black_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_cancel_circle',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_cancel_circle.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_back_arrow',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_back_arrow_24px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_magnify_search',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_magnify_glass_48px.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_clipboard_copy',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_clipboard_copy.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_trash_can',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_trash_can.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_pencil',
      sanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg-icons/ic_pencil.svg'
      )
    );
    matIconRegistry.addSvgIcon(
      'ic_crucible_caster',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_crucible_caster.svg'
      )
    );

    // Register hotkeys
    const helpFcn: () => void = () => {
      const ref = this.hotkeysDialog.open(HotkeysHelpComponent, {
        width: '500px',
      });
      ref.componentInstance.title = 'Shortcuts Help';
      ref.componentInstance.dimiss.subscribe(() => ref.close());
    };
    const hotkeys = this.settingsService.settings.Hotkeys;
    this.HotkeysService.registerHelpModal(helpFcn);

    for (const k in hotkeys) {
      const v = hotkeys[k];
      this.HotkeysService.addShortcut(v)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe();
    }
  }

  setTheme(theme: Theme) {
    const classList = this.overlayContainer.getContainerElement().classList;
    switch (theme) {
      case Theme.LIGHT:
        this.componentCssClass = theme;
        classList.add(theme);
        classList.remove(Theme.DARK);
        break;
      case Theme.DARK:
        this.componentCssClass = theme;
        classList.add(theme);
        classList.remove(Theme.LIGHT);
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
