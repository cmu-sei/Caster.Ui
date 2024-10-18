// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, HostBinding, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { ComnSettingsService, Theme } from '@cmusei/crucible-common';
import { HotkeysHelpComponent, HotkeysService } from '@ngneat/hotkeys';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CurrentUserQuery, CurrentUserStore } from './users/state';

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
    private hotkeysDialog: MatDialog,
    private router: Router,
    private currentUserStore: CurrentUserStore
  ) {
    currentUserQuery.userTheme$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((theme) => {
        this.setTheme(theme);
      });

    titleService.setTitle(settingsService.settings.AppTopBarText);

    this.addIcons();

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

    // store last route to return to from administration
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.unsubscribe$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateLastRoute(event.url);
      });
  }

  setTheme(theme: Theme) {
    const body = document.getElementsByTagName('body')[0];
    switch (theme) {
      case Theme.LIGHT:
        body.classList.remove(Theme.DARK);
        body.classList.add(Theme.LIGHT);
        break;
      case Theme.DARK:
        body.classList.remove(Theme.LIGHT);
        body.classList.add(Theme.DARK);
    }
  }

  updateLastRoute(route: string) {
    if (route !== '/admin') {
      this.currentUserStore.update({ lastRoute: route });
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  addIcons(): void {
    this.matIconRegistry.setDefaultFontSetClass('mdi');

    this.matIconRegistry.addSvgIcon(
      'ic_apps_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_apps_white_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_chevron_left_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_left_white_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_chevron_right_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_right_black_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_chevron_right_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_right_white_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_expand_more_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_expand_more_white_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_clear_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_clear_black_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_expand_more_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_expand_more_black_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_cancel_circle',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_cancel_circle.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_back_arrow',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_back_arrow_24px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_magnify_search',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_magnify_glass_48px.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_clipboard_copy',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_clipboard_copy.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_trash_can',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_trash_can.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_pencil',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_pencil.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ic_crucible_caster',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_crucible_caster.svg'
      )
    );
  }
}
