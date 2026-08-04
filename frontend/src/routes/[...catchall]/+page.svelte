<script>
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
  import { PACKAGES, WARNING_THRESHOLD } from '$lib/data.js';

  let screen = $state('packages');
  let selectedPkg = $state(PACKAGES.find((p) => p.id === 'weekly'));
  let selectedActivator = $state(null);
  let loggedInActivator = $state(null);
  let loggedInCoordinator = $state(null);
  let phone = $state('');
  let warningRemaining = $state(WARNING_THRESHOLD);
  let paymentFailReason = $state(null);
  let simulatePaymentFailure = $state(false);
  let paymentReference = $state(null);

  function goPackages() {
    screen = 'packages';
  }
  function goWarning() {
    warningRemaining = WARNING_THRESHOLD;
    screen = 'warning';
  }
</script>

<AppShell>
  {#if screen === 'packages'}
    <PackageScreen
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
      reason={paymentFailReason}
      onRetry={() => (screen = 'payment')}
      onHome={goPackages}
    />
  {/if}
  {#if screen === 'connecting'}
    <ConnectingScreen onConnected={() => (screen = 'active')} />
  {/if}
  {#if screen === 'active'}
    <ActiveScreen pkg={selectedPkg} {phone} onExpiring={goWarning} onExtend={goPackages} />
  {/if}
  {#if screen === 'warning'}
    <WarningScreen pkg={selectedPkg} remaining={warningRemaining} onExtend={goPackages} onDismiss={() => (screen = 'ended')} />
  {/if}
  {#if screen === 'ended'}
    <EndedScreen pkg={selectedPkg} {phone} onBuyAgain={goPackages} />
  {/if}
</AppShell>
