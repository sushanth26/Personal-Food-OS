import { ReactNode, useEffect, useRef } from "react";
import { TabId, tabs } from "../lib/appConfig";
import AppIcon from "./AppIcon";

type TabsNavProps = {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  showProfileTab?: boolean;
  className?: string;
  trailingContent?: ReactNode;
};

export default function TabsNav({
  activeTab,
  onChange,
  showProfileTab = true,
  className = "",
  trailingContent
}: TabsNavProps) {
  const visibleTabs = showProfileTab ? tabs : tabs.filter((tab) => tab.id !== "profile");
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const activeButton = buttonRefs.current[activeTab];
    if (!activeButton) {
      return;
    }

    activeButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }, [activeTab]);

  return (
    <nav className={className ? `tabs ${className}` : "tabs"} aria-label="Primary sections">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          ref={(node) => {
            buttonRefs.current[tab.id] = node;
          }}
          type="button"
          className={activeTab === tab.id ? `tab-button active tab-${tab.accent}` : `tab-button tab-${tab.accent}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="tab-content">
            <AppIcon name={tab.id} className="tab-icon" />
            <span>{tab.label}</span>
          </span>
        </button>
      ))}
      {trailingContent}
    </nav>
  );
}
