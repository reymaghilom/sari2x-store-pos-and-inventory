import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { formatStoredDate, localDateFromStorage, localDateToStorage, startOfLocalToday } from '@/utils/date';

export function DateField({ label, value, onChange, error }: { label: string; value?: string; onChange: (value: string) => void; error?: string }) {
  const { colorScheme, colors } = useAppearance();
  const styles = useStyles();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const minimumDate = startOfLocalToday();
  const selectedDate = localDateFromStorage(value) ?? minimumDate;
  const select = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') return date && onChange(localDateToStorage(date));
    if (date) onChange(localDateToStorage(date));
  };
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: selectedDate < minimumDate ? minimumDate : selectedDate, minimumDate, mode: 'date', display: 'calendar', initialInputMode: 'default', onChange: select });
    } else setShowIosPicker((current) => !current);
  };

  return <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${value ? formatStoredDate(value) : 'No date selected'}`} onPress={open} style={({ pressed }) => [styles.field, error && styles.fieldError, pressed && styles.pressed]}>
      <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatStoredDate(value) : 'Select due date'}</Text>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
    </Pressable>
    {showIosPicker ? <DateTimePicker value={selectedDate < minimumDate ? minimumDate : selectedDate} minimumDate={minimumDate} mode="date" display="inline" themeVariant={colorScheme} accentColor={colors.primary} onChange={select} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const useStyles = createThemedStyles((colors) => ({
  group: { gap: spacing.sm },
  label: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  fieldError: { borderColor: colors.danger, borderWidth: 2, backgroundColor: colors.dangerSoft },
  value: { flex: 1, color: colors.text, fontSize: typography.body },
  placeholder: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: typography.bodySmall },
  pressed: { opacity: 0.72 },
}));
