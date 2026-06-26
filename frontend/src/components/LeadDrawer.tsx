import { useState, useEffect, useRef } from "react";
import type { Lead } from "../api/leads";
import * as leadsApi from "../api/leads";
import { useToast } from "../contexts/ToastContext";
import { extractError } from "../utils/error";

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (lead: Lead) => void;
}

const STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];

export default function LeadDrawer({ lead, open, onClose, onUpdated }: Props) {
  const { addToast } = useToast();
  const [status, setStatus] = useState(lead?.status ?? "new");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const originalRef = useRef<Lead | null>(null);

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNotes(lead.notes ?? "");
      originalRef.current = lead;
    }
  }, [lead]);

  async function handleSave() {
    if (!lead || !originalRef.current) return;
    setSaving(true);

    const original: Lead = originalRef.current;
    const optimistic: Lead = {
      ...original,
      status: status as any,
      notes: notes || null,
    } as Lead;
    onUpdated(optimistic);

    try {
      const updated = await leadsApi.updateLead(lead.id, {
        status,
        notes: notes || null,
      } as any);
      onUpdated(updated);
      addToast("Lead updated", "success");
      onClose();
    } catch (err: any) {
      onUpdated(original);
      setStatus(original.status);
      setNotes(original.notes ?? "");
      addToast(extractError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col bg-white shadow-xl sm:max-w-lg sm:rounded-l-3xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold sm:text-lg">
            {lead.first_name} {lead.last_name}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-gray-500">Email</span>
              <p className="font-medium">{lead.email}</p>
            </div>
            <div>
              <span className="text-gray-500">Phone</span>
              <p className="font-medium">{lead.phone}</p>
            </div>
            <div>
              <span className="text-gray-500">Company</span>
              <p className="font-medium">{lead.company || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Source</span>
              <p className="font-medium">{lead.source || "—"}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-4 py-4 justify-end sm:px-6">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
