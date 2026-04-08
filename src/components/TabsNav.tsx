import { TabId, tabs } from "../lib/appConfig";

type TabsNavProps = {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  showProfileTab?: boolean;
};

export default function TabsNav({ activeTab, onChange, showProfileTab = true }: TabsNavProps) {
  const visibleTabs = showProfileTab ? tabs : tabs.filter((tab) => tab.id !== "profile");

  return (
    <nav className="tabs" aria-label="Primary sections">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "tab-button active" : "tab-button"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
