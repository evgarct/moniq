import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef, useState } from "react";

import { DateRangePicker } from "@/components/ui/date-range-picker";

function DateRangePickerStory({
  initialOpen = false,
}: {
  initialOpen?: boolean;
}) {
  const [range, setRange] = useState({
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialOpen) {
      return;
    }

    const trigger = wrapperRef.current?.querySelector<HTMLButtonElement>("button");

    if (!trigger || trigger.getAttribute("aria-expanded") === "true") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      trigger.click();
    });

    return () => cancelAnimationFrame(frame);
  }, [initialOpen]);

  return (
    <div ref={wrapperRef} className="flex min-h-[520px] items-start justify-center bg-background px-8 py-10">
      <DateRangePicker
        startDate={range.startDate}
        endDate={range.endDate}
        defaultStartDate="2026-04-01"
        onChange={setRange}
        triggerAriaLabel="Date range"
        emptyLabel="This month"
        presets={{
          today: "Today",
          yesterday: "Yesterday",
          last7Days: "Last 7 days",
          last14Days: "Last 14 days",
          last30Days: "Last 30 days",
          thisWeek: "This week",
          lastWeek: "Last week",
          thisMonth: "This month",
          lastMonth: "Last month",
        }}
        initialOpen={initialOpen}
      />
    </div>
  );
}

const meta = {
  title: "Molecules/DateRangePicker",
  component: DateRangePickerStory,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DateRangePickerStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DateRangePickerStory />,
};

export const Open: Story = {
  render: () => <DateRangePickerStory initialOpen />,
};
