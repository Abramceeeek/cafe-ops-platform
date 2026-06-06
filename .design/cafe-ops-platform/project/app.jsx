/* ════ HubSync — design canvas assembly ════ */
const { useState } = React;

const PW = 350, PH = 754;            // phone artboard
const Phone = ({ dark, children }) => (
  <IOSDevice dark={dark} width={PW} height={PH}>{children}</IOSDevice>
);

function Canvas() {
  return (
    <DesignCanvas>
      <DCSection id="system" title="Visual System" subtitle="bobo & wild · HubSync — warm artisanal-utilitarian. Terracotta accent, light shop/admin, dark hub.">
        <DCArtboard id="vs" label="Design language" width={980} height={560}><VisualSystem /></DCArtboard>
      </DCSection>

      <DCSection id="login" title="Sign In" subtitle="Internal staff only — no public sign-up. Accounts issued by Admin. Three entry points across the apps.">
        <DCArtboard id="l1" label="Shop App · login" width={PW} height={PH}><Phone><ShopLogin /></Phone></DCArtboard>
        <DCArtboard id="l2" label="Hub Terminal · login" width={PW} height={PH}><Phone dark><HubLogin /></Phone></DCArtboard>
        <DCArtboard id="l3" label="Admin Web · login" width={1180} height={680}>
          <ChromeWindow width={1180} height={680} url="hubsync.app/sign-in" tabs={[{ title: 'HubSync · Sign in' }]}><AdminLogin /></ChromeWindow>
        </DCArtboard>
      </DCSection>

      <DCSection id="shop" title="Shop App — FOH & Kitchen Managers" subtitle="iOS · light. Role-scoped catalog, the Two-Way Handshake, lead-time gating, split orders, tracking & sign-off.">
        <DCArtboard id="s1" label="FOH · Home — cut-off + requests" width={PW} height={PH}><Phone><FohHome /></Phone></DCArtboard>
        <DCArtboard id="s2" label="New Request · catalog + modifiers" width={PW} height={PH}><Phone><ShopCatalog /></Phone></DCArtboard>
        <DCArtboard id="s3" label="Cart · lead-time picker + split" width={PW} height={PH}><Phone><ShopCart /></Phone></DCArtboard>
        <DCArtboard id="s4" label="Handshake · Final Confirm" width={PW} height={PH}><Phone><ShopConfirm /></Phone></DCArtboard>
        <DCArtboard id="s5" label="My Templates" width={PW} height={PH}><Phone><ShopTemplates /></Phone></DCArtboard>
        <DCArtboard id="s6" label="Order history" width={PW} height={PH}><Phone><ShopHistory /></Phone></DCArtboard>
        <DCArtboard id="s7" label="Order tracking timeline" width={PW} height={PH}><Phone><ShopTracking /></Phone></DCArtboard>
        <DCArtboard id="s8" label="Delivery sign-off" width={PW} height={PH}><Phone><ShopSignoff /></Phone></DCArtboard>
        <DCArtboard id="s9" label="Kitchen Mgr · home + 86 alert" width={PW} height={PH}><Phone><KitchenHome /></Phone></DCArtboard>
      </DCSection>

      <DCSection id="hub" title="Hub App — Specialists" subtitle="iOS · dark kitchen displays. Meat / Bread / Pastry: inbox, approve & quote, the 86 protocol.">
        <DCArtboard id="h1" label="Meat · Inbox (pending)" width={PW} height={PH}><Phone dark><HubInbox /></Phone></DCArtboard>
        <DCArtboard id="h2" label="Approve & Quote" width={PW} height={PH}><Phone dark><HubApprove /></Phone></DCArtboard>
        <DCArtboard id="h3" label="Bread · 86 toggle / catalog" width={PW} height={PH}><Phone dark><Hub86 /></Phone></DCArtboard>
        <DCArtboard id="h4" label="Production Board · wall display" width={1000} height={600}><HubBoard /></DCArtboard>
      </DCSection>

      <DCSection id="courier" title="Hub App — Courier" subtitle="iOS · dark. Optimised manifest, hand-off checklist, two-party delivery sign-off.">
        <DCArtboard id="c1" label="Today's manifest + route" width={PW} height={PH}><Phone dark><CourierManifest /></Phone></DCArtboard>
        <DCArtboard id="c2" label="Stop · hand-off checklist" width={PW} height={PH}><Phone dark><CourierStop /></Phone></DCArtboard>
      </DCSection>

      <DCSection id="admin" title="Admin Web — Brand Owner" subtitle="Browser · light. Live ops kanban, catalog CRUD, financial reports, user management.">
        <DCArtboard id="a1" label="Live Operations" width={1180} height={764}>
          <ChromeWindow width={1180} height={764} url="hubsync.app/ops" tabs={[{ title: 'HubSync · Operations' }]}><AdminOps /></ChromeWindow>
        </DCArtboard>
        <DCArtboard id="a2" label="Catalog Management" width={1180} height={764}>
          <ChromeWindow width={1180} height={764} url="hubsync.app/catalog" tabs={[{ title: 'HubSync · Catalog' }]}><AdminCatalog /></ChromeWindow>
        </DCArtboard>
        <DCArtboard id="a3" label="Financial Reports" width={1180} height={764}>
          <ChromeWindow width={1180} height={764} url="hubsync.app/finance" tabs={[{ title: 'HubSync · Finance' }]}><AdminFinance /></ChromeWindow>
        </DCArtboard>
        <DCArtboard id="a4" label="User Management" width={1180} height={764}>
          <ChromeWindow width={1180} height={764} url="hubsync.app/users" tabs={[{ title: 'HubSync · Users' }]}><AdminUsers /></ChromeWindow>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Canvas />);
