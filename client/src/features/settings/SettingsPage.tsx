import { useSearchParams } from 'react-router-dom';
import { Bell, Lock, ShieldCheck, SlidersHorizontal, User } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSection } from './ProfileSection';
import { PreferencesSection } from './PreferencesSection';
import { NotificationsSection } from './NotificationsSection';
import { SecuritySection } from './SecuritySection';
import { PrivacySection } from './PrivacySection';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'privacy', label: 'Privacy & data', icon: ShieldCheck },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'profile';
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Manage your profile, preferences, notifications, security and data." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList aria-label="Settings sections" className="w-full sm:w-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon aria-hidden /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-5 max-w-3xl">
          <TabsContent value="profile"><ProfileSection /></TabsContent>
          <TabsContent value="preferences"><PreferencesSection /></TabsContent>
          <TabsContent value="notifications"><NotificationsSection /></TabsContent>
          <TabsContent value="security"><SecuritySection /></TabsContent>
          <TabsContent value="privacy"><PrivacySection /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
