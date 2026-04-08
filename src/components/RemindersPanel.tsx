import { Reminder } from "../types";
import { formatDisplayDate } from "../lib/foodUtils";

type ReminderGroup = {
  date: string;
  items: Reminder[];
};

type RemindersPanelProps = {
  groupedReminders: ReminderGroup[];
};

export default function RemindersPanel({ groupedReminders }: RemindersPanelProps) {
  return (
    <section className="panel active-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Reminder flow</p>
          <h2>Soak reminders</h2>
        </div>
      </div>

      {groupedReminders.length ? (
        <div className="reminder-list">
          {groupedReminders.map((group) => (
            <details
              key={group.date}
              className="reminder-day-card"
              open={group.date === new Date().toISOString().slice(0, 10)}
            >
              <summary className="reminder-day-summary">
                <div>
                  <p className="section-kicker">Soak day</p>
                  <h3>{formatDisplayDate(group.date)}</h3>
                </div>
                <div className="week-day-meta">
                  <strong>
                    {group.items.length} item{group.items.length > 1 ? "s" : ""}
                  </strong>
                </div>
              </summary>

              <div className="reminder-group-list">
                {group.items.map((reminder) => (
                  <article key={reminder.id} className={`reminder-card ${reminder.type}`}>
                    <span className="reminder-tag">{reminder.type}</span>
                    <h3>{reminder.title}</h3>
                    <p>
                      For {formatDisplayDate(reminder.targetDate)} {reminder.linkedMealName}
                      {reminder.linkedIngredientName ? ` • ${reminder.linkedIngredientName}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="empty-state">Only meals that truly need overnight soaking will appear here.</div>
      )}
    </section>
  );
}
