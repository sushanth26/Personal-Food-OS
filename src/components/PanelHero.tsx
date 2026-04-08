import AppIcon from "./AppIcon";

type PanelHeroProps = {
  tone: "profile" | "day" | "week" | "reminders" | "groceries" | "family";
  kicker: string;
  title: string;
  chips?: string[];
};

export default function PanelHero({ tone, kicker, title, chips = [] }: PanelHeroProps) {
  return (
    <section className={`panel-hero panel-hero-${tone}`}>
      <div className="panel-hero-copy">
        <p className="section-kicker">{kicker}</p>
        <h3>
          <AppIcon name={tone} className="panel-hero-icon" />
          <span>{title}</span>
        </h3>
        {chips.length ? (
          <div className="panel-hero-chip-row">
            {chips.map((chip) => (
              <span key={chip} className="panel-hero-chip">
                <AppIcon name="spark" className="panel-chip-icon" />
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel-hero-art" aria-hidden="true">
        <div className="panel-hero-plate" />
        <div className="panel-hero-garnish panel-hero-garnish-a" />
        <div className="panel-hero-garnish panel-hero-garnish-b" />
        <div className="panel-hero-garnish panel-hero-garnish-c" />
      </div>
    </section>
  );
}
