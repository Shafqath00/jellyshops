import { SettingsFrame } from "@/features/admin/settings-frame";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
