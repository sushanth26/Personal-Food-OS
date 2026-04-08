import { TabId } from "../lib/appConfig";

type AppStageProps = {
  activeTab: TabId;
  calorieTarget: number;
  cuisineLabel: string;
  weekReady: boolean;
  remindersCount: number;
};

const tabCopy: Record<TabId, { eyebrow: string; title: string }> = {
  profile: {
    eyebrow: "Personal Food OS",
    title: "Set your nutrition baseline"
  },
  day: {
    eyebrow: "Today in focus",
    title: "Your day plan at a glance"
  },
  week: {
    eyebrow: "Week in motion",
    title: "Your week plan at a glance"
  },
  family: {
    eyebrow: "Family mode",
    title: "Shared planning is coming next"
  },
  reminders: {
    eyebrow: "Prep rhythm",
    title: "Only real soak tasks stay visible"
  },
  groceries: {
    eyebrow: "Shopping rhythm",
    title: "Your grocery flow, simplified"
  }
};

export default function AppStage({
  activeTab,
  calorieTarget: _calorieTarget,
  cuisineLabel: _cuisineLabel,
  weekReady: _weekReady,
  remindersCount: _remindersCount
}: AppStageProps) {
  const copy = tabCopy[activeTab];

  return (
    <section className={`app-stage app-stage-${activeTab}`}>
      <div className="app-stage-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
      </div>

      <div className="app-stage-visual" aria-hidden="true">
        <div className="stage-orb stage-orb-saffron" />
        <div className="stage-orb stage-orb-leaf" />
        <div className="stage-orb stage-orb-ink" />
      </div>
    </section>
  );
}
