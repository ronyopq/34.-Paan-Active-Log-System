"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { normalizeText } from "@/lib/format";

export type SearchableOption = {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
  emptyMessage?: string;
  onCommitCustomValue?: (value: string) => void;
};

const getNextEnabledIndex = (options: SearchableOption[], startIndex: number, direction: 1 | -1) => {
  if (!options.length) return -1;

  let cursor = startIndex;
  for (let attempt = 0; attempt < options.length; attempt += 1) {
    cursor = (cursor + direction + options.length) % options.length;
    if (!options[cursor]?.disabled) return cursor;
  }

  return -1;
};

export const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  allowCustomValue = false,
  emptyMessage = "No result found",
  onCommitCustomValue
}: SearchableSelectProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = options.find((option) => option.value === value) || null;

  useEffect(() => {
    setQuery(selectedOption?.label || value || "");
  }, [selectedOption, value]);

  const filteredOptions = useMemo(() => {
    const needle = normalizeText(query);
    return !needle
      ? options
      : options.filter((option) =>
          normalizeText(`${option.label} ${option.value} ${option.hint || ""}`).includes(needle)
        );
  }, [options, query]);

  useEffect(() => {
    const firstEnabledIndex = filteredOptions.findIndex((option) => !option.disabled);
    if (firstEnabledIndex < 0) {
      if (activeIndex !== 0) setActiveIndex(0);
      return;
    }
    if (activeIndex < 0 || activeIndex >= filteredOptions.length || filteredOptions[activeIndex]?.disabled) {
      setActiveIndex(firstEnabledIndex);
    }
  }, [activeIndex, filteredOptions]);

  const closeMenu = (preserveSelection: boolean) => {
    if (preserveSelection) {
      setQuery(selectedOption?.label || value || "");
    }
    setOpen(false);
  };

  const commitCustomValue = () => {
    if (!allowCustomValue) {
      closeMenu(true);
      return;
    }

    const nextValue = query.trim();
    onChange(nextValue);
    if (nextValue) {
      onCommitCustomValue?.(nextValue);
    }
    setOpen(false);
  };

  const commitOption = (option: SearchableOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        if (open) {
          if (allowCustomValue) {
            const nextValue = query.trim();
            onChange(nextValue);
            if (nextValue) {
              onCommitCustomValue?.(nextValue);
            }
            setOpen(false);
          } else {
            setQuery(selectedOption?.label || value || "");
            setOpen(false);
          }
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [allowCustomValue, onChange, onCommitCustomValue, open, query, selectedOption, value]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => getNextEnabledIndex(filteredOptions, current, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => getNextEnabledIndex(filteredOptions, current, -1));
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (open && option && !option.disabled) {
        commitOption(option);
        return;
      }
      commitCustomValue();
    }
  };

  return (
    <div
      ref={rootRef}
      className={clsx("search-select", open && "open", disabled && "disabled")}
      onFocusCapture={() => {
        if (!disabled) setOpen(true);
      }}
    >
      <div className="search-select-control">
        <input
          ref={inputRef}
          className="form-control premium-input search-select-input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            if (allowCustomValue && !event.target.value.trim()) {
              onChange("");
            }
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="search-select-toggle"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          aria-label="Toggle options"
        >
          <i className={clsx("bi", open ? "bi-chevron-up" : "bi-chevron-down")} />
        </button>
      </div>

      {open && (
        <div id={listboxId} className="search-select-menu" role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                className={clsx(
                  "search-select-option",
                  option.value === value && "selected",
                  index === activeIndex && "active",
                  option.disabled && "disabled"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitOption(option);
                }}
              >
                <span>{option.label}</span>
                {option.hint && <small>{option.hint}</small>}
              </button>
            ))
          ) : (
            <div className="search-select-empty">
              {allowCustomValue && query.trim()
                ? `Press Enter to use "${query.trim()}"`
                : emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
