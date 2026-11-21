import { Clock, MapPin, Wallet } from 'lucide-react';
import type { FulfilmentPreference } from '../../types';

interface TradeoffSliderProps {
  value: FulfilmentPreference;
  onChange: (next: FulfilmentPreference) => void;
}

const OPTIONS: Array<{
  value: FulfilmentPreference;
  label: string;
  caption: string;
  Icon: typeof Wallet;
}> = [
  {
    value: 'SAVE_MONEY',
    label: 'Save Money',
    caption: 'Lowest total cost',
    Icon: Wallet,
  },
  {
    value: 'GET_IT_FASTER',
    label: 'Get It Faster',
    caption: 'Shortest readiness window',
    Icon: Clock,
  },
  {
    value: 'SHOP_NEARBY',
    label: 'Shop Nearby',
    caption: 'Closest eligible store',
    Icon: MapPin,
  },
];

export function TradeoffSlider({ value, onChange }: TradeoffSliderProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#1A2022]">Fulfilment Priority</span>
        <span className="text-xs text-[#526063]">Re-ranks eligible stores automatically</span>
      </div>
      <div
        role="radiogroup"
        aria-label="Fulfilment priority"
        className="grid grid-cols-3 gap-1.5 p-1 bg-[#F0F2F1] border border-[#E1E5E4] rounded-lg"
      >
        {OPTIONS.map(({ value: optValue, label, caption, Icon }) => {
          const active = value === optValue;
          return (
            <button
              key={optValue}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(optValue)}
              className={`flex flex-col items-start text-left px-3 py-2.5 rounded-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-[#264C4F] ${
                active
                  ? 'bg-white text-[#1A2022] shadow-xs border border-[#D4DAD8]'
                  : 'text-[#526063] hover:text-[#1A2022]'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#264C4F]' : 'text-[#526063]'}`}
                  aria-hidden="true"
                />
                {label}
              </span>
              <span className="text-[11px] text-[#526063] mt-0.5 truncate w-full">{caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
