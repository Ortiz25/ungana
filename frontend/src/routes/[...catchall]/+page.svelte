<script>
  import { onMount } from 'svelte';
  import { Zap } from '@lucide/svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import PackageScreen from '$lib/screens/PackageScreen.svelte';
  import PaymentScreen from '$lib/screens/PaymentScreen.svelte';
  import InitiatedScreen from '$lib/screens/InitiatedScreen.svelte';
  import PaymentFailedScreen from '$lib/screens/PaymentFailedScreen.svelte';
  import ConnectingScreen from '$lib/screens/ConnectingScreen.svelte';
  import ActiveScreen from '$lib/screens/ActiveScreen.svelte';
  import WarningScreen from '$lib/screens/WarningScreen.svelte';
  import EndedScreen from '$lib/screens/EndedScreen.svelte';
  import ActivatorLoginScreen from '$lib/screens/ActivatorLoginScreen.svelte';
  import ActivatorDashboardScreen from '$lib/screens/ActivatorDashboardScreen.svelte';
  import CoordinatorLoginScreen from '$lib/screens/CoordinatorLoginScreen.svelte';
  import CoordinatorDashboardScreen from '$lib/screens/CoordinatorDashboardScreen.svelte';
  import TimelineScreen from '$lib/screens/TimelineScreen.svelte';
  import CheckSessionScreen from '$lib/screens/CheckSessionScreen.svelte';
  import AdminLoginScreen from '$lib/screens/AdminLoginScreen.svelte';
  import AdminDashboardScreen from '$lib/screens/AdminDashboardScreen.svelte';
  import { PACKAGES, getWarningThreshold } from '$lib/data.js';
  import { getSessionStatus, getAppInfo } from '$lib/api.js';
  import { getClientMac, getStoredClientMac } from '$lib/device.js';
  import { saveDashboardSession, loadDashboardSession, clearDashboardSession } from '$lib/dashboardSession.js';

  let screen = $state('packages');
  let checkingSession = $state(true);
  // 'simulation' (safe default) or 'active' — mirrors the backend's own
  // APP_MODE. 'active' means real money: use real package durations instead
  // of the accelerated demo timers, and hide the "Demo" badges.
  let appMode = $state('simulation');
  let activeInitialRemaining = $state(null);
  // Distinguishes the two ways `screen` can become 'active': arriving fresh
  // from ConnectingScreen right after a payment just confirmed (true), vs.
  // applySessionData() restoring an already-active session — on load, or
  // via CheckSessionScreen's manual lookup (false). ActiveScreen uses this
  // to decide whether to auto-trigger "Go Online" itself: doing that on
  // every restore/reload of an already-connected session would pop a new
  // tab on the user unprompted; doing it once, right after a fresh payment
  // is confirmed, is the actual point of the button.
  let cameFromConnecting = $state(false);
  // True for every path that actually creates/authorises a real backend
  // session before reaching 'connecting' (a paid purchase, BTC, or a real
  // claim-earned-session) — false only for TimelineScreen's pure local/demo
  // shortcut (realUnclaimedSecs<=0, no backend call at all). Gates whether
  // the 'connecting' → 'active' transition re-reads the real session status
  // from the backend (see below) — doing that unconditionally would risk
  // picking up some unrelated *earlier* real session for this MAC and using
  // its expiry instead of the intended local-only demo duration, breaking
  // the "a demo completion can never touch a real session" invariant
  // TimelineScreen's own comments already rely on elsewhere.
  let expectRealSession = $state(true);
  let selectedPkg = $state(PACKAGES.find((p) => p.id === 'weekly'));
  let selectedActivator = $state(null);
  let loggedInActivator = $state(null);
  let loggedInCoordinator = $state(null);
  let loggedInAdmin = $state(null);
  let phone = $state('');
  let warningRemaining = $state(getWarningThreshold(selectedPkg.demoSecs));
  let paymentFailReason = $state(null);
  let simulatePaymentFailure = $state(false);
  let paymentReference = $state(null);

  function goPackages() {
    screen = 'packages';
  }
  // Where TimelineScreen's own "Back" button returns to — 'packages' (the
  // normal path in from PackageScreen's "Earn Access") or 'active' (reached
  // via ActiveScreen's Explore tile, mid-session — see its own comment).
  // Without this, going back from Timeline while a session is running would
  // dump the client at package selection instead of their still-live
  // countdown.
  let timelineOrigin = $state('packages');
  function goTimelineFromActive() {
    timelineOrigin = 'active';
    screen = 'timeline';
  }
  function backFromTimeline() {
    screen = timelineOrigin;
  }
  function goWarning() {
    warningRemaining = getWarningThreshold(selectedPkg.demoSecs);
    screen = 'warning';
  }

  function buildPkgFromSession(data) {
    // 'earned' sessions (claim-earned-session) aren't in PACKAGES — that
    // array is the purchase-screen catalogue, and 'earned' isn't something
    // a client can buy. Handled separately here rather than added to
    // PACKAGES, so it can never leak into the package-selection list.
    if (data.packageId === 'earned') {
      return {
        id: 'earned',
        label: 'Earned',
        duration: 'Earned access',
        price: 0,
        icon: Zap,
        badge: 'Earned via content',
        demoSecs: data.durationSecs ?? 0
      };
    }
    const local = PACKAGES.find((p) => p.id === data.packageId);
    if (!local) return null;
    return { ...local, demoSecs: data.durationSecs ?? local.demoSecs };
  }

  // Shared by the MAC-based auto-check and the username-based manual check
  // (CheckSessionScreen) — applies a GET /session/... response to app state
  // and picks the right screen. Returns false if the payload didn't map to
  // a package we know how to render (caller should treat as "not found").
  function applySessionData(data) {
    const restoredPkg = buildPkgFromSession(data);
    if (!restoredPkg) return false;

    selectedPkg = restoredPkg;
    phone = data.phone ? data.phone.replace(/^\+?254/, '') : '';

    if (data.active) {
      const serverNow = data.serverNow ?? Date.now();
      activeInitialRemaining = data.expiresAt
        ? Math.max(0, Math.round((data.expiresAt - serverNow) / 1000))
        : restoredPkg.demoSecs;
      cameFromConnecting = false; // restoring an existing session, not a fresh payment
      screen = 'active';
    } else {
      screen = 'ended';
    }
    return true;
  }

  // On load, ask the backend whether this device (by MAC) already has a
  // session on record — resume the live timer if it's still active, or
  // show the ended summary if it just expired, instead of always starting
  // fresh at package selection. Falls through to the normal flow if the
  // backend/DB is unreachable or no session is found.
  //
  // A MAC found in the URL just now is always trustworthy. A MAC merely
  // *cached* from a previous visit is not, by itself — getClientMac()
  // persists a randomly-generated MAC on any purchase attempt, including
  // ones that never completed (failed/abandoned payment), so "something is
  // stored" doesn't mean "this device has a real session". We only trust a
  // stored-but-unmatched MAC as proof of "genuinely new user" when it was
  // freshly confirmed by the router just now; otherwise, offer
  // CheckSessionScreen as a safety net rather than assuming "new". This is
  // also the Android case: captive-portal logins open in an isolated
  // WebView with its own storage, separate from the user's regular
  // Chrome — the real MAC only ever reached that WebView's localStorage.
  // A logged-in staff dashboard (activator/coordinator/admin) is a
  // completely separate concern from the client MAC/session flow below —
  // restoring it on reload doesn't need (and shouldn't run) any of that
  // MAC-lookup logic. Deliberately NOT reconciled against the backend
  // here — each dashboard's own initial data load already does that (see
  // their onMount 401-checks), and bounces back to login via onLogout if
  // the token turns out to be stale. Restoring optimistically first (with
  // that fallback in place) means a valid session reloads instantly
  // instead of flashing a loading state while re-verifying something
  // that's almost always still fine.
  function restoreDashboardSession() {
    const saved = loadDashboardSession();
    if (!saved) return false;

    if (saved.role === 'activator') {
      loggedInActivator = saved.data;
      screen = 'activator-dashboard';
    } else if (saved.role === 'coordinator') {
      loggedInCoordinator = saved.data;
      screen = 'coordinator-dashboard';
    } else if (saved.role === 'admin') {
      loggedInAdmin = saved.data;
      screen = 'admin-dashboard';
    } else {
      return false;
    }
    return true;
  }

  onMount(async () => {
    const infoResult = await getAppInfo();
    if (infoResult.ok && infoResult.data?.mode) appMode = infoResult.data.mode;

    if (restoreDashboardSession()) {
      checkingSession = false;
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hasRouterMac = ['id', 'mac', 'client_mac'].some((name) => params.get(name));
    const hasStoredMac = !!getStoredClientMac();

    if (hasRouterMac || hasStoredMac) {
      const result = await getSessionStatus(getClientMac());
      if (result.ok && result.data?.found) {
        applySessionData(result.data);
      } else if (!hasRouterMac) {
        screen = 'check-session';
      }
    } else {
      screen = 'check-session';
    }

    checkingSession = false;
  });
</script>

<AppShell>
  {#if checkingSession}
    <div class="flex items-center justify-center" style="min-height: 100dvh;">
      <div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div>
    </div>
  {:else if screen === 'packages'}
    <PackageScreen
      mode={appMode}
      onSelect={(pkg, activator) => {
        selectedPkg = pkg;
        selectedActivator = activator;
        screen = 'payment';
      }}
      onActivatorLogin={() => (screen = 'activator-login')}
      onCoordinatorLogin={() => (screen = 'coordinator-login')}
      onAdminLogin={() => (screen = 'admin-login')}
      onEarnAccess={() => {
        timelineOrigin = 'packages'; // defensive — could still be 'active' left over from a previous mid-session visit
        screen = 'timeline';
      }}
    />
  {/if}
  {#if screen === 'check-session'}
    <CheckSessionScreen
      onFound={(data) => {
        if (!applySessionData(data)) screen = 'packages';
      }}
      onSkip={goPackages}
      onActivatorLogin={() => (screen = 'activator-login')}
      onCoordinatorLogin={() => (screen = 'coordinator-login')}
      onAdminLogin={() => (screen = 'admin-login')}
    />
  {/if}
  {#if screen === 'timeline'}
    <TimelineScreen
      onBack={backFromTimeline}
      onBuyAccess={goPackages}
      onConnect={(secs, isReal) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
        selectedPkg = { id: 'daily', label: 'Earned', duration: dur, price: 0, icon: Zap, badge: 'Earned via content', demoSecs: secs };
        phone = 'earned';
        expectRealSession = isReal;
        screen = 'connecting';
      }}
    />
  {/if}
  {#if screen === 'coordinator-login'}
    <CoordinatorLoginScreen
      onLogin={(coord) => {
        loggedInCoordinator = coord;
        saveDashboardSession('coordinator', coord);
        screen = 'coordinator-dashboard';
      }}
      onBack={goPackages}
    />
  {/if}
  {#if screen === 'coordinator-dashboard' && loggedInCoordinator}
    <CoordinatorDashboardScreen
      coordinator={loggedInCoordinator}
      onLogout={() => {
        loggedInCoordinator = null;
        clearDashboardSession();
        screen = 'packages';
      }}
    />
  {/if}
  {#if screen === 'activator-login'}
    <ActivatorLoginScreen
      onLogin={(activator) => {
        loggedInActivator = activator;
        saveDashboardSession('activator', activator);
        screen = 'activator-dashboard';
      }}
      onBack={goPackages}
    />
  {/if}
  {#if screen === 'activator-dashboard' && loggedInActivator}
    <ActivatorDashboardScreen
      activator={loggedInActivator}
      onLogout={() => {
        loggedInActivator = null;
        clearDashboardSession();
        screen = 'packages';
      }}
    />
  {/if}
  {#if screen === 'admin-login'}
    <AdminLoginScreen
      onLogin={(admin) => {
        loggedInAdmin = admin;
        saveDashboardSession('admin', admin);
        screen = 'admin-dashboard';
      }}
      onBack={goPackages}
    />
  {/if}
  {#if screen === 'admin-dashboard' && loggedInAdmin}
    <AdminDashboardScreen
      token={loggedInAdmin.token}
      username={loggedInAdmin.username}
      onLogout={() => {
        loggedInAdmin = null;
        clearDashboardSession();
        screen = 'packages';
      }}
    />
  {/if}
  {#if screen === 'payment'}
    <PaymentScreen
      pkg={selectedPkg}
      activator={selectedActivator}
      onBack={goPackages}
      onPay={(p, fail, reference) => {
        phone = p;
        simulatePaymentFailure = fail;
        paymentReference = reference;
        expectRealSession = true; // defensive — could still be false left over from an earlier demo-only earn attempt
        screen = 'initiated';
      }}
      onBtcPaid={() => {
        // Polling already confirmed settlement inside PaymentScreen itself
        // (the QR panel IS the "awaiting confirmation" UI) — go straight to
        // connecting, same as the watch-to-earn flow skips a payment step.
        phone = 'BTC';
        activeInitialRemaining = null;
        expectRealSession = true;
        screen = 'connecting';
      }}
    />
  {/if}
  {#if screen === 'initiated'}
    <InitiatedScreen
      pkg={selectedPkg}
      {phone}
      activator={selectedActivator}
      willFail={simulatePaymentFailure}
      reference={paymentReference}
      mode={appMode}
      onContinue={() => (screen = 'connecting')}
      onFailed={(reason) => {
        paymentFailReason = reason;
        screen = 'payment-failed';
      }}
    />
  {/if}
  {#if screen === 'payment-failed'}
    <PaymentFailedScreen
      pkg={selectedPkg}
      {phone}
      mode={appMode}
      reason={paymentFailReason}
      onRetry={() => (screen = 'payment')}
      onHome={goPackages}
    />
  {/if}
  {#if screen === 'connecting'}
    <ConnectingScreen
      onConnected={async () => {
        // The router auth this just completed may have folded in leftover
        // time from a still-active prior session (see authorization.js's
        // completeAuthorization — "Extend Session" adds to what's running
        // rather than resetting it), so selectedPkg.demoSecs alone (just
        // this grant) is no longer trustworthy as "how long the countdown
        // should actually run". Re-read the real expiry from the backend
        // instead of assuming it — same lookup applySessionData() uses to
        // restore a session on page load. Skipped entirely for the pure
        // local/demo shortcut (expectRealSession false) — no real session
        // was created for that one, so looking one up here could pick up
        // some unrelated *earlier* real session for this MAC instead.
        activeInitialRemaining = null;
        if (expectRealSession) {
          const result = await getSessionStatus(getClientMac());
          if (result.ok && result.data?.active && result.data.expiresAt) {
            const serverNow = result.data.serverNow ?? Date.now();
            activeInitialRemaining = Math.max(0, Math.round((result.data.expiresAt - serverNow) / 1000));
            // The ring/percentage in ActiveScreen treats pkg.demoSecs as the
            // 100% mark — it must match this real total, or a session that
            // just got extended would render a ring stuck past full (or a
            // countdown that hits zero while the router still has the client
            // authorised for longer).
            selectedPkg = { ...selectedPkg, demoSecs: activeInitialRemaining };
          }
        }
        cameFromConnecting = true; // fresh payment just confirmed — safe to auto-trigger Go Online
        screen = 'active';
      }}
    />
  {/if}
  {#if screen === 'active'}
    <ActiveScreen
      pkg={selectedPkg}
      autoGoOnline={cameFromConnecting}
      {phone}
      mode={appMode}
      initialRemaining={activeInitialRemaining}
      onExpiring={goWarning}
      onExtend={goPackages}
      onExplore={goTimelineFromActive}
    />
  {/if}
  {#if screen === 'warning'}
    <WarningScreen
      pkg={selectedPkg}
      remaining={warningRemaining}
      mode={appMode}
      onExtend={goPackages}
      onDismiss={() => (screen = 'ended')}
    />
  {/if}
  {#if screen === 'ended'}
    <EndedScreen pkg={selectedPkg} {phone} onBuyAgain={goPackages} />
  {/if}
</AppShell>
