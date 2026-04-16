import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/primitives/Button";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { InsuranceAssignableOwner, InsuranceClaimWithPatient, InsuranceClaimUpdateInput } from "@/domain/insurance/insurance.types";

interface ClaimFollowUpDialogProps {
  open: boolean;
  claim: InsuranceClaimWithPatient | null;
  owners: InsuranceAssignableOwner[];
  saving?: boolean;
  onClose: () => void;
  onSave: (input: InsuranceClaimUpdateInput) => Promise<void> | void;
}

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const ClaimFollowUpDialog = ({
  open,
  claim,
  owners,
  saving = false,
  onClose,
  onSave,
}: ClaimFollowUpDialogProps) => {
  const [assignedToUserId, setAssignedToUserId] = useState("unassigned");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [payerNotes, setPayerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    if (!claim) {
      setAssignedToUserId("unassigned");
      setNextFollowUpAt("");
      setPayerNotes("");
      setInternalNotes("");
      return;
    }

    setAssignedToUserId(claim.assigned_to_user_id ?? "unassigned");
    setNextFollowUpAt(toDateTimeLocal(claim.next_follow_up_at));
    setPayerNotes(claim.payer_notes ?? "");
    setInternalNotes(claim.internal_notes ?? "");
  }, [claim]);

  const ownerLabel = useMemo(() => {
    if (!claim?.assigned_profile?.full_name) return "Unassigned";
    return claim.assigned_profile.full_name;
  }, [claim?.assigned_profile?.full_name]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Claim follow-up</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {claim ? `${claim.provider} - ${claim.patients?.full_name ?? "-"}` : "Update ownership, payer notes, and next follow-up timing."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Assigned owner</Label>
              <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.user_id} value={owner.user_id}>
                      {owner.full_name} ({owner.role.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Current owner: {ownerLabel}</p>
            </div>
            <div className="space-y-2">
              <Label>Next follow-up</Label>
              <Input
                type="datetime-local"
                value={nextFollowUpAt}
                onChange={(event) => setNextFollowUpAt(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank if no callback or payer touchpoint is scheduled.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payer notes</Label>
            <Textarea
              rows={4}
              value={payerNotes}
              onChange={(event) => setPayerNotes(event.target.value)}
              placeholder="Called payer, requested corrected ICD code, waiting on EOB image, etc."
            />
          </div>
          <div className="space-y-2">
            <Label>Internal notes</Label>
            <Textarea
              rows={4}
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              placeholder="Front-desk handoff, coding correction needed, doctor signature pending, etc."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave({
              assigned_to_user_id: assignedToUserId === "unassigned" ? null : assignedToUserId,
              next_follow_up_at: fromDateTimeLocal(nextFollowUpAt),
              payer_notes,
              internal_notes,
              last_follow_up_at: new Date().toISOString(),
            })}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save follow-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
