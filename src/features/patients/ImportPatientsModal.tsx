import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { FileUpload } from "@/components/primitives/FileUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { patientService } from "@/services/patients/patient.service";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: number;
  errors: { row: number; message: string }[];
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

export const ImportPatientsModal = ({ open, onClose, onSuccess }: Props) => {
  const { t } = useI18n(["patients", "common"]);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      toast({
        title: t("common.error"),
        description: t("patients.importSection.fileTooLarge"),
        variant: "destructive",
      });
      return;
    }

    const isCsv =
      selected.type === "text/csv" || selected.name.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      toast({
        title: t("common.error"),
        description: t("patients.importSection.invalidFileType"),
        variant: "destructive",
      });
      return;
    }

    setFile(selected);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        toast({
          title: t("common.error"),
          description: t("patients.importSection.emptyFile"),
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      const headers = parseCsvLine(lines[0]).map((header) =>
        header.trim().toLowerCase(),
      );
      const requiredHeaders = ["full_name"];
      const missing = requiredHeaders.filter((header) => !headers.includes(header));

      if (missing.length > 0) {
        toast({
          title: t("common.error"),
          description: t("patients.importSection.missingColumns", {
            columns: missing.join(", "),
          }),
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      const errors: Array<{ row: number; message: string }> = [];
      let success = 0;
      const allowedBloodTypes = new Set([
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ]);

      const rows: Array<{ rowIndex: number; payload: any }> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row: Record<string, string | null> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || null;
        });

        if (!row.full_name) {
          errors.push({
            row: i + 1,
            message: t("patients.importSection.missingFullName"),
          });
          continue;
        }

        const genderRaw =
          typeof row.gender === "string" ? row.gender.trim().toLowerCase() : "";
        const gender =
          genderRaw === "male" || genderRaw === "female" ? genderRaw : null;

        const bloodTypeRaw =
          typeof row.blood_type === "string"
            ? row.blood_type.trim().toUpperCase()
            : "";
        const blood_type = allowedBloodTypes.has(bloodTypeRaw)
          ? bloodTypeRaw
          : null;

        rows.push({
          rowIndex: i + 1,
          payload: {
            full_name: row.full_name,
            date_of_birth: row.date_of_birth || null,
            gender,
            blood_type,
            phone: row.phone || null,
            email: row.email || null,
            address: row.address || null,
            insurance_provider: row.insurance_provider || null,
            status: "active",
          },
        });
      }

      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);

        for (const item of chunk) {
          try {
            await patientService.create(item.payload);
            success++;
          } catch (rowErr: any) {
            errors.push({
              row: item.rowIndex,
              message:
                rowErr?.message ?? t("patients.importSection.rowImportFailed"),
            });
          }
        }
      }

      setResult({ success, errors });

      if (success > 0) {
        onSuccess();
        toast({ title: t("patients.importSection.success", { count: success }) });
      }
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv =
      "full_name,date_of_birth,gender,blood_type,phone,email,address,insurance_provider\nJohn Doe,1985-03-15,male,A+,+1234567890,john@example.com,123 Main St,Insurance Co";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "patients-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("patients.importPatients")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("patients.importSection.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              {t("patients.importSection.description")}
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="w-full"
          >
            <Download className="h-4 w-4" /> {t("patients.downloadTemplate")}
          </Button>

          <FileUpload
            variant="dropzone"
            accept=".csv"
            onChange={handleFileChange}
            disabled={importing}
            loading={importing}
            fileName={file?.name}
            title={t("patients.selectCSVFile")}
            description={t("patients.clickToSelectFile")}
            icon={<Upload className="h-10 w-10 text-muted-foreground" />}
          />

          {result ? (
            <Alert variant={result.errors.length > 0 ? "destructive" : "default"}>
              {result.success > 0 ? <CheckCircle2 className="h-4 w-4" /> : null}
              {result.errors.length > 0 ? <AlertTriangle className="h-4 w-4" /> : null}
              <AlertDescription>
                {result.success > 0 ? (
                  <p className="font-medium">
                    {t("patients.importSection.success", {
                      count: result.success,
                    })}
                  </p>
                ) : null}

                {result.errors.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs">
                    <p className="font-medium">
                      {t("patients.importSection.errorsTitle")}:
                    </p>
                    {result.errors.slice(0, 5).map((error, index) => (
                      <p key={index}>
                        {t("patients.importSection.rowLabel", {
                          row: error.row,
                          message: error.message,
                        })}
                      </p>
                    ))}
                    {result.errors.length > 5 ? (
                      <p>
                        {t("patients.importSection.moreErrors", {
                          count: result.errors.length - 5,
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? t("common.loading") : t("patients.import")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
