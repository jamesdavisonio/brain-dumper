# Due Date + Time Picker UI Design

## Proposed Design: Enhanced Calendar Popover

### Visual Design

```
┌─────────────────────────────────┐
│  Due Date                       │
│  ┌──────────────────────────┐   │
│  │  📅 Jan 9, 2026         │   │ ← Trigger button
│  └──────────────────────────┘   │
└─────────────────────────────────┘
         ↓ (Opens popover)
┌─────────────────────────────────┐
│  ┌────────────────────────────┐ │
│  │   January 2026        ◀ ▶ │ │
│  │  Su Mo Tu We Th Fr Sa     │ │
│  │            1  2  3  4     │ │
│  │   5  6  7  8 [9] 10 11    │ │
│  │  12 13 14 15 16 17 18     │ │
│  │  19 20 21 22 23 24 25     │ │
│  │  26 27 28 29 30 31        │ │
│  └────────────────────────────┘ │
│                                 │
│  ⏰ Time of day                 │
│  ┌────┬──────────┬──────────┐  │
│  │ 🌅 │   ☀️    │    🌙    │  │
│  │Morn│Afternoon│ Evening  │  │
│  └────┴──────────┴──────────┘  │
│                                 │
│  [Clear Date] [Set to Today]   │
└─────────────────────────────────┘
```

### Component Structure

```tsx
<DateTimePicker
  value={{ date: Date, timeOfDay: 'morning' | 'afternoon' | 'evening' | null }}
  onChange={(value) => void}
  placeholder="Select due date..."
/>
```

### Implementation Details

**Components to Create:**
1. `DateTimePicker.tsx` - Main component combining date + time-of-day
2. `TimeOfDaySelector.tsx` - Segmented control for morning/afternoon/evening

**Existing Components to Use:**
- `Calendar` (already exists at `/src/components/ui/calendar.tsx`)
- `Popover` (Radix UI already imported)
- `Button` (existing UI component)

### UX Flow

1. User clicks the date trigger button
2. Popover opens showing calendar
3. User selects a date from calendar
4. Date is highlighted, time-of-day selector activates below
5. User clicks morning/afternoon/evening (optional)
6. Clicking outside or selecting saves both date + time

### States

- **No date selected**: Time selector is disabled/grayed
- **Date selected, no time**: Time selector is active, none selected
- **Date + time selected**: Both are highlighted
- **Hover states**: Clear hover feedback on all interactive elements

### Accessibility

- Keyboard navigation: Tab between date → time buttons → actions
- ARIA labels: "Select due date", "Select time of day"
- Focus management: Proper focus trap in popover
- Screen reader: Announces selected date and time

### Styling (Tailwind + Radix)

- Use existing button variants from your UI library
- Time selector uses `grid grid-cols-3 gap-2` for equal spacing
- Selected state: `bg-primary text-primary-foreground`
- Hover state: `hover:bg-accent hover:text-accent-foreground`
- Icons: Use Lucide icons (Sunrise, Sun, Moon)

### Mobile Considerations

- Popover width: `min-w-[280px]` for calendar legibility
- Touch targets: Minimum 44px for time buttons
- Position: Auto-adjust if near screen edges
- Calendar: react-day-picker is already mobile-friendly

### Code Sketch

```tsx
interface DateTimeValue {
  date: Date | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | null;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date..."
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(!value?.date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.date ? (
            <>
              {format(value.date, "MMM d, yyyy")}
              {value.timeOfDay && ` • ${value.timeOfDay}`}
            </>
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value?.date}
          onSelect={(date) => onChange({ ...value, date })}
        />
        <div className="p-3 border-t">
          <TimeOfDaySelector
            value={value?.timeOfDay}
            onChange={(timeOfDay) => onChange({ ...value, timeOfDay })}
            disabled={!value?.date}
          />
        </div>
        <div className="flex gap-2 p-3 border-t">
          <Button variant="ghost" onClick={() => onChange({ date: null, timeOfDay: null })}>
            Clear
          </Button>
          <Button variant="ghost" onClick={() => onChange({ date: new Date(), timeOfDay: value?.timeOfDay })}>
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Integration Points

**Where to use:**
1. EditTaskDialog - Replace current due date picker
2. ApprovalScreen - For setting due dates on approved tasks
3. TaskCard - Quick edit popover (optional)

**Data mapping:**
- `dueDate` (Date) ← from calendar selection
- `scheduledTime` (string) ← map time-of-day to existing format

### Design Benefits

✅ Single interaction (one popover)
✅ Visual hierarchy (date first, time second)
✅ Consistent with existing patterns
✅ Mobile-friendly
✅ Accessible
✅ Progressive enhancement (date required, time optional)
✅ Uses existing components (Calendar, Popover)
