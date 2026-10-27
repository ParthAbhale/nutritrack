import { NUTRIENT_KEYS, NUTRIENT_META, macroCalories, type NutrientValues } from '@nutritrack/shared';
import { formatNutrient } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Full nutrient list; unknown values are shown as "Not reported", never 0. */
export function NutritionTable({ nutrients, className, caption }: { nutrients: NutrientValues; className?: string; caption?: string }) {
  const mc = macroCalories(nutrients);
  const label = nutrients.calories;
  const diff = label !== null && mc.total > 0 ? Math.abs(mc.total - label) / Math.max(label, 1) : 0;
  return (
    <div className={className}>
      <table className="w-full text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <tbody className="divide-y divide-line">
          {NUTRIENT_KEYS.map((k) => (
            <tr key={k} className={cn(k === 'calories' && 'font-semibold')}>
              <th scope="row" className={cn('py-1.5 text-left font-normal text-muted', (k === 'saturatedFat' || k === 'sugars') && 'pl-3')}>
                {NUTRIENT_META[k].label}
              </th>
              <td className="py-1.5 text-right tabular text-ink">
                {nutrients[k] === null ? <span className="text-subtle">Not reported</span> : `${formatNutrient(nutrients[k], k)} ${NUTRIENT_META[k].unit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {diff > 0.1 && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Macros account for ~{Math.round(mc.total)} kcal vs {Math.round(label!)} kcal listed. Labels differ from 4/4/9 kcal-per-gram estimates because of rounding, fiber, sugar alcohols, alcohol and source data.
        </p>
      )}
    </div>
  );
}
