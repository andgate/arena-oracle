import { cn } from "@renderer/lib/utils"
import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

type ComboboxProps = {
  items: string[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  allowCustomValue?: boolean
}

export function Combobox({
  items,
  value,
  onValueChange,
  placeholder,
  emptyText = "No items found.",
  disabled = false,
  allowCustomValue = false,
}: ComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        if (!allowCustomValue) {
          setInputValue(value)
        }
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    return () => window.removeEventListener("mousedown", handlePointerDown)
  }, [allowCustomValue, value])

  const filteredItems = useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (!query) {
      return items
    }

    return items.filter((item) => item.toLowerCase().includes(query))
  }, [inputValue, items])

  const commitValue = (nextValue: string) => {
    onValueChange(nextValue)
    setInputValue(nextValue)
    setIsOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()

      if (filteredItems[0]) {
        commitValue(filteredItems[0])
        return
      }

      if (allowCustomValue && inputValue.trim()) {
        commitValue(inputValue.trim())
      }
    }

    if (event.key === "Escape") {
      setIsOpen(false)
      if (!allowCustomValue) {
        setInputValue(value)
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        value={inputValue}
        onChange={(event) => {
          const nextValue = event.target.value
          setInputValue(nextValue)
          setIsOpen(true)

          if (allowCustomValue) {
            onValueChange(nextValue)
          }
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!allowCustomValue) {
            window.setTimeout(() => setInputValue(value), 100)
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-xs/relaxed dark:bg-input/30",
        )}
      />

      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {filteredItems.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitValue(item)}
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted",
                  item === value && "bg-muted",
                )}
              >
                {item}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
