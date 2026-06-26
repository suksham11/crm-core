import { useState, useCallback } from "react";
import { useDebounce } from "../hooks/useDebounce";

interface Props {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search leads...",
}: Props) {
  const [value, setValue] = useState("");

  const debouncedSearch = useDebounce((q: string) => {
    onSearch(q);
  }, 300);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      debouncedSearch(v);
    },
    [debouncedSearch],
  );

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:text-sm"
    />
  );
}
