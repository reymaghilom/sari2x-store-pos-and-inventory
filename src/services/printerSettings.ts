import { getLocalSetting, setLocalSetting } from '@/database/repositories/settings';

export type PaperWidth = '58mm' | '80mm';
export type PrinterSettings = {
  selectedId: string | null;
  selectedName: string | null;
  paperWidth: PaperWidth;
  autoCut: boolean;
  autoPrint: boolean;
};

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const [selectedId, selectedName, paperWidth, autoCut, autoPrint] = await Promise.all([
    getLocalSetting('printer_selected_id'), getLocalSetting('printer_selected_name'), getLocalSetting('printer_paper_width'),
    getLocalSetting('printer_auto_cut'), getLocalSetting('printer_auto_print'),
  ]);
  return { selectedId: selectedId || null, selectedName: selectedName || null, paperWidth: paperWidth === '80mm' ? '80mm' : '58mm', autoCut: autoCut !== '0', autoPrint: autoPrint === '1' };
}

export async function saveSelectedPrinter(id: string, name: string) {
  await Promise.all([setLocalSetting('printer_selected_id', id), setLocalSetting('printer_selected_name', name)]);
}
export async function forgetSelectedPrinter() {
  await Promise.all([setLocalSetting('printer_selected_id', ''), setLocalSetting('printer_selected_name', '')]);
}
export async function setPrinterPaperWidth(value: PaperWidth) { await setLocalSetting('printer_paper_width', value); }
export async function setPrinterAutoCut(value: boolean) { await setLocalSetting('printer_auto_cut', value ? '1' : '0'); }
export async function setPrinterAutoPrint(value: boolean) { await setLocalSetting('printer_auto_print', value ? '1' : '0'); }
