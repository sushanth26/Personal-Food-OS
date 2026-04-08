import { GroceryListItem } from "../types";
import PanelHero from "./PanelHero";

type GroupedGroceries = {
  fruits: GroceryListItem[];
  vegetables: GroceryListItem[];
  dry_items: GroceryListItem[];
};

type GroceriesPanelProps = {
  weekMode: boolean;
  hasGroceries: boolean;
  groupedGroceries: GroupedGroceries;
  checkedGroceries: string[];
  onToggleItem: (itemId: string) => void;
  onResetChecks: () => void;
};

export default function GroceriesPanel({
  weekMode,
  hasGroceries,
  groupedGroceries,
  checkedGroceries,
  onToggleItem,
  onResetChecks
}: GroceriesPanelProps) {
  function renderSection(title: string, items: GroceryListItem[], className: string) {
    if (!items.length) {
      return null;
    }

    return (
      <div className={`section-block grocery-section ${className}`}>
        <p className="subheading">{title}</p>
        <ul className="grocery-list weekly-grocery-list">
          {items.map((item) => (
            <li key={item.ingredientId}>
              <label className={checkedGroceries.includes(item.ingredientId) ? "grocery-check checked" : "grocery-check"}>
                <input
                  type="checkbox"
                  checked={checkedGroceries.includes(item.ingredientId)}
                  onChange={() => onToggleItem(item.ingredientId)}
                />
                <span>{item.ingredientName}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="panel active-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Shopping</p>
          <h2>{weekMode ? "Weekly grocery list" : "Grocery list"}</h2>
        </div>
        {hasGroceries ? (
          <button className="ghost-button" type="button" onClick={onResetChecks}>
            Reset checks
          </button>
        ) : null}
      </div>

      <PanelHero
        tone="groceries"
        kicker="Store mode"
        title="A cleaner shopping pass, not a spreadsheet"
        chips={weekMode ? ["weekly list", "checklist mode", "grouped by section"] : ["day list", "checklist mode", "grouped by section"]}
      />

      {hasGroceries ? (
        <>
          <p className="planner-note">
            {weekMode
              ? "Everything you need for your current 7-day plan, grouped for an easier shop."
              : "Your current grocery list, grouped for an easier shop."}
          </p>
          {renderSection("Fruits", groupedGroceries.fruits, "grocery-section-fruits")}
          {renderSection("Vegetables", groupedGroceries.vegetables, "grocery-section-vegetables")}
          {renderSection("Dry items", groupedGroceries.dry_items, "grocery-section-dry")}
        </>
      ) : (
        <div className="empty-state">Generate a day or week plan and your grocery list will appear here.</div>
      )}
    </section>
  );
}
