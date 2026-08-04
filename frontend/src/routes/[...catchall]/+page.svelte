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
  import { PACKAGES, getWarningThreshold } from '$lib/data.js';
  import { getSessionStatus, getAppInfo } from '$lib/api.js';
  import { getClientMac, getStoredClientMac } from '$lib/device.js';

  let screen = $state('packages');
  let checkingSession = $state(true);
  // 'simulation' (safe default) or 'active' — mirrors the backend's own
  // APP_MODE. 'active' means real money: use real package durations instead
  // of the accelerated demo timers, and hide the "Demo" badges.
  let appMode = $state('simulation');
  let activeInitialRemaining = $state(null);
  let selectedPkg = $state(PACKAGES.find((p) => p.id === 'weekly'));
  let selectedActivator = $state(null);
  let loggedInActivator = $state(null);
  let loggedInCoordinator = $state(null);
  let phone = $state('');
  let warningRemaining = $state(getWarningThreshold(selectedPkg.demoSecs));
  let paymentFailReason = $state(null);
  let simulatePaymentFailure = $state(false);
  let paymentReference = $state(null);

  function goPackages() {
    screen = 'packages';
  }
  function goWarning() {
    warningRemaining = getWarningThreshold(selectedPkg.demoSecs);
    screen = 'warning';
  }

  function buildPkgFromSession(data) {
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
  onMount(async () => {
    const infoResult = await getAppInfo();
    if (infoResult.ok && infoResult.data?.mode) appMode = infoResult.data.mode;

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
      onEarnAccess={() => (screen = 'timeline')}
    />
  {/if}
  {#if screen === 'check-session'}
    <CheckSessionScreen
      onFound={(data) => {
        if (!applySessionData(data)) screen = 'packages';
      }}
      onSkip={goPackages}
    />
  {/if}
  {#if screen === 'timeline'}
    <TimelineScreen
      onBack={goPackages}
      onBuyAccess={goPackages}
      onConnect={(secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
        selectedPkg = { id: 'daily', label: 'Earned', duration: dur, price: 0, icon: Zap, badge: 'Earned via content', demoSecs: secs };
        phone = 'earned';
        screen = 'connecting';
      }}
    />
  {/if}
  {#if screen === 'coordinator-login'}
    <CoordinatorLoginScreen
      onLogin={(coord) => {
        loggedInCoordinator = coord;
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
        screen = 'packages';
      }}
    />
  {/if}
  {#if screen === 'activator-login'}
    <ActivatorLoginScreen
      onLogin={(activator) => {
        loggedInActivator = activator;
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
        screen = 'initiated';
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
      onConnected={() => {
        activeInitialRemaining = null;
        screen = 'active';
      }}
    />
  {/if}
  {#if screen === 'active'}
    <ActiveScreen
      pkg={selectedPkg}
      {phone}
      mode={appMode}
      initialRemaining={activeInitialRemaining}
      onExpiring={goWarning}
      onExtend={goPackages}
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
