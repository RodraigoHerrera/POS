
import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';
import 'flatpickr/dist/flatpickr.css';
import Label from './Label';
import { CalenderIcon } from '../../icons';
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  /** Controlled value: when it changes the picker is updated without firing onChange. Empty clears it. */
  value?: DateOption | DateOption[];
  label?: string;
  placeholder?: string;
  /** Render the calendar inside the input wrapper (always below). Use false outside modals so it flips to fit the viewport. */
  staticPosition?: boolean;
};

const fechasDe = (value: PropsType["value"]) =>
  (Array.isArray(value) ? value : [value]).filter((v): v is DateOption => v !== "" && v != null);

const claveValor = (value: PropsType["value"]) => fechasDe(value).map(String).join("|");

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  value,
  placeholder,
  staticPosition = true,
}: PropsType) {
  const instanceRef = useRef<flatpickr.Instance | null>(null);
  // Refs keep the latest props without re-creating flatpickr on every render
  // (an inline onChange would otherwise destroy it mid-selection).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const flatPickr = flatpickr(`#${id}`, {
      mode: mode || "single",
      static: staticPosition,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      locale: Spanish,
      defaultDate: valueRef.current === undefined ? defaultDate : fechasDe(valueRef.current),
      onChange: (selectedDates, dateStr, instance) => {
        const handlers = onChangeRef.current;
        if (!handlers) return;
        (Array.isArray(handlers) ? handlers : [handlers]).forEach((h) => h(selectedDates, dateStr, instance));
      },
    });
    instanceRef.current = Array.isArray(flatPickr) ? null : flatPickr;

    return () => {
      if (!Array.isArray(flatPickr)) {
        flatPickr.destroy();
      }
      instanceRef.current = null;
    };
  }, [mode, id, defaultDate, staticPosition]);

  const clave = claveValor(value);
  useEffect(() => {
    const instance = instanceRef.current;
    const actual = valueRef.current;
    if (!instance || actual === undefined) return;
    const fechas = fechasDe(actual);
    if (fechas.length === 0) instance.clear(false);
    else instance.setDate(fechas, false);
  }, [clave]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800"
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
